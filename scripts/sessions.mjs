#!/usr/bin/env node
import { fmtSize, fmtTime, fmtDate, statusIcon, parseSessionsFromDB, getBrainSessions, findSession, cpDir, now, dirSize, BRAIN_DIR, SESSIONS_DB, DEFAULT_BACKUP_DIR, getSqlModule } from './_utils.mjs';
import fs from 'fs';
import path from 'path';

// ── list ──
async function cmdList(recent) {
  const sessions = await parseSessionsFromDB();
  const brain = getBrainSessions();
  const disp = recent ? sessions.slice(0, recent) : sessions;
  console.log(`\n📋 WorkBuddy 会话列表 (共 ${sessions.length} 个)\n`);
  console.log('  #    状态       ID                                     标题                                       工作空间                         更新时间       产物');
  console.log('  ' + '─'.repeat(145));
  disp.forEach((s, idx) => {
    const no = String(idx + 1).padEnd(4);
    const st = (statusIcon(s.status) + ' ' + (s.status || '?')).padEnd(11);
    const id = s.conversationId.slice(0, 36);
    const title = (s.title || '(无标题)').replace(/[\r\n]/g, ' ').slice(0, 38);
    const cwd = (s.cwd || '-').slice(0, 32);
    const updated = fmtTime(s.updatedAt);
    const bi = brain[s.conversationId];
    const artifact = bi ? fmtSize(bi.size) : '-';
    console.log(`  ${no} ${st} ${id.padEnd(38)} ${title.padEnd(40)} ${cwd.padEnd(32)} ${updated.padEnd(14)} ${artifact}`);
  });
  if (!disp.length) console.log('  (空)');
  const sc = {};
  sessions.forEach(s => { sc[s.status] = (sc[s.status] || 0) + 1; });
  const bt = Object.values(brain).reduce((a, b) => a + b.size, 0);
  const bc = Object.keys(brain).length;
  console.log('\n  ── 汇总 ──');
  Object.entries(sc).forEach(([k, v]) => console.log(`  ${statusIcon(k)} ${k}: ${v}`));
  if (bc > 0) console.log(`  💾 Brain 产物: ${bc} 个, 共 ${fmtSize(bt)}`);
  console.log(`  📄 DB: ${SESSIONS_DB}\n`);
}

// ── search ──
async function cmdSearch(kw) {
  const lk = kw.toLowerCase();
  const sessions = (await parseSessionsFromDB()).filter(s =>
    (s.title || '').toLowerCase().includes(lk) || (s.cwd || '').toLowerCase().includes(lk) || s.conversationId.toLowerCase().includes(lk)
  );
  console.log(`\n🔍 搜索 "${kw}" (找到 ${sessions.length} 个)\n`);
  sessions.forEach(s => {
    const title = (s.title || '(无标题)').replace(/[\r\n]/g, ' ').slice(0, 60);
    console.log(`  ${statusIcon(s.status)} [${s.status}] ${s.conversationId}`);
    console.log(`     ${title}`);
    console.log(`     工作空间: ${s.cwd || '-'}  更新: ${fmtDate(s.updatedAt)}\n`);
  });
  if (!sessions.length) console.log('  未找到。\n');
}

