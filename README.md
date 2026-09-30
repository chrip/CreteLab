# CreteLab

[![CI](https://github.com/chrip/CreteLab/actions/workflows/ci.yml/badge.svg)](https://github.com/chrip/CreteLab/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Describe a concrete project in plain German or English and get a recipe. A fine-tuned
[Laya](https://github.com/convai-innovations/laya) model reads the description; a tested
mix design after [Zement-Merkblatt B 20](https://www.beton.org/fileadmin/beton-org/media/Dokumente/PDF/Service/Zementmerkbl%C3%A4tter/B20.pdf)
does the engineering.

```
"Einfahrt 6 x 3 m, 15 cm stark, im Winter wird gestreut"
  → 2,70 m³ C35/45 · XC4 XD3 XF4 XM1 · air-entrained
  → bagged concrete: not possible (no bag declares XM1), mix it yourself, or the order text for a plant
```

## What it does

| Tool | For | Output |
|---|---|---|
| **Component planner** (`/plan`) | foundations, slabs, walls, posts | what it needs, how much, and three ways to make it: a bagged product that meets the requirements (or the sourced reason none does), a B 20 recipe to mix yourself, an order text after DIN EN 206 / DIN 1045-2. Every input of the mix design is adjustable. |
| **Fine concrete** (`/fine-concrete`) | planters, bowls, thin furniture | shape and sizes → volume, a published fine-mortar recipe scaled to it, plausibility checks |
| **Ready-mix tool** (`/bag`) | experiments with bags | what extra cement, fly ash, silica fume or admixtures would do (with the datasheets' warning) |

The start page takes one description and routes it: walls under 3 cm go to the fine
concrete page, everything else to the planner. Every page keeps its state in the URL.

## Architecture

```
apps/web          Nuxt 4 · Vue 3 · TypeScript · @nuxtjs/i18n (de/en), static pages
  └─ uses
packages/engine   the calculations: B 20 mix design, DIN 1045-2 rules, volumes, bags, orders,
                  fine-mortar recipes. Pure TypeScript, no DOM, no strings (codes + numbers)
services/api      FastAPI · Pydantic: POST /api/describe → Laya's answers + measurements
ml                training data (2 100 descriptions, 19 800 teacher votes), train/evaluate scripts
docs/research     sourced research behind the rules (bagged concrete datasheets)
```

```
text ─► /api/describe ─► Laya: 16 typed questions + one role question per measurement
            │
            ▼
   engine: planProject()
     facts ───► requirementsFromFacts()   DIN 1045-2 → exposure classes, strength class, air, WU
     roles ───► volumeFromAnswers()       shape + roles → m³ (regex parser as fallback)
     approach ► tool + production          physics overrides the model: walls < 3 cm → fine mortar
            │
            ▼
   computeRecipe() · planBag() · orderSpec() · scaleDecorRecipe()
```

The language model only answers questions it was trained on; it never writes the recipe.
Rules and formulas stay in code where they are reviewed and tested.

## Quality

| | |
|---|---|
| Engine | ~700 Vitest tests, including the four B 20 worked examples as regression tests and the Walz curves against a 300 dpi digitisation of B 20 Bild 1 |
| Web | unit and component tests (Vitest, @nuxt/test-utils), Playwright end-to-end tests on desktop and mobile with recorded model answers, axe WCAG 2.1 AA checks on every page |
| API | pytest with a fake model (no torch needed), Ruff, mypy strict |
| Data | every training row is checked against the questions (`ml/tests`) |

## Run it

With Docker (needs the fine-tuned weights in `models/laya-crete`, see below):

```bash
docker compose up --build        # http://localhost:8080
```

For development:

```bash
npm install
npm test                                  # engine + web
npm run test:e2e -w apps/web              # Playwright

cd services/api
uv sync && uv run pytest                  # API tests, no model needed
uv sync --extra model                     # adds laya + torch
LAYA_MODEL_DIR=../../models/laya-crete uv run uvicorn cretelab_api.app:app --port 8000

npm run dev                               # http://localhost:3000, proxies /api to :8000
```

Without the API the planner and both tools still work; only the description search needs it.

## The model

The weights are not in the repository, the data is. `ml/DATA.md` describes how it was
made: a local Qwen3.8-27B teacher on a DGX Spark wrote and labelled the descriptions
(about 24 hours in several runs, 11.8 M generated tokens), and fine-tuning takes about an hour on a GPU.

```bash
cd ml && python train.py --out ../models/laya-crete    # needs laya + torch
python evaluate.py --model ../models/laya-crete          # 93.6 % on 66, 91.5 % on 30 more (--file eval_objects.jsonl)
```

## Sources

- Zement-Merkblatt B 20 (2.2017) and B 9, Verein Deutscher Zementwerke
- DIN EN 206 / DIN 1045-2, DAfStb WU-Richtlinie
- Heidelberg Materials, Betontechnische Daten 2022
- Manufacturer datasheets of bagged concrete: [docs/research/bagged-concrete.md](docs/research/bagged-concrete.md)
- Fine-mortar recipes: Grey Element; Fehling et al., Universität Kassel (UHPC, Heft 1)

CreteLab is not an engineering service. Have load-bearing parts designed by a professional.

## License

MIT. Laya (Convai Innovations) and Qwen are Apache 2.0.
