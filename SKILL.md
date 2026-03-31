---
name: workbuddy-manager
description: WorkBuddy 任务/工作空间/会话管理工具。当用户需要查看会话历史、管理工作空间、管理自动化任务、清理缓存、检查工作空间状态，或对 WorkBuddy 自身进行运维管理时触发。关键词：会话管理、工作空间、automation、自动任务、清理缓存、brain、sessions。
---

# WorkBuddy Manager

## Overview

管理 WorkBuddy 的会话、工作空间、自动化任务和系统资源的统一工具。让用户对 WorkBuddy 的运行状态一目了然，并支持日常运维操作。

## 触发条件

当用户提到以下场景时自动触发：
- 查看/管理会话历史
- 查看工作空间列表或状态
- 查看/创建/修改自动化任务 (automation)
- 清理缓存或临时文件
- 查看 brain/artifact 目录
- WorkBuddy 运行状态检查
- "管理我的 WorkBuddy"、"查看任务列表" 等模糊指令

## 核心能力

### 1. 会话管理 (Sessions)

查看和管理 WorkBuddy 的会话记录。

会话数据库位置：
- **SQLite DB**: `%APPDATA%/WorkBuddy/codebuddy-sessions.vscdb`

操作方式：
```
# 查看所有会话
node scripts/sessions.mjs list

# 查看最近 N 条会话
node scripts/sessions.mjs list --recent 10

# 按关键词搜索会话
node scripts/sessions.mjs search <keyword>

# 删除会话（⚠️ 需要 --force 确认）
node scripts/sessions.mjs delete <session-id> [--force]

# 备份单个会话
node scripts/sessions.mjs backup <session-id>

# 备份所有会话
node scripts/sessions.mjs backup all

# 备份到指定目录
node scripts/sessions.mjs backup all --output <dir>

# 从备份恢复会话
node scripts/sessions.mjs restore <backup-path>

# 迁移会话到新目录
node scripts/sessions.mjs migrate <source-brain-dir> <target-brain-dir>
```

### 2. 工作空间管理 (Workspaces)

查看和管理 WorkBuddy 工作空间。

工作空间存储位置：
- **Workspace Storage**: `%APPDATA%/WorkBuddy/User/workspaceStorage/`
- **本地工作空间**: 由用户自行管理（如 `e:\Desktop\WBSpace\`）
- **.workbuddy 配置**: 每个工作空间根目录下的 `.workbuddy/` 文件夹

工作空间内关键结构：
```
<workspace>/.workbuddy/
├── memory/           # 工作记忆文件
│   ├── MEMORY.md     # 长期记忆
│   └── YYYY-MM-DD.md # 每日记录
├── skills/           # 项目级技能
└── teams/            # 团队协作数据
```

操作方式：
```
# 列出所有工作空间
node scripts/workspaces.mjs list

# 查看工作空间详情
node scripts/workspaces.mjs info <workspace-path>

# 查看工作空间的 memory 使用情况
node scripts/workspaces.mjs memory <workspace-path>
```

### 3. 自动化任务管理 (Automations)

查看和管理 WorkBuddy 自动化任务。

存储位置：
- **DB**: `%APPDATA%/WorkBuddy/automations/automations.db`
- **TOML 配置**: `~/.workbuddy/automations/<automation-id>/automation.toml`

操作方式：
```
# 列出所有自动化任务
node scripts/automations.mjs list

# 查看某个任务的详情
node scripts/automations.mjs info <automation-id>
```

### 4. 系统资源管理 (Resources)

监控和清理 WorkBuddy 的系统资源占用。

关键路径：
| 资源 | 路径 | 说明 |
|------|------|------|
| 缓存 | `%APPDATA%/WorkBuddy/Cache/` | HTTP/资源缓存 |
| 日志 | `%APPDATA%/WorkBuddy/logs/` | 运行日志 |
| Crash Reports | `%APPDATA%/WorkBuddy/CrashReport/` | 崩溃报告 |
| Blob Storage | `%APPDATA%/WorkBuddy/blob_storage/` | 二进制存储 |
| Brain/Artifacts | `%APPDATA%/WorkBuddy/User/globalStorage/tencent-cloud.coding-copilot/brain/` | 会话产物 |

操作方式：
```
# 查看资源占用概览
node scripts/resources.mjs overview

# 清理缓存（仅清理 Cache 目录）
node scripts/resources.mjs clean-cache

# 清理日志（保留最近 7 天）
node scripts/resources.mjs clean-logs

# 清理 brain artifacts（保留最近 30 天）
node scripts/resources.mjs clean-brain --keep-days 30
```

## 工作流

### 决策树

用户请求 → 判断操作类型：

```
"查看会话" / "历史记录" → 会话管理
"工作空间" / "workspace" → 工作空间管理
"自动任务" / "automation" / "定时任务" → 自动化任务管理
"清理" / "缓存" / "占用空间" → 系统资源管理
"状态" / "概览" / "健康检查" → 全局状态报告
```

### 全局状态报告

当用户要求"状态检查"或"概览"时，依次执行：

1. **会话统计**: 最近会话数量、最新会话时间
2. **工作空间统计**: 已注册的工作空间数量及路径
3. **自动化任务统计**: 活跃任务数、暂停任务数
4. **资源占用**: 各目录大小汇总

输出格式：
```markdown
# WorkBuddy 状态报告

## 📊 会话
- 总会话数: XX
- 最近活跃: YYYY-MM-DD HH:mm

## 📂 工作空间
- 数量: X
- 列表:
  - [path1] - 最后修改: ...
  - [path2] - 最后修改: ...

## ⏱ 自动化任务
- 活跃: X / 暂停: X
- 最近执行: ...

## 💾 资源占用
| 目录 | 大小 |
|------|------|
| Cache | XX MB |
| Logs | XX MB |
| Brain | XX MB |
| 总计 | XX MB |
```

## 注意事项

- ⚠️ **只读优先**: 所有查询操作默认只读，不修改任何数据
- ⚠️ **删除需 --force**: 删除操作必须加 `--force` 参数，否则仅显示预览
- ⚠️ **先备份再删除**: 执行删除前应先 `backup`，备份存放在 `%APPDATA%/WorkBuddy/Backups/sessions/`
- ⚠️ **恢复不覆盖**: `restore` 如果目标已存在会跳过，不会覆盖
- ⚠️ **迁移不删源**: `migrate` 采用复制模式，不会删除源目录
- ⚠️ **清理需确认**: 清理类操作必须先展示将删除的内容，获取用户明确确认后再执行