// ── delete ──
async function cmdDelete(id, force) {
  const s = await findSession(id);
  if (!s) { console.log(`❌ 未找到: ${id}`); process.exit(1); }
  if (s.ambiguous) { console.log(`❌ 匹配到 ${s.matches.length} 个:`); s.matches.forEach(m => console.log(`   - ${m.conversationId}`)); process.exit(1); }
  console.log(`\n🗑️  准备删除\n  ID: ${s.conversationId}\n  标题: ${(s.title || '').replace(/[\r\n]/g, ' ').slice(0, 60)}\n  状态: ${s.status}`);
  if (!force) {
    const bp = path.join(BRAIN_DIR, s.conversationId);
    const hasBrain = fs.existsSync(bp);
    console.log(`\n⚠️  预览模式，未实际删除。`);
    console.log(`  📄 会话记录: 1 条`);
    console.log(`  🧠 Brain 产物: ${hasBrain ? fmtSize(dirSize(bp).size) : '无'}`);
    console.log(`\n  加 --force 确认删除，加 --db-only 仅删除数据库记录，加 --brain-only 仅删除产物\n`);
    return;
  }
  const dbOnly = args.includes('--db-only');
  const brainOnly = args.includes('--brain-only');
  let deletedDb = false, deletedBrain = false;

  // 删除数据库记录
  if (!brainOnly) {
    const SQL = await getSqlModule();
    const buf = fs.readFileSync(SESSIONS_DB);
    const db = new SQL.Database(buf);
    try {
      const key = `session:${s.conversationId}`;
      db.run("DELETE FROM ItemTable WHERE key = ?", [key]);
      const data = db.export();
      fs.writeFileSync(SESSIONS_DB, Buffer.from(data));
      deletedDb = true;
    } finally { db.close(); }
  }

  // 删除 Brain 产物
  if (!dbOnly) {
    const bp = path.join(BRAIN_DIR, s.conversationId);
    if (fs.existsSync(bp)) {
      const info = dirSize(bp);
      fs.rmSync(bp, { recursive: true, force: true });
      deletedBrain = true;
      console.log(`\n  ✅ 已删除 Brain 产物: ${fmtSize(info.size)}`);
    }
  }

  if (deletedDb) console.log(`  ✅ 已删除会话记录`);
  if (!deletedDb && !deletedBrain) console.log(`\n  ℹ️  无内容可删除`);
  console.log();
}

// ── backup ──
async function cmdBackup(idOrAll, outDir) {
  const base = outDir || DEFAULT_BACKUP_DIR;
  fs.mkdirSync(base, { recursive: true });
  const sessions = await parseSessionsFromDB();
  if (idOrAll === 'all') {
    if (!sessions.length) { console.log('ℹ️  无会话'); return; }
    const ts = now(), bd = `${base}/sessions-all-${ts}`;
    fs.mkdirSync(bd, { recursive: true });
    fs.writeFileSync(`${bd}/_sessions.json`, JSON.stringify(sessions, null, 2));
    let ac = 0, abSize = 0;
    if (fs.existsSync(BRAIN_DIR)) {
      for (const s of sessions) {
        const sp = path.join(BRAIN_DIR, s.conversationId);
        if (fs.existsSync(sp)) { try { cpDir(sp, path.join(bd, 'brain', s.conversationId)); ac++; abSize += dirSize(sp).size; } catch {} }
      }
    }
    console.log(`\n📦 备份完成\n  会话: ${sessions.length} 条\n  产物: ${ac} 个 (${fmtSize(abSize)})\n  位置: ${bd}\n`);
  } else {
    const s = await findSession(idOrAll);
    if (!s) { console.log(`❌ 未找到: ${idOrAll}`); process.exit(1); }
    if (s.ambiguous) { console.log(`❌ 匹配多个:`); s.matches.forEach(m => console.log(`   - ${m.conversationId}`)); process.exit(1); }
    const dd = `${base}/session-${s.conversationId.slice(0, 8)}-${now()}`;
    fs.mkdirSync(dd, { recursive: true });
    fs.writeFileSync(`${dd}/_session.json`, JSON.stringify(s, null, 2));
    const bp = `${BRAIN_DIR}/${s.conversationId}`;
    if (fs.existsSync(bp)) cpDir(bp, `${dd}/brain`);
    console.log(`\n📦 备份完成\n  ID: ${s.conversationId}\n  位置: ${dd}\n`);
  }
}

// ── restore ──
function cmdRestore(bp) {
  const rp = path.resolve(bp);
  if (!fs.existsSync(rp)) { console.log(`❌ 不存在: ${rp}`); process.exit(1); }
  fs.mkdirSync(BRAIN_DIR, { recursive: true });
  const mf = `${rp}/_session.json`, mj = `${rp}/_sessions.json`;
  if (fs.existsSync(mj)) {
    const list = JSON.parse(fs.readFileSync(mj, 'utf-8'));
    let ok = 0;
    for (const s of list) {
      const src = `${rp}/brain/${s.conversationId}`, tgt = `${BRAIN_DIR}/${s.conversationId}`;
      if (fs.existsSync(src) && !fs.existsSync(tgt)) { cpDir(src, tgt); ok++; }
    }
    console.log(`\n✅ 批量恢复: ${ok} 个产物\n`);
  } else if (fs.existsSync(mf)) {
    const s = JSON.parse(fs.readFileSync(mf, 'utf-8'));
    const src = `${rp}/brain`, tgt = `${BRAIN_DIR}/${s.conversationId}`;
    if (fs.existsSync(src) && !fs.existsSync(tgt)) { cpDir(src, tgt); console.log(`\n✅ 恢复: ${s.conversationId}\n`); }
    else console.log(`\nℹ️  无产物或已存在\n`);
  } else console.log(`\n❌ 非有效备份目录\n`);
}

