# WorkBuddy Manager

> WorkBuddy 会话、工作空间、自动化任务与系统资源的统一管理工具。

## ✨ 特性

- 🔍 **会话管理** — 列出、搜索、删除会话记录（直接操作 vscdb 数据库）
- 📂 **工作空间管理** — 查看工作空间列表、详情和 memory 使用情况
- ⏱️ **自动化任务** — 查看定时任务的配置和状态
- 💾 **资源监控** — 查看各目录占用、清理缓存/日志/崩溃报告
- 📦 **备份恢复** — 备份和恢复会话数据
- ⚡ **快速** — 所有命令 150ms 内完成

## 📋 环境要求

- **Node.js** ≥ 18
- **操作系统** — Windows（macOS/Linux 理论可用，路径需适配）

## 🚀 安装

### 方式一：作为 WorkBuddy Skill 安装

将整个目录复制到 WorkBuddy 的 skills 目录：

```powershell
Copy-Item -Recurse ./workbuddy-manager ~/.workbuddy/skills/workbuddy-manager
cd ~/.workbuddy/skills/workbuddy-manager
npm install
```

安装后可通过自然语言调用（如"查看我的会话历史"）。

### 方式二：独立使用

```powershell
git clone <repo-url>
cd workbuddy-manager
npm install
```

## 📁 目录结构

```
workbuddy-manager/
├── scripts/
│   ├── _utils.mjs          # 共享工具函数（路径、格式化、SQLite 操作）
│   ├── sessions.mjs        # 会话管理
│   ├── workspaces.mjs      # 工作空间管理
│   ├── automations.mjs     # 自动化任务管理
│   └── resources.mjs       # 系统资源管理
├── references/
│   ├── paths.md            # WorkBuddy 路径参考文档
│   └── status-report.md    # 状态报告格式参考
├── SKILL.md                # Skill 定义文件（触发条件、工作流）
├── README.md               # 本文档
├── package.json
└── package-lock.json
```

源码仅 **~42 KB**，`node_modules`（sql.js WASM）约 **18 MB**。

## 🛠️ 使用方式

### 会话管理

```bash
# 列出所有会话
node scripts/sessions.mjs list

# 仅查看最近 5 条
node scripts/sessions.mjs list --recent 5

# 按关键词搜索
node scripts/sessions.mjs search HTML5

# 预览删除（不实际删除，仅显示将要删除的内容）
node scripts/sessions.mjs delete <session-id>

# 删除会话记录 + Brain 产物
node scripts/sessions.mjs delete <session-id> --force

# 仅删除数据库记录（保留 Brain 产物）
node scripts/sessions.mjs delete <session-id> --force --db-only

# 仅删除 Brain 产物（保留数据库记录）
node scripts/sessions.mjs delete <session-id> --force --brain-only

# 备份所有会话
node scripts/sessions.mjs backup all

# 备份单个会话到指定目录
node scripts/sessions.mjs backup <session-id> --output ./my-backup

# 从备份恢复
node scripts/sessions.mjs restore <backup-path>

# 迁移 Brain 产物到新目录
node scripts/sessions.mjs migrate <source-dir> <target-dir>
```

**会话 ID 支持缩写**：只需输入前几位即可匹配（如 `ffec10aa` 可匹配完整 UUID）。

### 工作空间管理

```bash
# 列出所有工作空间
node scripts/workspaces.mjs list

# 查看工作空间详情（大小、memory、技能等）
node scripts/workspaces.mjs info <workspace-path>

# 查看 memory 目录内容
node scripts/workspaces.mjs memory <workspace-path>
```

### 自动化任务

```bash
# 列出所有自动化任务
node scripts/automations.mjs list

# 查看某个任务的详细配置
node scripts/automations.mjs info <automation-id>
```

### 系统资源

```bash
# 查看资源占用概览
node scripts/resources.mjs overview

# 清理缓存
node scripts/resources.mjs clean-cache

# 清理旧日志（默认保留 7 天）
node scripts/resources.mjs clean-logs

# 清理指定天数前的日志
node scripts/resources.mjs clean-logs 30

# 清理旧 Brain 产物（默认保留 30 天）
node scripts/resources.mjs clean-brain --keep-days 30
```

## 📊 输出示例

### sessions list

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

### resources overview

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

## 🔧 技术实现

### 数据库

WorkBuddy 的会话存储在 **vscdb** 格式的 SQLite 数据库中：

- **路径**: `%APPDATA%/WorkBuddy/codebuddy-sessions.vscdb`
- **表名**: `ItemTable`
- **结构**: `key TEXT, value BLOB`
- **Key 格式**: `session:<uuid>`
- **Value**: JSON 字符串（可能以 BLOB 存储，需 `TextDecoder` 转换）

使用 [sql.js](https://github.com/sql-js/sql.js)（WASM 版 SQLite）读写数据库，无需安装原生依赖。

### 关键路径

| 资源 | 路径 |
|------|------|
| WorkBuddy 根目录 | `%APPDATA%/WorkBuddy/` |
| 会话数据库 | `%APPDATA%/WorkBuddy/codebuddy-sessions.vscdb` |
| Brain 产物 | `%APPDATA%/WorkBuddy/User/globalStorage/tencent-cloud.coding-copilot/brain/` |
| 自动化任务 DB | `%APPDATA%/WorkBuddy/automations/automations.db` |
| 备份默认目录 | `%APPDATA%/WorkBuddy/Backups/sessions/` |

## ⚠️ 安全设计

- **只读优先** — 所有查询操作不修改任何数据
- **删除需确认** — `delete` 不加 `--force` 仅预览，不实际执行
- **先备份再删除** — 建议删除前先 `backup`
- **恢复不覆盖** — `restore` 遇到已存在的目标会跳过
- **迁移不删源** — `migrate` 采用复制模式

## 📦 迁移到其他机器

```powershell
# 1. 仅拷贝源码（排除 node_modules，约 42 KB）
# 2. 在目标机器上：
cd workbuddy-manager
npm install

# 3. 安装为 Skill
Copy-Item -Recurse ./ ~/.workbuddy/skills/workbuddy-manager
```

> 路径通过 `%APPDATA%` 动态获取，无需修改代码。`npm install` 会自动下载对应平台的 WASM 文件。

## ⚡ 性能

| 命令 | 耗时 |
|------|------|
| `sessions list` | ~140 ms |
| `resources overview` | ~130 ms |
| `automations list` | ~80 ms |

大部分时间消耗在 sql.js WASM 初始化上（~80 ms），后续调用有模块缓存。

## 📄 License

ISC
