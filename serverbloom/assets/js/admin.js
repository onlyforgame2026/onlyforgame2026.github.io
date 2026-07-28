import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const ADMIN = 'alyonayona0801@gmail.com';
const config = window.SERVERBLOOM_SUPABASE || {};
const configured = /^https:\/\/[^.]+\.supabase\.co$/.test(config.url || '') &&
  config.anonKey && !config.anonKey.includes('YOUR_');

let supabase;
let servers = [];
let original = [];
let editing = null;
let dragIndex = null;
let lastWrite = 0;

const overlay = document.createElement('div');
overlay.className = 'sb-admin-overlay';
overlay.hidden = true;
overlay.innerHTML = `<section class="sb-admin" role="dialog" aria-modal="true" aria-labelledby="sbAdminTitle">
  <header class="sb-admin-head">
    <h2 id="sbAdminTitle">ServerBloom 管理後台</h2>
    <button data-close aria-label="關閉">✕</button>
  </header>
  <div class="sb-admin-body">
    <div class="sb-admin-login">
      <p>僅限指定管理員，以 Email 六位數驗證碼登入。</p>
      <label>Email<input id="sbEmail" type="email" autocomplete="email" value="${ADMIN}" readonly></label>
      <button class="primary" data-send>寄送驗證碼</button>
      <label>6 位數驗證碼<input id="sbOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}"></label>
      <button class="primary" data-verify>驗證並登入</button>
      <p class="sb-admin-status" role="status"></p>
    </div>
    <div class="sb-admin-console" hidden>
      <div class="sb-admin-actions">
        <button class="primary" data-publish>發布變更</button>
        <button data-preview>預覽</button>
        <button data-cancel>取消變更</button>
        <button data-reset-original>回原始排序</button>
        <button data-restore>復原上一版</button>
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
edit.innerHTML = `<form>
  <h3>編輯卡片位置與排程</h3>
  <p class="sb-admin-edit-name"></p>
  <div class="sb-admin-edit-grid">
    <label>指定格數<input name="position" type="number" min="1" required></label>
    <label>狀態<select name="status">
      <option value="published">已發布</option>
      <option value="draft">草稿</option>
      <option value="archived">下架</option>
    </select></label>
    <label>快速排程<select name="duration">
      <option value="">不變更到期時間</option>
      <option value="7">置頂 7 天後回原位</option>
      <option value="30">置頂 30 天後回原位</option>
      <option value="clear">清除排程</option>
    </select></label>
    <label>到期處理<select name="expiry_action">
      <option value="normal">到期回原位</option>
      <option value="unpublish">到期自動下架</option>
    </select></label>
    <label>開始時間<input name="starts_at" type="datetime-local"></label>
    <label>結束時間<input name="ends_at" type="datetime-local"></label>
    <label>到期日<input name="expires_at" type="datetime-local"></label>
    <label class="sb-admin-check"><span>鎖定前 3 格</span><input name="locked" type="checkbox"></label>
  </div>
  <div class="sb-admin-form-actions">
    <button class="primary" type="submit">套用</button>
    <button type="button" data-edit-close>取消</button>
  </div>
