# Training data for the describe search

This folder holds everything needed to rebuild the fine-tuned Laya model behind
the description search: 4 349 project descriptions, 22 409 teacher votes, two hand-labelled
evaluation sets and a blind cross-check of the teacher. The model weights are not in the
repository; `train.py` rebuilds them in about an hour on a CUDA GPU.

## What Laya learns

Laya answers typed questions about a description; it never writes text. The questions are
fixed in `services/api/src/cretelab_api/questions.json` (16 questions) and `role_question.json` (one role question
per measurement found by `measurements.py`). Their wording is part of the model input:
change a question and the data has to be relabelled.

| Group | Questions |
|---|---|
| Exposure facts | `indoor_dry`, `rain`, `ground`, `frost`, `deicing_salt`, `horizontal`, `reinforced`, `watertight`, `traffic`, `element` |
| Route | `fine_cast`, `approach` (scratch / bagged / fine_mortar), `add_cement`, `add_plasticizer` |
| Volume | `shape`, `open_sides`, `role:<measurement>` (length, width, height, diameter, wall, thickness, area, volume, count, other) |

DIN rules, volume formulas and the B 20 mix design stay in code (`packages/engine`:
`project/requirements.ts`, `project/volume.ts`, `b20/recipe.ts`).

## Files

| File | Rows | Content |
|---|---|---|
| `data/descriptions.jsonl` | 4 349 | `{job, scenario, lang, text}` – descriptions as people type them into a search box, 2 899 German, 1 450 English, with typos and missing details on purpose |
| `data/votes.jsonl` | 9 300 | `{vote, text, answers}` – site and DIY descriptions: 5 votes on the 10 exposure questions; ready-mix and shape descriptions: 3 votes on all 16 questions plus roles |
| `data/votes_fine_cast.jsonl` | 7 500 | 5 votes on `fine_cast` for the site and DIY descriptions |
| `data/votes_v2.jsonl` | 3 000 | 2 votes on `approach`, `add_cement`, `add_plasticizer`, `shape`, `open_sides` and roles for the site and DIY descriptions |
| `data/votes_objects.jsonl` | 2 609 | 1–2 votes on all 16 questions plus roles for the 2 249 descriptions of the 75 object topics |
| `eval_handwritten.jsonl` | 66 | Hand-labelled test set (`null` = genuinely ambiguous, skipped). Never shown to the teacher |
| `eval_objects.jsonl` | 30 | Hand-labelled test set of objects from the web survey (sink, shower tray, bird bath, light well …) |
| `verify/` | 100 | Opus 5.5 labelled 100 random descriptions blind; `compare.py`, `disagreements.json` |

A vote row holds the teacher's answer per question; roles are stored as `role:<measurement>`
(e.g. `"role:90 cm": "length"`). `train.py` turns the vote shares into soft targets
(3 of 5 → about 0.58), so the model learns how sure to be.

The descriptions cover 145 topics (`make_dataset.py`): 35 site-concrete topics (driveways,
foundations, basements …), 15 DIY pieces (tables, planters, bowls …), 10 ready-mix-bag
projects, 10 topics that give sizes in many ways (diameter, edge length, wall thickness,
counts) and 75 more objects from a web survey of what people cast from concrete
(`docs/research/concrete-objects.md`: 146 objects, the 75 not covered before, from septic
pits and ramps to shower trays, cement tiles and Christmas decorations).

## How it was made

- Teacher: `unsloth/Qwen3.8-27B-NVFP4` (Apache 2.0) on a DGX Spark via vLLM, reasoning
  effort low, temperature 1.0 for writing descriptions and 0.8 for voting. Prompts are in
  `make_dataset.py`.
- Dates: 2026-09-28/29; the 75 object topics on 2026-09-30 (one night: 30 minutes writing,
  4 hours labelling at about 150 tokens/s, 8 requests in parallel).
- About 3.5 M prompt tokens and 11.8 M generated tokens in total, most of it the teacher's
  reasoning (the object night is estimated from the throughput: vLLM restarted twice after
  a CUDA error and lost its counters).

## Quality

- Opus 5.5 agrees with the teacher on 91,1 % of the answers of 100 random descriptions
  (94,8 % where the teacher's votes were unanimous, 66,9 % where they were split).
- Known teacher biases: `ground` is set for anything standing on soil (columns, walls),
  `watertight` whenever groundwater is mentioned, `reinforced` leans towards yes on split
  votes. Most of these push the recipe to the safe side.
- 6 rows in `votes.jsonl` and 750 rows in `votes_fine_cast.jsonl` have empty answers
  (the teacher replied in an unusable format); training ignores them.

Trained model on `eval_handwritten.jsonl` (2026-09-29): 93,5 % of answers right
(untrained base model: 49,7 %), number roles 98 %, open sides 100 %, approach 83 %,
shape 81 %; the Laya-based volume matches the hand labels for 23 of 23 descriptions
with a size.

## Rebuild and extend

```bash
# from ml/, with a local OpenAI-compatible LLM on localhost:8000
python train.py                                   # ~30 min on a CUDA GPU
python evaluate.py --model ../models/laya-crete    # compare with the numbers above

# more descriptions for a topic list, then labels for them
python make_dataset.py --step generate --scenarios shapes
python make_dataset.py --step label --label-scenarios shapes --batch-size 5 \
    --questions <all question ids>,roles --votes 3
```

`ml/tests/test_data.py` checks every row of these files against the questions.
Retraining uses random noise (RLCD) and is not bit-identical; evaluate every new model.

## License

The descriptions and labels are generated by an Apache 2.0 model and released with CreteLab
under the MIT license.
