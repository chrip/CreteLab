"""The model behind /api/describe, behind a small interface so tests run without torch."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Protocol

from .measurements import Question

#: Laya's raw answer per question id.
Answers = dict[str, dict[str, Any]]

log = logging.getLogger(__name__)

BASE_MODEL = "convaiinnovations/laya"


class Predictor(Protocol):
    """Answers typed questions about a description."""

    name: str

    def predict(self, text: str, questions: dict[str, Question]) -> Answers: ...


class LayaPredictor:
    """The fine-tuned Laya checkpoint, or the multilingual base model when none is built yet."""

    def __init__(self, model_dir: Path) -> None:
        import laya  # heavy (torch); imported only when the real model is used

        if model_dir.is_dir():
            self._agent = laya.Agent(str(model_dir))
            self.name = model_dir.name
        else:
            log.warning("No fine-tuned model at %s, using the untrained base model", model_dir)
            self._agent = laya.load(BASE_MODEL, subfolder="multilingual")
            self.name = "laya-multilingual (base)"

    def predict(self, text: str, questions: dict[str, Question]) -> Answers:
        answers: Answers = self._agent.predict({"description": text}, questions)["answers"]
        return answers
