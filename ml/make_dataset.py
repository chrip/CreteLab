"""Build the Laya training set for the describe-search box with a local LLM as teacher.

Step 1 (generate): the LLM writes short project descriptions, the way a DIY user or a
small contractor would type them into a search box.
Step 2 (label): the LLM answers every question in ../questions.json for each description,
VOTES times at temperature > 0. The vote shares become Laya's soft targets.

Both steps append to JSONL files and skip work already on disk, so the script can be
stopped and restarted.

    python make_dataset.py --base-url http://localhost:8000/v1 --model qwen3.8-27b
    python make_dataset.py --step generate --scenarios diy          # add DIY descriptions
    python make_dataset.py --step label --questions fine_cast --votes-file votes_fine_cast.jsonl
"""

import argparse
import asyncio
import json
import random
import re
from collections import defaultdict
from pathlib import Path

import httpx

import sys
# Questions and measurement candidates are shared with the API, so training and
# inference see exactly the same inputs.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "api" / "src"))
from cretelab_api.measurements import ROLE_TEMPLATE, role_candidates  # noqa: E402

HERE = Path(__file__).parent
from cretelab_api.measurements import QUESTIONS  # noqa: E402
DATA = HERE / "data"

SCENARIOS = [
    "shed or garden house foundation", "fence posts", "carport base slab", "garage floor",
    "driveway", "garden path", "terrace", "basement floor inside the house",
    "basement walls in groundwater", "retaining wall in the garden", "garden wall",
    "outdoor stairs", "indoor stairs", "strip foundation for a house extension",
    "pad footing for a pergola or a column", "machine foundation in a workshop",
    "industrial hall floor with forklifts", "farm yard or silo base", "pond or swimming pool",
    "rain water tank", "planters and decorative casts", "bench or table cast in concrete",
    "parking lot", "floor slab of a new house", "ceiling slab", "concrete column",
    "curbs or edging stones", "manhole or shaft", "slab for a garden pavilion",
    "base for a heat pump or air conditioner", "trampoline or flagpole anchor",
    "loading ramp", "workshop floor", "balcony slab", "window sill or lintel",
]

# DIY pieces cast from fine mortar (the fine_cast question); --scenarios diy.
DIY_SCENARIOS = [
    "concrete table top or coffee table", "kitchen or bathroom countertop", "concrete sink or washbasin",
    "flower pot or planter for the balcony or terrace", "large planter for the garden",
    "fruit bowl, tray or decorative bowl", "lamp base or pendant lamp", "candle holder or tealight holder",
    "coasters, soap dish or small decor", "bookends, vase or figurine", "stool or side table",
    "garden bench seat", "fire bowl or fire table", "wall panels or tiles", "shelf or log holder",
]

# Ready-mix bag from the DIY store plus additions (the fine-tune page); --scenarios bagged.
BAGGED_SCENARIOS = [
    "planter or plant bowl from a bag of ready-mix concrete with a waterproofer",
    "fence posts set with bagged quick-set concrete from the DIY store",
    "small garden path or stepping stones from bagged concrete mix",
    "shed or pergola foundation from a few bags of ready-mix, a little extra cement",
    "bird bath or garden ornament from ready-mixed concrete, frost-proof",
    "repairing steps or a threshold with bagged repair concrete",
    "table top or bench from bagged concrete, made stronger with extra cement",
    "small pond or water feature from bagged concrete with sealing admixture",
    "anchor or base for a letterbox, swing or clothes line from a bag of concrete",
    "outdoor fire pit ring from bagged concrete",
]

# Pieces whose size is given in many ways (volume from shape and roles); --scenarios shapes.
SHAPE_SCENARIOS = [
    "round planter or pot with diameter, height and wall thickness",
    "square or rectangular planter or trough with outer size and wall thickness",
    "hollow seat cube or stool with edge length and wall thickness",
    "concrete ring, pipe section or frame open at both ends",
    "bowl or dish with diameter and wall thickness",
    "several identical post holes or point foundations with their size",
    "round column or post with diameter and height",
    "slab or table top with length, width and thickness written in words",
    "solid block or step with length, width and height",
    "sizes given with words like Seitenlänge, Kante, Durchmesser, Wandstärke, lang, breit, hoch",
]


