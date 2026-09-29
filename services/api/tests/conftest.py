from typing import Any

import pytest
from fastapi.testclient import TestClient

from cretelab_api.app import create_app


class FakePredictor:
    """Answers every question with fixed values and records what it was asked."""

    name = "fake-laya"

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, dict]]] = []

    def predict(self, text: str, questions: dict[str, dict]) -> dict[str, dict[str, Any]]:
        self.calls.append((text, questions))
        answers: dict[str, dict[str, Any]] = {}
        for qid, q in questions.items():
            if q["type"] == "noul":
                answers[qid] = {"type": "noul", "noul": 0.9, "confidence": 0.9, "action": {"act_probability": 1.0}}
            elif q["type"] == "score":
                answers[qid] = {"type": "score", "score": 1.0, "probabilities": {"0": 0.1}, "confidence": 0.6}
            else:
                options = list(q["criteria"])
                answers[qid] = {"type": "choice", "choice": options[0], "confidence": 0.5}
        return answers


@pytest.fixture
def predictor() -> FakePredictor:
    return FakePredictor()


@pytest.fixture
def client(predictor: FakePredictor):
    with TestClient(create_app(predictor)) as c:
        yield c
