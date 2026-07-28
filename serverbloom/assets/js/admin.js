import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const ADMIN = 'alyonayona0801@gmail.com';
const config = window.SERVERBLOOM_SUPABASE || {};
const configured = /^https:\/\/[^.]+\.supabase\.co$/.test(config.url || '') &&
  config.anonKey && !config.anonKey.includes('YOUR_');
let supabase;
let servers = [];
let original = [];
let editing = null;
let lastWrite = 0;

const overlay = document.createElement('div');
overlay.className = 'sb-admin-overlay';
overlay.hidden = true;
overlay.innerHTML = `<section class="sb-admin" role="dialog" aria-modal="true" aria-labelledby="sbAdminTitle">
  <header class="sb-admin-head"><h2 id="sbAdminTitle">ServerBloom 管理後台</h2><button data-close aria-label="關閉">✕</button></header>
  <div class="sb-admin-body"><div class="sb-admin-login">
    <p>僅限指定管理員，以 Email 六位數驗證碼登入。</p>
    <label>Email<input id="sbEmail" type="email" autocomplete="email" value="${ADMIN}" readonly></label>
    <button class="primary" data-send>寄送驗證碼</button>
    <label>6 位數驗證碼<input id="sbOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}"></label>
    <button class="primary" data-verify>驗證並登入</button><p class="sb-admin-status" role="status"></p>
  </div><div class="sb-admin-console" hidden>
    <div class="sb-admin-actions"><button class="primary" data-publish>發布變更</button><button data-preview>預覽</button><button data-cancel>取消變更</button><button data-restore>復原上一版</button><button data-logout>登出</button></div>
    <p class="sb-admin-status" role="status"></p><div class="sb-admin-list"></div>
  </div></div></section>`;
document.body.appendChild(overlay);
const edit = document.createElement('div');
edit.className = 'sb-admin-edit';
edit.hidden = true;
edit.innerHTML = `<form><h3>編輯卡片排程</h3><div class="sb-admin-edit-grid">
  <label>指定格數<input name="position" type="number" min="1" required></label>
  <label>狀態<select name="status"><option value="published">已發布</option><option value="draft">草稿</option><option value="archived">下架</option></select></label>
  <label>開始時間<input name="starts_at" type="datetime-local"></label><label>結束時間<input name="ends_at" type="datetime-local"></label>
  <label>到期日<input name="expires_at" type="datetime-local"></label>
  <label><span>鎖定於前 3 格</span><input name="locked" type="checkbox"></label>
  <label>到期處理<select name="expiry_action"><option value="unpublish">自動下架</option><option value="normal">回普通排序</option></select></label>
  </div><div class="sb-admin-form-actions"><button class="primary" type="submit">套用</button><button type="button" data-edit-close>取消</button></div></form>`;
document.body.appendChild(edit);
const statusEls = overlay.querySelectorAll('.sb-admin-status');
const say = message => statusEls.forEach(el => { el.textContent = message; });
const isoLocal = value => value ? new Date(value).toISOString().slice(0, 16) : '';
const safeDate = value => value ? new Date(value).toISOString() : null;

function client() {
  if (!configured) throw new Error('請先在 supabase-config.js 填入 Supabase URL 與 anon key。');
  return supabase ||= createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'serverbloom-admin-auth' }
  });
}
async function assertAdmin() {
  const { data, error } = await client().auth.getUser();
  if (error || data.user?.email?.toLowerCase() !== ADMIN) throw new Error('管理員驗證失敗。');
  return data.user;
}
async function load() {
  await assertAdmin();
  const { data, error } = await client().from('server_cards').select('*').order('position');
  if (error) throw error;
  servers = (data || []).map(x => ({ ...x }));
  if (!servers.length && window.ServerBloomData) {
    const current = await window.ServerBloomData.loadServers();
    const { error: bootstrapError } = await client().rpc('bootstrap_server_cards', { initial_cards: current });
    if (bootstrapError) throw bootstrapError;
    const { data: imported, error: importReadError } = await client().from('server_cards').select('*').order('position');
    if (importReadError) throw importReadError;
    servers = (imported || []).map(x => ({ ...x }));
  }
  original = structuredClone(servers);
  render();
}
function render() {
  const list = overlay.querySelector('.sb-admin-list');
  list.innerHTML = '';
  servers.forEach((server, index) => {
    const row = document.createElement('div');
    row.className = 'sb-admin-row';
    row.draggable = true;
    row.dataset.index = index;
    const lock = server.locked && index < 3 ? ' 🔒' : '';
    row.innerHTML = `<strong>${index + 1}</strong><div><b></b><small></small></div><div class="sb-admin-row-actions">
      <button data-up>↑</button><button data-down>↓</button><button data-move>移至</button><button data-edit>編輯</button></div>`;
    row.querySelector('b').textContent = server.name || server.server_id;
    row.querySelector('small').textContent = `${server.status}${lock}${server.expires_at ? ` · 到期 ${new Date(server.expires_at).toLocaleString()}` : ''}`;
    row.addEventListener('dragstart', () => row.classList.add('dragging'));
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.addEventListener('dragover', event => {
      event.preventDefault();
      const from = Number(list.querySelector('.dragging')?.dataset.index);
      if (!Number.isInteger(from) || from === index) return;
      const [item] = servers.splice(from, 1); servers.splice(index, 0, item); normalize(); render();
    });
    row.oncontextmenu = event => { event.preventDefault(); openEdit(index); };
    let hold; row.addEventListener('touchstart', () => { hold = setTimeout(() => openEdit(index), 650); }, { passive: true });
    row.addEventListener('touchend', () => clearTimeout(hold));
    row.querySelector('[data-up]').onclick = () => move(index, index - 1);
    row.querySelector('[data-down]').onclick = () => move(index, index + 1);
    row.querySelector('[data-move]').onclick = () => { const value = prompt('移至第幾格？', String(index + 1)); if (value) move(index, Number(value) - 1); };
    row.querySelector('[data-edit]').onclick = () => openEdit(index);
    list.appendChild(row);
  });
}
function normalize() { servers.forEach((server, index) => { server.position = index + 1; }); }
function move(from, to) {
  to = Math.max(0, Math.min(servers.length - 1, to));
  if (from === to) return;
  const [item] = servers.splice(from, 1); servers.splice(to, 0, item); normalize(); render();
}
function openEdit(index) {
  editing = index;
  const s = servers[index], form = edit.querySelector('form');
  form.position.value = s.position; form.status.value = s.status;
  form.starts_at.value = isoLocal(s.starts_at); form.ends_at.value = isoLocal(s.ends_at);
  form.expires_at.value = isoLocal(s.expires_at); form.locked.checked = !!s.locked;
  form.expiry_action.value = s.expiry_action || 'unpublish'; edit.hidden = false;
}
edit.querySelector('form').onsubmit = event => {
  event.preventDefault();
  const f = event.currentTarget, s = servers[editing];
  s.status = f.status.value; s.starts_at = safeDate(f.starts_at.value); s.ends_at = safeDate(f.ends_at.value);
  s.expires_at = safeDate(f.expires_at.value); s.locked = f.locked.checked; s.expiry_action = f.expiry_action.value;
  move(editing, Number(f.position.value) - 1); edit.hidden = true;
};
edit.querySelector('[data-edit-close]').onclick = () => { edit.hidden = true; };