// ── migrate ──
function cmdMigrate(srcDir, tgtDir) {
  const src = path.resolve(srcDir), tgt = path.resolve(tgtDir);
  if (!fs.existsSync(src)) { console.log(`❌ 源不存在: ${src}`); process.exit(1); }
  fs.mkdirSync(tgt, { recursive: true });
  const items = fs.readdirSync(src, { withFileTypes: true }).filter(i => i.isDirectory());
  if (!items.length) { console.log('ℹ️  源无子目录'); return; }
  let ok = 0, skip = 0, fail = 0, total = 0;
  console.log(`\n🚚 迁移\n  源: ${src}\n  目标: ${tgt}\n`);
  for (const item of items) {
    const s = `${src}/${item.name}`, t = `${tgt}/${item.name}`;
    try {
      if (fs.existsSync(t)) { skip++; console.log(`  ⏭️ 跳过: ${item.name}`); continue; }
      cpDir(s, t); const info = dirSize(t); ok++; total += info.size;
      console.log(`  ✅ ${item.name} (${fmtSize(info.size)})`);
    } catch (e) { fail++; console.log(`  ❌ ${item.name}: ${e.message}`); }
  }
  console.log(`\n  成功 ${ok}  跳过 ${skip}  失败 ${fail}  共 ${fmtSize(total)}\n`);
}

// ── CLI ──
const args = process.argv.slice(2), cmd = args[0];
switch (cmd) {
  case 'list': {
    const ri = args.indexOf('--recent');
    const recent = ri !== -1 ? parseInt(args[ri + 1], 10) || 20 : undefined;
    console.log(' WorkBuddy Sessions Manager\n');
    if (fs.existsSync(SESSIONS_DB)) {
      const st = fs.statSync(SESSIONS_DB);
      console.log(`📊 DB: ${fmtSize(st.size)}  修改: ${fmtDate(st.mtime)}\n`);
    } else console.log('⚠️  DB 不存在\n');
    await cmdList(recent); break;
  }
  case 'search':
    if (!args[1]) { console.log('用法: search <keyword>'); process.exit(1); }
    console.log(' WorkBuddy Sessions Manager\n'); await cmdSearch(args[1]); break;
  case 'delete':
    if (!args[1]) { console.log('用法: delete <id> [--force] [--db-only] [--brain-only]'); process.exit(1); }
    console.log(' WorkBuddy Sessions Manager\n'); await cmdDelete(args[1], args.includes('--force')); break;
  case 'backup':
    if (!args[1]) { console.log('用法: backup <id|all> [--output dir]'); process.exit(1); }
    { const oi = args.indexOf('--output'); console.log(' WorkBuddy Sessions Manager\n'); await cmdBackup(args[1], oi !== -1 ? args[oi + 1] : undefined); break; }
  case 'restore':
    if (!args[1]) { console.log('用法: restore <backup-path>'); process.exit(1); }
    console.log(' WorkBuddy Sessions Manager\n'); cmdRestore(args[1]); break;
  case 'migrate':
    if (args.length < 3) { console.log('用法: migrate <src> <tgt>'); process.exit(1); }
    console.log(' WorkBuddy Sessions Manager\n'); cmdMigrate(args[1], args[2]); break;
  default:
    console.log(`
WorkBuddy Sessions Manager

用法:
  list [--recent N]         列出会话 (从 SQLite 解析)
  search <keyword>           搜索会话
  delete <id> [--force]      删除会话记录 + Brain 产物
                            --db-only      仅删除数据库记录
                            --brain-only   仅删除 Brain 产物
                            不加 --force    预览（不实际删除）
  backup <id|all> [--output] 备份会话元数据 + 产物
  restore <backup-path>      恢复备份
  migrate <src> <tgt>        迁移 Brain 产物
`);
}
