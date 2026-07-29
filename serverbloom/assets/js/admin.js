import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const ADMIN = 'alyonayona0801@gmail.com';
const NAME_API = window.ServerBloomData?.API_URL;
const config = window.SERVERBLOOM_SUPABASE || {};
const configured = /^https:\/\/[^.]+\.supabase\.co$/.test(config.url || '') &&
  config.anonKey && !config.anonKey.includes('YOUR_');
let supabase;
let servers = [];
let baseline = [];
let editing = -1;
let lastWrite = 0;
let searchQuery = '';

const overlay = document.createElement('div');
overlay.className = 'sb-admin-overlay';
overlay.hidden = true;
overlay.innerHTML = `<section class="sb-admin" role="dialog" aria-modal="true" aria-labelledby="sbAdminTitle">
  <header class="sb-admin-head"><h2 id="sbAdminTitle">ServerBloom 管理後台</h2><button data-close aria-label="關閉">×</button></header>
  <div class="sb-admin-body">
    <div class="sb-admin-login">
      <p>管理員使用 Email 六位數驗證碼登入。</p>
      <label>Email<input id="sbEmail" type="email" value="${ADMIN}" readonly></label>
      <button class="primary" data-send>寄送驗證碼</button>
      <label>6 位數驗證碼<input id="sbOtp" inputmode="numeric" maxlength="6" pattern="[0-9]{6}"></label>
      <button class="primary" data-verify>驗證並登入</button>
      <p class="sb-admin-status" role="status"></p>
    </div>
    <div class="sb-admin-console" hidden>
      <div class="sb-admin-actions">
        <button class="primary" data-publish>發布變更</button><button data-preview>預覽</button>
        <button data-cancel>取消變更</button><button data-reset-original>回原始排序</button>
        <button data-restore>復原上一版</button>
        <label class="sb-admin-search"><span>Server Search</span><input data-server-search type="search" placeholder="搜尋 Server…" autocomplete="off"><button data-clear-search type="button" aria-label="清除 Server 搜尋">×</button></label>
        <button data-logout>登出</button>
      </div>
      <p class="sb-admin-status" role="status"></p>
      <div class="sb-admin-list" aria-label="Server 排序清單"></div>
    </div>
  </div>
</section>`;
document.body.appendChild(overlay);

const edit = document.createElement('div');
edit.className = 'sb-admin-edit';
edit.hidden = true;
edit.innerHTML = `<form novalidate>
  <h3>編輯排名排程</h3><p class="sb-admin-edit-name"></p>
  <div class="sb-admin-edit-grid">
    <label>指定位置<input name="target_rank" type="number" min="1" required></label>
    <label>發布狀態<select name="published"><option value="true">已發布</option><option value="false">未發布</option></select></label>
    <label>快速排程<select name="quick">
      <option value="unchanged">不變更時間</option><option value="now">立即開始</option>
      <option value="1">1 天</option><option value="3">3 天</option><option value="7">7 天</option>
      <option value="14">14 天</option><option value="30">30 天</option><option value="custom">自訂時間</option>
    </select></label>
    <label>開始時間（Asia/Taipei）<input name="starts_at" type="datetime-local"></label>
    <label>結束時間（Asia/Taipei）<input name="ends_at" type="datetime-local"></label>
    <label>結束後處理<select name="expiry_action">
      <option value="restore">回到原始位置</option><option value="keep">保持排程位置</option><option value="unpublish">自動下架</option>
    </select></label>
    <label class="sb-admin-check"><span>鎖定前 3 格</span><input name="lock_top_three" type="checkbox"></label>
  </div>
  <div class="sb-admin-form-actions"><button class="primary" type="submit">套用</button><button type="button" data-edit-close>取消</button></div>
</form>`;
document.body.appendChild(edit);

const statusEls = overlay.querySelectorAll('.sb-admin-status');
const say = message => statusEls.forEach(el => { el.textContent = message || ''; });
const clone = value => structuredClone(value);
const toLocal = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date).replace(' ', 'T');
};
const taipeiToUtc = value => {
  if (!value) return null;
  const utc = new Date(`${value}:00+08:00`);
  if (Number.isNaN(utc.getTime())) throw new Error('時間格式無效。');
  return utc.toISOString();
};
const formatTaipei = value => value ? new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '無';

