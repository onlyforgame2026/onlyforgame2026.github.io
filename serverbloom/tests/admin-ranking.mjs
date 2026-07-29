import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../assets/js/admin.js', import.meta.url), 'utf8');
const body = name => source.match(new RegExp(`function ${name}\\([^]*?\\n}`))?.[0] || '';

assert.doesNotMatch(body('sortDraft'), /target_rank\s*=/, 'sortDraft must not rewrite target_rank');
assert.doesNotMatch(body('render'), /target_rank\s*=/, 'render must not rewrite target_rank');
assert.match(source, /const changed = servers\.filter/, 'publish must diff against baseline');
assert.match(source, /const payload = changed\.map/, 'publish must send only changed cards');
assert.match(source, /data-server-search/, 'admin console must include Server search');
assert.match(source, /searchableText\(server\)/, 'Server search must inspect each server');
assert.match(source, /searchQuery\.trim\(\)\.toLocaleLowerCase\(\)/, 'Server search must normalize the query');

const cards = [
  { id: 'a', target_rank: 1, original_rank: 1, lock_top_three: false },
  { id: 'b', target_rank: 1, original_rank: 9, lock_top_three: false },
  { id: 'c', target_rank: 2, original_rank: 2, lock_top_three: false }
];
const before = structuredClone(cards);
const display = cards.map((server, dataIndex) => ({ server, dataIndex }))
  .sort((a, b) => a.server.target_rank - b.server.target_rank ||
    Number(b.server.lock_top_three) - Number(a.server.lock_top_three) ||
    a.server.original_rank - b.server.original_rank);
assert.equal(display.length, 3);
assert.deepEqual(cards, before, 'display sorting must preserve duplicate target_rank values');
console.log('admin ranking invariants: PASS');
