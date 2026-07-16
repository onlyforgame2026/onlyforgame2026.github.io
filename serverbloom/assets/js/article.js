(function () {
  'use strict';

  const DATA_URL = 'data/articles.json';
  const DEFAULT_COVER = 'assets/articles/default-knowledge-cover.svg';
  const app = document.querySelector('#articleApp');
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const coverOf = article => String(article?.cover || '').trim() || DEFAULT_COVER;
  const formatDate = value => { const parsed = new Date(`${value}T00:00:00`); return Number.isNaN(parsed.getTime()) ? escapeHtml(value) : parsed.toLocaleDateString('zh-TW'); };
  const list = value => Array.isArray(value) ? value : [];
  function coverError(event) { const image = event.currentTarget; if (image.dataset.coverFallback === 'true') { image.onerror = null; return; } image.dataset.coverFallback = 'true'; image.src = DEFAULT_COVER; }
  function renderBlock(block) {
    if (!block || typeof block !== 'object') return '';
    switch (block.type) {
      case 'paragraph': return `<p>${escapeHtml(block.text)}</p>`;
      case 'heading': { const level = Number(block.level) === 3 ? 3 : 2; return `<h${level}>${escapeHtml(block.text)}</h${level}>`; }
      case 'list': return `<ul>${list(block.items).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
      case 'quote': return `<blockquote class="article-quote">${escapeHtml(block.text)}</blockquote>`;
      case 'image': return `<img class="content-image" src="${escapeHtml(String(block.src || '').trim() || DEFAULT_COVER)}" alt="${escapeHtml(block.alt || '')}" loading="lazy">`;
      case 'code': return `<div class="code-block"><pre><code data-language="${escapeHtml(block.language || 'text')}">${escapeHtml(block.code)}</code></pre></div>`;
      case 'divider': return '<hr class="content-divider">';
      default: return '';
    }
  }
  function meta(name, content) { let element = document.querySelector(`meta[${name.startsWith('og:') ? 'property' : 'name'}="${name}"]`); if (!element) { element = document.createElement('meta'); element.setAttribute(name.startsWith('og:') ? 'property' : 'name', name); document.head.appendChild(element); } element.setAttribute('content', content); }
  function updateSeo(article) { document.title = `${article.title}｜ServerBloom`; meta('description', article.summary || ''); meta('og:title', article.title); meta('og:description', article.summary || ''); meta('og:image', new URL(coverOf(article), location.href).href); }
  function recommendCard(article) { return `<a class="recommend-card" href="article.html?id=${encodeURIComponent(article.id)}"><img src="${escapeHtml(coverOf(article))}" alt="${escapeHtml(article.title)}封面" loading="lazy"><div class="recommend-copy"><strong>${escapeHtml(article.title)}</strong><small>${escapeHtml(article.category || '其他')} · ${escapeHtml(article.readingTime || '')}</small></div></a>`; }
  function render(article, articles) {
    const same = articles.filter(item => item.id !== article.id && item.category === article.category), others = articles.filter(item => item.id !== article.id && item.category !== article.category), recommendations = [...same,...others].slice(0,3);
    updateSeo(article);
    app.innerHTML = `<a class="back-link" href="knowledge.html">← 返回知識庫</a><article><header class="article-header"><span class="category-pill">${escapeHtml(article.category || '其他')}</span><h1>${escapeHtml(article.title)}</h1><p class="article-lead">${escapeHtml(article.summary || '')}</p><div class="article-meta"><span>${formatDate(article.date)}</span><span>·</span><span>${escapeHtml(article.readingTime || '')}</span></div></header><img class="article-cover" src="${escapeHtml(coverOf(article))}" alt="${escapeHtml(article.title)}封面"><div class="article-body">${list(article.content).map(renderBlock).join('')}</div><div class="article-tags">${list(article.tags).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div><div class="article-actions"><button class="article-action primary" id="articleShare" type="button">分享文章</button><button class="article-action" id="articleCopy" type="button">複製連結</button></div></article><section class="recommend-section"><h2>推薦文章</h2><div class="recommend-grid">${recommendations.map(recommendCard).join('')}</div></section>`;
    app.querySelectorAll('img').forEach(image => image.addEventListener('error', coverError));
    document.querySelector('#articleCopy').addEventListener('click', async event => { try { await navigator.clipboard.writeText(location.href); event.currentTarget.textContent = '已複製連結'; } catch { window.prompt('請複製文章連結：', location.href); } });
    document.querySelector('#articleShare').addEventListener('click', async event => { try { if (navigator.share) await navigator.share({title:article.title,text:article.summary,url:location.href}); else { await navigator.clipboard.writeText(location.href); event.currentTarget.textContent = '已複製分享連結'; } } catch { window.prompt('請複製文章連結：', location.href); } });
  }
  function showError(message) { app.innerHTML = `<div class="error-box"><h1>找不到文章</h1><p>${escapeHtml(message)}</p><a class="article-action primary" href="knowledge.html">返回知識庫</a></div>`; }
  async function start() { const id = new URLSearchParams(location.search).get('id'); if (!id) { showError('網址缺少文章 id。'); return; } try { const response = await fetch(DATA_URL,{cache:'no-store'}); if (!response.ok) throw new Error('無法讀取 articles.json'); const articles = (await response.json()).filter(item => item && item.id && item.title), article = articles.find(item => item.id === id); if (!article) { showError(`沒有找到 id 為「${id}」的文章。`); return; } render(article,articles); } catch (error) { showError(`${error.message}，請透過本地伺服器預覽。`); } }
  start();
})();
