(function (global) {
  'use strict';

  const DEFAULT_BANNER = './assets/default-server-banner.svg';
  const bannerPresetMap = Object.freeze({
    'cyberpunk-purple': './assets/banners/community-neon-default.svg',
    'gaming-purple': './assets/banners/game-default.svg',
    'anime-pink': './assets/banners/anime-default.svg',
    'sakura-pink': './assets/banners/sakura-pink.svg',
    'steam-style': './assets/banners/steam-style.svg',
    'chat-night': './assets/banners/midnight-grid-default.svg',
    'chat-neon': './assets/banners/chat-default.svg',
    'tech-blue': './assets/banners/tech-default.svg',
    'music-orange': './assets/banners/music-default.svg',
    'fantasy': './assets/banners/fantasy.svg',
    'cyber-purple': './assets/banners/community-neon-default.svg'
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

  function clean(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function getCategoryFallbackBanner(category) {
    return categoryBannerMap[clean(category)] || DEFAULT_BANNER;
  }

  function resolveBannerPreset(preset) {
    return bannerPresetMap[clean(preset)] || '';
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
    DEFAULT_BANNERS: Object.freeze(Object.values(bannerPresetMap)),
    bannerPresetMap,
    categoryBannerMap,
    getCategoryFallbackBanner,
    resolveBannerPreset,
    getBannerCandidates,
    getBannerOptions,
    resolveServerBanner,
    getServerBanner: resolveServerBanner,
    handleBannerError,
    bindBannerFallback
  });
})(window);
