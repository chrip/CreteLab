"""Score a Laya checkpoint on the hand-labelled descriptions in eval_handwritten.jsonl.

    python evaluate.py                                  # base multilingual checkpoint
    python evaluate.py --model ../models/laya-crete      # fine-tuned checkpoint
"""

import argparse
import json
import warnings
from collections import defaultdict
from pathlib import Path

import laya
import sys
# Questions and measurement candidates are shared with the API, so training and
# inference see exactly the same inputs.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "api" / "src"))
from cretelab_api.measurements import role_candidates, role_question  # noqa: E402

HERE = Path(__file__).parent
from cretelab_api.measurements import QUESTIONS  # noqa: E402


def predicted(qid, ans):
    t = "choice" if qid.startswith("role:") else QUESTIONS[qid]["type"]
    if t == "noul":
        return ans["noul"] >= 0.5
    if t == "score":
        return round(ans["score"])
    return ans["choice"]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--model", help="local checkpoint dir; default is the base multilingual checkpoint")
    p.add_argument("--show-errors", action="store_true")
    p.add_argument("--file", default="eval_handwritten.jsonl", help="hand-labelled set in ml/")
    args = p.parse_args()
    warnings.filterwarnings("ignore")

    agent = laya.Agent(args.model) if args.model else laya.load("convaiinnovations/laya", subfolder="multilingual")
    rows = [json.loads(l) for l in (HERE / args.file).open()]
    hits, total = defaultdict(int), defaultdict(int)
    perfect = 0
    for row in rows:
        questions = {**QUESTIONS, **{f"role:{c}": role_question(c) for c in role_candidates(row["text"])}}
        answers = agent.predict({"description": row["text"]}, questions)["answers"]
        wrong = []
        for qid, gold in row["labels"].items():
            if gold is None:
                continue
            if qid not in answers:
                continue
            got = predicted(qid, answers[qid])
            key = "roles" if qid.startswith("role:") else qid
            total[key] += 1
            if got == gold:
                hits[key] += 1
            else:
                wrong.append(f"{qid}={got} (gold {gold})")
        perfect += not wrong
        if args.show_errors and wrong:
            print(f"  {row['text'][:60]:<60} {', '.join(wrong)}")

    print(f"\n{'question':<14} accuracy")
    for qid in [*QUESTIONS, "roles"]:
        if total[qid]:
            print(f"{qid:<16} {hits[qid] / total[qid]:.0%}  ({hits[qid]}/{total[qid]})")
    all_hits, all_total = sum(hits.values()), sum(total.values())
    print(f"{'overall':<14} {all_hits / all_total:.1%}  ({all_hits}/{all_total})")
    print(f"{'all facts ok':<14} {perfect}/{len(rows)} descriptions")


if __name__ == "__main__":
    main()
