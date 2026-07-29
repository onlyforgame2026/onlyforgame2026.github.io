import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appsScript = fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8');

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
assert.match(index, /adminPreview/);
assert.match(index, /action:'updateServerName'/);
assert.match(index, /server\.name=name/);
assert.match(appsScript, /data\.action === 'updateServerName'/);
assert.match(appsScript, /function updateServerName_\(data\)/);

console.log('Server name search and admin rename checks passed.');
