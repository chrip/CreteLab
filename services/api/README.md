# CreteLab API

FastAPI service around the fine-tuned [Laya](https://github.com/convai-innovations/laya) model.
`POST /api/describe` takes a project description (German or English) and returns Laya's
answers to the typed questions in `src/cretelab_api/questions.json`, one role question per
measurement found in the text (`measurements.py`) and the measurements themselves.
Everything else, from exposure classes to the mix design, runs in the web app
(`packages/engine`).

```bash
uv sync                                   # API + test tools, no torch
uv run pytest                             # tests use a fake model
uv sync --extra model                     # adds laya (and torch) for the real model
LAYA_MODEL_DIR=../../models/laya-crete uv run uvicorn cretelab_api.app:app --port 8000
```

Without `LAYA_MODEL_DIR` the service looks for `models/laya-crete` in the repository and
falls back to the untrained multilingual base model, whose answers are close to random.
The weights are not in the repository; `ml/train.py` builds them (see `ml/DATA.md`).
