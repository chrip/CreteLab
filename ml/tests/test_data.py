"""The published training data stays consistent with the questions the model is asked:
every row parses, names a known question and gives an allowed answer (ml/DATA.md)."""

import json
from pathlib import Path

import pytest

from cretelab_api.measurements import QUESTIONS, ROLE_TEMPLATE

ML = Path(__file__).resolve().parents[1]
ROLES = set(ROLE_TEMPLATE["criteria"])


def jsonl(path: Path) -> list[dict]:
    rows = []
    for i, line in enumerate(path.read_text().splitlines(), 1):
        if line.strip():
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise AssertionError(f"{path.name}:{i} is not JSON") from e
    return rows


def allowed(qid: str, value: object) -> bool:
    if qid.startswith("role:"):
        return value in ROLES
    q = QUESTIONS.get(qid)
    if q is None:
        return False
    if q["type"] == "noul":
        return isinstance(value, bool)
    if q["type"] == "score":
        return isinstance(value, int) and not isinstance(value, bool) and 0 <= value < len(q["criteria"])
    return value in q["criteria"]


@pytest.fixture(scope="module")
def descriptions() -> list[dict]:
    return jsonl(ML / "data" / "descriptions.jsonl")


@pytest.fixture(scope="module")
def texts(descriptions) -> set[str]:
    return {d["text"] for d in descriptions}


def test_descriptions_are_unique_non_empty_and_german_or_english(descriptions, texts):
    assert len(descriptions) >= 2000
    assert len(texts) == len(descriptions), "duplicate descriptions"
    for d in descriptions:
        assert d["text"].strip() and d["scenario"], d
        assert d["lang"] in {"de", "en"}, d


def test_two_thirds_german(descriptions):
    german = sum(d["lang"] == "de" for d in descriptions)
    assert german / len(descriptions) == pytest.approx(2 / 3, abs=0.02)


@pytest.mark.parametrize("file", ["votes.jsonl", "votes_fine_cast.jsonl", "votes_v2.jsonl"])
def test_every_vote_belongs_to_a_description_and_gives_allowed_answers(file, texts):
    rows = jsonl(ML / "data" / file)
    assert rows
    for r in rows:
        assert r["text"] in texts, f"{file}: unknown description {r['text'][:60]!r}"
        for qid, v in r["answers"].items():
            assert allowed(qid, v), f"{file}: {qid} = {v!r} for {r['text'][:50]!r}"


@pytest.mark.parametrize(("file", "size"), [("eval_handwritten.jsonl", 66), ("eval_objects.jsonl", 30)])
def test_eval_set_is_held_out_and_uses_allowed_labels(texts, file, size):
    rows = jsonl(ML / file)
    assert len(rows) >= size
    for r in rows:
        assert r["text"] not in texts, f"eval description also in the training data: {r['text']!r}"
        for qid, v in r["labels"].items():
            if v is not None:  # null = genuinely ambiguous, skipped in evaluation
                assert allowed(qid, v), f"eval: {qid} = {v!r} for {r['text']!r}"
