import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appsScript = readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8');
const admin = readFileSync(path.join(root, 'assets', 'js', 'admin.js'), 'utf8');
const bannerAdmin = readFileSync(path.join(root, 'assets', 'js', 'banner-admin.js'), 'utf8');
const index = readFileSync(path.join(root, 'index.html'), 'utf8');
const adminPage = readFileSync(path.join(root, 'admin.html'), 'utf8');

assert.match(appsScript, /const ADMIN_KEY_PROPERTY = 'SERVERBLOOM_ADMIN_KEY'/);
assert.match(appsScript, /function requireAdminKey_\(data\)/);
assert.match(appsScript, /function updateServerName_\(data\) \{\n\s+requireAdminKey_\(data\);/);
assert.match(appsScript, /function updateBanner_\(data\) \{\n\s+requireAdminKey_\(data\);/);
assert.match(appsScript, /SERVER_SUBMISSION_COOLDOWN_SECONDS = 10 \* 60/);
assert.match(appsScript, /SERVER_SUBMISSION_DAILY_LIMIT = 5/);
assert.match(appsScript, /function recordServerSubmission_\(data, server\)/);
assert.match(appsScript, /CacheService\.getScriptCache\(\)/);
assert.match(appsScript, /PropertiesService\.getScriptProperties\(\)/);
assert.match(appsScript, /function sanitizeText_\(value, label, maxLength, required\)/);
assert.match(appsScript, /DANGEROUS_TEXT_RE/);
assert.match(appsScript, /normalizeDiscordInviteUrl_/);

assert.match(admin, /const ADMIN_KEY_STORAGE = 'serverbloomAdminApiKey'/);
assert.match(admin, /function getAdminKey\(\)/);
assert.match(admin, /adminKey: getAdminKey\(\)/);
assert.match(admin, /clearAdminKey\(\)/);
assert.match(admin, /Google Apps Script 沒有確認改名/);
assert.match(adminPage, /admin\.js\?v=9/);

assert.match(bannerAdmin, /adminKey:getAdminKey\(\)/);
assert.match(bannerAdmin, /API 沒有確認寫入/);
assert.match(index, /banner-admin\.js\?v=banner-sync-v3/);
assert.match(index, /function submitterId\(\)/);
assert.match(index, /body\.set\('visitorId',submitterId\(\)\)/);
assert.match(index, /function cooldownRemaining\(\)/);
assert.match(index, /submissionHistory\(\)\.length>=5/);
assert.match(index, /markSubmitted\(\)/);

console.log('ServerBloom security hardening checks passed.');
