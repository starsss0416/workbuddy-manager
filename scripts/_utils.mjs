import fs from 'fs';
import path from 'path';

export const APP_DATA = process.env.APPDATA || path.join(process.env.HOME || '', 'AppData', 'Roaming');
export const WB_ROOT = path.join(APP_DATA, 'WorkBuddy');
export const SESSIONS_DB = path.join(WB_ROOT, 'codebuddy-sessions.vscdb');
export const BRAIN_DIR = path.join(WB_ROOT, 'User', 'globalStorage', 'tencent-cloud.coding-copilot', 'brain');
export const DEFAULT_BACKUP_DIR = path.join(WB_ROOT, 'Backups', 'sessions');

// sql.js 模块缓存（避免重复初始化 WASM）
let _sqlModule = null;
export async function getSqlModule() {
  if (!_sqlModule) {
    const m = await import('sql.js');
    _sqlModule = await m.default();
  }
  return _sqlModule;
}

export function fmtSize(b) {
  if (b === 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return (b / Math.pow(1024, i)).toFixed(1) + ' ' + u[i];
}

export function fmtTime(ts) {
  return ts ? new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
}

export function fmtDate(ts) {
  return ts ? new Date(ts).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
}

export function statusIcon(s) {
  return { Working: '🟢', Completed: '✅', Failed: '🔴', Terminated: '🟡' }[s] || '⚪';
}

export function now() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); }

export function dirSize(d) {
  if (!fs.existsSync(d)) return { size: 0, fileCount: 0 };
  let s = 0, n = 0;
  for (const i of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, i.name);
    if (i.isDirectory()) { const r = dirSize(p); s += r.size; n += r.fileCount; }
    else { try { s += fs.statSync(p).size; n++; } catch {} }
  }
  return { size: s, fileCount: n };
}

export async function parseSessionsFromDB() {
  if (!fs.existsSync(SESSIONS_DB)) return [];
  const SQL = await getSqlModule();
  const buf = fs.readFileSync(SESSIONS_DB);
  const db = new SQL.Database(buf);
  let sessions = [];
  try {
    const result = db.exec("SELECT key, value FROM ItemTable WHERE key LIKE 'session:%'");
    if (result.length) {
      for (const row of result[0].values) {
        try {
          const val = typeof row[1] === 'string' ? row[1] : new TextDecoder().decode(row[1]);
          const obj = JSON.parse(val);
          if (obj.conversationId) sessions.push(obj);
        } catch {}
      }
    }
  } finally {
    db.close();
  }
  return sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getBrainSessions() {
  if (!fs.existsSync(BRAIN_DIR)) return {};
  const map = {};
  for (const item of fs.readdirSync(BRAIN_DIR, { withFileTypes: true })) {
    if (!item.isDirectory()) continue;
    map[item.name] = dirSize(path.join(BRAIN_DIR, item.name));
  }
  return map;
}

export async function findSession(idOrPartial) {
  const sessions = await parseSessionsFromDB();
  let f = sessions.find(s => s.conversationId === idOrPartial);
  if (f) return f;
  const m = sessions.filter(s => s.conversationId.startsWith(idOrPartial));
  if (m.length === 1) return m[0];
  if (m.length > 1) return { ambiguous: true, matches: m };
  return null;
}

export function cpDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const i of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, i.name), d = path.join(dst, i.name);
    i.isDirectory() ? cpDir(s, d) : fs.copyFileSync(s, d);
  }
}
