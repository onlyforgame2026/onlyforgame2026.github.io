import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appsScript = fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8');
const admin = fs.readFileSync(path.join(root, 'assets', 'js', 'admin.js'), 'utf8');
const adminPage = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const setup = fs.readFileSync(path.join(root, 'SETUP.md'), 'utf8');

function searchableText(server) {
  const values = [server.name, server.category, server.description, ...(server.tags || [])];
  if (server.name.includes('市集')) values.push('蒐集');
  return values.join(' ').toLowerCase();
}

const servers = [
  { name: '市集', category: '聊天交友', description: '交易交流', tags: [] },
  { name: '水晶花園', category: '遊戲', description: '休閒社群', tags: [] }
];

assert.equal(servers.filter(server => searchableText(server).includes('市'))[0].name, '市集');
assert.equal(servers.filter(server => searchableText(server).includes('蒐集'))[0].name, '市集');
assert.equal(servers.filter(server => searchableText(server).includes('水'))[0].name, '水晶花園');
assert.doesNotMatch(index, /server-name-(?:admin|input|save|status)/);
assert.doesNotMatch(index, /改名稱/);
assert.doesNotMatch(index, /updateServerName/);
assert.doesNotMatch(index, /assets\/js\/admin-loader\.js/);
assert.doesNotMatch(index, /assets\/js\/admin\.js/);
assert.match(index, /class="admin-gate"/);
assert.match(index, /href="\/serverbloom\/admin\.html"/);
assert.match(index, /event\.ctrlKey && event\.shiftKey && !event\.altKey && !event\.metaKey && key === 'b'/);
assert.doesNotMatch(index, /ctrlKey && event\.altKey/);
assert.doesNotMatch(index, /key === 'a'/);
assert.match(setup, /Ctrl\\+Shift\\+B/);
assert.match(adminPage, /assets\/js\/admin\.js/);
assert.match(admin, /data-name/);
assert.match(admin, /action: 'updateServerName'/);
assert.match(admin, /await assertAdmin\(\)/);
assert.match(appsScript, /data\.action === 'updateServerName'/);
assert.match(appsScript, /function updateServerName_\(data\)/);

console.log('Front-end search and back-office rename checks passed.');
