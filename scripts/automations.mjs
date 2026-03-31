#!/usr/bin/env node
/**
 * WorkBuddy Automations Manager
 * 查看 WorkBuddy 自动化任务
 * Usage: node automations.mjs list | node automations.mjs info <id>
 */

import fs from 'fs';
import path from 'path';

function parseToml(content) {
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function getAutomations() {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const autoBaseDir = path.join(homeDir, '.workbuddy', 'automations');
  if (!fs.existsSync(autoBaseDir)) return [];

  const automations = [];
  for (const item of fs.readdirSync(autoBaseDir, { withFileTypes: true })) {
    if (!item.isDirectory()) continue;
    const tomlFile = path.join(autoBaseDir, item.name, 'automation.toml');
    if (fs.existsSync(tomlFile)) {
      try {
        const content = fs.readFileSync(tomlFile, 'utf-8');
        const data = parseToml(content);
        automations.push({
          id: item.name,
          name: data.name || '(未命名)',
          prompt: data.prompt || '',
          status: data.status || 'unknown',
          rrule: data.rrule || '',
          scheduleType: data.scheduleType || 'recurring',
          scheduledAt: data.scheduledAt || '',
          cwds: data.cwds || ''
        });
      } catch { /* skip */ }
    }
  }
  return automations;
}

function listAutomations() {
  const automations = getAutomations();
  console.log(`\n⏱️  自动化任务列表 (共 ${automations.length} 个)\n`);

  if (automations.length === 0) {
    console.log('  (没有自动化任务)');
    console.log('');
    return;
  }

  const active = automations.filter(a => a.status === 'ACTIVE');
  const paused = automations.filter(a => a.status === 'PAUSED');
  console.log(`  ✅ 活跃: ${active.length}  |  ⏸️  暂停: ${paused.length}\n`);

  for (const a of automations) {
    const statusIcon = a.status === 'ACTIVE' ? '✅' : '⏸️';
    const schedule = a.scheduleType === 'once'
      ? `一次性: ${a.scheduledAt}`
      : `循环: ${a.rrule || '(未设置)'}`;
    const promptPreview = a.prompt.length > 50 ? a.prompt.slice(0, 50) + '...' : a.prompt;

    console.log(`  ${statusIcon} [${a.id}] ${a.name}`);
    console.log(`     ${schedule}`);
    console.log(`     📝 ${promptPreview}`);
    if (a.cwds) console.log(`     📂 ${a.cwds}`);
    console.log('');
  }
}

function automationInfo(id) {
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const tomlFile = path.join(homeDir, '.workbuddy', 'automations', id, 'automation.toml');
  if (!fs.existsSync(tomlFile)) {
    console.log(`❌ 自动化任务不存在: ${id}`);
    console.log(`   位置: ${tomlFile}`);
    process.exit(1);
  }

  const content = fs.readFileSync(tomlFile, 'utf-8');
  const data = parseToml(content);
  console.log(`\n📋 自动化任务详情\n`);
  console.log(`  ID:          ${id}`);
  console.log(`  名称:        ${data.name || '(未命名)'}`);
  console.log(`  状态:        ${data.status === 'ACTIVE' ? '✅ 活跃' : data.status === 'PAUSED' ? '⏸️ 暂停' : data.status}`);
  console.log(`  类型:        ${data.scheduleType === 'once' ? '一次性' : '循环'}`);
  if (data.scheduleType === 'once') {
    console.log(`  执行时间:    ${data.scheduledAt || '(未设置)'}`);
  }
  if (data.rrule) {
    console.log(`  调度规则:    ${data.rrule}`);
  }
  if (data.validFrom) console.log(`  有效期开始:  ${data.validFrom}`);
  if (data.validUntil) console.log(`  有效期结束:  ${data.validUntil}`);
  if (data.maxDurationMinutes) console.log(`  最大时长:    ${data.maxDurationMinutes} 分钟`);
  if (data.cwds) console.log(`  工作目录:    ${data.cwds}`);
  console.log(`\n  📝 Prompt:`);
  console.log(`  ${'─'.repeat(60)}`);
  console.log(`  ${data.prompt || '(空)'}`);
  console.log(`  ${'─'.repeat(60)}`);
  console.log(`\n  📄 TOML 文件: ${tomlFile}\n`);
}

// === CLI ===
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'list':
    console.log(' WorkBuddy Automations Manager\n');
    listAutomations();
    break;
  case 'info':
    if (!args[1]) { console.log('用法: node automations.mjs info <automation-id>'); process.exit(1); }
    automationInfo(args[1]);
    break;
  default:
    console.log(`
 WorkBuddy Automations Manager

 用法:
   node automations.mjs list              列出所有自动化任务
   node automations.mjs info <id>         查看任务详情
`);
    process.exit(1);
}
