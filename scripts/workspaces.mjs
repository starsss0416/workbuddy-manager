#!/usr/bin/env node
/**
 * WorkBuddy Workspaces Manager
 * 
 * 查看 WorkBuddy 工作空间信息
 * 
 * Usage:
 *   node workspaces.mjs list
 *   node workspaces.mjs info <workspace-path>
 *   node workspaces.mjs memory <workspace-path>
 */

import fs from 'fs';
import path from 'path';

function getDirSize(dirPath) {
  if (!fs.existsSync(dirPath)) return { size: 0, fileCount: 0 };
  let size = 0, fileCount = 0;
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    if (item.isDirectory()) {
      const sub = getDirSize(fullPath);
      size += sub.size;
      fileCount += sub.fileCount;
    } else {
      try { size += fs.statSync(fullPath).size; fileCount++; } catch { /* skip */ }
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

function getRegisteredWorkspaces() {
  const APP_DATA = process.env.APPDATA || '';
  const storageDir = path.join(APP_DATA, 'WorkBuddy', 'User', 'workspaceStorage');
  if (!fs.existsSync(storageDir)) return [];
  const workspaces = [];
  const items = fs.readdirSync(storageDir, { withFileTypes: true });
  for (const item of items) {
    if (!item.isDirectory()) continue;
    const wsPath = path.join(storageDir, item.name);
    const workspaceJson = path.join(wsPath, 'workspace.json');
    if (fs.existsSync(workspaceJson)) {
      try {
        const ws = JSON.parse(fs.readFileSync(workspaceJson, 'utf-8'));
        let fp = decodeURIComponent(ws.folderPath || ws.folder || '');
        if (fp.startsWith('file:///')) fp = fp.slice(8);
        workspaces.push({
          id: item.name,
          folderPath: fp,
          lastModified: fs.statSync(wsPath).mtime
        });
      } catch { /* skip */ }
    }
  }
  const seen = new Set();
  return workspaces.filter(ws => {
    const key = ws.folderPath.toLowerCase();
    if (seen.has(key) || !key) return false;
    seen.add(key);
    return true;
  });
}

function listWorkspaces() {
  const registered = getRegisteredWorkspaces();
  console.log(`\n📂 工作空间列表 (共 ${registered.length} 个)\n`);
  if (registered.length === 0) {
    console.log('  (未发现已注册的工作空间)');
  } else {
    for (const ws of registered) {
      const hasWB = fs.existsSync(path.join(ws.folderPath, '.workbuddy'));
      const modified = ws.lastModified.toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      });
      const badge = hasWB ? '✅ .workbuddy' : '⚠️  无 .workbuddy';
      console.log(`  📁 ${ws.folderPath}`);
      console.log(`     ID: ${ws.id}  修改: ${modified}  ${badge}`);
      console.log('');
    }
  }
  console.log('');
}

function workspaceInfo(wsPath) {
  const resolved = path.resolve(wsPath);
  if (!fs.existsSync(resolved)) {
    console.log(`❌ 路径不存在: ${resolved}`);
    process.exit(1);
  }
  console.log(`\n📊 工作空间详情: ${resolved}\n`);

  const dirStat = fs.statSync(resolved);
  const dirInfo = getDirSize(resolved);
  console.log(`  路径:        ${resolved}`);
  console.log(`  大小:        ${formatSize(dirInfo.size)} (${dirInfo.fileCount} 个文件)`);
  console.log(`  创建时间:    ${dirStat.birthtime.toLocaleString('zh-CN')}`);
  console.log(`  修改时间:    ${dirStat.mtime.toLocaleString('zh-CN')}`);

  const wbDir = path.join(resolved, '.workbuddy');
  if (fs.existsSync(wbDir)) {
    const wbInfo = getDirSize(wbDir);
    console.log(`\n  .workbuddy/:`);
    console.log(`    大小:      ${formatSize(wbInfo.size)} (${wbInfo.fileCount} 个文件)`);

    const memDir = path.join(wbDir, 'memory');
    if (fs.existsSync(memDir)) {
      const memInfo = getDirSize(memDir);
      const memFiles = fs.readdirSync(memDir).sort().reverse();
      console.log(`    memory/:   ${formatSize(memInfo.size)} (${memFiles.length} 个文件)`);
      for (const f of memFiles.slice(0, 5)) {
        const fstat = fs.statSync(path.join(memDir, f));
        console.log(`      - ${f}  (${formatSize(fstat.size)}, ${fstat.mtime.toLocaleDateString('zh-CN')})`);
      }
      if (memFiles.length > 5) console.log(`      ... 还有 ${memFiles.length - 5} 个文件`);
    }

    const skillsDir = path.join(wbDir, 'skills');
    if (fs.existsSync(skillsDir)) {
      const skills = fs.readdirSync(skillsDir);
      console.log(`    skills/:   ${skills.length} 个技能`);
      for (const s of skills) {
        const hasSkill = fs.existsSync(path.join(skillsDir, s, 'SKILL.md'));
        console.log(`      - ${s} ${hasSkill ? '✅' : '⚠️ 缺少 SKILL.md'}`);
      }
    }
  } else {
    console.log('\n  ⚠️  此工作空间没有 .workbuddy 目录');
  }
  console.log('');
}

function memoryInfo(wsPath) {
  const resolved = path.resolve(wsPath);
  const memDir = path.join(resolved, '.workbuddy', 'memory');
  if (!fs.existsSync(memDir)) {
    console.log(`❌ Memory 目录不存在: ${memDir}`);
    process.exit(1);
  }
  console.log(`\n🧠 工作记忆: ${resolved}\n`);
  const files = fs.readdirSync(memDir).sort();
  for (const f of files) {
    const fp = path.join(memDir, f);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) {
      const sub = getDirSize(fp);
      console.log(`  📁 ${f}/  ${formatSize(sub.size)}  ${sub.fileCount} 个文件  修改: ${stat.mtime.toLocaleString('zh-CN')}`);
    } else {
      console.log(`  📄 ${f}  ${formatSize(stat.size)}  修改: ${stat.mtime.toLocaleString('zh-CN')}`);
    }
  }
  console.log('');
}

// === CLI ===
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'list':
    console.log(' WorkBuddy Workspaces Manager\n');
    listWorkspaces();
    break;
  case 'info':
    if (!args[1]) { console.log('用法: node workspaces.mjs info <workspace-path>'); process.exit(1); }
    workspaceInfo(args[1]);
    break;
  case 'memory':
    if (!args[1]) { console.log('用法: node workspaces.mjs memory <workspace-path>'); process.exit(1); }
    memoryInfo(args[1]);
    break;
  default:
    console.log(`
 WorkBuddy Workspaces Manager

 用法:
   node workspaces.mjs list                  列出所有工作空间
   node workspaces.mjs info <workspace-path> 查看工作空间详情
   node workspaces.mjs memory <workspace-path> 查看 memory 目录内容
`);
    process.exit(1);
}