function client() {
  if (!configured) throw new Error('請先在 supabase-config.js 填入 Supabase URL 與 anon key。');
  return supabase ||= createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'serverbloom-admin-auth' }
  });
}

async function assertAdmin() {
  const { data, error } = await client().auth.getUser();
  if (error || data.user?.email?.toLowerCase() !== ADMIN) throw new Error('目前帳號不是指定管理員。');
}

function normalize(row, index) {
  return {
    ...row,
    original_rank: Number(row.original_rank || row.original_position || row.position || index + 1),
    target_rank: Number(row.target_rank || row.position || index + 1),
    published: row.published ?? row.status === 'published',
    lock_top_three: row.lock_top_three ?? row.locked ?? false,
    expiry_action: ['restore', 'keep', 'unpublish'].includes(row.expiry_action) ? row.expiry_action : 'restore'
  };
}

async function load() {
  await assertAdmin();
  const { data, error } = await client().from('server_cards').select('*').order('original_rank');
  if (error) throw error;
  servers = (data || []).map(normalize);
  if (!servers.length && window.ServerBloomData) {
    const initial = await window.ServerBloomData.loadServers();
    const { error: importError } = await client().rpc('bootstrap_server_cards', { initial_cards: initial });
    if (importError) throw importError;
    return load();
  }
  baseline = clone(servers);
  render();
  say(`已載入 ${servers.length} 張 Server 卡片。`);
}

function sortDraft() {
  return servers
    .map((server, dataIndex) => ({ server, dataIndex }))
    .sort((a, b) =>
      a.server.target_rank - b.server.target_rank ||
      Number(b.server.lock_top_three) - Number(a.server.lock_top_three) ||
      a.server.original_rank - b.server.original_rank
    );
}

function move(from, to) {
  if (!Number.isInteger(from) || !servers[from]) return;
  const targetRank = Math.max(1, Math.min(servers.length, Number(to) + 1));
  if (servers[from].target_rank === targetRank) return;
  servers[from].target_rank = targetRank;
  render();
}

function statusText(server) {
  const parts = [server.published ? '已發布' : '未發布', `原始 ${server.original_rank}`, `指定 ${server.target_rank}`];
  if (server.lock_top_three) parts.push('鎖定前 3');
  if (server.starts_at) parts.push(`開始 ${formatTaipei(server.starts_at)}`);
  if (server.ends_at) parts.push(`結束 ${formatTaipei(server.ends_at)}`);
  parts.push({ restore: '到期恢復', keep: '到期保留', unpublish: '到期下架' }[server.expiry_action]);
  return parts.join('｜');
}

function searchableText(server) {
  return [
    server.name,
    server.server_id,
    server.id,
    server.category,
    server.description,
    server.short_description,
    server.long_description,
    ...(Array.isArray(server.tags) ? server.tags : [])
  ].filter(Boolean).join(' ').toLocaleLowerCase();
}

function render() {
  const list = overlay.querySelector('.sb-admin-list');
  list.replaceChildren();
  const query = searchQuery.trim().toLocaleLowerCase();
  const visible = sortDraft()
    .map((item, draftIndex) => ({ ...item, draftIndex }))
    .filter(({ server }) => !query || searchableText(server).includes(query));
  visible.forEach(({ server, dataIndex, draftIndex }) => {
    const row = document.createElement('div');
    row.className = 'sb-admin-row';
    row.draggable = !query;
    row.innerHTML = `<strong>${draftIndex + 1}</strong><div class="sb-admin-row-main"><b></b><small></small></div>
      <div class="sb-admin-row-actions"><button data-up>↑</button><button data-down>↓</button><button data-move>移至</button><button data-edit>編輯</button><button data-name>改名稱</button></div>`;
    row.querySelector('b').textContent = server.name || server.server_id;
    row.querySelector('small').textContent = statusText(server);
    row.ondragstart = event => event.dataTransfer.setData('text/plain', String(dataIndex));
    row.ondragover = event => event.preventDefault();
    row.ondrop = event => { event.preventDefault(); move(Number(event.dataTransfer.getData('text/plain')), draftIndex); };
    row.oncontextmenu = event => { event.preventDefault(); openEdit(dataIndex); };
    let timer;
    row.ontouchstart = () => { timer = setTimeout(() => openEdit(dataIndex), 650); };
    row.ontouchend = row.ontouchmove = () => clearTimeout(timer);
    row.querySelector('[data-up]').onclick = () => move(dataIndex, draftIndex - 1);
    row.querySelector('[data-down]').onclick = () => move(dataIndex, draftIndex + 1);
    row.querySelector('[data-move]').onclick = () => {
      const rank = Number.parseInt(prompt('移至第幾格？', String(server.target_rank)), 10);
      if (Number.isInteger(rank)) move(dataIndex, rank - 1);
    };
    if (query) row.querySelectorAll('[data-up], [data-down], [data-move]').forEach(button => {
      button.disabled = true;
      button.title = '請清除搜尋後再調整排序';
    });
    row.querySelector('[data-edit]').onclick = () => openEdit(dataIndex);
    row.querySelector('[data-name]').onclick = () => renameServer(dataIndex);
    list.appendChild(row);
  });
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'sb-admin-empty';
    empty.textContent = query ? `找不到符合「${searchQuery.trim()}」的 Server。` : '目前沒有 Server 卡片。';
    list.appendChild(empty);
  }
}