</form>`;
document.body.appendChild(edit);

const statusEls = overlay.querySelectorAll('.sb-admin-status');
const say = message => statusEls.forEach(el => { el.textContent = message || ''; });
const toLocalDateTime = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const fromLocalDateTime = value => value ? new Date(value).toISOString() : null;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function client() {
  if (!configured) throw new Error('請先在 supabase-config.js 填入 Supabase URL 與 anon key。');
  return supabase ||= createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'serverbloom-admin-auth'
    }
  });
}

async function assertAdmin() {
  const { data, error } = await client().auth.getUser();
  if (error || data.user?.email?.toLowerCase() !== ADMIN) throw new Error('目前登入帳號不是指定管理員。');
  return data.user;
}

function normalizeRow(row, index) {
  const originalPosition = Number(row.original_position || row.originalPosition || row.position || index + 1);
  return {
    ...row,
    position: Number(row.position || index + 1),
    original_position: originalPosition,
    status: row.status || 'published',
    expiry_action: row.expiry_action || 'normal',
    locked: !!row.locked
  };
}

async function load() {
  await assertAdmin();
  say('讀取後台資料中...');
  const { data, error } = await client().from('server_cards').select('*').order('position', { ascending: true });
  if (error) throw error;
  servers = (data || []).map(normalizeRow);

  if (!servers.length && window.ServerBloomData) {
    const current = await window.ServerBloomData.loadServers();
    const { error: bootstrapError } = await client().rpc('bootstrap_server_cards', { initial_cards: current });
    if (bootstrapError) throw bootstrapError;
    const { data: imported, error: importReadError } = await client().from('server_cards').select('*').order('position', { ascending: true });
    if (importReadError) throw importReadError;
    servers = (imported || []).map(normalizeRow);
  }

  normalizePositions();
  original = structuredClone(servers);
  render();
  say(servers.length ? `已載入 ${servers.length} 張 Server 卡片。` : '目前沒有 Server 卡片資料。');
}

function normalizePositions() {
  servers.forEach((server, index) => {
    server.position = index + 1;
    if (!Number.isFinite(Number(server.original_position))) server.original_position = index + 1;
  });
}

function move(from, to) {
  to = clamp(Number(to), 0, servers.length - 1);
  if (!Number.isInteger(from) || from === to) return;
  const [item] = servers.splice(from, 1);
  servers.splice(to, 0, item);
  normalizePositions();
  render();
}

function resetOriginalOrder() {
  servers.sort((a, b) => Number(a.original_position || a.position) - Number(b.original_position || b.position));
  servers.forEach((server, index) => {
    server.position = index + 1;
    server.status = 'published';
    server.starts_at = null;
    server.ends_at = null;
    server.expires_at = null;
    server.expiry_action = 'normal';
    server.locked = index < 3 && !!server.locked;
  });
  render();
  say('已回到原始排序。按「發布變更」後才會更新前台。');
}

function statusText(server) {
  const parts = [server.status === 'published' ? '已發布' : server.status === 'draft' ? '草稿' : '下架'];
  if (server.locked) parts.push('鎖定');
  if (server.starts_at) parts.push(`開始 ${new Date(server.starts_at).toLocaleString()}`);
  if (server.ends_at) parts.push(`結束 ${new Date(server.ends_at).toLocaleString()}`);
  if (server.expires_at) {
    parts.push(`${server.expiry_action === 'normal' ? '到期回原位' : '到期下架'} ${new Date(server.expires_at).toLocaleString()}`);
  }
  return parts.join('｜');
}

function render() {
  const list = overlay.querySelector('.sb-admin-list');
  list.innerHTML = '';
  if (!servers.length) {
    list.innerHTML = '<p class="sb-admin-empty">沒有資料。請確認 SQL 已執行，或重新登入後再試。</p>';
    return;
  }

  servers.forEach((server, index) => {
    const row = document.createElement('div');
    row.className = 'sb-admin-row';
    row.draggable = true;
    row.dataset.index = String(index);
    row.innerHTML = `<strong>${index + 1}</strong>
      <div class="sb-admin-row-main">
        <b></b>
        <small></small>
      </div>
      <div class="sb-admin-row-actions">
        <button type="button" data-up aria-label="上移">↑</button>
        <button type="button" data-down aria-label="下移">↓</button>
        <button type="button" data-move>移至</button>
        <button type="button" data-edit>編輯</button>
      </div>`;
    row.querySelector('b').textContent = server.name || server.server_id || '未命名 Server';
    row.querySelector('small').textContent = `原始第 ${server.original_position || index + 1} 格｜${statusText(server)}`;

    row.addEventListener('dragstart', event => {
      dragIndex = index;
      row.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    });
    row.addEventListener('dragover', event => {
      event.preventDefault();
      row.classList.add('drag-over');
      event.dataTransfer.dropEffect = 'move';
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', event => {
      event.preventDefault();
      row.classList.remove('drag-over');
      const from = Number(event.dataTransfer.getData('text/plain') || dragIndex);
      move(from, index);
    });
    row.addEventListener('dragend', () => {
      dragIndex = null;
      row.classList.remove('dragging');
      list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
    row.oncontextmenu = event => {
      event.preventDefault();
      openEdit(index);
    };

    let holdTimer = 0;
    row.addEventListener('touchstart', () => {
      holdTimer = window.setTimeout(() => openEdit(index), 650);
    }, { passive: true });
    row.addEventListener('touchend', () => window.clearTimeout(holdTimer));
    row.addEventListener('touchmove', () => window.clearTimeout(holdTimer), { passive: true });

    row.querySelector('[data-up]').onclick = () => move(index, index - 1);
    row.querySelector('[data-down]').onclick = () => move(index, index + 1);
    row.querySelector('[data-move]').onclick = () => {
      const value = window.prompt('移到第幾格？', String(index + 1));
      if (!value) return;
      const next = Number.parseInt(value, 10);
      if (Number.isInteger(next)) move(index, next - 1);
    };
    row.querySelector('[data-edit]').onclick = () => openEdit(index);
    list.appendChild(row);
  });
}

function openEdit(index) {
  editing = index;
  const server = servers[index];
  const form = edit.querySelector('form');
  edit.querySelector('.sb-admin-edit-name').textContent = `${server.name || server.server_id}：目前第 ${index + 1} 格，原始第 ${server.original_position || index + 1} 格`;
  form.position.value = String(index + 1);
  form.status.value = server.status || 'published';
  form.duration.value = '';
  form.expiry_action.value = server.expiry_action || 'normal';
  form.starts_at.value = toLocalDateTime(server.starts_at);
  form.ends_at.value = toLocalDateTime(server.ends_at);
  form.expires_at.value = toLocalDateTime(server.expires_at);
  form.locked.checked = !!server.locked;
  edit.hidden = false;
}

edit.querySelector('form').onsubmit = event => {
  event.preventDefault();
  if (!Number.isInteger(editing) || !servers[editing]) return;
  const form = event.currentTarget;
  const server = servers[editing];
  const duration = form.duration.value;

  server.status = form.status.value;
  server.starts_at = fromLocalDateTime(form.starts_at.value);
  server.ends_at = fromLocalDateTime(form.ends_at.value);
  server.expires_at = fromLocalDateTime(form.expires_at.value);
  server.expiry_action = form.expiry_action.value;
  server.locked = form.locked.checked;

  if (duration === '7' || duration === '30') {
    const days = Number(duration);
    server.status = 'published';
    server.starts_at = new Date().toISOString();
    server.ends_at = null;
    server.expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    server.expiry_action = 'normal';
  } else if (duration === 'clear') {
    server.starts_at = null;
    server.ends_at = null;
    server.expires_at = null;
    server.expiry_action = 'normal';
  }

  const nextPosition = Number.parseInt(form.position.value, 10);
  if (Number.isInteger(nextPosition)) move(editing, nextPosition - 1);
  edit.hidden = true;
  say('已套用到暫存清單。按「發布變更」後才會更新前台。');
};
edit.querySelector('[data-edit-close]').onclick = () => { edit.hidden = true; };

async function publish() {
  if (Date.now() - lastWrite < 3000) throw new Error('操作太頻繁，請 3 秒後再發布。');
  lastWrite = Date.now();
  await assertAdmin();
  normalizePositions();
  const payload = servers.map((server, index) => ({
    id: server.id,
    position: index + 1,
    original_position: Number(server.original_position || index + 1),
    status: server.status,
    starts_at: server.starts_at,
    ends_at: server.ends_at,
    expires_at: server.expires_at,
    locked: !!server.locked && index < 3,
    expiry_action: server.expiry_action || 'normal'
  }));
  const { error } = await client().rpc('publish_server_cards', { card_changes: payload });
  if (error) throw error;
  original = structuredClone(servers);
  say('發布完成。重新整理前台即可看到有效資料。');
}

async function restore() {
  await assertAdmin();
  const { error } = await client().rpc('restore_previous_server_cards');
  if (error) throw error;
  await load();
  say('已復原上一版。');
}

function preview() {
  window.ServerBloomAdminPreview = structuredClone(servers);
  document.documentElement.classList.add('sb-admin-mode');
  window.dispatchEvent(new CustomEvent('serverbloom:admin-preview', { detail: servers }));
  overlay.hidden = true;
}

async function show() {
  overlay.hidden = false;
  say('');
  if (!configured) {
    say('請先在 supabase-config.js 填入 Supabase URL 與 anon key。');
    return;
  }
  const { data } = await client().auth.getSession();
  const email = data.session?.user?.email?.toLowerCase();
  if (email === ADMIN) {
    overlay.querySelector('.sb-admin-login').hidden = true;
    overlay.querySelector('.sb-admin-console').hidden = false;
    try {
      await load();
    } catch (error) {
      say(error.message);
    }
  } else {
    overlay.querySelector('.sb-admin-login').hidden = false;
    overlay.querySelector('.sb-admin-console').hidden = true;
  }
}

overlay.querySelector('[data-close]').onclick = () => { overlay.hidden = true; };
overlay.querySelector('[data-send]').onclick = async () => {
  try {
    const { error } = await client().auth.signInWithOtp({ email: ADMIN, options: { shouldCreateUser: false } });
    if (error) throw error;
    say('驗證碼已寄出，10 分鐘內輸入。');
  } catch (error) {
    say(error.message);
  }
};
overlay.querySelector('[data-verify]').onclick = async () => {
  try {
    const token = overlay.querySelector('#sbOtp').value.trim();
    if (!/^\d{6}$/.test(token)) throw new Error('請輸入 6 位數驗證碼。');
    const { data, error } = await client().auth.verifyOtp({ email: ADMIN, token, type: 'email' });
    if (error) throw error;
    if (data.user?.email?.toLowerCase() !== ADMIN) {
      await client().auth.signOut();
      throw new Error('登入帳號不是指定管理員。');
    }
    await show();
  } catch (error) {
    say(error.message);
  }
};
overlay.querySelector('[data-publish]').onclick = () => publish().catch(error => say(error.message));
overlay.querySelector('[data-preview]').onclick = preview;
overlay.querySelector('[data-cancel]').onclick = () => {
  servers = structuredClone(original);
  normalizePositions();
  render();
  say('已取消尚未發布的變更。');
};
overlay.querySelector('[data-reset-original]').onclick = resetOriginalOrder;
overlay.querySelector('[data-restore]').onclick = () => restore().catch(error => say(error.message));
overlay.querySelector('[data-logout]').onclick = async () => {
  await client().auth.signOut();
  location.reload();
};

window.ServerBloomAdmin = Object.freeze({ open: show });
