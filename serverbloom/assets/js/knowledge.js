(function () {
  'use strict';

  const DATA_URL = 'data/articles.json';
  const DEFAULT_COVER = 'assets/articles/default-knowledge-cover.svg';
  const categories = ['全部','新手入門','活躍度','成員留存','活動企劃','管理制度','宣傳成長','身分組','Bot 與工具','其他'];
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const coverOf = article => String(article?.cover || '').trim() || DEFAULT_COVER;
  const validArticles = payload => (Array.isArray(payload) ? payload : []).filter(article => article && article.id && article.title);
  const formatDate = value => { const parsed = new Date(`${value}T00:00:00`); return Number.isNaN(parsed.getTime()) ? escapeHtml(value) : parsed.toLocaleDateString('zh-TW'); };
  function coverError(event) { const image = event.currentTarget; if (image.dataset.coverFallback === 'true') { image.onerror = null; return; } image.dataset.coverFallback = 'true'; image.src = DEFAULT_COVER; }
  function card(article, compact = false) {
    const tags = Array.isArray(article.tags) ? article.tags.slice(0, 3) : [];
    if (compact) return `<article class="article"><strong title="${escapeHtml(article.title)}">${escapeHtml(article.title)}</strong><small>${escapeHtml(article.summary)}</small><a href="article.html?id=${encodeURIComponent(article.id)}">閱讀更多 →</a></article>`;
    return `<article class="knowledge-card"><a class="cover-link" href="article.html?id=${encodeURIComponent(article.id)}"><img src="${escapeHtml(coverOf(article))}" alt="${escapeHtml(article.title)}封面" loading="lazy"></a><div class="card-content"><div class="card-top"><span class="category-pill">${escapeHtml(article.category || '其他')}</span><span class="card-date">${formatDate(article.date)}</span></div><h2><a href="article.html?id=${encodeURIComponent(article.id)}">${escapeHtml(article.title)}</a></h2><p class="card-summary">${escapeHtml(article.summary || '')}</p><div class="card-tags">${tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div><div class="card-footer"><span>${escapeHtml(article.readingTime || '')}</span><a class="read-more" href="article.html?id=${encodeURIComponent(article.id)}">閱讀更多 →</a></div></div></article>`;
  }
  function bindCoverFallback(root) { root.querySelectorAll('img').forEach(image => image.addEventListener('error', coverError)); }
  async function fetchArticles() { const response = await fetch(DATA_URL, {cache:'no-store'}); if (!response.ok) throw new Error('無法讀取 articles.json'); return validArticles(await response.json()).sort((a,b) => String(b.date || '').localeCompare(String(a.date || ''))); }
  async function initKnowledge() {
    const grid = document.querySelector('#knowledgeGrid'), search = document.querySelector('#knowledgeSearch'), categoryRoot = document.querySelector('#knowledgeCategories'), count = document.querySelector('#knowledgeResultCount');
    if (!grid || !search || !categoryRoot || !count) return;
    let active = '全部', articles = [];
    categoryRoot.innerHTML = categories.map(category => `<button class="category-button${category === '全部' ? ' active' : ''}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('');
    const render = () => { const query = search.value.trim().toLowerCase(); const filtered = articles.filter(article => (active === '全部' || article.category === active) && [article.title,article.summary,article.category,...(Array.isArray(article.tags)?article.tags:[])].join(' ').toLowerCase().includes(query)); grid.innerHTML = filtered.length ? filtered.map(article => card(article)).join('') : '<div class="empty-state"><strong>找不到符合條件的文章</strong><br>請調整搜尋文字或文章分類。</div>'; count.textContent = `顯示 ${filtered.length} 篇文章`; bindCoverFallback(grid); };
    search.addEventListener('input', render);
    categoryRoot.addEventListener('click', event => { const button = event.target.closest('[data-category]'); if (!button) return; active = button.dataset.category; categoryRoot.querySelectorAll('.category-button').forEach(item => item.classList.toggle('active', item === button)); render(); });
    try { articles = await fetchArticles(); render(); } catch (error) { grid.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}，請透過本地伺服器預覽。</div>`; count.textContent = '載入失敗'; }
  }
  async function initHome() {
    const grid = document.querySelector('#homeKnowledgeGrid'); if (!grid) return;
    try { const articles = await fetchArticles(); grid.innerHTML = articles.slice(0,5).map(article => card(article,true)).join(''); }
    catch { grid.innerHTML = '<article class="article"><strong>知識庫暫時無法載入</strong><small>請稍後再試。</small><a href="knowledge.html">前往知識庫 →</a></article>'; }
  }
  if (document.body.dataset.page === 'knowledge') initKnowledge();
  else initHome();
})();
