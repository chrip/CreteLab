"""Fine-tune Laya's multilingual checkpoint on the teacher votes in data/votes.jsonl.

Single-GPU version of the upstream notebook
(notebooks/laya_finetune_typed_decisions_2xT4_kaggle.ipynb in NandhaKishorM/laya):
RLCD policy gradient with proper-scoring-rule rewards plus soft cross-entropy, then one
calibration temperature per question type, fitted on a held-out slice.

    python train.py --out ../model/laya-crete
"""

import argparse
import json
import os
import random
import time
from collections import defaultdict
from pathlib import Path

import torch
from huggingface_hub import snapshot_download
from safetensors.torch import load_file, save_file
from transformers import AutoTokenizer

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from measurements import role_question  # noqa: E402

from laya.agent import _fix_tokenizer_config
from laya.common import QTYPES, build_model, build_sequence, proper_reward, render_options

HERE = Path(__file__).parent
QUESTIONS = json.loads((HERE.parent / "questions.json").read_text())
SMOOTHING = 0.25  # pseudo-votes per option, so a 5/5 vote becomes ~0.9 rather than 1.0


def question_for(qid):
    """The typed question for an answer id: a fixed question, or role:<candidate>."""
    if qid.startswith("role:"):
        return role_question(qid[5:])
    return QUESTIONS.get(qid)


def options(q):
    if q["type"] == "noul":
        return [False, True]
    if q["type"] == "score":
        return list(range(len(q["criteria"])))
    return list(q["criteria"])


def soft_targets(votes_paths):
    """Aggregate the teacher's votes per description into one probability vector per question.

    Several vote files (e.g. votes.jsonl plus votes_fine_cast.jsonl) merge per description.
    """
    counts = defaultdict(lambda: defaultdict(lambda: defaultdict(int)))
    for path in votes_paths:
        for line in open(path):
            row = json.loads(line)
            for qid, value in row["answers"].items():
                if question_for(qid):
                    counts[row["text"]][qid][value] += 1
    targets = {}
    for text, per_q in counts.items():
        targets[text] = {}
        for qid, c in per_q.items():
            opts = options(question_for(qid))
            n = sum(c.values())
            targets[text][qid] = [(c.get(o, 0) + SMOOTHING) / (n + SMOOTHING * len(opts)) for o in opts]
    return targets


def build_items(tok, cfg, targets):
    items = []
    for text, per_q in targets.items():
        for qid, target in per_q.items():
            q = question_for(qid)
            crit = q.get("criteria", {})
            seq, markers = build_sequence(tok, {"description": text},
                                          {"t": q["type"], "ins": q["instructions"], "crit": crit},
                                          cfg["max_len"], cfg["head_max_len"])
            if len(markers) != len(render_options({"t": q["type"], "crit": crit})) or len(markers) != len(target):
                continue
            items.append({"ids": seq, "markers": markers, "qtype": QTYPES[q["type"]], "target": target})
    return items


def collate(items, pad_id):
    n, L = len(items), max(len(it["ids"]) for it in items)
    kmax = max(len(it["markers"]) for it in items)
    ids = torch.full((n, L), pad_id, dtype=torch.long)
    att = torch.zeros((n, L), dtype=torch.long)
    mpos = torch.zeros((n, kmax), dtype=torch.long)
    mmask = torch.zeros((n, kmax), dtype=torch.bool)
    target = torch.zeros((n, kmax), dtype=torch.float32)
    for i, it in enumerate(items):
        ids[i, :len(it["ids"])] = torch.tensor(it["ids"])
        att[i, :len(it["ids"])] = 1
        k = len(it["markers"])
        mpos[i, :k] = torch.tensor(it["markers"])
        mmask[i, :k] = True
        target[i, :k] = torch.tensor(it["target"])
    return ids, att, mpos, mmask, torch.tensor([it["qtype"] for it in items]), target


