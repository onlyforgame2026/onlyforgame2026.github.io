(function (global) {
  'use strict';

  const DEFAULT_BANNER = './assets/default-server-banner.svg';
  const categoryBannerMap = Object.freeze({
    '遊戲': './assets/banners/game-default.svg',
    '聊天交友': './assets/banners/chat-default.svg',
    '動漫': './assets/banners/anime-default.svg',
    '音樂': './assets/banners/music-default.svg',
    '科技': './assets/banners/tech-default.svg',
    '程式設計': './assets/banners/tech-default.svg',
    '學習': './assets/banners/learning-default.svg',
    '其他': './assets/banners/other-default.svg'
  });

  function getCategoryFallbackBanner(category) {
    return categoryBannerMap[String(category || '').trim()] || DEFAULT_BANNER;
  }

  function getServerBanner(server) {
    if (server && typeof server.banner === 'string' && server.banner.trim() !== '') {
      return server.banner.trim();
    }
    return getCategoryFallbackBanner(server && server.category);
  }

  function handleBannerError(imageElement, server) {
    if (!imageElement) return;
    if (imageElement.dataset.fallbackApplied === 'true') {
      if (imageElement.dataset.defaultApplied === 'true') {
        imageElement.onerror = null;
        return;
      }
      imageElement.dataset.defaultApplied = 'true';
      imageElement.src = DEFAULT_BANNER;
      return;
    }
    imageElement.dataset.fallbackApplied = 'true';
    imageElement.src = getCategoryFallbackBanner(server && server.category);
  }

  function bindBannerFallback(imageElement, server) {
    if (!imageElement) return imageElement;
    imageElement.addEventListener('error', function () {
      handleBannerError(imageElement, server);
    });
    return imageElement;
  }

  global.ServerBloomBanner = Object.freeze({
    DEFAULT_BANNER,
    categoryBannerMap,
    getCategoryFallbackBanner,
    getServerBanner,
    handleBannerError,
    bindBannerFallback
  });
})(window);
