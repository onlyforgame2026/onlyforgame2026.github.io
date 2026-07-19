(function (global) {
  'use strict';

  const DEFAULT_BANNER = './assets/default-server-banner.svg';
  const PRESET_LIBRARY_URL = './assets/banners/banner-presets.json';
  const PRESET_ASSET_BASE = './assets/banners/presets/';
  const presetMap = new Map();
  const legacyPresetAliases = Object.freeze({
    'cyber-purple': 'cyber',
    'cyberpunk-purple': 'cyber',
    'gaming-purple': 'game',
    'anime-pink': 'anime',
    'sakura-pink': 'sakura',
    'steam-style': 'steam',
    'chat-night': 'chat01',
    'chat-neon': 'chat02',
    'tech-blue': 'cyber',
    'music-orange': 'music'
  });
  const categoryBannerMap = Object.freeze({
    '遊戲': './assets/banners/game-default.svg',
    '聊天交友': './assets/banners/chat-default.svg',
    '動漫': './assets/banners/anime-default.svg',
    '音樂': './assets/banners/music-default.svg',
    '科技': './assets/banners/tech-default.svg',
    '技術': './assets/banners/tech-default.svg',
    '程式設計': './assets/banners/tech-default.svg',
    '創作': './assets/banners/anime-default.svg',
    '生活': './assets/banners/other-default.svg',
    '學習': './assets/banners/learning-default.svg',
    '其他': './assets/banners/other-default.svg'
  });
  let presetLibraryPromise = null;

  function clean(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function safePresetFile(file) {
    const value = clean(file);
    return /^[a-z0-9][a-z0-9._-]*\.(?:webp|svg|png|jpe?g)$/i.test(value) ? value : '';
  }

  function normalizePreset(entry) {
    const id = clean(entry && entry.id);
    const file = safePresetFile(entry && entry.file);
    if (!id || !file) return null;
    return Object.freeze({
      id,
      name: clean(entry.name) || id,
      file,
      category: clean(entry.category) || 'other',
      src: `${PRESET_ASSET_BASE}${file}`
    });
  }

  function loadBannerPresets() {
    if (presetLibraryPromise) return presetLibraryPromise;
    presetLibraryPromise = fetch(PRESET_LIBRARY_URL, { cache: 'no-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`Banner preset library HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        const presets = (Array.isArray(data) ? data : []).map(normalizePreset).filter(Boolean);
        presetMap.clear();
        presets.forEach(preset => presetMap.set(preset.id, preset));
        return Object.freeze(presets);
      })
      .catch(error => {
        presetLibraryPromise = null;
        throw error;
      });
    return presetLibraryPromise;
  }

  function getCategoryFallbackBanner(category) {
    return categoryBannerMap[clean(category)] || DEFAULT_BANNER;
  }

  function resolveBannerPreset(preset) {
    const requested = clean(preset);
    const id = presetMap.has(requested) ? requested : (legacyPresetAliases[requested] || requested);
    return presetMap.get(id)?.src || '';
  }

  function getBannerCandidates(server) {
    const candidates = [
      clean(server && server.customBanner),
      resolveBannerPreset(server && server.bannerPreset),
      getCategoryFallbackBanner(server && server.category),
      DEFAULT_BANNER
    ].filter(Boolean);
    return [...new Set(candidates)];
  }

  function getBannerOptions(server) {
    const options = [
      { src: clean(server && server.customBanner), type: 'Uploaded Banner' },
      { src: resolveBannerPreset(server && server.bannerPreset), type: 'Official Banner' },
      { src: getCategoryFallbackBanner(server && server.category), type: 'Category Banner' },
      { src: DEFAULT_BANNER, type: 'Category Banner' }
    ].filter(option => option.src);
    return options.filter((option, index) => options.findIndex(item => item.src === option.src) === index);
  }

  function resolveServerBanner(server) {
    return getBannerCandidates(server)[0] || DEFAULT_BANNER;
  }

  function handleBannerError(imageElement, server) {
    if (!imageElement) return;
    const candidates = getBannerOptions(server);
    const nextIndex = Number(imageElement.dataset.bannerCandidateIndex || 0) + 1;
    if (nextIndex >= candidates.length) {
      imageElement.onerror = null;
      return;
    }
    imageElement.dataset.bannerCandidateIndex = String(nextIndex);
    imageElement.src = candidates[nextIndex].src;
  }

  function bindBannerFallback(imageElement, server) {
    if (!imageElement) return imageElement;
    imageElement.dataset.bannerCandidateIndex = '0';
    delete imageElement.dataset.bannerManualSource;
    imageElement.addEventListener('load', function () {
      const option = getBannerOptions(server)[Number(imageElement.dataset.bannerCandidateIndex || 0)];
      imageElement.dataset.bannerSource = imageElement.dataset.bannerManualSource || option?.type || 'Category Banner';
      imageElement.dispatchEvent(new CustomEvent('serverbloom:bannerchange', { bubbles: true, detail: { type: imageElement.dataset.bannerSource } }));
    });
    imageElement.addEventListener('error', function () {
      handleBannerError(imageElement, server);
    });
    return imageElement;
  }

  global.resolveServerBanner = resolveServerBanner;
  global.ServerBloomBanner = Object.freeze({
    DEFAULT_BANNER,
    PRESET_LIBRARY_URL,
    PRESET_ASSET_BASE,
    categoryBannerMap,
    loadBannerPresets,
    resolveBannerPreset,
    getCategoryFallbackBanner,
    getBannerCandidates,
    getBannerOptions,
    resolveServerBanner,
    getServerBanner: resolveServerBanner,
    handleBannerError,
    bindBannerFallback
  });
})(window);