async function renameServer(index) {
  const server = servers[index];
  if (!server) return;
  const id = String(server.server_id || server.id || '').trim();
  const name = prompt('輸入新的 Server 名稱：', server.name || '');
  if (name === null) return;
  const normalizedName = name.trim();
  if (!normalizedName) return say('Server 名稱不可為空。');
  if (normalizedName.length > 80) return say('Server 名稱不可超過 80 個字元。');
  if (!id) return say('缺少 Server ID，無法更新名稱。');
  if (!NAME_API) return say('找不到 Google Apps Script API 設定。');

  try {
    await assertAdmin();
    say('正在更新 Server 名稱…');
    const body = new URLSearchParams({ action: 'updateServerName', id, name: normalizedName });
    await fetch(NAME_API, { method: 'POST', mode: 'no-cors', body });
    server.name = normalizedName;
    const baselineServer = baseline.find(item => item.id === server.id);
    if (baselineServer) baselineServer.name = normalizedName;
    render();
    say(`Server 名稱已更新為「${normalizedName}」。`);
  } catch (error) {
    say(error.message || 'Server 名稱更新失敗。');
  }
}

function openEdit(index) {
  editing = index;
  const server = servers[index];
  const form = edit.querySelector('form');
  edit.querySelector('.sb-admin-edit-name').textContent = `${server.name || server.server_id}（原始第 ${server.original_rank} 名）`;
  form.target_rank.value = server.target_rank;
  form.published.value = String(server.published);
  form.quick.value = 'unchanged';
  form.starts_at.value = toLocal(server.starts_at);
  form.ends_at.value = toLocal(server.ends_at);
  form.expiry_action.value = server.expiry_action;
  form.lock_top_three.checked = server.lock_top_three;
  edit.hidden = false;
}

edit.querySelector('[name=quick]').onchange = event => {
  const form = edit.querySelector('form');
  const value = event.target.value;
  if (value === 'unchanged' || value === 'custom') return;
  const now = new Date();
  form.starts_at.value = toLocal(now.toISOString());
  form.ends_at.value = /^\d+$/.test(value) ? toLocal(new Date(now.getTime() + Number(value) * 86400000).toISOString()) : '';
};

edit.querySelector('form').onsubmit = event => {
  event.preventDefault();
  const server = servers[editing];
  if (!server) return;
  const form = event.currentTarget;
  const startsAt = taipeiToUtc(form.starts_at.value);
  const endsAt = taipeiToUtc(form.ends_at.value);
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    alert('結束時間必須晚於開始時間。');
    return;
  }
  const targetRank = Number.parseInt(form.target_rank.value, 10);
  if (!Number.isInteger(targetRank) || targetRank < 1 || targetRank > servers.length) {
    alert(`指定位置必須介於 1 到 ${servers.length}。`);
    return;
  }
  Object.assign(server, {
    published: form.published.value === 'true',
    starts_at: startsAt,
    ends_at: endsAt,
    expiry_action: form.expiry_action.value,
    lock_top_three: form.lock_top_three.checked
  });
  if (server.lock_top_three && targetRank > 3) {
    alert('鎖定前 3 格時，指定位置必須是 1、2 或 3。');
    return;
  }
  move(editing, targetRank - 1);
  edit.hidden = true;
  say('已套用到預覽資料，尚未寫入 Supabase。');
};
edit.querySelector('[data-edit-close]').onclick = () => { edit.hidden = true; };

