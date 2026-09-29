/**
 * The training data of the describe search (describe/ml/DATA.md) stays consistent with
 * the questions: every row parses, names a known question and gives an allowed answer.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL(`../describe/${f}`, import.meta.url), 'utf8');
const jsonl = f => read(f).split('\n').filter(Boolean).map((l, i) => {
    try { return JSON.parse(l); } catch { throw new Error(`${f}:${i + 1} is not JSON`); }
});
const QUESTIONS = JSON.parse(read('questions.json'));
const ROLES = Object.keys(JSON.parse(read('role_question.json')).criteria);

function allowed(qid, value) {
    if (qid.startsWith('role:')) return ROLES.includes(value);
    const q = QUESTIONS[qid];
    if (!q) return false;
    if (q.type === 'noul') return typeof value === 'boolean';
    if (q.type === 'score') return Number.isInteger(value) && value >= 0 && value < q.criteria.length;
    return Object.hasOwn(q.criteria, value);
}

describe('describe training data', () => {
    const descriptions = jsonl('ml/data/descriptions.jsonl');
    const texts = new Set(descriptions.map(d => d.text));

    it('descriptions: unique, non-empty, German or English', () => {
        assert.ok(descriptions.length >= 2000, `only ${descriptions.length} descriptions`);
        assert.strictEqual(texts.size, descriptions.length, 'duplicate descriptions');
        for (const d of descriptions) {
            assert.ok(d.text.trim() && d.scenario, JSON.stringify(d));
            assert.ok(['de', 'en'].includes(d.lang), d.lang);
        }
    });

    for (const file of ['votes.jsonl', 'votes_fine_cast.jsonl', 'votes_v2.jsonl']) {
        it(`${file}: every vote belongs to a description and gives allowed answers`, () => {
            const rows = jsonl(`ml/data/${file}`);
            assert.ok(rows.length > 0);
            for (const r of rows) {
                assert.ok(texts.has(r.text), `${file}: unknown description "${r.text.slice(0, 60)}"`);
                for (const [qid, v] of Object.entries(r.answers))
                    assert.ok(allowed(qid, v), `${file}: ${qid} = ${JSON.stringify(v)} for "${r.text.slice(0, 50)}"`);
            }
        });
    }

    it('eval set: hand labels use known questions and allowed answers (null = skipped)', () => {
        const rows = jsonl('ml/eval_handwritten.jsonl');
        assert.ok(rows.length >= 66);
        for (const r of rows) {
            assert.ok(!texts.has(r.text), `eval description also in the training data: "${r.text}"`);
            for (const [qid, v] of Object.entries(r.labels))
                if (v !== null) assert.ok(allowed(qid, v), `eval: ${qid} = ${JSON.stringify(v)} for "${r.text}"`);
        }
    });
});
