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
    if (data.action === 'updateBanner') {
      return jsonOutput_(updateBanner_(data));
    }
    return jsonOutput_(createServer_(data));
  } catch (error) {
    console.error('doPost failed', error);
    return jsonOutput_({ ok: false, error: errorMessage_(error) });
  }
}

function updateBanner_(data) {
  const id = clean_(data.id);
  const bannerPreset = clean_(data.bannerPreset);
  const customBanner = clean_(data.customBanner);
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
  const server = {
    id: clean_(data.id) || createId_(data.name),
    name: clean_(data.name),
    category: clean_(data.category) || '其他',
    inviteUrl: clean_(data.inviteUrl),
    tags: clean_(data.tags),
    description: clean_(data.description),
    color: clean_(data.color) || '#755cff',
    createdAt: clean_(data.createdAt) || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    bannerPreset: clean_(data.bannerPreset),
    customBanner: clean_(data.customBanner)
  };
  if (!server.name || !server.inviteUrl || !server.description) {
    throw new Error('社群名稱、邀請網址與簡介為必填');
  }

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

    const row = table.headers.map(function (header) {
      return Object.prototype.hasOwnProperty.call(server, header) ? server[header] : '';
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
  const headers = values[0].map(clean_);
  const columns = {};
  headers.forEach(function (header, index) {
    columns[normalizeHeader_(header)] = index;
  });
  REQUIRED_HEADERS.forEach(function (header) {
    requireColumn_(columns, header);
  });
  const rows = values.slice(1).filter(function (row) {
    return row.some(function (value) { return clean_(value) !== ''; });
  }).map(function (row) {
    const record = {};
    headers.forEach(function (header, index) {
      record[header] = row[index] == null ? '' : row[index];
    });
    record.tags = clean_(record.tags).split(',').map(clean_).filter(Boolean);
    return record;
  });
  return { values: values, headers: headers, columns: columns, rows: rows };
}

function requireColumn_(columns, name) {
  const key = normalizeHeader_(name);
  if (!Object.prototype.hasOwnProperty.call(columns, key)) {
    throw new Error('Google Sheet 缺少欄位：' + name);
  }
  return columns[key];
}

function normalizeHeader_(value) {
  return clean_(value).toLowerCase();
}

function createId_(name) {
  const slug = clean_(name).toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || ('server-' + Date.now());
}

function clean_(value) {
  return value == null ? '' : String(value).trim();
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
