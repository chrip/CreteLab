"""HTTP API: POST /api/describe answers the questions for one project description.

Laya only answers typed questions (measurements.QUESTIONS plus one role question per
measurement). The DIN 1045-2 mapping, volumes and mix design run in the web app
(packages/engine), where they can be reviewed and tested.

    uvicorn cretelab_api.app:app --port 8000
"""

from __future__ import annotations

import os
import threading
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator

from . import __version__
from .measurements import extract, questions_for
from .predictor import LayaPredictor, Predictor


def model_dir() -> Path:
    """LAYA_MODEL_DIR, else models/laya-crete in the repository checkout."""
    if env := os.environ.get("LAYA_MODEL_DIR"):
        return Path(env)
    here = Path(__file__).resolve()
    repo = here.parents[4] if len(here.parents) > 4 else Path.cwd()
    return repo / "models" / "laya-crete"


class DescribeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000, description="Project description, German or English")

    @field_validator("text")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("description is empty")
        return v


class Answer(BaseModel):
    """One answer: `noul` = probability of yes, `choice` = chosen option, `score` = 0–3."""

    model_config = ConfigDict(extra="ignore")

    noul: float | None = None
    choice: str | None = None
    score: float | None = None
    confidence: float | None = None


class DescribeResponse(BaseModel):
    answers: dict[str, Answer]
    candidates: list[str] = Field(description="Measurements in reading order, e.g. ['3x2 m', '20 cm']")
    model: str
    ms: float


class Health(BaseModel):
    ok: bool
    model: str
    version: str


def env_int(name: str, default: int) -> int:
    try:
        return max(1, int(os.environ.get(name, default)))
    except ValueError:
        return default


def create_app(predictor: Predictor | None = None, max_parallel: int | None = None, wait_s: float = 10.0) -> FastAPI:
    """Build the app. Tests pass a fake predictor; production loads Laya on startup.

    At most `max_parallel` descriptions run through the model at once (LAYA_MAX_PARALLEL, default 2):
    on a CPU each takes about 2 s and uses every core, so more in parallel only makes all of them
    slower. A request that cannot start within `wait_s` gets 503 with Retry-After.
    """
    slots = threading.BoundedSemaphore(max_parallel or env_int("LAYA_MAX_PARALLEL", 2))

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if predictor is not None:
            app.state.predictor = predictor
        else:
            app.state.predictor = LayaPredictor(model_dir())
        yield

    app = FastAPI(title="CreteLab API", version=__version__, lifespan=lifespan)

    @app.post("/api/describe", response_model=DescribeResponse)
    def describe(req: DescribeRequest, request: Request) -> dict[str, Any]:
        model: Predictor = request.app.state.predictor
        if not slots.acquire(timeout=wait_s):
            raise HTTPException(503, "busy, try again shortly", headers={"Retry-After": "5"})
        try:
            start = time.perf_counter()
            answers = model.predict(req.text, questions_for(req.text))
        finally:
            slots.release()
        return {
            "answers": answers,
            "candidates": extract(req.text),
            "model": model.name,
            "ms": round((time.perf_counter() - start) * 1000, 1),
        }

    @app.get("/api/health", response_model=Health)
    def health(request: Request) -> dict[str, Any]:
        return {"ok": True, "model": request.app.state.predictor.name, "version": __version__}

    return app


app = create_app()