async function publish() {
  if (Date.now() - lastWrite < 3000) throw new Error('操作太頻繁，請 3 秒後再發布。');
  lastWrite = Date.now();
  await assertAdmin();
  const baselineById = new Map(baseline.map(server => [server.id, server]));
  const comparable = server => JSON.stringify({
    target_rank: Number(server.target_rank),
    starts_at: server.starts_at || null,
    ends_at: server.ends_at || null,
    expiry_action: server.expiry_action,
    published: Boolean(server.published),
    lock_top_three: Boolean(server.lock_top_three)
  });
  const changed = servers.filter(server =>
    !baselineById.has(server.id) || comparable(server) !== comparable(baselineById.get(server.id))
  );
  if (!changed.length) {
    say('沒有需要發布的變更。');
    return;
  }
  const payload = changed.map(server => ({
    id: server.id, target_rank: server.target_rank, starts_at: server.starts_at,
    ends_at: server.ends_at, expiry_action: server.expiry_action,
    published: server.published, lock_top_three: server.lock_top_three
  }));
  const { error } = await client().rpc('publish_server_cards', { card_changes: payload });
  if (error) throw error;
  await load();
  say('發布完成，已重新讀取 Supabase。');
}

function preview() {
  window.ServerBloomAdminPreview = clone(servers);
  window.dispatchEvent(new CustomEvent('serverbloom:admin-preview', { detail: servers.map(s => ({ ...s, position: s.target_rank })) }));
  overlay.hidden = true;
}

async function show() {
  overlay.hidden = false;
  if (!configured) return say('請先在 supabase-config.js 填入 Supabase URL 與 anon key。');
  const { data } = await client().auth.getSession();
  const loggedIn = data.session?.user?.email?.toLowerCase() === ADMIN;
  overlay.querySelector('.sb-admin-login').hidden = loggedIn;
  overlay.querySelector('.sb-admin-console').hidden = !loggedIn;
  if (loggedIn) await load();
}

overlay.querySelector('[data-close]').onclick = () => { overlay.hidden = true; };
overlay.querySelector('[data-send]').onclick = async () => {
  try {
    const { error } = await client().auth.signInWithOtp({ email: ADMIN, options: { shouldCreateUser: false } });
    if (error) throw error;
    say('驗證碼已寄出，有效時間依 Supabase 設定為 10 分鐘。');
  } catch (error) { say(error.message); }
};
overlay.querySelector('[data-verify]').onclick = async () => {
  try {
    const token = overlay.querySelector('#sbOtp').value.trim();
    if (!/^\d{6}$/.test(token)) throw new Error('請輸入 6 位數驗證碼。');
    const { data, error } = await client().auth.verifyOtp({ email: ADMIN, token, type: 'email' });
    if (error) throw error;
    if (data.user?.email?.toLowerCase() !== ADMIN) throw new Error('目前帳號不是指定管理員。');
    await show();
  } catch (error) { say(error.message); }
};
overlay.querySelector('[data-publish]').onclick = () => publish().catch(error => say(error.message));
overlay.querySelector('[data-preview]').onclick = preview;
overlay.querySelector('[data-cancel]').onclick = () => { servers = clone(baseline); render(); say('已取消尚未發布的修改。'); };
overlay.querySelector('[data-reset-original]').onclick = async () => {
  try {
    await assertAdmin();
    const { error } = await client().rpc('reset_server_card_schedules');
    if (error) throw error;
    await load();
    say('已清除所有排名排程並恢復 original_rank。');
  } catch (error) { say(error.message); }
};
overlay.querySelector('[data-restore]').onclick = async () => {
  try {
    await assertAdmin();
    const { error } = await client().rpc('restore_previous_server_cards');
    if (error) throw error;
    await load();
    say('已復原上一版。');
  } catch (error) { say(error.message); }
};
const searchInput = overlay.querySelector('[data-server-search]');
searchInput.oninput = event => {
  searchQuery = event.target.value;
  render();
};
overlay.querySelector('[data-clear-search]').onclick = () => {
  searchQuery = '';
  searchInput.value = '';
  searchInput.focus();
  render();
};
overlay.querySelector('[data-logout]').onclick = async () => { await client().auth.signOut(); location.reload(); };
window.ServerBloomAdmin = Object.freeze({ open: () => show().catch(error => say(error.message)) });
