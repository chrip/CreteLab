"""Compare Opus 5.5 blind labels (verify/opus_*.json) with the Qwen majority vote."""
import json
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent
Q = json.loads((HERE.parent.parent / "questions.json").read_text())
qwen = json.loads((HERE / "qwen_majority.json").read_text())
opus = {}
for p in sorted(HERE.glob("opus_*.json")):
    opus.update(json.loads(p.read_text()))

agree, total = defaultdict(int), defaultdict(int)
split_agree, split_total = 0, 0
disagreements = []
for i, row in qwen.items():
    if i not in opus:
        continue
    for q in Q:
        if q not in row["qwen"] or q not in opus[i]:
            continue
        mv = row["qwen"][q]
        same = mv["value"] == opus[i][q]
        total[q] += 1
        agree[q] += same
        unanimous = mv["votes"] == mv["of"]
        if not unanimous:
            split_total += 1
            split_agree += same
        if not same:
            disagreements.append((i, q, mv, opus[i][q], row["text"], opus[i].get("note", "")))

n = len([i for i in qwen if i in opus])
print(f"samples compared: {n}\n")
print(f"{'question':<14} agreement")
for q in Q:
    print(f"{q:<14} {agree[q] / total[q]:.0%}  ({agree[q]}/{total[q]})")
a, t = sum(agree.values()), sum(total.values())
print(f"{'overall':<14} {a / t:.1%}  ({a}/{t})")
print(f"when Qwen's 5 votes were unanimous: {(a - split_agree) / (t - split_total):.1%}  "
      f"| when split: {split_agree / max(1, split_total):.1%} ({split_total} answers)")
json.dump([dict(id=i, q=q, qwen=mv, opus=o, text=tx, note=nt) for i, q, mv, o, tx, nt in disagreements],
          open(HERE / "disagreements.json", "w"), ensure_ascii=False, indent=1)
print(f"\n{len(disagreements)} disagreements -> verify/disagreements.json")
