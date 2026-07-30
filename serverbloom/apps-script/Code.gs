const SPREADSHEET_ID = '1PJU_-jKjKhlbrm625WBsXFlJLA4lhDDkKtfLpAb_2lw';
const SERVER_SHEET_NAME = 'servers';
const REQUIRED_HEADERS = [
  'id',
  'name',
  'category',
  'inviteUrl',
  'tags',
  'description',
  'color',
  'createdAt',
  'bannerPreset',
  'customBanner'
];
const ADMIN_KEY_PROPERTY = 'SERVERBLOOM_ADMIN_KEY';
const HEADER_ALIASES = Object.freeze({
  id: ['id', 'serverId', 'server_id', '社群ID', '伺服器ID'],
  name: ['name', 'serverName', 'server_name', '社群名稱', '伺服器名稱', '名稱'],
  category: ['category', 'type', '分類', '類別'],
  inviteUrl: ['inviteUrl', 'invite_url', 'invite', 'discordUrl', 'discord_url', 'Discord邀請連結', '邀請連結'],
  tags: ['tags', 'tag', '標籤'],
  description: ['description', 'desc', '簡介', '介紹'],
  color: ['color', 'primaryColor', 'primary_color', '顏色'],
  createdAt: ['createdAt', 'created_at', 'created', '建立時間'],
  bannerPreset: ['bannerPreset', 'banner_preset', '預設Banner', '預設背景'],
  customBanner: ['customBanner', 'custom_banner', '自訂Banner', '客製Banner']
});
const SERVER_CATEGORIES = ['遊戲', '聊天交友', '創作', '技術', '學習', '其他'];
const DISCORD_INVITE_RE = /^https:\/\/(?:www\.)?(discord\.gg\/[A-Za-z0-9-]{2,32}|discord\.com\/invite\/[A-Za-z0-9-]{2,32})\/?$/i;
const BANNER_PRESET_RE = /^[a-z0-9][a-z0-9-]{0,79}$/i;
const DANGEROUS_TEXT_RE = /<\s*\/?\s*script\b|javascript\s*:|data\s*:|file\s*:|vbscript\s*:/i;
const SERVER_SUBMISSION_COOLDOWN_SECONDS = 10 * 60;
const SERVER_SUBMISSION_DAILY_LIMIT = 5;

function doGet(e) {
  try {
    const sheet = getServerSheet_();
    const table = readTable_(sheet);
    const payload = { ok: true, servers: table.rows };
    return output_(payload, e && e.parameter && e.parameter.callback);
  } catch (error) {
    console.error('doGet failed', error);
    return output_({ ok: false, error: errorMessage_(error), servers: [] }, e && e.parameter && e.parameter.callback);
  }
}

function doPost(e) {
  try {
    const data = parseRequest_(e);
    const action = clean_(data.action);
    if (action === 'updateBanner') {
      return jsonOutput_(updateBanner_(data));
    }
    if (action === 'updateServerName') {
      return jsonOutput_(updateServerName_(data));
    }
    if (action && action !== 'createServer') {
      throw new Error('不支援的操作');
    }
    return jsonOutput_(createServer_(data));
  } catch (error) {
    console.error('doPost failed', error);
    return jsonOutput_({ ok: false, error: errorMessage_(error) });
  }
}

function updateServerName_(data) {
  requireAdminKey_(data);

  const id = clean_(data.id, 120);
  const name = sanitizeText_(data.name, '社群名稱', 40, true);
  if (!id) throw new Error('缺少社群 ID');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getServerSheet_();
    const table = readTable_(sheet);
    const idColumn = requireColumn_(table.columns, 'id');
    const nameColumn = requireColumn_(table.columns, 'name');
    const rowIndex = table.values.findIndex(function (row, index) {
      return index > 0 && clean_(row[idColumn]) === id;
    });
    if (rowIndex < 1) throw new Error('Google Sheet 找不到指定社群');

    sheet.getRange(rowIndex + 1, nameColumn + 1).setValue(name);
    SpreadsheetApp.flush();
    return { ok: true, action: 'updateServerName', id: id, name: name };
  } finally {
    lock.releaseLock();
  }
}

function updateBanner_(data) {
  requireAdminKey_(data);

  const id = clean_(data.id, 120);
  const bannerPreset = validateBannerPreset_(data.bannerPreset);
  const customBanner = validateOptionalHttpsUrl_(data.customBanner, 'customBanner', 500);
  if (!id) throw new Error('缺少社群 ID');
  if (!bannerPreset && !customBanner) throw new Error('bannerPreset 與 customBanner 不可同時為空');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getServerSheet_();
    const table = readTable_(sheet);
    const idColumn = requireColumn_(table.columns, 'id');
    const presetColumn = requireColumn_(table.columns, 'bannerPreset');
    const customColumn = requireColumn_(table.columns, 'customBanner');
    const rowIndex = table.values.findIndex(function (row, index) {
      return index > 0 && clean_(row[idColumn]) === id;
    });
    if (rowIndex < 1) throw new Error('Google Sheet 找不到指定社群');

    sheet.getRange(rowIndex + 1, presetColumn + 1).setValue(bannerPreset);
    sheet.getRange(rowIndex + 1, customColumn + 1).setValue(customBanner);
    SpreadsheetApp.flush();
    return {
      ok: true,
      action: 'updateBanner',
      id: id,
      bannerPreset: bannerPreset,
      customBanner: customBanner
    };
  } finally {
    lock.releaseLock();
  }
}

