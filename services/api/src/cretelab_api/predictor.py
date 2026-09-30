"""The model behind /api/describe, behind a small interface so tests run without torch."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Protocol

from .measurements import Question

#: Laya's raw answer per question id.
Answers = dict[str, dict[str, Any]]


class Predictor(Protocol):
    """Answers typed questions about a description."""

    name: str

    def predict(self, text: str, questions: dict[str, Question]) -> Answers: ...


class LayaPredictor:
    """The fine-tuned Laya checkpoint. Without it the service does not start: the untrained
    base model answers about half of the questions wrong, which would look like working."""

    def __init__(self, model_dir: Path) -> None:
        if not (model_dir / "model.safetensors").is_file():
            raise RuntimeError(
                f"No fine-tuned model at {model_dir}: build it with ml/train.py or copy models/laya-crete there"
            )
        import laya  # heavy (torch); imported only when the real model is used
        import torch

        # PyTorch counts physical cores and picks 1 thread on a 2-vCore VPS; compose passes the
        # container's CPU limit instead (2 threads: 10 s → 7 s per description there).
        if threads := int(os.environ.get("LAYA_THREADS", "0")):
            torch.set_num_threads(threads)
        self._agent = laya.Agent(str(model_dir))
        self.name = model_dir.name

    def predict(self, text: str, questions: dict[str, Question]) -> Answers:
        answers: Answers = self._agent.predict({"description": text}, questions)["answers"]
        return answers
