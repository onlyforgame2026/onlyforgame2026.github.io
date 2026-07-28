(() => {
  'use strict';

  const API_URL = 'https://script.google.com/macros/s/AKfycbwsU40XuJqCBFzCZjH_Mp57y05OIIFp3RAtxFD1HisM_she08o2951ajf4ovzA1Q1gW/exec';

  function configured() {
    const config = window.SERVERBLOOM_SUPABASE || {};
    return /^https:\/\/[^.]+\.supabase\.co$/.test(config.url || '') &&
      config.anonKey && !config.anonKey.includes('YOUR_');
  }

  async function loadSupabaseServers() {
    if (!configured()) return [];
    const config = window.SERVERBLOOM_SUPABASE;
    const response = await fetch(`${config.url}/rest/v1/rpc/public_serverbloom_cards`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json'
      },
      body: '{}',
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('無法取得 ServerBloom 排名資料，請確認 Supabase SQL 已更新。');
    return (await response.json()).map(card => normalizeRemote({
      id: card.server_id,
      name: card.name,
      category: card.category,
      inviteUrl: card.invite_url,
      tags: card.tags,
      description: card.description,
      color: card.color,
      icon: card.icon,
      banner: card.banner,
      customBanner: card.custom_banner,
      bannerPreset: card.banner_preset,
      position: Number(card.effective_rank),
      effective_rank: Number(card.effective_rank),
      locked: card.lock_top_three
    }));
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const callback = `serverBloomData_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const timeout = window.setTimeout(() => finish(new Error('讀取遠端 Server 資料逾時。')), 12000);
      const cleanup = () => {
        window.clearTimeout(timeout);
        delete window[callback];
        script.remove();
      };
      const finish = (error, value) => {
        cleanup();
        if (error) reject(error); else resolve(value);
      };
      window[callback] = payload => finish(null, payload);
      script.onerror = () => finish(new Error('無法讀取遠端 Server 資料。'));
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
      tags: Array.isArray(server.tags) ? server.tags : String(server.tags || '').split(',').filter(Boolean),
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
    return String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  }

  function identity(server) {
    return {
      id: normalizeIdentity(server.id || server.slug),
      invite: String(server.inviteUrl || '').trim().toLowerCase(),
      name: normalizeIdentity(server.name)
    };
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
    const servers = await loadRemoteServers();
    return servers.find(server => {
      const candidate = identity(server);
      return (requested.id && candidate.id === requested.id) ||
        (requested.invite && candidate.invite === requested.invite) ||
        (requested.name && candidate.name === requested.name);
    }) || null;
  }

  async function loadServers() {
    if (configured()) {
      try {
        const managed = await loadSupabaseServers();
        if (managed.length) return managed;
      } catch (error) {
        console.error(error);
      }
    }

    const response = await fetch('data/servers.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('servers.json 載入失敗');
    const payload = await response.json();
    const local = (Array.isArray(payload) ? payload : payload.servers || []).map(server => ({
      ...server, members: null, online: null, memberCount: null, onlineCount: null, countsUnknown: true
    }));
    try {
      const submitted = await loadRemoteServers();
      return submitted.length ? submitted : local;
    } catch (error) {
      console.warn(error.message);
      return local;
    }
  }

  window.ServerBloomData = Object.freeze({
    API_URL,
    loadServers,
    loadRemoteServers,
    getRemoteServer,
    getRemoteServerById: getRemoteServer
  });
})();
