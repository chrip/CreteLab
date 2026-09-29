# Describe search

A single search box (`describe.html`): the user describes a project in German or English,
CreteLab shows the recipe in plain words and opens the matching form pre-filled for editing.

```
text ──► POST /api/describe ──► Laya: 16 typed questions + one role question per measurement
  │                              (describe/questions.json, role_question.json, measurements.py)
  │
  ├─► approach  scratch ─────► js/lib/recipe.js  (B 20 mix design)     → index.html
  │             bagged ──────► ready-mix bag + extras (fine-tune rules) → fine-tune.html
  │             fine_mortar ─► sourced DIY recipe (UHPC engine)         → uhpc.html
  │
  ├─► facts ───► js/lib/describe.js  DIN 1045-2 rules → exposure classes, strength, air, WU
  └─► volume ──► js/lib/volume.js    shape + roles → m³, fallback: text parser
```

Laya only answers plain-language questions. DIN rules, volume formulas and the mix design
stay in code, where they can be reviewed and tested. Code rules also correct Laya where the
physics is clear: a wall thickness means a hollow piece, and walls under 3 cm cannot be cast
from site concrete. Pages hand recipes to each other as URL parameters (`js/lib/handoff.js`).

## Run on the Spark

```bash
python3 -m venv .venv && .venv/bin/pip install -r describe/requirements.txt
.venv/bin/uvicorn describe.server.app:app --host 0.0.0.0 --port 8080
# http://<spark>:8080/  → describe.html
```

The server loads `describe/model/laya-crete`. The weights are not in the repository; without
them it falls back to the base multilingual checkpoint, whose answers are close to random.
Build them with `describe/ml/train.py` (about 30 minutes on a CUDA GPU).

## Training data

`describe/ml/DATA.md` describes the data, how it was generated with a local teacher LLM,
its quality, and how to rebuild or extend the model. `tests/describe-data.test.js` checks
every row. If you change a question, relabel and retrain: Laya reads the question text as input.
