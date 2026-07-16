(() => {
  'use strict';

  const adminPreview = new URLSearchParams(location.search).get('adminPreview') === '1';
  const ownServerName = 'Only for Game';
  const suggestedPath = 'assets/servers/onlyforgame/banner-custom.webp';
  const categoryLabels = Object.freeze({
    anime: '動漫', nature: '自然', cyber: 'Cyber', game: '遊戲', chat: '聊天',
    steam: 'Steam', fantasy: '奇幻', music: '音樂', minimal: '極簡'
  });
  let activeCard = null;
  let activeFilter = '全部';
  let uploadUrl = '';
  let pendingPreset = '';
  let originalPreview = null;

  const style = document.createElement('style');
  style.textContent = `
    .banner-gallery[hidden]{display:none}.banner-gallery{position:fixed;z-index:1200;inset:0;display:grid;place-items:center;padding:18px;background:#01040de8;backdrop-filter:blur(15px)}
    .banner-gallery-panel{width:min(1040px,100%);max-height:92vh;overflow:auto;padding:22px;border:1px solid #6349be;border-radius:20px;background:radial-gradient(circle at 15% 0,#5d2ec22b,transparent 32%),#07101d;color:#f5f7ff;box-shadow:0 30px 100px #000}
    .banner-gallery-head{display:flex;align-items:start;justify-content:space-between;gap:16px}.banner-gallery-head h2{margin:0;font-size:25px}.banner-gallery-head p{margin:4px 0;color:#91a0b7}.banner-gallery-close{width:42px;height:42px;border:1px solid #ffffff24;border-radius:12px;color:#fff;background:#101a2b;font-size:25px}
    .banner-filters{display:flex;gap:7px;overflow-x:auto;margin:16px 0;padding-bottom:3px}.banner-filter{min-height:36px;flex:none;padding:6px 12px;border:1px solid #293a56;border-radius:999px;color:#b9c4d6;background:#0b1727}.banner-filter.active{border-color:#8868ff;color:#fff;background:#5736c3}
    .official-banner-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.official-banner{padding:0;overflow:hidden;border:1px solid #253753;border-radius:13px;color:#fff;background:#0a1525;text-align:left;transition:.2s}.official-banner:hover{transform:translateY(-3px);border-color:#8d6aff;box-shadow:0 0 22px #7049ff45}.official-banner img{width:100%;aspect-ratio:16/6;object-fit:cover}.official-banner span{display:block;padding:8px 11px;font-weight:800}.official-banner[hidden]{display:none}
    .gallery-tools{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px;padding-top:17px;border-top:1px solid #1b2a42}.gallery-tool{min-height:42px;padding:8px 14px;border:1px solid #684ed1;border-radius:10px;color:#fff;background:#21174b;font-weight:800}.gallery-tool[disabled]{color:#718097;border-color:#27354b;background:#0b1421;cursor:not-allowed}.upload-box{display:none;width:100%;padding:14px;border:1px solid #2b3e5d;border-radius:12px;background:#091524}.upload-box.visible{display:block}.upload-box input{display:block;width:100%;margin:10px 0}.upload-status{color:#aab7c9}.upload-json{width:100%;min-height:75px;padding:10px;border:1px solid #314564;border-radius:9px;color:#aff3c7;background:#030913}.upload-copy{margin-top:8px}.static-note{color:#f5d27e;font-size:12px}
    .banner-admin-actions{position:absolute;z-index:9;left:10px;top:10px;display:flex;gap:6px}.banner-admin-button{min-height:30px;padding:5px 9px;border:1px solid #9a7aff;border-radius:8px;color:#fff;background:#100a2ee8;font-size:10px;font-weight:850}
    @media(max-width:620px){.banner-gallery{padding:8px}.banner-gallery-panel{padding:15px;border-radius:15px}.official-banner-grid{grid-template-columns:1fr}.banner-gallery-head h2{font-size:20px}.gallery-tools{display:grid}.gallery-tool{width:100%}.banner-admin-actions{right:58px;left:8px;flex-wrap:wrap}.banner-admin-button{font-size:9px}}
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.className = 'banner-gallery';
  modal.hidden = true;
  modal.innerHTML = `<section class="banner-gallery-panel" role="dialog" aria-modal="true" aria-labelledby="bannerGalleryTitle">
    <header class="banner-gallery-head"><div><h2 id="bannerGalleryTitle">Banner Gallery</h2><p>選擇官方 Banner，立即套用到目前卡片。</p></div><button class="banner-gallery-close" type="button" aria-label="關閉">×</button></header>
    <nav class="banner-filters" aria-label="Banner 分類"></nav><div class="official-banner-grid"></div>
    <div class="gallery-tools"><button class="gallery-tool preset-apply" type="button" disabled>套用</button><button class="gallery-tool preset-copy" type="button" disabled>Copy JSON</button><button class="gallery-tool upload-open" type="button">Upload Banner</button><button class="gallery-tool" type="button" disabled>AI Generate · Coming Soon</button>
      <div class="upload-box"><strong>上傳自訂 Banner</strong><p>支援 JPG、PNG、WebP，最大 5MB；將自動置中裁切為 16:6。</p><input type="file" accept="image/jpeg,image/png,image/webp"><p class="upload-status">尚未選擇圖片</p><textarea class="upload-json" readonly></textarea><button class="gallery-tool upload-copy" type="button">複製 JSON</button><p class="static-note">GitHub Pages 無法永久上傳。請將輸出圖片手動存入 assets/servers/onlyforgame/，更新 JSON 後 Commit。</p></div>
    </div></section>`;
  document.body.appendChild(modal);

  const filterNav = modal.querySelector('.banner-filters');
  const grid = modal.querySelector('.official-banner-grid');
  filterNav.innerHTML = '<button class="banner-filter active" type="button" data-filter="全部">全部</button>';
  grid.innerHTML = '<p class="upload-status">正在載入官方 Banner…</p>';

  function renderPresetLibrary(presets) {
    const categories = [...new Set(presets.map(preset => categoryLabels[preset.category] || preset.category))];
    const filters = ['全部', ...categories];
    filterNav.innerHTML = filters.map(name => `<button class="banner-filter${name==='全部'?' active':''}" type="button" data-filter="${name}">${name}</button>`).join('');
    grid.innerHTML = presets.map((preset, index) => {
      const category = categoryLabels[preset.category] || preset.category;
      const number = String(index + 1).padStart(2, '0');
      return `<button class="official-banner" type="button" data-preset="${preset.id}" data-category="${category}"><img src="${preset.src}" alt="${preset.name}" loading="lazy"><span>${number} ${preset.name}</span></button>`;
    }).join('');
    filter('全部');
  }

  async function loadPresetLibrary() {
    try {
      renderPresetLibrary(await ServerBloomBanner.loadBannerPresets());
    } catch {
      grid.innerHTML = '<p class="upload-status">Banner Library 暫時無法載入。</p>';
    }
  }

  function cardName(card){return card?.querySelector('h3')?.textContent.replace('◆','').trim()||'server'}
  function storageKey(card){return `serverbloom:banner:${cardName(card)}`}
  function label(card,type){let node=card.querySelector('.banner-label');if(!node){node=document.createElement('span');node.className='banner-label';card.querySelector('.banner').appendChild(node)}node.textContent=type}
  function setPreview(card,id){if(!card)return false;const src=ServerBloomBanner.resolveBannerPreset(id),image=card.querySelector('.card-banner-image');if(!src||!image)return false;image.dataset.bannerManualSource='Official Banner';image.dataset.bannerSource='Official Banner';image.src=src;label(card,'Official Banner');card.querySelector('.bookmark').textContent='★';return true}
  function applyPreset(id,persist=true){if(!activeCard||!setPreview(activeCard,id))return false;activeCard.dataset.bannerPreset=id;if(persist)localStorage.setItem(storageKey(activeCard),id);activeCard.dispatchEvent(new CustomEvent('serverbloom:bannerpresetchange',{bubbles:true,detail:{bannerPreset:id}}));return true}
  function previewPreset(id){if(!activeCard||!setPreview(activeCard,id))return;pendingPreset=id;modal.querySelectorAll('.official-banner').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.preset===id)));modal.querySelector('.preset-apply').disabled=false;modal.querySelector('.preset-copy').disabled=false}
  function restorePreview(){if(!activeCard||!originalPreview)return;const image=activeCard.querySelector('.card-banner-image');if(image){image.dataset.bannerManualSource=originalPreview.manualSource;image.dataset.bannerSource=originalPreview.source;image.src=originalPreview.src}activeCard.dataset.bannerPreset=originalPreview.preset;label(activeCard,originalPreview.label);activeCard.querySelector('.bookmark').textContent=originalPreview.star}
  function open(card){activeCard=card;const image=card.querySelector('.card-banner-image'),bannerLabel=card.querySelector('.banner-label'),copyButton=modal.querySelector('.preset-copy');originalPreview={src:image?.getAttribute('src')||'',source:image?.dataset.bannerSource||'',manualSource:image?.dataset.bannerManualSource||'',preset:card.dataset.bannerPreset||localStorage.getItem(storageKey(card))||'',label:bannerLabel?.textContent.trim()||'Category Banner',star:card.querySelector('.bookmark')?.textContent.trim()||'☆'};pendingPreset='';modal.querySelector('.preset-apply').disabled=true;copyButton.disabled=true;copyButton.textContent='Copy JSON';delete copyButton.dataset.json;modal.querySelectorAll('.official-banner').forEach(button=>button.setAttribute('aria-pressed','false'));modal.hidden=false;document.body.style.overflow='hidden';modal.querySelector('.upload-open').hidden=!(adminPreview&&cardName(card)===ownServerName);modal.querySelector('.upload-box').classList.remove('visible')}
  function close(){if(pendingPreset)restorePreview();pendingPreset='';originalPreview=null;modal.hidden=true;document.body.style.overflow=''}
  function filter(name){activeFilter=name;modal.querySelectorAll('.banner-filter').forEach(button=>button.classList.toggle('active',button.dataset.filter===name));modal.querySelectorAll('.official-banner').forEach(button=>button.hidden=name!=='全部'&&button.dataset.category!==name)}

  function install(){document.querySelectorAll('article.card').forEach(card=>{const star=card.querySelector('.bookmark');if(star&&!star.dataset.galleryReady){star.dataset.galleryReady='1';star.setAttribute('aria-label','開啟 Banner Gallery');star.title='開啟 Banner Gallery';star.addEventListener('click',()=>open(card));const saved=localStorage.getItem(storageKey(card));if(saved)applySaved(card,saved)}const image=card.querySelector('.card-banner-image');if(image&&!image.dataset.labelReady){image.dataset.labelReady='1';image.addEventListener('serverbloom:bannerchange',event=>label(card,event.detail.type));if(image.dataset.bannerSource)label(card,image.dataset.bannerSource)}if(adminPreview&&cardName(card)===ownServerName&&!card.querySelector('.banner-admin-actions')){const actions=document.createElement('div');actions.className='banner-admin-actions';actions.innerHTML='<button class="banner-admin-button" type="button">選擇預設 Banner</button><button class="banner-admin-button" type="button">使用自訂 Banner</button>';actions.children[0].onclick=()=>open(card);actions.children[1].onclick=()=>{open(card);modal.querySelector('.upload-box').classList.add('visible')};card.querySelector('.banner').appendChild(actions)}})}
  function applySaved(card,id){activeCard=card;applyPreset(id,false);activeCard=null}

  filterNav.addEventListener('click',event=>{const button=event.target.closest('[data-filter]');if(button)filter(button.dataset.filter)});
  grid.addEventListener('click',event=>{const button=event.target.closest('[data-preset]');if(button)previewPreset(button.dataset.preset)});
  modal.querySelector('.preset-apply').addEventListener('click',()=>{if(!pendingPreset||!applyPreset(pendingPreset))return;const applied=pendingPreset;pendingPreset='';originalPreview=null;modal.querySelector('.preset-apply').disabled=true;modal.querySelector('.preset-copy').dataset.json=`"bannerPreset":"${applied}"`});
  modal.querySelector('.preset-copy').addEventListener('click',async event=>{const value=event.currentTarget.dataset.json||`"bannerPreset":"${pendingPreset}"`;if(!pendingPreset&&!event.currentTarget.dataset.json)return;try{await navigator.clipboard.writeText(value);event.currentTarget.textContent='已複製 JSON'}catch{window.prompt('請複製 Banner JSON：',value)}});
  modal.querySelector('.banner-gallery-close').addEventListener('click',close);modal.addEventListener('click',event=>{if(event.target===modal)close()});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.hidden)close()});
  modal.querySelector('.upload-open').addEventListener('click',()=>modal.querySelector('.upload-box').classList.toggle('visible'));
  const fileInput=modal.querySelector('input[type="file"]'),status=modal.querySelector('.upload-status'),json=modal.querySelector('.upload-json');
  fileInput.addEventListener('change',()=>{const file=fileInput.files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){status.textContent='只支援 JPG、PNG、WebP';return}if(file.size>5*1024*1024){status.textContent='圖片超過 5MB';return}const reader=new FileReader();reader.onload=()=>{const image=new Image();image.onload=()=>{const targetRatio=16/6,current=image.width/image.height;let sx=0,sy=0,sw=image.width,sh=image.height;if(current>targetRatio){sw=image.height*targetRatio;sx=(image.width-sw)/2}else{sh=image.width/targetRatio;sy=(image.height-sh)/2}const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=600;canvas.getContext('2d').drawImage(image,sx,sy,sw,sh,0,0,1600,600);canvas.toBlob(blob=>{if(!blob)return;if(uploadUrl)URL.revokeObjectURL(uploadUrl);uploadUrl=URL.createObjectURL(blob);const target=activeCard?.querySelector('.card-banner-image');if(target){target.dataset.bannerManualSource='Uploaded Banner';target.dataset.bannerSource='Uploaded Banner';target.src=uploadUrl}if(activeCard)label(activeCard,'Uploaded Banner');status.textContent=`已裁切：${file.name} → banner-custom.webp（1600 × 600）`;json.value='"customBanner": "'+suggestedPath+'"'},'image/webp',.9)};image.src=reader.result};reader.readAsDataURL(file)});
  modal.querySelector('.upload-copy').addEventListener('click',async event=>{try{await navigator.clipboard.writeText(json.value);event.currentTarget.textContent='已複製 JSON'}catch{json.select();document.execCommand('copy')}});
  new MutationObserver(install).observe(document.querySelector('#serverGrid'),{childList:true});install();loadPresetLibrary();
})();
