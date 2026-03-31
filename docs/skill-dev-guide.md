---
title: 从零开发一个 WorkBuddy Skill——手把手教你给 AI 助手装上「超能力」
tags: [WorkBuddy, AI编程助手, Skill开发, Node.js, 技能扩展]
category: 前端
date: 2026-04-01
description: WorkBuddy 支持通过 Skill 机制扩展 AI 能力。本文以 workbuddy-manager 为例，从零讲解 Skill 的完整开发流程：需求分析、SKILL.md 编写、脚本开发、打包分发、上架技能商店。看完你也能给自己的 AI 助手写插件。
---

# 从零开发一个 WorkBuddy Skill——手把手教你给 AI 助手装上「超能力」

## 前言

你用过 WorkBuddy（腾讯小龙虾）吗？它是个 AI 编程助手，日常写代码、查 Bug、生成文档，基本离不开。

但有个问题：**它能做的事情是固定的。** 想让它自动管理会话？清理缓存？查看自动化任务？对不起，原生不支持。

直到我发现了 **Skill 机制**。

Skill 就是 WorkBuddy 的插件系统——你写一份配置文件 + 一堆脚本，AI 就能根据用户自然语言自动调用。整个过程不需要改 WorkBuddy 任何代码，纯扩展。

我用这个机制做了一个 **workbuddy-manager**，让 AI 能直接管理 WorkBuddy 自己。这篇文章把整个开发流程拆给你看。

## 一、Skill 是什么？

简单说，Skill 由三部分组成：

