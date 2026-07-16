import { readFile } from 'node:fs/promises';

const errors = [];
const readJson = async path => {
  try { return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8')); }
  catch (error) { errors.push(`${path}: JSON 無法解析（${error.message}）`); return []; }
};
const required = (item, field, label) => {
  if (typeof item[field] !== 'string' || !item[field].trim()) errors.push(`${label}: 缺少 ${field}`);
};
const uniqueIds = (items, label) => {
  const seen = new Set();
  for (const item of items) {
    required(item, 'id', label);
    if (seen.has(item.id)) errors.push(`${label}: id 重複「${item.id}」`);
    seen.add(item.id);
  }
};

const servers = await readJson('../data/servers.json');
const articles = await readJson('../data/articles.json');
if (!Array.isArray(servers)) errors.push('servers.json: 根節點必須是陣列');
if (!Array.isArray(articles)) errors.push('articles.json: 根節點必須是陣列');

uniqueIds(Array.isArray(servers) ? servers : [], 'server');
for (const server of Array.isArray(servers) ? servers : []) {
  for (const field of ['name','category','description','inviteUrl']) required(server, field, `server ${server.id || '(無 id)'}`);
  if (!/^https:\/\/(?:www\.)?(?:discord\.gg\/|discord\.com\/invite\/)[A-Za-z0-9-]+\/?$/i.test(server.inviteUrl || '')) errors.push(`server ${server.id}: inviteUrl 格式不正確`);
  if (!Number.isFinite(server.memberCount) || server.memberCount < 0) errors.push(`server ${server.id}: memberCount 必須是非負數字`);
  if (!Number.isFinite(server.onlineCount) || server.onlineCount < 0) errors.push(`server ${server.id}: onlineCount 必須是非負數字`);
  if (Number.isFinite(server.memberCount) && Number.isFinite(server.onlineCount) && server.onlineCount > server.memberCount) errors.push(`server ${server.id}: onlineCount 不可大於 memberCount`);
  if (!/^#[0-9a-f]{6}$/i.test(server.primaryColor || '')) errors.push(`server ${server.id}: primaryColor 必須是 #RRGGBB`);
}

uniqueIds(Array.isArray(articles) ? articles : [], 'article');
for (const article of Array.isArray(articles) ? articles : []) {
  for (const field of ['title','summary','category','date']) required(article, field, `article ${article.id || '(無 id)'}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(article.date || '') || Number.isNaN(Date.parse(`${article.date}T00:00:00Z`))) errors.push(`article ${article.id}: date 格式不正確`);
  if (!Array.isArray(article.content)) errors.push(`article ${article.id}: content 必須是陣列`);
  else article.content.forEach((block, index) => { if (!block || typeof block !== 'object' || typeof block.type !== 'string') errors.push(`article ${article.id}: content[${index}] 結構不正確`); });
}

if (errors.length) {
  console.error(`資料驗證失敗（${errors.length} 項）：\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`資料驗證通過：${servers.length} 個 Server、${articles.length} 篇文章。`);
