(() => {
  'use strict';

  function inviteCode(url) {
    try {
      const parsed = new URL(url, location.href);
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parsed.hostname.endsWith('discord.gg')) return parts[0] || '';
      if (parsed.hostname.endsWith('discord.com') && parts[0] === 'invite') return parts[1] || '';
    } catch {}
    return '';
  }

  function getDiscordTargets(url) {
    const code = inviteCode(url);
    return code ? {
      app: `discord://-/invite/${encodeURIComponent(code)}`,
      web: `https://discord.com/invite/${encodeURIComponent(code)}`
    } : null;
  }

  function openDiscordInvite(url) {
    const targets = getDiscordTargets(url);
    if (!targets) return false;

    let appOpened = document.hidden;
    const onVisibility = () => {
      if (document.hidden) appOpened = true;
    };

    document.addEventListener('visibilitychange', onVisibility);
    location.href = targets.app;

    window.setTimeout(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (!appOpened && !document.hidden) location.href = targets.web;
    }, 1800);

    return true;
  }

  window.ServerBloomDiscord = Object.freeze({ inviteCode, getDiscordTargets, openDiscordInvite });

  document.addEventListener('click', event => {
    const link = event.target.closest('a.action.primary[href*="discord"]');
    if (!link) return;
    if (!getDiscordTargets(link.href)) return;
    event.preventDefault();
    openDiscordInvite(link.href);
  });
})();