def build_generate_prompt(scenario: str, lang: str, n: int) -> str:
    diy = scenario in DIY_SCENARIOS or scenario in BAGGED_SCENARIOS or scenario in SHAPE_SCENARIOS
    language = "German" if lang == "de" else "English"
    return f"""Write {n} different short project descriptions that a person might type into a
concrete recipe calculator's search box. Topic: {scenario}.

Rules:
- Write in {language}.
- Vary the style: some one-liners with a few keywords, some full sentences, some colloquial,
  a few with small typos.
- Vary the details: sometimes mention dimensions (for example {'"60x40x3 cm", "wall 2 cm"' if diy else '"3x2 m, 20 cm thick"'}), sometimes
  a volume ({'"5 Liter", "20 kg"' if diy else '"2 m³", "halber Kubik"'}), often no size at all.
- Vary indoor/outdoor, frost, de-icing salt, groundwater, loads, reinforcement where it fits.
  Do not always state these explicitly; leave some to be inferred.

Reply with only a JSON array of {n} strings."""


def build_label_prompt(descriptions: list[str], qids: list[str], roles: bool = False) -> str:
    qs = {qid: dict(QUESTIONS[qid]) for qid in qids}
    items = {str(i): d for i, d in enumerate(descriptions)}
    role_part = ""
    if roles:
        cands = {str(i): role_candidates(d) for i, d in enumerate(descriptions)}
        role_part = f"""

Also give "roles": for each measurement listed below for a description, what it gives, as one of
{json.dumps(ROLE_TEMPLATE["criteria"], ensure_ascii=False)}
("#2" marks the second occurrence of the same value.) Measurements per description:
{json.dumps(cands, ensure_ascii=False)}"""
    return f"""You are a concrete engineer. For each project description, answer every question.
Infer what is typical when the description does not say it (a driveway in Germany gets frost
and de-icing salt; a basement floor inside a house is dry; fence posts sit in the ground).

- noul questions: answer true or false.
- score questions: answer the level index, starting at 0.
- choice questions: answer the option key.

Questions:
{json.dumps(qs, ensure_ascii=False, indent=1)}

Descriptions:
{json.dumps(items, ensure_ascii=False, indent=1)}{role_part}

Reply with only a JSON object that maps each description number to an object of
question id -> answer{' (plus "roles": measurement -> role)' if roles else ''}."""


def extract_json(text: str):
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    start = min(i for i in (text.find("{"), text.find("[")) if i >= 0)
    return json.loads(text[start:])


