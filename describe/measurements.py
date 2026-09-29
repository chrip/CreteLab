"""Find the measurements in a description: the candidates whose role Laya decides.

Shared by the training data (ml/make_dataset.py, ml/train.py, ml/evaluate.py) and the
server, so training and inference see exactly the same candidates. The browser reads
a candidate's number and unit back from its text (js/lib/volume.js).
"""

import json
import re
from pathlib import Path

NUM = r"(\d+(?:[.,]\d+)?)"
UNIT = r"(mm|cm|dm|m²|m2|qm|m³|m3|cbm|kubik|liter|litre|l|m)"
# counts, also in compounds and other cases: "12 Zaunpfosten", "4 Löcher", "2 Säcken", "6 Punktfundamente"
COUNT = (r"([a-zäöüß]*(?:stück|stk|stck|pcs|pieces|posts?|pfosten|säcke?n?|bags?|löcher[n]?|holes?|"
         r"fundamente?|platten?|steine?|stufen?|slabs?|steps?|blocks?|blöcke?))")

# "3x2 m", "40x40x80 cm", "40 cm x 40 cm" describe themselves (length × width [× height]):
# one candidate, no role question. Without a unit, values from 10 up are read as cm.
LEN_U = r"(mm|cm|m)"
DIMS = re.compile(NUM + r"\s*" + LEN_U + r"?\s*[x×*]\s*" + NUM + r"\s*" + LEN_U + r"?"
                  r"(?:\s*[x×*]\s*" + NUM + r"\s*" + LEN_U + r"?)?(?![a-zäöüß\d])", re.I)
SINGLE = re.compile(NUM + r"\s*" + UNIT + r"(?![a-zäöüß])", re.I)
COUNTS = re.compile(NUM + r"\s*" + COUNT + r"\b", re.I)


def dims_unit(m) -> str:
    unit = m.group(6) or m.group(4) or m.group(2)
    if unit:
        return unit.lower()
    values = [float(g.replace(",", ".")) for g in m.group(1, 3, 5) if g]
    return "cm" if min(values) >= 10 else "m"

ROLE_TEMPLATE = json.loads((Path(__file__).parent / "role_question.json").read_text())
MAX_CANDIDATES = 6


def extract(text: str) -> list[str]:
    """Candidate measurements in reading order, e.g. ['90 cm', '2 cm'] or ['3x2 m', '20 cm'].

    A repeated single value gets a suffix ("40 cm", "40 cm #2") so each one has its own role.
    """
    found, taken = [], []

    def add(start, end, label):
        if any(s < end and start < e for s, e in taken):
            return
        taken.append((start, end))
        found.append((start, label))

    for m in DIMS.finditer(text):
        sizes = "x".join(g for g in m.group(1, 3, 5) if g)
        add(m.start(), m.end(), f"{sizes} {dims_unit(m)}")
    for m in COUNTS.finditer(text):
        add(m.start(), m.end(), f"{m.group(1)} {m.group(2).lower()}")
    for m in SINGLE.finditer(text):
        add(m.start(), m.end(), f"{m.group(1)} {m.group(2).lower()}")
    labels, seen = [], {}
    for _, label in sorted(found):
        seen[label] = seen.get(label, 0) + 1
        labels.append(label if seen[label] == 1 else f"{label} #{seen[label]}")
    return labels[:MAX_CANDIDATES]


def is_dims(candidate: str) -> bool:
    return "x" in candidate.split(" ")[0]


def role_question(candidate: str) -> dict:
    """The typed question for one single-value candidate; its text names the candidate."""
    value, _, nth = candidate.partition(" #")
    q = dict(ROLE_TEMPLATE)
    q["instructions"] = ROLE_TEMPLATE["instructions"].replace("{candidate}", value + (f" (occurrence {nth})" if nth else ""))
    return q


def role_candidates(text: str) -> list[str]:
    """The candidates that get a role question (single values, not LxWxH groups)."""
    return [c for c in extract(text) if not is_dims(c)]


if __name__ == "__main__":
    for t in ["ein imperialer sitzwürfel cubisch, 90 cm Seitenlänge wandicke 2 cm, für den Garten",
              "Fundament für ein Gartenhaus 3x2 m, 20 cm dick", "Einfahrt zur Garage, 25 m² und 15 cm stark",
              "12 Zaunpfosten, Löcher 30x30x80 cm", "Tischplatte 1,20 x 0,8 m, 4 cm dick", "40 cm lang, 40 cm breit und 40 cm hoch", "Betonring 60x60x30 cm ohne Boden, Wand 4 cm",
              "runder Pflanztopf Durchmesser 40 cm, 35 cm hoch, 2,5 cm Wand", "2 Säcke Fertigbeton à 40 kg", "halber Kubik"]:
        print(extract(t), "<-", t)
