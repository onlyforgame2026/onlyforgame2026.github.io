(function (global) {
  'use strict';

  const DEFAULT_BANNER = './assets/default-server-banner.svg';
  const bannerPresetMap = Object.freeze({
    'cyber-purple': './assets/banners/community-neon-default.svg',
    'midnight-grid': './assets/banners/midnight-grid-default.svg',
    'game-neon': './assets/banners/game-default.svg',
    'social-blue': './assets/banners/chat-default.svg',
    'anime-pink': './assets/banners/anime-default.svg',
    'music-stage': './assets/banners/music-default.svg',
    'tech-circuit': './assets/banners/tech-default.svg',
    'learning-gold': './assets/banners/learning-default.svg',
    'other-violet': './assets/banners/other-default.svg',
    'serverbloom-classic': './assets/default-server-banner.svg'
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

  function resolveServerBanner(server) {
    return getBannerCandidates(server)[0] || DEFAULT_BANNER;
  }

  function handleBannerError(imageElement, server) {
    if (!imageElement) return;
    const candidates = getBannerCandidates(server);
    const nextIndex = Number(imageElement.dataset.bannerCandidateIndex || 0) + 1;
    if (nextIndex >= candidates.length) {
      imageElement.onerror = null;
      return;
    }
    imageElement.dataset.bannerCandidateIndex = String(nextIndex);
    imageElement.src = candidates[nextIndex];
  }

  function bindBannerFallback(imageElement, server) {
    if (!imageElement) return imageElement;
    imageElement.dataset.bannerCandidateIndex = '0';
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
    resolveServerBanner,
    getServerBanner: resolveServerBanner,
    handleBannerError,
    bindBannerFallback
  });
})(window);