async function publish() {
  if (Date.now() - lastWrite < 3000) throw new Error('操作太頻繁，請稍候。');
  lastWrite = Date.now();
  await assertAdmin();
  const payload = servers.map((s, index) => ({
    id: s.id, position: index + 1, status: s.status, starts_at: s.starts_at, ends_at: s.ends_at,
    expires_at: s.expires_at, locked: !!s.locked && index < 3, expiry_action: s.expiry_action
  }));
  const { error } = await client().rpc('publish_server_cards', { card_changes: payload });
  if (error) throw error;
  original = structuredClone(servers); say('發布完成。重新整理前台即可看到有效資料。');
}
async function restore() {
  await assertAdmin();
  const { error } = await client().rpc('restore_previous_server_cards');
  if (error) throw error;
  await load(); say('已復原上一版。');
}
function preview() {
  window.ServerBloomAdminPreview = structuredClone(servers);
  document.documentElement.classList.add('sb-admin-mode');
  window.dispatchEvent(new CustomEvent('serverbloom:admin-preview', { detail: servers }));
  overlay.hidden = true;
}
async function show() {
  overlay.hidden = false;
  if (!configured) { say('尚未設定 Supabase。請依 SETUP.md 填入兩個公開連線值。'); return; }
  const { data } = await client().auth.getSession();
  const email = data.session?.user?.email?.toLowerCase();
  if (email === ADMIN) {
    overlay.querySelector('.sb-admin-login').hidden = true;
    overlay.querySelector('.sb-admin-console').hidden = false;
    try { await load(); } catch (error) { say(error.message); }
  }
}
overlay.querySelector('[data-close]').onclick = () => { overlay.hidden = true; };
overlay.querySelector('[data-send]').onclick = async () => {
  try {
    const { error } = await client().auth.signInWithOtp({ email: ADMIN, options: { shouldCreateUser: false } });
    if (error) throw error; say('驗證碼已寄出，10 分鐘內輸入。');
  } catch (error) { say(error.message); }
};
overlay.querySelector('[data-verify]').onclick = async () => {
  try {
    const token = overlay.querySelector('#sbOtp').value.trim();
    if (!/^\d{6}$/.test(token)) throw new Error('請輸入 6 位數驗證碼。');
    const { data, error } = await client().auth.verifyOtp({ email: ADMIN, token, type: 'email' });
    if (error) throw error;
    if (data.user?.email?.toLowerCase() !== ADMIN) { await client().auth.signOut(); throw new Error('非授權管理員。'); }
    await show();
  } catch (error) { say(error.message); }
};
overlay.querySelector('[data-publish]').onclick = () => publish().catch(error => say(error.message));
overlay.querySelector('[data-preview]').onclick = preview;
overlay.querySelector('[data-cancel]').onclick = () => { servers = structuredClone(original); render(); say('已取消未發布變更。'); };
overlay.querySelector('[data-restore]').onclick = () => restore().catch(error => say(error.message));
overlay.querySelector('[data-logout]').onclick = async () => { await client().auth.signOut(); location.reload(); };
window.ServerBloomAdmin = Object.freeze({ open: show });
