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
      isNew: server.isNew === true,
      banner: String(server.banner || '').trim(),
      customBanner: String(server.customBanner || '').trim(),
      bannerPreset: String(server.bannerPreset || '').trim(),
      icon: String(server.icon || '').trim()
    };
  }

  function identity(server) {
    return {
      id: String(server.id || server.slug || '').replace(/[^a-z0-9]/gi, '').toLowerCase(),
      invite: String(server.inviteUrl || '').trim().toLowerCase(),
      name: String(server.name || '').replace(/[^a-z0-9\u4e00-\u9fff]/gi, '').toLowerCase()
    };
  }

  async function loadRemoteServers() {
    const payload = await jsonp(API_URL);
    return (Array.isArray(payload?.servers) ? payload.servers : [])
      .map(normalizeRemote)
      .filter(server => server.id && server.name && server.inviteUrl);
  }

  async function getRemoteServerById(id) {
    const requested = String(id || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (!requested) return null;
    const servers = await loadRemoteServers();
    return servers.find(server => identity(server).id === requested) || null;
  }

  async function loadServers() {
    const localResponse = await fetch('data/servers.json', { cache: 'no-store' });
    if (!localResponse.ok) throw new Error('servers.json 載入失敗');
    const localPayload = await localResponse.json();
    const localServers = Array.isArray(localPayload) ? localPayload : (localPayload.servers || []);
    const official = localServers.map(server => ({
      ...server,
      members: null,
      online: null,
      memberCount: null,
      onlineCount: null,
      countsUnknown: true
    }));

    let submitted = [];
    try {
      submitted = await loadRemoteServers();
    } catch (error) {
      console.warn(error.message);
    }

    const localIndex = new Map();
    official.forEach(server => {
      const key = identity(server);
      if (key.id) localIndex.set(`id:${key.id}`, server);
      if (key.invite) localIndex.set(`invite:${key.invite}`, server);
      if (key.name) localIndex.set(`name:${key.name}`, server);
    });

    const source = submitted.length ? submitted.map(remote => {
      const key = identity(remote);
      const local = localIndex.get(`id:${key.id}`) ||
        localIndex.get(`invite:${key.invite}`) ||
        localIndex.get(`name:${key.name}`);
      if (!local) return remote;

      return {
        ...local,
        ...remote,
        id: remote.id || local.id,
        banner: remote.banner || local.banner || '',
        customBanner: remote.customBanner || local.customBanner || '',
        bannerPreset: remote.bannerPreset || local.bannerPreset || '',
        icon: remote.icon || local.icon || ''
      };
    }) : official;

    const seen = new Set();
    const servers = source.filter(server => {
      const key = String(server.inviteUrl || server.id || server.name).toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const pinnedIndex = servers.findIndex(server =>
      identity(server).id === 'onlyforgame' ||
      String(server.name || '').trim().toLowerCase() === 'only for game'
    );
    if (pinnedIndex > 0) servers.unshift(servers.splice(pinnedIndex, 1)[0]);
    return servers;
  }

  window.ServerBloomData = Object.freeze({
    API_URL,
    loadServers,
    loadRemoteServers,
    getRemoteServerById
  });
})();