async def chat(client, args, prompt, temperature):
    r = await client.post(
        f"{args.base_url}/chat/completions",
        json={
            "model": args.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": 8000,
            "chat_template_kwargs": {"reasoning_effort": "low"},
        },
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


async def generate(client, args, sem):
    out = DATA / "descriptions.jsonl"
    done = {json.loads(l)["job"] for l in out.open()} if out.exists() else set()
    scenarios = {"diy": DIY_SCENARIOS, "bagged": BAGGED_SCENARIOS, "shapes": SHAPE_SCENARIOS}.get(args.scenarios, SCENARIOS)
    jobs = [(s, lang, rep) for s in scenarios for lang in ("de", "de", "en") for rep in range(args.rounds)]
    jobs = [(s, lang, rep, f"{s}|{lang}|{i}") for i, (s, lang, rep) in enumerate(jobs)]

    async def run(scenario, lang, rep, job):
        if job in done:
            return
        async with sem:
            for _ in range(3):
                try:
                    texts = extract_json(await chat(client, args, build_generate_prompt(scenario, lang, 10), 1.0))
                    break
                except Exception as e:  # malformed JSON or a timeout; retry
                    print("generate retry:", job, e)
            else:
                return
        with out.open("a") as f:
            for t in texts:
                if isinstance(t, str) and t.strip():
                    f.write(json.dumps({"job": job, "scenario": scenario, "lang": lang, "text": t.strip()}, ensure_ascii=False) + "\n")
        print("generated", job)

    await asyncio.gather(*(run(*j) for j in jobs))


def valid_answer(qid, value):
    q = QUESTIONS[qid]
    if q["type"] == "noul":
        return isinstance(value, bool)
    if q["type"] == "score":
        return isinstance(value, int) and 0 <= value < len(q["criteria"])
    return value in q["criteria"]


async def label(client, args, sem):
    """Label every description until it has --votes votes for the chosen questions.

    Resumes per description (not per batch), so descriptions can be added between runs.
    """
    qids = args.questions.split(",") if args.questions else list(QUESTIONS)
    roles = "roles" in qids
    qids = [q for q in qids if q != "roles"]
    rows = [json.loads(l) for l in (DATA / "descriptions.jsonl").open()]
    if args.label_scenarios:
        groups = {"site": SCENARIOS, "diy": DIY_SCENARIOS, "bagged": BAGGED_SCENARIOS, "shapes": SHAPE_SCENARIOS}
        keep = {s for g in args.label_scenarios.split(",") for s in groups[g]}
        rows = [r for r in rows if r["scenario"] in keep]
    texts = list(dict.fromkeys(r["text"] for r in rows))
    random.Random(7).shuffle(texts)
    out = DATA / args.votes_file
    have = defaultdict(int)
    if out.exists():
        for l in out.open():
            have[json.loads(l)["text"]] += 1

    async def run(batch, vote):
        async with sem:
            for _ in range(3):
                try:
                    answers = extract_json(await chat(client, args, build_label_prompt(batch, qids, roles), 0.8))
                    break
                except Exception as e:
                    print("label retry:", vote, e)
            else:
                return
        with out.open("a") as f:
            for i, text in enumerate(batch):
                a = answers.get(str(i), {})
                clean = {q: v for q, v in a.items() if q in qids and valid_answer(q, v)}
                if roles:
                    got = a.get("roles") or {}
                    for c in role_candidates(text):
                        if got.get(c) in ROLE_TEMPLATE["criteria"]:
                            clean[f"role:{c}"] = got[c]
                f.write(json.dumps({"vote": vote, "text": text, "answers": clean}, ensure_ascii=False) + "\n")
        print(f"labelled {len(batch)} descriptions, vote {vote}")

    jobs = []
    for vote in range(args.votes):
        todo = [t for t in texts if have[t] <= vote]
        jobs += [run(todo[i:i + args.batch_size], vote) for i in range(0, len(todo), args.batch_size)]
    await asyncio.gather(*jobs)


async def main():
    p = argparse.ArgumentParser()
    p.add_argument("--base-url", default="http://localhost:8000/v1")
    p.add_argument("--model", default="qwen3.8-27b")
    p.add_argument("--concurrency", type=int, default=8)
    p.add_argument("--rounds", type=int, default=1, help="generation calls per scenario and language slot")
    p.add_argument("--votes", type=int, default=5)
    p.add_argument("--step", choices=["generate", "label", "all"], default="all")
    p.add_argument("--scenarios", choices=["site", "diy", "bagged", "shapes"], default="site", help="which topic list to generate")
    p.add_argument("--questions", help="comma-separated question ids to label (default: all)")
    p.add_argument("--votes-file", default="votes.jsonl", help="file in data/ to append votes to")
    p.add_argument("--label-scenarios", help="only label descriptions of these groups: site,diy,bagged,shapes")
    p.add_argument("--batch-size", type=int, default=10, help="descriptions per labelling call")
    args = p.parse_args()
    DATA.mkdir(exist_ok=True)
    sem = asyncio.Semaphore(args.concurrency)
    async with httpx.AsyncClient(timeout=900) as client:
        if args.step in ("generate", "all"):
            await generate(client, args, sem)
        if args.step in ("label", "all"):
            await label(client, args, sem)


if __name__ == "__main__":
    asyncio.run(main())
