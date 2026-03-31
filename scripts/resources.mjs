#!/usr/bin/env node
/**
 * WorkBuddy Resources Manager
 * 监控和清理 WorkBuddy 系统资源
 * Usage: node resources.mjs overview | clean-cache | clean-logs | clean-brain
 */

import fs from 'fs';
import path from 'path';

const APP_DATA = process.env.APPDATA || '';
const WB_ROOT = path.join(APP_DATA, 'WorkBuddy');

const DIRS = {
  cache:     path.join(WB_ROOT, 'Cache'),
  logs:      path.join(WB_ROOT, 'logs'),
  crash:     path.join(WB_ROOT, 'CrashReport'),
  blob:      path.join(WB_ROOT, 'blob_storage'),
  brain:     path.join(WB_ROOT, 'User', 'globalStorage', 'tencent-cloud.coding-copilot', 'brain'),
  gpu:       path.join(WB_ROOT, 'GPUCache'),
  network:   path.join(WB_ROOT, 'Network'),
  codeCache: path.join(WB_ROOT, 'Code Cache'),
};

function getDirSize(dirPath) {
  if (!fs.existsSync(dirPath)) return { size: 0, fileCount: 0 };
  let size = 0, fileCount = 0;
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const item of items) {
    const fp = path.join(dirPath, item.name);
    if (item.isDirectory()) {
      const sub = getDirSize(fp);
      size += sub.size; fileCount += sub.fileCount;
    } else {
      try { size += fs.statSync(fp).size; fileCount++; } catch { /* skip */ }
    }
  }
  return { size, fileCount };
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

function overview() {
  console.log('\n💾 WorkBuddy 资源占用概览\n');
  console.log('  目录                          大小         文件数');
  console.log('  ' + '─'.repeat(70));

  let totalSize = 0, totalFiles = 0;
  const entries = Object.entries(DIRS);

  for (const [name, dirPath] of entries) {
    const info = getDirSize(dirPath);
    totalSize += info.size;
    totalFiles += info.fileCount;
    const exists = fs.existsSync(dirPath) ? '✅' : '❌';
    const label = name.padEnd(30);
    console.log(`  ${label} ${formatSize(info.size).padEnd(12)} ${String(info.fileCount).padEnd(8)} ${exists}`);
  }

  console.log('  ' + '─'.repeat(70));
  console.log(`  ${'总计'.padEnd(30)} ${formatSize(totalSize).padEnd(12)} ${totalFiles}\n`);
  console.log(`  📁 WorkBuddy 根目录: ${WB_ROOT}\n`);
}

function deleteOldFiles(dirPath, keepDays) {
  if (!fs.existsSync(dirPath)) {
    console.log(`  ⚠️  目录不存在: ${dirPath}`);
    return { deleted: 0, freed: 0 };
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - keepDays);
  let deleted = 0, freed = 0;

  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, item.name);
      if (item.isDirectory()) {
        walk(fp);
        // 如果目录空了就删除
        try {
          if (fs.readdirSync(fp).length === 0) fs.rmdirSync(fp);
        } catch { /* skip */ }
      } else {
        try {
          const stat = fs.statSync(fp);
          if (stat.mtime < cutoff) {
            const size = stat.size;
            fs.unlinkSync(fp);
            deleted++;
            freed += size;
          }
        } catch { /* skip */ }
      }
    }
  }

  walk(dirPath);
  return { deleted, freed };
}

function cleanCache() {
  console.log('\n🧹 清理缓存...\n');
  const result = deleteOldFiles(DIRS.cache, 0);
  console.log(`  ✅ 删除 ${result.deleted} 个文件，释放 ${formatSize(result.freed)}\n`);
}

function cleanLogs(keepDays = 7) {
  console.log(`\n🧹 清理日志 (保留最近 ${keepDays} 天)...\n`);
  const result = deleteOldFiles(DIRS.logs, keepDays);
  console.log(`  ✅ 删除 ${result.deleted} 个文件，释放 ${formatSize(result.freed)}\n`);
}

function cleanBrain(keepDays = 30) {
  console.log(`\n🧹 清理 Brain artifacts (保留最近 ${keepDays} 天)...\n`);
  if (!fs.existsSync(DIRS.brain)) {
    console.log('  ⚠️  Brain 目录不存在\n');
    return;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - keepDays);
  let deleted = 0, freed = 0;

  for (const item of fs.readdirSync(DIRS.brain, { withFileTypes: true })) {
    if (!item.isDirectory()) continue;
    try {
      const stat = fs.statSync(path.join(DIRS.brain, item.name));
      if (stat.mtime < cutoff) {
        const info = getDirSize(path.join(DIRS.brain, item.name));
        fs.rmSync(path.join(DIRS.brain, item.name), { recursive: true, force: true });
        deleted++;
        freed += info.size;
        console.log(`  🗑️  删除: ${item.name}  (${formatSize(info.size)})`);
      }
    } catch { /* skip */ }
  }

  console.log(`\n  ✅ 删除 ${deleted} 个会话目录，释放 ${formatSize(freed)}\n`);
}

// === CLI ===
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'overview':
    console.log(' WorkBuddy Resources Manager');
    overview();
    break;
  case 'clean-cache':
    console.log(' WorkBuddy Resources Manager');
    cleanCache();
    break;
  case 'clean-logs':
    console.log(' WorkBuddy Resources Manager');
    cleanLogs(parseInt(args.find(a => !isNaN(a)), 10) || 7);
    break;
  case 'clean-brain':
    console.log(' WorkBuddy Resources Manager');
    const keepIdx = args.indexOf('--keep-days');
    const keepDays = keepIdx !== -1 ? parseInt(args[keepIdx + 1], 10) || 30 : 30;
    cleanBrain(keepDays);
    break;
  default:
    console.log(`
 WorkBuddy Resources Manager

 用法:
   node resources.mjs overview                  查看资源占用
   node resources.mjs clean-cache               清理全部缓存
   node resources.mjs clean-logs [days]         清理旧日志 (默认保留 7 天)
   node resources.mjs clean-brain [--keep-days N]  清理旧 brain (默认保留 30 天)

 ⚠️  清理操作不可逆，请谨慎使用！
`);
    process.exit(1);
}
