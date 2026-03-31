---
title: 我给 AI 编程助手写了一个「系统管家」——用 Node.js 逆向 vscdb 管理会话、清理缓存
tags: [WorkBuddy, Node.js, AI编程助手, 工具开发, sql.js]
category: 前端
date: 2026-04-01
description: WorkBuddy会话越积越多，数据库膨胀，磁盘占用上升，想清理某个旧会话？对不起，UI 里没有删除按钮。我选择自己动手做Skill，用 Node.js + sql.js 逆向 vscdb 数据库，200 行代码实现会话查看、搜索、删除、备份恢复、资源清理……
---

# 我给小龙虾写了一个「系统管家」——用 Node.js 逆向 vscdb 管理会话

## 前言

工欲善其事必先利其器。我用 WorkBuddy（腾讯小龙虾）快一个月了，日常开发基本离不开它。但有个痛点一直让我不爽：

**没有会话管理。**

你会话越积越多，数据库膨胀，磁盘占用上升，想清理某个旧会话？对不起，UI 里没有删除按钮。想看看上次那个关于 WebSocket 的问题是在哪个会话里讨论的？翻历史记录翻到手酸。

算了，我自己写一个。

## 一、先看效果

最终做出来的东西叫 **workbuddy-manager**，一个命令行工具，源码不到 600 行，覆盖 4 大模块：

### 🔍 会话管理

| 命令                               | 功能                                                 |
| ---------------------------------- | ---------------------------------------------------- |
| `list`                             | 列出所有会话，含状态、标题、工作空间、Brain 产物大小 |
| `list --recent 10`                 | 最近 10 条                                           |
| `search <keyword>`                 | 按标题/路径/ID 搜索                                  |
| `delete <id> --force`              | 删除 DB 记录 + Brain 产物                            |
| `delete <id> --force --db-only`    | 仅删数据库记录                                       |
| `delete <id> --force --brain-only` | 仅删 Brain 产物                                      |
| `backup all`                       | 全量备份（元数据 + 产物）                            |
| `restore <path>`                   | 恢复备份（不覆盖已存在文件）                         |
| `migrate <src> <dst>`              | 迁移产物（复制模式，不删源）                         |

### 💾 资源管理

| 命令                         | 功能                                                 |
| ---------------------------- | ---------------------------------------------------- |
| `overview`                   | 查看各目录占用（cache/logs/crash/brain 等 8 个目录） |
| `clean-cache`                | 清理全部缓存                                         |
| `clean-logs 30`              | 清理 30 天前的日志                                   |
| `clean-brain --keep-days 30` | 清理旧 Brain 产物                                    |

### ⏱️ 自动化任务 & 📂 工作空间

`list` + `info`，查看定时任务配置和工作空间详情。

### 实际运行效果

**会话列表：**

```
📊 DB: 12.0 KB  修改: 2026/03/31 23:59

📋 WorkBuddy 会话列表 (共 9 个)

  #    状态       ID                                     标题                                  更新时间       产物
  ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
  1    🟢 Working  416b8f6bff54...  帮我创建一个文件夹...                    03/31 23:48    -
  2    🔴 Failed   ffec10aa68cf4...  课程名称：HTML5+CSS3...                  03/31 23:30    -
  3    ✅ Completed 559938fb57d0...  为微信小程序编写的...                    03/31 21:06    -

  ── 汇总 ──
  🟢 Working: 1  ✅ Completed: 4  🔴 Failed: 2  🟡 Terminated: 2
```

**资源概览：**

```
💾 WorkBuddy 资源占用概览

  目录          大小         文件数
  ─────────────────────────────────────
  cache         40.7 MB      122
  logs          59.3 MB      449
  crash         146.5 MB     6
  brain         0 B          0
  ─────────────────────────────────────
  总计           248.0 MB     593
```

发现问题了：**crash 目录 146.5 MB，全是崩溃转储，白白占空间。** 一条命令清理后，释放了约 **200 MB** 磁盘空间。

**删除预览（安全设计，不加 --force 绝不实际删除）：**

```
🗑️  准备删除
  ID: 9595df9d8bfc4a709dcd8a09d576146a
  标题: 帮我生成一张小红书风格的美女写真
  状态: Completed

⚠️  预览模式，未实际删除。
  📄 会话记录: 1 条
  🧠 Brain 产物: 3.2 MB

  加 --force 确认删除，加 --db-only 仅删除数据库记录，加 --brain-only 仅删除产物
```

**性能**：所有命令 **150ms 内完成**，体感秒出。

## 二、快速安装

只需要 Node.js ≥ 18，三步搞定：

```bash
git clone https://github.com/starsss0416/workbuddy-manager.git
cd workbuddy-manager
npm install
```

