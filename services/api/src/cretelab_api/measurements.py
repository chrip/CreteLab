"""The questions Laya answers and the measurements whose role it decides.

Shared by the training scripts (ml/) and the API, so training and inference see exactly the
same inputs. The web app reads a candidate's number and unit back from its text
(packages/engine/src/project/volume.ts, parseCandidate).
"""

import json
import re
from pathlib import Path
from typing import Any

#: A typed Laya question: {"type": "noul" | "choice" | "score", "instructions": ..., "criteria": ...}
Question = dict[str, Any]

NUM = r"(\d+(?:[.,]\d+)?)"
UNIT = r"(mm|cm|dm|m²|m2|qm|m³|m3|cbm|kubik|liter|litre|l|m)"
# counts, also in compounds and other cases: "12 Zaunpfosten", "4 Löcher", "2 Säcken", "6 Punktfundamente"
COUNT = (
    r"([a-zäöüß]*(?:stück|stk|stck|pcs|pieces|posts?|pfosten|säcke?n?|bags?|löcher[n]?|holes?|"
    r"fundamente?|platten?|steine?|stufen?|slabs?|steps?|blocks?|blöcke?))"
)

# "3x2 m", "40x40x80 cm", "40 cm x 40 cm" describe themselves (length × width [× height]):
# one candidate, no role question. Without a unit, values from 10 up are read as cm.
LEN_U = r"(mm|cm|m)"
DIMS = re.compile(
    NUM + r"\s*" + LEN_U + r"?\s*[x×*]\s*" + NUM + r"\s*" + LEN_U + r"?"
    r"(?:\s*[x×*]\s*" + NUM + r"\s*" + LEN_U + r"?)?(?![a-zäöüß\d])",
    re.I,
)
SINGLE = re.compile(NUM + r"\s*" + UNIT + r"(?![a-zäöüß])", re.I)
COUNTS = re.compile(NUM + r"\s*" + COUNT + r"\b", re.I)


def dims_unit(m: re.Match[str]) -> str:
    unit = m.group(6) or m.group(4) or m.group(2)
    if unit:
        return unit.lower()
    values = [float(g.replace(",", ".")) for g in m.group(1, 3, 5) if g]
    return "cm" if min(values) >= 10 else "m"


HERE = Path(__file__).parent
#: The fixed questions (exposure facts, route, shape). Their wording is model input:
#: change one and the training data has to be relabelled.
QUESTIONS: dict[str, Question] = json.loads((HERE / "questions.json").read_text())
#: One choice question per single-value measurement, "{candidate}" is replaced.
ROLE_TEMPLATE: Question = json.loads((HERE / "role_question.json").read_text())
MAX_CANDIDATES = 6


def extract(text: str) -> list[str]:
    """Candidate measurements in reading order, e.g. ['90 cm', '2 cm'] or ['3x2 m', '20 cm'].

    A repeated single value gets a suffix ("40 cm", "40 cm #2") so each one has its own role.
    """
    found: list[tuple[int, str]] = []
    taken: list[tuple[int, int]] = []

    def add(start: int, end: int, label: str) -> None:
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
    labels: list[str] = []
    seen: dict[str, int] = {}
    for _, label in sorted(found):
        seen[label] = seen.get(label, 0) + 1
        labels.append(label if seen[label] == 1 else f"{label} #{seen[label]}")
    return labels[:MAX_CANDIDATES]


def is_dims(candidate: str) -> bool:
    return "x" in candidate.split(" ")[0]


def role_question(candidate: str) -> Question:
    """The typed question for one single-value candidate; its text names the candidate."""
    value, _, nth = candidate.partition(" #")
    q = dict(ROLE_TEMPLATE)
    label = value + (f" (occurrence {nth})" if nth else "")
    q["instructions"] = ROLE_TEMPLATE["instructions"].replace("{candidate}", label)
    return q


def role_candidates(text: str) -> list[str]:
    """The candidates that get a role question (single values, not LxWxH groups)."""
    return [c for c in extract(text) if not is_dims(c)]


def questions_for(text: str) -> dict[str, Question]:
    """All questions for one description: the fixed ones plus a role question per measurement."""
    return {**QUESTIONS, **{f"role:{c}": role_question(c) for c in role_candidates(text)}}
