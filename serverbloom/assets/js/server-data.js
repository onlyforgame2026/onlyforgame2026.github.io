(() => {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbwsU40XuJqCBFzCZjH_Mp57y05OIIFp3RAtxFD1HisM_she08o2951ajf4ovzA1Q1gW/exec';

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const callback = `serverBloomData_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const timeout = window.setTimeout(() => finish(new Error('共用社群資料庫逾時')), 12000);

      function cleanup() {
        window.clearTimeout(timeout);
        delete window[callback];
        script.remove();
      }

      function finish(error, value) {
        cleanup();
        if (error) reject(error);
        else resolve(value);
      }

      window[callback] = payload => finish(null, payload);
      script.onerror = () => finish(new Error('無法讀取共用社群資料庫'));
      script.src = `${url}?callback=${encodeURIComponent(callback)}&_=${Date.now()}`;
      document.body.appendChild(script);
    });
  }

  function normalizeRemote(server) {
    return {
      ...server,
      id: String(server.id || server.slug || server.name || '').trim(),
      name: String(server.name || '').trim(),
      category: String(server.category || '其他').trim(),
      inviteUrl: String(server.inviteUrl || '').trim(),
      tags: Array.isArray(server.tags) ? server.tags : String(server.tags || '').split(','),
      description: String(server.description || '').trim(),
      primaryColor: String(server.color || server.primaryColor || '#755cff'),
      color: String(server.color || server.primaryColor || '#755cff'),
      memberCount: null,
      onlineCount: null,
      countsUnknown: true,
      isNew: true,
      banner: String(server.banner || '').trim(),
      customBanner: String(server.customBanner || '').trim(),
      bannerPreset: String(server.bannerPreset || '').trim(),
      icon: String(server.icon || '').trim()
    };
  }

  async function loadRemoteServers() {
    const payload = await jsonp(API_URL);
    return (Array.isArray(payload?.servers) ? payload.servers : [])
      .map(normalizeRemote)
      .filter(server => server.id && server.name && server.inviteUrl);
  }

  async function getRemoteServerById(id) {
    const requestedId = String(id || '').trim();
    if (!requestedId) return null;
    const servers = await loadRemoteServers();
    return servers.find(server => server.id === requestedId) || null;
  }

  async function loadServers() {
    const localResponse = await fetch('data/servers.json', { cache: 'no-store' });
    if (!localResponse.ok) throw new Error('servers.json 暫時無法讀取');
    const localPayload = await localResponse.json();
    const localServers = Array.isArray(localPayload) ? localPayload : (localPayload.servers || []);
    const official = localServers.filter(server =>
      String(server.id || '').replaceAll('-', '').toLowerCase() === 'onlyforgame' ||
      String(server.name || '').trim().toLowerCase() === 'only for game'
    ).map(server => ({ ...server, members: null, online: null, memberCount: null, onlineCount: null, countsUnknown: true }));

    let submitted = [];
    try {
      submitted = await loadRemoteServers();
    } catch (error) {
      console.warn(error.message);
    }

    const submittedById = new Map(submitted.map(server => [server.id, server]));
    const mergedOfficial = official.map(server => {
      const remote = submittedById.get(String(server.id || '').trim());
      if (!remote) return server;
      submittedById.delete(remote.id);
      return {
        ...server,
        ...remote,
        banner: remote.banner || server.banner || '',
        customBanner: remote.customBanner || '',
        bannerPreset: remote.bannerPreset || '',
        icon: remote.icon || server.icon || ''
      };
    });

    const seen = new Set();
    return [...mergedOfficial, ...submittedById.values()].filter(server => {
      const key = String(server.inviteUrl || server.id || server.name).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  window.ServerBloomData = Object.freeze({
    API_URL,
    loadServers,
    loadRemoteServers,
    getRemoteServerById
  });
})();
