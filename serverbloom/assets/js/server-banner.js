(function (global) {
  'use strict';

  const DEFAULT_BANNER = './assets/default-server-banner.svg';
  const DEFAULT_BANNERS = Object.freeze([
    './assets/banners/game-default.svg',
    './assets/banners/chat-default.svg',
    './assets/banners/anime-default.svg',
    './assets/banners/music-default.svg',
    './assets/banners/tech-default.svg',
    './assets/banners/learning-default.svg',
    './assets/banners/other-default.svg',
    './assets/default-server-banner.svg',
    './assets/banners/community-neon-default.svg',
    './assets/banners/midnight-grid-default.svg'
  ]);
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

  function stableBannerIndex(server) {
    const value = String(server && (server.id || server.slug || server.name || server.inviteUrl) || 'serverbloom');
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % DEFAULT_BANNERS.length;
  }

  function getDefaultBanner(server) {
    return DEFAULT_BANNERS[stableBannerIndex(server)];
  }

  function getServerBanner(server) {
    if (server && typeof server.banner === 'string' && server.banner.trim() !== '') {
      return server.banner.trim();
    }
    return getDefaultBanner(server);
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
    imageElement.src = getDefaultBanner(server);
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
    DEFAULT_BANNERS,
    categoryBannerMap,
    getCategoryFallbackBanner,
    getDefaultBanner,
    getServerBanner,
    handleBannerError,
    bindBannerFallback
  });
})(window);