function createServer_(data) {
  const name = sanitizeText_(data.name, '社群名稱', 40, true);
  const inviteUrl = normalizeDiscordInviteUrl_(data.inviteUrl);
  const description = sanitizeText_(data.description, '社群簡介', 300, true);
  const server = {
    id: clean_(data.id, 80) || createId_(name),
    name: name,
    category: validateCategory_(data.category),
    inviteUrl: inviteUrl,
    tags: formatTags_(data.tags),
    description: description,
    color: safeColor_(data.color),
    createdAt: clean_(data.createdAt) || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    bannerPreset: validateBannerPreset_(data.bannerPreset),
    customBanner: validateOptionalHttpsUrl_(data.customBanner, 'customBanner', 500)
  };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getServerSheet_();
    const table = readTable_(sheet);
    const idColumn = requireColumn_(table.columns, 'id');
    const inviteColumn = requireColumn_(table.columns, 'inviteUrl');
    const duplicate = table.values.some(function (row, index) {
      return index > 0 && (clean_(row[idColumn]) === server.id || clean_(row[inviteColumn]) === server.inviteUrl);
    });
    if (duplicate) throw new Error('此社群已經存在');

    recordServerSubmission_(data, server);

    const row = table.headers.map(function () { return ''; });
    Object.keys(table.columns).forEach(function (field) {
      row[table.columns[field]] = server[field] == null ? '' : server[field];
    });
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    return { ok: true, action: 'createServer', server: server };
  } finally {
    lock.releaseLock();
  }
}

function parseRequest_(e) {
  const data = {};
  const parameters = e && e.parameter ? e.parameter : {};
  Object.keys(parameters).forEach(function (key) {
    data[key] = parameters[key];
  });

  const postData = e && e.postData && e.postData.contents;
  const contentType = String(e && e.postData && e.postData.type || '').toLowerCase();
  if (postData && contentType.indexOf('application/json') >= 0) {
    const json = JSON.parse(postData);
    Object.keys(json || {}).forEach(function (key) {
      data[key] = json[key];
    });
  }
  return data;
}

function getServerSheet_() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SERVER_SHEET_NAME);
  if (!sheet) throw new Error('找不到工作表：' + SERVER_SHEET_NAME);
  return sheet;
}

function readTable_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) throw new Error('servers 工作表沒有欄名');

  // 有些 Google Sheet 會在欄位標題前放置說明列或空白列。
  // 先在前 20 列尋找同時包含 id 與 name（或相容標題）的真正標題列。
  const headerRowIndex = findHeaderRow_(values);
  if (headerRowIndex < 0) {
    throw new Error('Google Sheet 找不到標題列：需要包含 id 與 name 欄位');
  }

  const headers = values[headerRowIndex].map(clean_);
  const rawColumns = {};
  headers.forEach(function (header, index) {
    rawColumns[normalizeHeader_(header)] = index;
  });

  // 讀取公開資料時，只有 id 與 name 是所有功能都必須的核心欄位。
  // 其他欄位（例如 Banner 欄位）可能尚未建立；缺少時先以空值讀取，
  // 只有真正執行相關更新功能時，才由 requireColumn_ 明確提示缺少哪一欄。
  const columns = {};
  REQUIRED_HEADERS.forEach(function (field) {
    columns[field] = findColumn_(rawColumns, field);
  });
  ['id', 'name'].forEach(function (field) {
    if (columns[field] < 0) requireColumn_(rawColumns, field);
  });

  const rows = values.slice(headerRowIndex + 1)
    .filter(function (row) {
      return row.some(function (value) { return clean_(value) !== ''; });
    })
    .map(function (row) {
      const record = {};
      Object.keys(columns).forEach(function (field) {
        const column = columns[field];
        record[field] = column >= 0 && row[column] != null ? row[column] : '';
      });
      record.tags = clean_(record.tags).split(',').map(clean_).filter(Boolean);
      return record;
    });

  return {
    values: values,
    headers: headers,
    columns: columns,
    rows: rows,
    headerRowIndex: headerRowIndex
  };
}

function findHeaderRow_(values) {
  const limit = Math.min(values.length, 20);
  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const rawColumns = {};
    (values[rowIndex] || []).forEach(function (header, columnIndex) {
      const key = normalizeHeader_(header);
      if (key) rawColumns[key] = columnIndex;
    });
    if (findColumn_(rawColumns, 'id') >= 0 && findColumn_(rawColumns, 'name') >= 0) {
      return rowIndex;
    }
  }
  return -1;
}
function requireColumn_(columns, name) {
  const column = findColumn_(columns, name);
  if (column < 0) {
    throw new Error('Google Sheet 缺少欄位：' + name +
      '（可使用相容標題：' + (HEADER_ALIASES[name] || [name]).join('、') + '）');
  }
  return column;
}

