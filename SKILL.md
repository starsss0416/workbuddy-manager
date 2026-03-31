---
name: workbuddy-manager
description: WorkBuddy 任务/工作空间/会话管理工具。当用户需要查看会话历史、管理工作空间、管理自动化任务、清理缓存、检查工作空间状态，或对 WorkBuddy 自身进行运维管理时触发。关键词：会话管理、工作空间、automation、自动任务、清理缓存、brain、sessions。
---

# WorkBuddy Manager

## Overview

管理 WorkBuddy 的会话、工作空间、自动化任务和系统资源的统一工具。

## 触发条件

当用户提到以下场景时自动触发：
- 查看/管理会话历史（"查看会话"、"历史记录"、"删除会话"）
- 查看工作空间列表或状态（"工作空间"、"workspace"）
- 查看/创建/修改自动化任务（"自动任务"、"automation"、"定时任务"）
- 清理缓存或临时文件（"清理"、"缓存"、"占用空间"）
- 查看 brain/artifact 目录
- WorkBuddy 运行状态检查（"状态"、"概览"、"健康检查"）
- 模糊指令（"管理我的 WorkBuddy"、"查看任务列表"）

## 前置依赖

**Node.js ≥ 18**（必需）。首次使用前，执行以下命令确认环境：

```bash
node -v
```

- 若输出版本号 ≥ 18，环境正常，继续执行命令。
- 若提示 `node: command not found` 或版本低于 18，告知用户：
  > ⚠️ 本工具需要 Node.js ≥ 18。请前往 https://nodejs.org 下载安装 LTS 版本。

**不需要 `npm install`**：`node_modules` 已随 Skill 一起打包，解压即用。

## 脚本位置

所有脚本位于当前目录下的 `scripts/` 文件夹，使用 **ESM** 模块（`.mjs`），依赖 **sql.js**（WASM SQLite）读取 vscdb 数据库。

**运行前确认脚本路径**：如果 `scripts/` 在当前工作目录下不存在，尝试 `~/.workbuddy/skills/workbuddy-manager/scripts/`。

```
scripts/
├── _utils.mjs          # 共享工具（路径常量、格式化、SQLite 操作、Brain 扫描）
├── sessions.mjs        # 会话管理（list / search / delete / backup / restore / migrate）
├── workspaces.mjs      # 工作空间管理（list / info / memory）
├── automations.mjs     # 自动化任务（list / info）
└── resources.mjs       # 系统资源（overview / clean-cache / clean-logs / clean-brain）
```

## 核心能力

### 1. 会话管理 (Sessions)

会话数据存储在 SQLite 数据库 `codebuddy-sessions.vscdb` 中（表 `ItemTable`，key 格式 `session:<uuid>`）。
Brain 产物（artifact）存储在 `brain/` 目录下，以会话 ID 命名。

```bash
# 查看所有会话
node scripts/sessions.mjs list

# 仅查看最近 N 条
node scripts/sessions.mjs list --recent 10

# 按关键词搜索（匹配标题、工作空间路径、ID）
node scripts/sessions.mjs search <keyword>

# 预览删除（不实际删除，显示将要删除的内容）
node scripts/sessions.mjs delete <session-id>

# 删除会话记录 + Brain 产物
node scripts/sessions.mjs delete <session-id> --force

# 仅删除数据库记录（保留 Brain 产物）
node scripts/sessions.mjs delete <session-id> --force --db-only

# 仅删除 Brain 产物（保留数据库记录）
node scripts/sessions.mjs delete <session-id> --force --brain-only

# 备份单个/全部会话（元数据 + Brain 产物）
node scripts/sessions.mjs backup <session-id>
node scripts/sessions.mjs backup all
node scripts/sessions.mjs backup all --output <dir>

# 从备份恢复（不覆盖已存在的文件）
node scripts/sessions.mjs restore <backup-path>

# 迁移 Brain 产物（复制模式，不删源）
node scripts/sessions.mjs migrate <source-dir> <target-dir>
```

**会话 ID 支持缩写**：只需输入前几位即可匹配完整 UUID。

### 2. 工作空间管理 (Workspaces)

工作空间存储在 `%APPDATA%/WorkBuddy/User/workspaceStorage/`，用户本地工作空间由用户自行管理。

工作空间关键结构：
```
<workspace>/.workbuddy/
├── memory/           # 工作记忆
│   ├── MEMORY.md     # 长期记忆
│   └── YYYY-MM-DD.md # 每日记录
├── skills/           # 项目级技能
└── teams/            # 团队协作数据
```

```bash
# 列出所有工作空间
node scripts/workspaces.mjs list

# 查看工作空间详情
node scripts/workspaces.mjs info <workspace-path>

# 查看 memory 使用情况
node scripts/workspaces.mjs memory <workspace-path>
```

### 3. 自动化任务管理 (Automations)

自动化任务以 TOML 配置存储在 `~/.workbuddy/automations/<id>/automation.toml`。

```bash
# 列出所有自动化任务（显示名称、状态、调度规则、Prompt 预览）
node scripts/automations.mjs list

# 查看某个任务的完整配置（含 TOML 文件路径）
node scripts/automations.mjs info <automation-id>
```

### 4. 系统资源管理 (Resources)

```bash
# 查看资源占用概览（cache / logs / crash / brain / gpu / network 等）
node scripts/resources.mjs overview

# 清理缓存（删除 Cache 目录全部内容）
node scripts/resources.mjs clean-cache

# 清理旧日志（默认保留 7 天）
node scripts/resources.mjs clean-logs
node scripts/resources.mjs clean-logs 30

# 清理旧 Brain 产物（默认保留 30 天）
node scripts/resources.mjs clean-brain --keep-days 30
```

## 决策树

```
用户请求 → 判断操作类型：
  "查看会话" / "历史记录" / "删除会话"  → 会话管理
  "工作空间" / "workspace"             → 工作空间管理
  "自动任务" / "automation" / "定时"    → 自动化任务管理
  "清理" / "缓存" / "占用空间"          → 系统资源管理
  "状态" / "概览" / "健康检查"          → 全局状态报告（依次执行上述四类）
```

## 全局状态报告

当用户要求"状态检查"或"概览"时，依次执行：

1. `sessions.mjs list` — 会话统计
2. `workspaces.mjs list` — 工作空间统计
3. `automations.mjs list` — 自动化任务统计
4. `resources.mjs overview` — 资源占用

将四个命令的输出整合为一份 Markdown 报告呈现给用户。

## ⚠️ 安全规则

1. **只读优先** — 所有查询操作默认只读，不修改任何数据
2. **删除需 --force** — `delete` 不加 `--force` 仅预览，不实际执行
3. **先备份再删除** — 删除前应先执行 `backup`，备份存放在默认备份目录
4. **恢复不覆盖** — `restore` 遇到已存在的目标会跳过
5. **迁移不删源** — `migrate` 采用复制模式
6. **清理需确认** — 清理类操作（clean-*）必须先展示将删除的内容，获取用户明确确认后再执行