### 作为 WorkBuddy Skill 使用（推荐）

将工具安装为 Skill 后，**不需要记任何命令**，直接用自然语言对话即可：

```powershell
Copy-Item -Recurse . ~/.workbuddy/skills/workbuddy-manager
```

安装完成后，你可以直接这样跟 WorkBuddy 说：

| 你说的                       | WorkBuddy 做的                            |
| ---------------------------- | ----------------------------------------- |
| "查看我的会话历史"           | 调用 `sessions list`，列出所有会话        |
| "搜索关于 HTML5 的会话"      | 调用 `sessions search HTML5`              |
| "删除那个美女写真相关的会话" | 模糊匹配会话 → 预览 → 确认删除            |
| "WorkBuddy 占了多少空间"     | 调用 `resources overview`，展示各目录占用 |
| "帮我清理一下缓存"           | 展示将删除的内容 → 确认后执行             |
| "查看我的自动化任务"         | 调用 `automations list`                   |
| "给 WorkBuddy 做个体检"      | 依次执行四类检查，生成完整状态报告        |

> Skill 会自动识别意图、选择对应模块、执行命令，你只需要说人话。

### 命令行使用

如果你想更精细地控制，也可以直接在终端使用：

```bash
# 查看会话
node scripts/sessions.mjs list

# 查看资源占用
node scripts/resources.mjs overview

# 搜索会话
node scripts/sessions.mjs search "HTML5"

# 删除会话（预览 → 确认）
node scripts/sessions.mjs delete ffec10aa
node scripts/sessions.mjs delete ffec10aa --force
```

> **会话 ID 支持缩写**：只需输入前几位即可匹配完整 UUID（如 `ffec10aa` 即可匹配 `ffec10aa68cf4a709dcd8a09d576146a`）。

源码仅 **~42 KB**，`node_modules`（sql.js WASM）约 **18 MB**。路径通过 `%APPDATA%` 动态获取，无需改代码，拷贝到其他机器 `npm install` 就能用。

