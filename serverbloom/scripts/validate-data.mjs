import { access, readFile } from 'node:fs/promises';

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
const bannerPresets = await readJson('../assets/banners/banner-presets.json');
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

const bannerCategories = new Set(['default','japanese-sakura','character','war-epic','cyberpunk','cozy','pets','gaming','fantasy-sci-fi','city-night','nature-landscape','music-party']);
const bannerColors = new Set(['pink','purple','blue','cyan','green','warm','red','dark']);
const defaultBannerIds = ['cyberpunk-purple','gaming-purple','anime-pink','sakura-pink','steam-style','chat-night','chat-neon','tech-blue','music-orange','fantasy-classic'];
if (!Array.isArray(bannerPresets)) errors.push('banner-presets.json: 根節點必須是陣列');
uniqueIds(Array.isArray(bannerPresets) ? bannerPresets : [], 'banner');
const defaultPresets = Array.isArray(bannerPresets) ? bannerPresets.filter(item => item.category === 'default') : [];
if (defaultPresets.length !== 10) errors.push(`banner-presets.json: 預設背景必須剛好 10 張，目前為 ${defaultPresets.length} 張`);
for (const [index, banner] of (Array.isArray(bannerPresets) ? bannerPresets : []).entries()) {
  for (const field of ['name','file','category','color']) required(banner, field, `banner ${banner.id || '(無 id)'}`);
  if (!bannerCategories.has(banner.category)) errors.push(`banner ${banner.id}: category 不在允許清單`);
  if (!bannerColors.has(banner.color)) errors.push(`banner ${banner.id}: color 不在允許清單`);
  if (!Array.isArray(banner.tags) || !banner.tags.length || banner.tags.some(tag => typeof tag !== 'string' || !tag.trim())) errors.push(`banner ${banner.id}: tags 必須是非空字串陣列`);
  if (!/^[a-z0-9][a-z0-9._-]*\.(?:webp|svg|png|jpe?g)$/i.test(banner.file || '')) errors.push(`banner ${banner.id}: file 格式不正確`);
  if (index < 10 && (banner.category !== 'default' || banner.id !== defaultBannerIds[index])) errors.push(`banner ${banner.id}: 前 10 張預設背景的順序或分類不正確`);
  if (index >= 10 && banner.category === 'default') errors.push(`banner ${banner.id}: 第 11 張以後不可歸類為預設背景`);
  try { await access(new URL(`../assets/banners/presets/${banner.file}`, import.meta.url)); }
  catch { errors.push(`banner ${banner.id}: 找不到圖片 ${banner.file}`); }
}

if (errors.length) {
  console.error(`資料驗證失敗（${errors.length} 項）：\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`資料驗證通過：${servers.length} 個 Server、${articles.length} 篇文章、${bannerPresets.length} 張 Banner。`);
