#!/usr/bin/env bash
# The structural-elements round (2026-10-01): write and label the "pro" topics with the
# local teacher, train v4 next to the served model, evaluate v3 and v4, then try int8.
# Every step resumes; vLLM can hang or crash, so each one waits for a real completion.
set -uo pipefail
cd "$(dirname "$0")"
PY=${PY:-/home/schaef/localAI/laya-hello/.venv/bin/python}
export PYTHONUNBUFFERED=1
QS=indoor_dry,rain,ground,frost,deicing_salt,horizontal,reinforced,watertight,traffic,element,fine_cast,approach,add_cement,add_plasticizer,shape,open_sides,roles

alive() {
  curl -s -m 120 http://localhost:8000/v1/chat/completions -H 'content-type: application/json' \
    -d '{"model":"qwen3.8-27b","messages":[{"role":"user","content":"Hi"}],"max_tokens":5,"chat_template_kwargs":{"reasoning_effort":"low"}}' \
    | grep -q '"choices"'
}
wait_teacher() { until alive; do echo "$(date +%T) teacher not answering, waiting"; sleep 60; done; }

pro_texts() { $PY -c "
import json, make_dataset as m
print(sum(1 for l in open('data/descriptions.jsonl') if json.loads(l)['scenario'] in m.PRO_SCENARIOS))"; }
pro_short() { $PY -c "
import json, collections, make_dataset as m
t={json.loads(l)['text'] for l in open('data/descriptions.jsonl') if json.loads(l)['scenario'] in m.PRO_SCENARIOS}
c=collections.Counter(json.loads(l)['text'] for l in open('data/votes_pro.jsonl')) if __import__('os').path.exists('data/votes_pro.jsonl') else {}
print(sum(1 for x in t if c.get(x,0) < 3))"; }

echo "== $(date) generate"
for i in 1 2 3 4 5; do
  wait_teacher
  $PY make_dataset.py --step generate --scenarios pro
  echo "pro descriptions: $(pro_texts)"
  [ "$(pro_texts)" -ge 570 ] && break
done

echo "== $(date) label"
for i in $(seq 1 12); do
  wait_teacher
  $PY make_dataset.py --step label --label-scenarios pro --questions $QS --votes 3 --batch-size 5 --votes-file votes_pro.jsonl
  left=$(pro_short); echo "$(date +%T) descriptions with fewer than 3 votes: $left"
  [ "$left" -le 5 ] && break
done

echo "== $(date) train v4"
$PY train.py --out ../models/laya-crete-v4 || exit 1
chmod -R a+rX ../models/laya-crete-v4

echo "== $(date) evaluate"
until [ -f eval_pro.jsonl ]; do echo "waiting for eval_pro.jsonl"; sleep 60; done
for m in laya-crete laya-crete-v4; do
  for f in eval_handwritten.jsonl eval_objects.jsonl eval_pro.jsonl; do
    echo "--- $m $f"
    $PY evaluate.py --model ../models/$m --file $f --show-errors
  done
done

echo "== $(date) int8"
$PY quantize.py --model ../models/laya-crete-v4 --threads 2
echo "== $(date) done"
