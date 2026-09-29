"""CreteLab describe-search server: serves the static site and runs Laya on /api/describe.

Laya only answers the fixed questions in describe/questions.json. Volume parsing, the
DIN 1045-2 mapping and the B20 recipe run in the browser (js/lib/describe.js, recipe.js).

    LAYA_CRETE_MODEL=describe/model/laya-crete uvicorn describe.server.app:app --port 8080
"""

import json
import os
import time
from pathlib import Path

import laya
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
import sys
sys.path.insert(0, str(ROOT / "describe"))
from measurements import extract, role_candidates, role_question  # noqa: E402

QUESTIONS = json.loads((ROOT / "describe" / "questions.json").read_text())
MODEL = os.environ.get("LAYA_CRETE_MODEL", str(ROOT / "describe" / "model" / "laya-crete"))

# Fall back to the base multilingual checkpoint until a fine-tuned one exists.
agent = laya.Agent(MODEL) if Path(MODEL).is_dir() else laya.load("convaiinnovations/laya", subfolder="multilingual")
model_name = Path(MODEL).name if Path(MODEL).is_dir() else "laya-multilingual (base)"

app = FastAPI(title="CreteLab describe")


class DescribeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


@app.post("/api/describe")
def describe(req: DescribeRequest):
    text = req.text.strip()
    if not text:
        raise HTTPException(422, "empty description")
    start = time.perf_counter()
    # One role question per single-value measurement ("90 cm", "2 cm", "12 Stück").
    questions = {**QUESTIONS, **{f"role:{c}": role_question(c) for c in role_candidates(text)}}
    answers = agent.predict({"description": text}, questions)["answers"]
    return {"answers": answers, "candidates": extract(text), "model": model_name,
            "ms": round((time.perf_counter() - start) * 1000, 1)}


@app.get("/api/health")
def health():
    return {"ok": True, "model": model_name}


# Serve only the site itself, never the repo root (.git, training data, node_modules).
for folder in ("css", "js", "assets", "locales"):
    app.mount(f"/{folder}", StaticFiles(directory=ROOT / folder), name=folder)

PAGES = {"describe.html", "index.html", "fine-tune.html", "uhpc.html"}


@app.get("/")
def home():
    return RedirectResponse("/describe.html")


@app.get("/{page}")
def page(page: str):
    if page not in PAGES:
        raise HTTPException(404)
    return FileResponse(ROOT / page)
