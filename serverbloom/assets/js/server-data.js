(() => {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbwsU40XuJqCBFzCZjH_Mp57y05OIIFp3RAtxFD1HisM_she08o2951ajf4ovzA1Q1gW/exec';

  async function loadSupabaseServers() {
    const config = window.SERVERBLOOM_SUPABASE || {};
    if (!/^https:\/\/[^.]+\.supabase\.co$/.test(config.url || '') || !config.anonKey || config.anonKey.includes('YOUR_')) return [];
    const headers = { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` };
    // This RPC exposes only published cards that have started. It keeps the
    // public page working even if table-level RLS is made stricter later.
    let response = await fetch(`${config.url}/rest/v1/rpc/public_serverbloom_cards`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store'
    });
    // Existing installations continue to work until the one-time SQL update
    // is run in Supabase.
    if (!response.ok) response = await fetch(`${config.url}/rest/v1/server_cards?select=*&order=locked.desc,position.asc`, {
      headers,
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('Supabase cards unavailable');
    const now = Date.now();
    const originalOrder = await loadOriginalOrder();
    return (await response.json()).map(card => normalizeRemote({
      id: card.server_id, name: card.name, category: card.category, inviteUrl: card.invite_url,
      tags: card.tags, description: card.description, color: card.color, icon: card.icon,
      banner: card.banner, customBanner: card.custom_banner, bannerPreset: card.banner_preset,
      position: effectivePosition(card, originalOrder, now),
      locked: isExpiredReturn(card, now) ? false : card.locked
    })).sort((a, b) => Number(b.locked) - Number(a.locked) || Number(a.position) - Number(b.position));
  }

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

  function normalizeIdentity(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '');
  }

  function identity(server) {
    return {
      id: normalizeIdentity(server.id || server.slug),
      invite: String(server.inviteUrl || '').trim().toLowerCase(),
      name: normalizeIdentity(server.name)
    };
  }

  function originalOrderKey(server) {
    const key = identity(server || {});
    return key.id || key.invite || key.name;
  }

  async function loadOriginalOrder() {
    try {
      const response = await fetch('data/servers.json', { cache: 'no-store' });
      if (!response.ok) return new Map();
      const payload = await response.json();
      const list = Array.isArray(payload) ? payload : (payload.servers || []);
      const order = new Map();
      list.forEach((server, index) => {
        const key = originalOrderKey(server);
        if (key && !order.has(key)) order.set(key, index + 1);
      });
      return order;
    } catch (error) {
      console.warn(error.message);
      return new Map();
    }
  }

  function isExpiredReturn(card, now) {
    return card.expires_at && Date.parse(card.expires_at) <= now && card.expiry_action === 'normal';
  }

  function effectivePosition(card, originalOrder, now) {
    if (!isExpiredReturn(card, now)) return Number(card.position || 10000);
    const key = originalOrderKey({
      id: card.server_id,
      inviteUrl: card.invite_url,
      name: card.name
    });
    return Number(card.original_position || originalOrder.get(key) || card.position || 10000);
  }

  async function loadRemoteServers() {
    const payload = await jsonp(API_URL);
    return (Array.isArray(payload?.servers) ? payload.servers : [])
      .map(normalizeRemote)
      .filter(server => server.id && server.name && server.inviteUrl);
  }

  async function getRemoteServer(reference) {
    const requested = typeof reference === 'object'
      ? identity(reference || {})
      : { id: normalizeIdentity(reference), invite: '', name: '' };
    if (!requested.id && !requested.invite && !requested.name) return null;
    const servers = await loadRemoteServers();
    return servers.find(server => {
      const candidate = identity(server);
      return (requested.id && candidate.id === requested.id) ||
        (requested.invite && candidate.invite === requested.invite) ||
        (requested.name && candidate.name === requested.name);
    }) || null;
  }

  async function getRemoteServerById(id) {
    return getRemoteServer(id);
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

    let managed = [];
    try {
      managed = await loadSupabaseServers();
    } catch (error) {
      console.warn(error.message);
    }
    if (managed.length) return managed;

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
    getRemoteServer,
    getRemoteServerById
  });
})();