| 组成 | 作用 | 必需 |
|------|------|------|
| **SKILL.md** | 告诉 AI 什么时候触发、怎么调用你的脚本 | ✅ |
| **scripts/** | 你的业务逻辑脚本 | ✅ 至少一个 |
| **references/** | 参考文档（路径、格式说明等） | ❌ 可选 |

AI 加载 Skill 后，会读取 SKILL.md 中的指令，当用户对话命中触发条件时，自动调用对应脚本并返回结果。

**核心优势：用户不需要记命令。** 他们只需要说人话，Skill 自动匹配意图 → 选择脚本 → 执行。

## 二、开发流程总览

```
需求分析 → 目录规划 → 编写脚本 → 编写 SKILL.md → 测试调试 → 打包发布
```

接下来按这个顺序，一步步讲。

## 三、第一步：需求分析

在写代码之前，先想清楚三个问题：

### 3.1 解决什么问题？

我的痛点：WorkBuddy 用久了会话堆积、缓存膨胀，想清理某个旧会话？UI 里没有删除按钮。

所以我需要：
- 查看会话列表
- 搜索/删除会话
- 查看磁盘占用
- 清理缓存和日志

### 3.2 数据从哪来？

WorkBuddy 的会话存在一个 SQLite 数据库里：
- 路径：`%APPDATA%/WorkBuddy/codebuddy-sessions.vscdb`
- 格式：vscdb 就是换了扩展名的 SQLite

知道了数据源，就知道用什么技术栈去操作它。

### 3.3 用户怎么触发？

用户不会去记命令，他们只会说：
- "帮我看看会话历史"
- "WorkBuddy 占了多大空间"
- "清理一下缓存"

所以 Skill 的触发条件要覆盖这些自然语言表达。

## 四、第二步：目录规划

需求明确后，规划目录结构：

```
workbuddy-manager/
├── SKILL.md                # Skill 定义（AI 指令文件）
├── scripts/
│   ├── _utils.mjs          # 共享工具（路径常量、SQLite 操作、格式化函数）
│   ├── sessions.mjs        # 会话管理
│   ├── workspaces.mjs      # 工作空间管理
│   ├── automations.mjs     # 自动化任务管理
│   └── resources.mjs       # 系统资源管理
├── references/
│   ├── paths.md            # 路径参考文档
│   └── status-report.md    # 状态报告格式参考
├── package.json            # 依赖管理（sql.js）
└── README.md               # 项目文档
```

**设计原则：**
- 一个模块一个文件，职责单一
- 共享逻辑抽到 `_utils.mjs`，避免重复
- `references/` 放参考信息，AI 需要时读取

## 五、第三步：编写脚本

### 5.1 技术选型

| 方案 | 优点 | 缺点 |
|------|------|------|
| Python + sqlite3 | 标准库自带 | 需要额外装 Python |
| Go + go-sqlite3 | 单文件编译 | 编译配置麻烦 |
| **Node.js + sql.js** | 纯 WASM，零原生依赖 | WASM 体积略大 |

选 Node.js，因为 WorkBuddy 本身基于 Electron（Node.js），用户大概率已经有环境。

### 5.2 核心代码：读取数据库

`_utils.mjs` 是所有脚本的共享基础：

```javascript
import fs from 'fs';
import path from 'path';

// 路径常量
export const APP_DATA = process.env.APPDATA || path.join(process.env.HOME, 'AppData', 'Roaming');
export const WB_ROOT = path.join(APP_DATA, 'WorkBuddy');
export const SESSIONS_DB = path.join(WB_ROOT, 'codebuddy-sessions.vscdb');
export const BRAIN_DIR = path.join(WB_ROOT, 'User', 'globalStorage', 'tencent-cloud.coding-copilot', 'brain');

// sql.js 模块缓存（避免重复初始化 WASM）
let _sqlModule = null;
export async function getSqlModule() {
  if (!_sqlModule) {
    const m = await import('sql.js');
    _sqlModule = await m.default();
  }
  return _sqlModule;
}

// 解析所有会话
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
        const val = typeof row[1] === 'string' ? row[1] : new TextDecoder().decode(row[1]);
        const obj = JSON.parse(val);
        if (obj.conversationId) sessions.push(obj);
      }
    }
  } finally {
    db.close();
  }
  return sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
```

**几个关键点：**
- `value` 字段是 BLOB 类型（Uint8Array），需要 `TextDecoder` 转字符串再 `JSON.parse`
- sql.js 初始化 WASM 约 80ms，用模块缓存避免重复加载
- `db.close()` 必须调用，否则内存泄漏

### 5.3 命令行入口模式

每个脚本都遵循同样的入口模式：

```javascript
// sessions.mjs
import { parseSessionsFromDB, findSession } from './_utils.mjs';

const [,, cmd, ...args] = process.argv;

switch (cmd) {
  case 'list':
    await cmdList(args);
    break;
  case 'search':
    await cmdSearch(args[0]);
    break;
  case 'delete':
    await cmdDelete(args[0], args);
    break;
  // ...
  default:
    console.log('用法: node sessions.mjs <list|search|delete|backup|restore|migrate>');
}
```

**设计要点：**
- `process.argv` 解析命令和参数
- 每个命令一个独立函数，职责清晰
- `--force` 等标志通过 `args.includes()` 判断

### 5.4 安全设计：预览模式

所有危险操作都支持预览：

```javascript
async function cmdDelete(id, args) {
  const force = args.includes('--force');
  const session = await findSession(id);
  
  if (!force) {
    // 预览模式：只展示信息，不实际删除
    console.log(`⚠️  预览模式，未实际删除。`);
    console.log(`  📄 会话记录: 1 条`);
    console.log(`  🧠 Brain 产物: ${hasBrain ? fmtSize(size) : '无'}`);
    return;
  }
  
  // 实际删除...
}
```

**原则：不加 `--force` 绝不修改数据。** 这是给 AI 用的工具，安全第一。

### 5.5 会话 ID 模糊匹配

没人会记 32 位 UUID，支持前几位匹配：

```javascript
export async function findSession(idOrPartial) {
  const sessions = await parseSessionsFromDB();
  let f = sessions.find(s => s.conversationId === idOrPartial);
  if (f) return f;
  
  const matches = sessions.filter(s => s.conversationId.startsWith(idOrPartial));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) return { ambiguous: true, matches };
  return null;
}
```

输入 `ffec10aa` 就能匹配完整 UUID，体验丝滑。

## 六、第四步：编写 SKILL.md（最关键的一步）

SKILL.md 是 Skill 的灵魂。它不是给人看的文档，而是**写给 AI 的指令文件**。

### 6.1 YAML 头（必需）

```yaml
---
name: workbuddy-manager
description: WorkBuddy 任务/工作空间/会话管理工具。当用户需要查看会话历史、管理工作空间、管理自动化任务、清理缓存、检查工作空间状态时触发。
---
```

- `name`：Skill 的唯一标识
- `description`：告诉 AI 这个 Skill 是干什么的、什么时候触发

**description 非常重要！** AI 通过它判断用户意图是否匹配。写得越精准，触发越准确。

### 6.2 触发条件

```markdown
## 触发条件

当用户提到以下场景时自动触发：
- 查看/管理会话历史（"查看会话"、"历史记录"、"删除会话"）
- 查看工作空间列表或状态（"工作空间"、"workspace"）
- 查看/创建/修改自动化任务（"自动任务"、"automation"、"定时任务"）
- 清理缓存或临时文件（"清理"、"缓存"、"占用空间"）
- WorkBuddy 运行状态检查（"状态"、"概览"、"健康检查"）
```

**技巧：列出用户可能说的各种说法**，包括中英文、同义词、模糊表达。

### 6.3 决策树

```markdown
## 决策树

用户请求 → 判断操作类型：
  "查看会话" / "历史记录" / "删除会话"  → 会话管理
  "工作空间" / "workspace"             → 工作空间管理
  "自动任务" / "automation" / "定时"    → 自动化任务管理
  "清理" / "缓存" / "占用空间"          → 系统资源管理
  "状态" / "概览" / "健康检查"          → 全局状态报告
```

这是给 AI 的路由表。用户说了什么 → 调用哪个脚本。

### 6.4 安全规则

```markdown
## ⚠️ 安全规则

1. **只读优先** — 所有查询操作默认只读，不修改任何数据
2. **删除需 --force** — `delete` 不加 `--force` 仅预览，不实际执行
3. **清理需确认** — 清理类操作必须先展示将删除的内容，获取用户明确确认后再执行
```

**必须明确告诉 AI 什么是安全的、什么需要确认。** 否则 AI 可能不经询问就删除数据。

## 七、第五步：测试调试

### 7.1 本地测试

把 Skill 安装到本地，直接用自然语言测试：

```powershell
Copy-Item -Recurse . ~/.workbuddy/skills/workbuddy-manager
```

然后在 WorkBuddy 中测试各种说法：

| 测试用例 | 期望行为 |
|----------|----------|
| "查看会话" | 触发 Skill，调用 `sessions list` |
| "帮我搜一下 HTML5" | 触发 Skill，调用 `sessions search HTML5` |
| "删除那个会话" | 不触发（ID 不明确） |
| "删除 ffec10aa" | 触发，预览模式展示信息 |
| "清理缓存" | 触发，展示将删除内容并等待确认 |

### 7.2 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| Skill 没触发 | description 不匹配 | 在 description 中补充关键词 |
| 脚本报错找不到模块 | node_modules 未打包 | 确保打包时包含 node_modules |
| 路径不对 | 脚本路径查找失败 | SKILL.md 中写明路径回退策略 |

## 八、第六步：打包发布

### 8.1 目录要求

发布 Skill 时，文件必须包含：

```
workbuddy-manager/
├── SKILL.md             # ✅ 必需（含 YAML 头）
├── scripts/             # ✅ 业务脚本
├── references/          # ❌ 可选
└── node_modules/        # ✅ 如有依赖需打包
```

**SKILL.md 的 YAML 头是必须的**，没有它技能商店无法识别。

### 8.2 打包脚本

```powershell
# 复制必要文件到 dist 目录
$dst = "dist/workbuddy-manager"
Copy-Item SKILL.md $dst/
Copy-Item scripts/ $dst/scripts/ -Recurse
Copy-Item node_modules/ $dst/node_modules/ -Recurse
Copy-Item package.json $dst/

# 打成 zip
Compress-Archive -Path $dst -DestinationPath workbuddy-manager.zip -Force
```

### 8.3 上架技能商店

1. 打开 WorkBuddy 技能商店
2. 点击「发布技能」
3. 上传 zip 文件
4. 填写名称、描述、分类
5. 提交审核

## 九、踩坑总结

### 写 SKILL.md 的坑

1. **description 决定触发率** — 太窄了匹配不到，太宽了误触发。要在精准和覆盖之间找平衡
2. **触发条件要用用户语言** — 别写技术术语，写用户实际会说的话
3. **安全规则不能省** — AI 不懂"危险"，你必须明确告诉它什么需要确认

### 写脚本的坑

4. **WASM 初始化有延迟** — sql.js 第一次加载约 80ms，用模块缓存
5. **BLOB 不是字符串** — vscdb 的 value 字段是 Uint8Array，必须 TextDecoder
6. **路径要用环境变量** — 不要硬编码路径，用 `%APPDATA%` 动态获取

### 打包发布的坑

7. **node_modules 必须打包** — 用户不应该被要求 `npm install`
8. **zip 里必须有 SKILL.md** — 没有 YAML 头技能商店不认
9. **不要打包 .git 目录** — 纯浪费空间

## 十、成果展示

最终成品：

| 指标 | 数据 |
|------|------|
| 源码量 | ~600 行（5 个脚本） |
| 命令数 | 14 个 |
| 响应速度 | 150ms 内 |
| 打包体积 | 4.2 MB（含 node_modules） |
| 开发周期 | 2 天 |

覆盖 4 大模块：会话管理、工作空间管理、自动化任务、系统资源管理。

**开源地址：**
- GitHub: [starsss0416/workbuddy-manager](https://github.com/starsss0416/workbuddy-manager)
- Gitee: [starroom/workbuddy-manager](https://gitee.com/starroom/workbuddy-manager)

---

**Skill 的本质是：你教 AI 怎么做，AI 帮用户做。** 写一份 SKILL.md，就是给 AI 写一份 SOP。写得越好，AI 表现越聪明。

如果这篇文章对你有帮助，欢迎点赞收藏。有问题评论区聊 👋