def fit_temperature(sel):
    """One temperature for a question type, minimising cross-entropy against the soft targets."""
    if len(sel) < 10:
        return 1.0
    kmax = max(len(z) for z, _ in sel)
    Z = torch.full((len(sel), kmax), -1e4)
    T = torch.zeros((len(sel), kmax))
    for i, (z, t) in enumerate(sel):
        Z[i, :len(z)] = torch.tensor(z)
        T[i, :len(t)] = torch.tensor(t)
    log_t = torch.zeros(1, requires_grad=True)
    opt = torch.optim.LBFGS([log_t], lr=0.1, max_iter=100)

    def closure():
        opt.zero_grad()
        loss = -(T * torch.log_softmax(Z / log_t.exp(), -1)).sum(-1).mean()
        loss.backward()
        return loss

    opt.step(closure)
    return float(torch.clamp(log_t.detach().exp(), 0.1, 10.0))


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--votes", nargs="+",
                   default=[str(f) for f in sorted((HERE / "data").glob("votes*.jsonl"))])
    p.add_argument("--out", default=str(HERE.parent / "model" / "laya-crete"))
    p.add_argument("--epochs", type=int, default=4)
    p.add_argument("--micro-batch", type=int, default=16)
    p.add_argument("--grad-accum", type=int, default=4)
    args = p.parse_args()

    base = os.path.join(snapshot_download("convaiinnovations/laya"), "multilingual")
    _fix_tokenizer_config(base)
    cfg = json.load(open(os.path.join(base, "rl_agent_config.json")))
    tok = AutoTokenizer.from_pretrained(os.path.join(base, "tokenizer"))

    targets = soft_targets(args.votes)
    # Split by description, so no description's questions leak into the calibration slice.
    texts = sorted(targets)
    random.Random(20260928).shuffle(texts)
    n_calib = max(1, len(texts) // 10)
    calib_items = build_items(tok, cfg, {t: targets[t] for t in texts[:n_calib]})
    train_items = build_items(tok, cfg, {t: targets[t] for t in texts[n_calib:]})
    print(f"{len(texts)} descriptions -> {len(train_items)} train items, {len(calib_items)} calibration items")

    device = torch.device("cuda")
    model = build_model(cfg, encoder_dir=os.path.join(base, "encoder"))
    model.load_state_dict(load_file(os.path.join(base, "model.safetensors")), strict=True)
    model.encoder.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
    model.head_checkpointing = True
    model.to(device).train()

    GROUP_SIZE, SIGMA_START, SIGMA_END = 4, 0.4, 0.1
    enc = [p for n, p in model.named_parameters() if n.startswith("encoder.")]
    head = [p for n, p in model.named_parameters() if not n.startswith("encoder.")]
    optimizer = torch.optim.AdamW([{"params": enc, "lr": 2.5e-5}, {"params": head, "lr": 1.0e-4}], weight_decay=0.01)
    total_updates = max(1, (len(train_items) // (args.micro_batch * args.grad_accum)) * args.epochs)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=total_updates, eta_min=1e-6)

    t0 = time.time()
    for epoch in range(args.epochs):
        random.Random(42 + epoch).shuffle(train_items)
        sigma = SIGMA_START + (SIGMA_END - SIGMA_START) * epoch / max(1, args.epochs - 1)
        epoch_loss, steps = 0.0, 0
        optimizer.zero_grad(set_to_none=True)
        for b in range(0, len(train_items), args.micro_batch):
            ids, att, mpos, mmask, qtype, target = (x.to(device) for x in collate(train_items[b:b + args.micro_batch], tok.pad_token_id))
            with torch.autocast("cuda", dtype=torch.bfloat16):
                logits, act = model(ids, att, mpos, mmask, qtype)
            logits = logits.float()
            k = mmask.sum(-1, keepdim=True).float()

            # RLCD: sample noisy logits, reward them with a proper scoring rule, push towards the better ones.
            eps = torch.randn((GROUP_SIZE,) + logits.shape, device=device) * sigma * mmask
            eps = (eps - eps.sum(-1, keepdim=True) / k) * mmask
            z = logits.detach().unsqueeze(0) + eps
            q = torch.softmax(z.masked_fill(~mmask, -1e4), -1)
            with torch.no_grad():
                r = proper_reward(q, target.unsqueeze(0), qtype, mmask, w_sph=0.75, w_rps=1.0)
                adv = (r - r.mean(0, keepdim=True)) / (r.std() + 1e-6)
            logp = -(((z - logits.unsqueeze(0)) ** 2) * mmask).sum(-1) / (2 * sigma ** 2)
            loss_rl = -(adv * logp).mean()
            loss_ce = -(target * torch.log_softmax(logits.masked_fill(~mmask, -1e4), -1)).sum(-1).mean()
            loss = (loss_rl + loss_ce) / args.grad_accum + 0.0 * act.sum()
            loss.backward()

            steps += 1
            epoch_loss += loss.item() * args.grad_accum
            if steps % args.grad_accum == 0 or b + args.micro_batch >= len(train_items):
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()
                scheduler.step()
                optimizer.zero_grad(set_to_none=True)
            if steps % 100 == 0:
                print(f"  epoch {epoch + 1} step {steps} loss {loss.item() * args.grad_accum:.4f} reward {r.mean().item():.3f}")
        print(f"epoch {epoch + 1}/{args.epochs} done in {time.time() - t0:.0f}s, avg loss {epoch_loss / max(1, steps):.4f}")

    model.eval()
    by_type = defaultdict(list)
    with torch.no_grad():
        for b in range(0, len(calib_items), 32):
            chunk = calib_items[b:b + 32]
            ids, att, mpos, mmask, qtype, _ = (x.to(device) for x in collate(chunk, tok.pad_token_id))
            with torch.autocast("cuda", dtype=torch.bfloat16):
                logits, _ = model(ids, att, mpos, mmask, qtype)
            for row, it in zip(logits.float().cpu().numpy(), chunk):
                by_type[it["qtype"]].append((row[:len(it["markers"])].tolist(), it["target"]))
    temps = [fit_temperature(by_type.get(t, [])) for t in range(3)]
    print("calibration temperatures (choice, score, noul):", [round(t, 3) for t in temps])

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    save_file({k: v.half().contiguous().cpu() for k, v in model.state_dict().items()}, str(out / "model.safetensors"))
    model.encoder.config.save_pretrained(str(out / "encoder"))
    tok.save_pretrained(str(out / "tokenizer"))
    cfg.update({"fine_tuned": True, "model_name": "laya-crete", "temperature": temps})
    cfg.pop("temperature_by_options", None)  # inherited overrides would hide the fitted values
    (out / "rl_agent_config.json").write_text(json.dumps(cfg, indent=2))
    print("saved to", out)


if __name__ == "__main__":
    main()
