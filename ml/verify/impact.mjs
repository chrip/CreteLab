// Run both label sets through the real mapping and compare what the recipe would use.
import { readFileSync } from 'node:fs';
import { factsToValues } from '../../../js/lib/describe.js';

const Q = JSON.parse(readFileSync(new URL('../../questions.json', import.meta.url)));
const qwen = JSON.parse(readFileSync(new URL('./qwen_majority.json', import.meta.url)));
const opus = {};
for (const i of [0, 1, 2, 3]) Object.assign(opus, JSON.parse(readFileSync(new URL(`./opus_${i}.json`, import.meta.url))));

const toAnswers = get => Object.fromEntries(Object.entries(Q).map(([q, def]) => {
    const v = get(q);
    if (def.type === 'noul') return [q, { noul: v ? 1 : 0 }];
    if (def.type === 'score') return [q, { score: v ?? 0 }];
    return [q, { choice: v }];
}));

let sameClasses = 0, sameStrength = 0, qwenStricter = 0, opusStricter = 0, n = 0;
const diffs = [];
const cube = c => parseInt(c.split('/')[1]);
for (const [i, row] of Object.entries(qwen)) {
    if (!opus[i]) continue;
    n++;
    const a = factsToValues(toAnswers(q => row.qwen[q]?.value));
    const b = factsToValues(toAnswers(q => opus[i][q]));
    const ca = [...a.exposureClasses].sort().join('+'), cb = [...b.exposureClasses].sort().join('+');
    sameClasses += ca === cb;
    sameStrength += a.values.strengthClass === b.values.strengthClass;
    if (cube(a.values.strengthClass) > cube(b.values.strengthClass)) qwenStricter++;
    if (cube(a.values.strengthClass) < cube(b.values.strengthClass)) opusStricter++;
    if (a.values.strengthClass !== b.values.strengthClass)
        diffs.push(`[${i}] qwen ${a.values.strengthClass} ${ca} | opus ${b.values.strengthClass} ${cb} | ${row.text.slice(0, 70)}`);
}
console.log(`samples: ${n}`);
console.log(`same exposure classes: ${sameClasses}/${n}`);
console.log(`same strength class:   ${sameStrength}/${n}  (Qwen stricter ${qwenStricter}, Opus stricter ${opusStricter})`);
console.log(diffs.join('\n'));