**开源地址：**
- GitHub: [starsss0416/workbuddy-manager](https://github.com/starsss0416/workbuddy-manager)
- Gitee: [starroom/workbuddy-manager](https://gitee.com/starroom/workbuddy-manager)

---

> 以上是工具的完整功能介绍和安装方式。如果你对实现细节感兴趣，下面是技术原理部分。

## 三、数据结构逆向

WorkBuddy 的会话数据存在一个 `.vscdb` 文件里。如果你用过 VS Code，对这个后缀不会陌生——它是 **SQLite 数据库**，只不过换了扩展名。

路径：`%APPDATA%/WorkBuddy/codebuddy-sessions.vscdb`

用任意 SQLite 工具打开它，结构很简单：

| 字段    | 类型 | 说明                           |
| ------- | ---- | ------------------------------ |
| `key`   | TEXT | 会话 ID，格式 `session:<uuid>` |
| `value` | BLOB | 会话数据，JSON 序列化          |

一条 `value` 解析后大概长这样：

```json
{
  "conversationId": "416b8f6bff5448e0ad3148288f211360",
  "title": "帮我创建一个文件夹",
  "status": "Working",
  "cwd": "e:/Desktop/WBSpace",
  "createdAt": 1743445680000,
  "updatedAt": 1743445728000
}
```

还有一个 **Brain 目录**，存储每次会话的产物（HTML、文档、图片等）：

```
%APPDATA%/WorkBuddy/User/globalStorage/tencent-cloud.coding-copilot/brain/
├── 416b8f6bff5448e0ad3148288f211360/
│   ├── index.html
│   └── report.md
└── ffec10aa68cf4a709dcd8a09d576146a/
    └── output.png
```

**核心发现：会话元数据在 SQLite 里，产物文件在 brain 目录里，两者通过会话 ID 关联。**

## 四、技术选型

需求很明确：读 SQLite + 操作文件系统。

**方案对比：**

| 方案                 | 优点                   | 缺点                   |
| -------------------- | ---------------------- | ---------------------- |
| Python + sqlite3     | 标准库自带             | 需要额外装 Python 环境 |
| Go + go-sqlite3      | 单文件编译             | 编译配置麻烦           |
| **Node.js + sql.js** | 纯 JS/WASM，零原生依赖 | WASM 体积略大（~18MB） |

考虑到 WorkBuddy 自身就是基于 Electron（Node.js）的，选 Node.js 是最自然的选择。**sql.js** 是 SQLite 编译成 WebAssembly 的版本，`npm install` 一键搞定，不需要编译任何原生模块。

## 五、核心实现

### 1. 读取 vscdb 数据库

```javascript
// _utils.mjs
import fs from 'fs';
import path from 'path';

const APP_DATA = process.env.APPDATA;
const WB_ROOT = path.join(APP_DATA, 'WorkBuddy');
const SESSIONS_DB = path.join(WB_ROOT, 'codebuddy-sessions.vscdb');

// sql.js 模块缓存（避免重复初始化 WASM）
let _sqlModule = null;
export async function getSqlModule() {
  if (!_sqlModule) {
    const m = await import('sql.js');
    _sqlModule = await m.default();
  }
  return _sqlModule;
}

export async function parseSessionsFromDB() {
  const SQL = await getSqlModule();
  const buf = fs.readFileSync(SESSIONS_DB);
  const db = new SQL.Database(buf);   // 直接从 Buffer 创建
  let sessions = [];
  try {
    const result = db.exec(
      "SELECT key, value FROM ItemTable WHERE key LIKE 'session:%'"
    );
    for (const row of result[0].values) {
      // value 可能是 BLOB (Uint8Array)，需要 TextDecoder 转换
      const val = typeof row[1] === 'string'
        ? row[1]
        : new TextDecoder().decode(row[1]);
      const obj = JSON.parse(val);
      if (obj.conversationId) sessions.push(obj);
    }
  } finally {
    db.close();
  }
  return sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
```

**几个坑：**

- `value` 字段虽然存的是 JSON，但类型是 **BLOB（Uint8Array）**，不能直接 `JSON.parse`，需要 `TextDecoder` 转换
- sql.js 初始化 WASM 大约需要 **80-100ms**，所以加了个模块缓存 `_sqlModule`
- 数据库操作用完一定要 `db.close()`，否则会内存泄漏

### 2. 删除会话（同时清理数据库 + 产物）

这是最核心的功能——一键删除某个会话的**所有痕迹**：

```javascript
async function cmdDelete(id, force) {
  const s = await findSession(id);
  
  // 预览模式：不加 --force 只展示信息
  if (!force) {
    const bp = path.join(BRAIN_DIR, s.conversationId);
    const hasBrain = fs.existsSync(bp);
    console.log('⚠️  预览模式，未实际删除。');
    console.log(`  📄 会话记录: 1 条`);
    console.log(`  🧠 Brain 产物: ${hasBrain ? fmtSize(dirSize(bp).size) : '无'}`);
    return;
  }

  // 删除数据库记录
  if (!brainOnly) {
    const SQL = await getSqlModule();
    const buf = fs.readFileSync(SESSIONS_DB);
    const db = new SQL.Database(buf);
    db.run("DELETE FROM ItemTable WHERE key = ?", [`session:${s.conversationId}`]);
    const data = db.export();
    fs.writeFileSync(SESSIONS_DB, Buffer.from(data));
    db.close();
  }

  // 删除 Brain 产物
  if (!dbOnly) {
    const bp = path.join(BRAIN_DIR, s.conversationId);
    if (fs.existsSync(bp)) {
      fs.rmSync(bp, { recursive: true, force: true });
    }
  }
}
```

**关键设计：**

- **预览优先**：不加 `--force` 绝不实际删除，让用户先看到影响范围
- **细粒度控制**：`--db-only` 只删数据库、`--brain-only` 只删产物，按需选择
- **原子写回**：先 `db.export()` 再 `writeFileSync`，保证数据库文件完整

### 3. 会话 ID 模糊匹配

谁会记住 32 位 UUID？支持输入前几位自动匹配：

```javascript
export async function findSession(idOrPartial) {
  const sessions = await parseSessionsFromDB();
  
  // 精确匹配
  let f = sessions.find(s => s.conversationId === idOrPartial);
  if (f) return f;
  
  // 前缀匹配
  const matches = sessions.filter(s => s.conversationId.startsWith(idOrPartial));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return { ambiguous: true, matches }; // 歧义，要求用户确认
  
  return null;
}
```

输入 `ffec10aa` 就能匹配 `ffec10aa68cf4a709dcd8a09d576146a`，体验丝滑。

## 六、踩坑总结

1. **vscdb 就是 SQLite**，但 `value` 字段是 BLOB 类型，不是 TEXT。`TextDecoder` 是关键。
2. **sql.js 需要 WASM 文件**，`npm install` 会自动下载对应平台的，不需要手动处理。
3. **数据库写回必须用 `db.export()`**，不能直接操作文件，否则会损坏。
4. **路径要用 `%APPDATA%` 动态获取**，不要硬编码，这样迁移到其他机器才不需要改代码。
5. **删除操作一定要预览模式**，误删数据库记录是不可逆的。

---

**当工具不好用时，就自己造一个。** 400 行代码解决的问题，比等官方更新快多了。

如果这篇文章对你有启发，欢迎点赞收藏。有什么问题可以在评论区讨论 👋
