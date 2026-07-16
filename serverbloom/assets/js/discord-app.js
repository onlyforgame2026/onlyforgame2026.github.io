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
    return code ? { app: `discord://-/invite/${encodeURIComponent(code)}`, web: `https://discord.gg/${code}` } : null;
  }

  window.ServerBloomDiscord = Object.freeze({ inviteCode, getDiscordTargets });

  document.addEventListener('click', event => {
    const link = event.target.closest('a.action.primary[href*="discord"]');
    if (!link) return;
    const targets = getDiscordTargets(link.href);
    if (!targets) return;
    event.preventDefault();
    let leftPage = false;
    const onVisibility = () => { if (document.hidden) leftPage = true; };
    document.addEventListener('visibilitychange', onVisibility, { once: true });
    location.href = targets.app;
    window.setTimeout(() => {
      if (!leftPage) location.href = targets.web;
    }, 1200);
  });
})();