function findColumn_(columns, name) {
  const candidates = [name].concat(HEADER_ALIASES[name] || []);
  for (let index = 0; index < candidates.length; index += 1) {
    const key = normalizeHeader_(candidates[index]);
    if (Object.prototype.hasOwnProperty.call(columns, key)) {
      return columns[key];
    }
  }
  return -1;
}

function normalizeHeader_(value) {
  return clean_(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\\s_-]+/g, '');
}

function createId_(name) {
  const slug = clean_(name).toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || ('server-' + Date.now());
}

function clean_(value, maxLength) {
  const text = value == null ? '' : String(value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return maxLength ? text.slice(0, maxLength) : text;
}

function sanitizeText_(value, label, maxLength, required) {
  const text = clean_(value);
  if (required && !text) throw new Error(label + '為必填');
  if (text.length > maxLength) throw new Error(label + '最多 ' + maxLength + ' 字');
  if (DANGEROUS_TEXT_RE.test(text)) throw new Error(label + '含有不安全內容');
  return text;
}

function validateCategory_(value) {
  const category = clean_(value);
  return SERVER_CATEGORIES.indexOf(category) >= 0 ? category : '其他';
}

function normalizeDiscordInviteUrl_(value) {
  const text = clean_(value, 120);
  const match = text.match(DISCORD_INVITE_RE);
  if (!match) {
    throw new Error('Discord 邀請連結格式不正確');
  }
  const code = match[1].split('/').pop();
  if (!/^[A-Za-z0-9-]{2,32}$/.test(code)) {
    throw new Error('Discord 邀請碼格式不正確');
  }
  return match[1].toLowerCase().indexOf('discord.gg/') === 0
    ? 'https://discord.gg/' + code
    : 'https://discord.com/invite/' + code;
}

function formatTags_(value) {
  const items = clean_(value, 140).split(/[、,，\s]+/)
    .map(function (item) { return sanitizeText_(item, '標籤', 20, false); })
    .filter(Boolean)
    .slice(0, 6);
  return items.join(',');
}

function safeColor_(value) {
  const color = clean_(value);
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#755cff';
}

function validateBannerPreset_(value) {
  const preset = clean_(value, 80);
  if (!preset) return '';
  if (!BANNER_PRESET_RE.test(preset)) throw new Error('Banner preset 格式不正確');
  return preset;
}

function validateOptionalHttpsUrl_(value, label, maxLength) {
  const text = clean_(value, maxLength);
  if (!text) return '';
  if (!/^https:\/\/[^\s<>"']+$/i.test(text) || DANGEROUS_TEXT_RE.test(text)) {
    throw new Error(label + ' 網址格式不正確');
  }
  return text;
}

function requireAdminKey_(data) {
  const expected = PropertiesService.getScriptProperties().getProperty(ADMIN_KEY_PROPERTY);
  if (!expected) {
    throw new Error('尚未設定管理密碼');
  }
  const provided = clean_(data.adminKey);
  if (!provided || provided !== expected) {
    throw new Error('管理密碼錯誤');
  }
}

function recordServerSubmission_(data, server) {
  const fingerprint = serverSubmissionFingerprint_(data, server);
  const cache = CacheService.getScriptCache();
  const cooldownKey = 'server-submit-cooldown:' + fingerprint;
  if (cache.get(cooldownKey)) {
    throw new Error('送出太頻繁，請稍後再試');
  }

  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  const dailyKey = 'SERVERBLOOM_SUBMIT_' + today + '_' + fingerprint;
  const props = PropertiesService.getScriptProperties();
  const count = Number(props.getProperty(dailyKey) || '0');
  if (count >= SERVER_SUBMISSION_DAILY_LIMIT) {
    throw new Error('今日投稿次數已達上限，請明天再試');
  }

  props.setProperty(dailyKey, String(count + 1));
  cache.put(cooldownKey, '1', SERVER_SUBMISSION_COOLDOWN_SECONDS);
}

function serverSubmissionFingerprint_(data, server) {
  const visitorId = clean_(data.visitorId, 120).replace(/[^A-Za-z0-9_.:-]/g, '');
  if (visitorId) {
    return 'visitor-' + hashText_(visitorId);
  }
  return 'invite-' + hashText_(server.inviteUrl || server.name);
}

function hashText_(value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    clean_(value)
  );
  return bytes.map(function (byte) {
    const value = (byte + 256) % 256;
    return ('0' + value.toString(16)).slice(-2);
  }).join('').slice(0, 32);
}

function errorMessage_(error) {
  return error && error.message ? error.message : String(error || '未知錯誤');
}

function output_(payload, callback) {
  const callbackName = clean_(callback);
  if (callbackName) {
    if (!/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callbackName)) {
      return jsonOutput_({ ok: false, error: '無效的 JSONP callback' });
    }
    return ContentService.createTextOutput(callbackName + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonOutput_(payload);
}

function jsonOutput_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
