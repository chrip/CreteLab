"""Compare a checkpoint on the CPU in float32 and with int8 dynamic quantization (Q8).

Every Linear layer of the encoder and the decision head gets int8 weights; activations are
quantized on the fly. Reports accuracy on the hand-labelled sets and time per description.

    python quantize.py --model ../models/laya-crete-v4 --threads 2
"""

import argparse
import json
import sys
import time
import warnings
from collections import defaultdict
from pathlib import Path

import laya
import torch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "services" / "api" / "src"))
from cretelab_api.measurements import QUESTIONS, role_candidates, role_question  # noqa: E402
from evaluate import predicted  # noqa: E402

HERE = Path(__file__).parent
SETS = ["eval_handwritten.jsonl", "eval_objects.jsonl", "eval_pro.jsonl"]


def score(agent, rows):
    hits = total = 0
    per = defaultdict(lambda: [0, 0])
    seconds = 0.0
    for row in rows:
        questions = {**QUESTIONS, **{f"role:{c}": role_question(c) for c in role_candidates(row["text"])}}
        t = time.perf_counter()
        answers = agent.predict({"description": row["text"]}, questions)["answers"]
        seconds += time.perf_counter() - t
        for qid, gold in row["labels"].items():
            if gold is None or qid not in answers:
                continue
            key = "roles" if qid.startswith("role:") else qid
            ok = predicted(qid, answers[qid]) == gold
            hits += ok
            total += 1
            per[key][0] += ok
            per[key][1] += 1
    return hits / total, seconds / len(rows), per


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--model", default=str(HERE.parent / "models" / "laya-crete"))
    p.add_argument("--threads", type=int, default=2, help="CPU threads (the server has 2 vCores)")
    args = p.parse_args()
    warnings.filterwarnings("ignore")
    torch.set_num_threads(args.threads)

    sets = {f: [json.loads(line) for line in (HERE / f).open()] for f in SETS if (HERE / f).exists()}
    results = {}
    for name in ("float32", "int8"):
        agent = laya.Agent(args.model, device="cpu")
        if name == "int8":
            agent.model = torch.ao.quantization.quantize_dynamic(agent.model, {torch.nn.Linear}, dtype=torch.qint8)
        agent.predict({"description": "Kellerwand 20 cm"}, QUESTIONS)  # warm-up
        results[name] = {f: score(agent, rows) for f, rows in sets.items()}

    print(f"model {args.model}, {args.threads} CPU threads\n")
    print(f"{'set':<24}{'float32':>16}{'int8':>16}")
    for f in sets:
        a32, s32, _ = results["float32"][f]
        a8, s8, _ = results["int8"][f]
        print(f"{f:<24}{a32:>9.1%} {s32:>4.1f} s{a8:>9.1%} {s8:>4.1f} s")
    print("\nper question (all sets), float32 → int8:")
    keys = sorted({k for r in results.values() for _, _, per in r.values() for k in per})
    for k in keys:
        h32 = sum(results["float32"][f][2][k][0] for f in sets)
        h8 = sum(results["int8"][f][2][k][0] for f in sets)
        n = sum(results["float32"][f][2][k][1] for f in sets)
        flag = "  <-" if h8 != h32 else ""
        print(f"  {k:<16} {h32}/{n} → {h8}/{n}{flag}")


if __name__ == "__main__":
    main()
