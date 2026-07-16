(() => {
  'use strict';

  if (new URLSearchParams(location.search).get('adminPreview') !== '1') return;

  const ownServerName = 'Only for Game';
  const suggestedPath = 'assets/servers/onlyforgame/banner-custom.webp';
  let previewObjectUrl = '';

  const style = document.createElement('style');
  style.textContent = `
    .banner-admin-actions{position:absolute;z-index:8;top:10px;left:10px;display:flex;flex-wrap:wrap;gap:6px;max-width:calc(100% - 58px)}
    .banner-admin-button{min-height:30px;padding:5px 9px;border:1px solid #9b78ff;border-radius:8px;color:#fff;background:#100b2ee8;font:700 11px/1.2 inherit;cursor:pointer}
    .banner-admin-button:hover{background:#5837c9}
    .banner-admin-modal[hidden]{display:none}.banner-admin-modal{position:fixed;z-index:1000;inset:0;display:grid;place-items:center;padding:18px;background:#020611d9}
    .banner-admin-panel{width:min(820px,100%);max-height:90vh;overflow:auto;padding:22px;border:1px solid #6849cc;border-radius:16px;background:#091221;color:#eef2ff;box-shadow:0 24px 80px #000}
    .banner-admin-head{display:flex;justify-content:space-between;gap:16px;align-items:start}.banner-admin-head h2{margin:0}.banner-admin-close{border:0;color:#fff;background:transparent;font-size:26px;cursor:pointer}
    .banner-admin-note{padding:10px 12px;border:1px solid #f4c15255;border-radius:10px;color:#f7d785;background:#3b2a0b55}
    .banner-preset-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0}.banner-preset{overflow:hidden;padding:0;border:1px solid #344461;border-radius:10px;color:#fff;background:#0d1829;text-align:left;cursor:pointer}.banner-preset img{display:block;width:100%;aspect-ratio:16/6;object-fit:cover}.banner-preset span{display:block;padding:8px 10px}
    .banner-file{display:block;margin:16px 0}.banner-file input{display:block;width:100%;margin-top:8px}.banner-file-name{color:#9fb0ca}.banner-json{width:100%;min-height:92px;padding:12px;border:1px solid #30415f;border-radius:9px;color:#b9f7d0;background:#030913;resize:vertical}.banner-copy{min-height:40px;margin-top:10px;padding:8px 14px;border:0;border-radius:9px;color:#fff;background:#6845e8;font-weight:800;cursor:pointer}
    @media(max-width:600px){.banner-admin-actions{right:48px}.banner-admin-button{font-size:10px}.banner-preset-grid{grid-template-columns:1fr}.banner-admin-panel{padding:16px}}
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.className = 'banner-admin-modal';
  modal.hidden = true;
  modal.innerHTML = `<section class="banner-admin-panel" role="dialog" aria-modal="true" aria-labelledby="bannerAdminTitle">
    <div class="banner-admin-head"><div><h2 id="bannerAdminTitle">Only for Game Banner 管理預覽</h2><p>建議圖片比例 16:6，格式建議 WebP。</p></div><button class="banner-admin-close" type="button" aria-label="關閉">×</button></div>
    <p class="banner-admin-note">GitHub Pages 無法直接永久上傳。請將圖片手動放入 <strong>${suggestedPath.replace('/banner-custom.webp','/')}</strong>，更新 JSON 後 Commit。</p>
    <div class="banner-preset-grid"></div>
    <label class="banner-file">選擇本機圖片立即預覽<input type="file" accept="image/*"></label>
    <p class="banner-file-name">尚未選擇圖片</p>
    <textarea class="banner-json" readonly aria-label="建議 JSON"></textarea>
    <button class="banner-copy" type="button">複製 JSON</button>
  </section>`;
  document.body.appendChild(modal);

  const presetGrid = modal.querySelector('.banner-preset-grid');
  const fileInput = modal.querySelector('input[type="file"]');
  const fileName = modal.querySelector('.banner-file-name');
  const jsonOutput = modal.querySelector('.banner-json');
  const presetEntries = Object.entries(ServerBloomBanner.bannerPresetMap);
  presetGrid.innerHTML = presetEntries.map(([id, src]) => `<button class="banner-preset" type="button" data-preset="${id}"><img src="${src}" alt="${id}" loading="lazy"><span>${id}</span></button>`).join('');

  function ownCard() {
    return [...document.querySelectorAll('article.card')].find(card => card.querySelector('h3')?.textContent.includes(ownServerName));
  }

  function showJson(value) {
    jsonOutput.value = JSON.stringify(value, null, 2).slice(1, -1).trim();
  }

  function preview(src) {
    const image = ownCard()?.querySelector('.card-banner-image');
    if (image) image.src = src;
  }

  function open(mode) {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    presetGrid.hidden = mode !== 'preset';
    fileInput.closest('.banner-file').hidden = mode !== 'custom';
    fileName.hidden = mode !== 'custom';
    showJson(mode === 'preset' ? { bannerPreset: 'cyber-purple' } : { customBanner: suggestedPath });
  }

  function close() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  function installButtons() {
    const banner = ownCard()?.querySelector('.banner');
    if (!banner || banner.querySelector('.banner-admin-actions')) return;
    const actions = document.createElement('div');
    actions.className = 'banner-admin-actions';
    actions.innerHTML = '<button class="banner-admin-button" type="button" data-banner-mode="preset">選擇預設 Banner</button><button class="banner-admin-button" type="button" data-banner-mode="custom">使用自訂 Banner</button>';
    actions.addEventListener('click', event => {
      const button = event.target.closest('[data-banner-mode]');
      if (button) open(button.dataset.bannerMode);
    });
    banner.appendChild(actions);
  }

  presetGrid.addEventListener('click', event => {
    const button = event.target.closest('[data-preset]');
    if (!button) return;
    const preset = button.dataset.preset;
    preview(ServerBloomBanner.resolveBannerPreset(preset));
    showJson({ bannerPreset: preset });
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = URL.createObjectURL(file);
    preview(previewObjectUrl);
    fileName.textContent = `已選擇：${file.name}｜建議存為：banner-custom.webp`;
    showJson({ customBanner: suggestedPath });
  });

  modal.querySelector('.banner-copy').addEventListener('click', async event => {
    try {
      await navigator.clipboard.writeText(jsonOutput.value);
      event.currentTarget.textContent = '已複製 JSON';
    } catch {
      jsonOutput.select();
      document.execCommand('copy');
    }
  });
  modal.querySelector('.banner-admin-close').addEventListener('click', close);
  modal.addEventListener('click', event => { if (event.target === modal) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) close(); });

  new MutationObserver(installButtons).observe(document.querySelector('#serverGrid'), { childList: true });
  installButtons();
})();
