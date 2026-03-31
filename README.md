# WorkBuddy Manager

> WorkBuddy 会话、工作空间、自动化任务与系统资源的统一管理工具。

## ✨ 特性

- 🔍 **会话管理** — 列出、搜索、删除会话记录（直接操作 vscdb 数据库 + Brain 产物）
- 📂 **工作空间管理** — 查看工作空间列表、详情和 memory 使用情况
- ⏱️ **自动化任务** — 查看定时任务的配置和执行规则
- 💾 **资源监控** — 查看各目录占用、清理缓存/日志/崩溃报告/Brain 产物
- 📦 **备份恢复** — 备份和恢复会话元数据与 Brain 产物
- ⚡ **快速** — 所有命令 150ms 内完成

## 📋 环境要求

- **Node.js** ≥ 18
- **操作系统** — Windows（macOS/Linux 理论可用，路径需适配）

## 🚀 安装

### 方式一：技能商店一键安装（推荐）

在 WorkBuddy 中直接搜索安装，最快最省心：

1. 打开 WorkBuddy 技能商店（点击侧边栏的「技能」图标）

   <!-- 插入引导搜索的截图 -->

2. 搜索 `workbuddy-manager`，点击安装即可

安装完成后，直接用自然语言对话即可，无需记任何命令：

| 你说的 | WorkBuddy 做的 |
|--------|---------------|
| "查看我的会话历史" | 调用 `sessions list`，列出所有会话 |
| "搜索关于 HTML5 的会话" | 调用 `sessions search HTML5` |
| "删除那个美女写真相关的会话" | 模糊匹配会话 → 预览 → 确认删除 |
| "WorkBuddy 占了多少空间" | 调用 `resources overview`，展示各目录占用 |
| "帮我清理一下缓存" | 展示将删除的内容 → 确认后执行 |
| "查看我的自动化任务" | 调用 `automations list` |
| "给 WorkBuddy 做个体检" | 依次执行四类检查，生成完整状态报告 |

Skill 会自动识别意图、选择对应模块、执行命令，你只需要说人话。

> ⚠️ 前置条件：确保本机已安装 **Node.js ≥ 18**。在终端运行 `node -v` 检查版本。未安装请前往 [nodejs.org](https://nodejs.org) 下载 LTS 版本。

### 方式二：手动安装 Skill

```powershell
# 克隆仓库
git clone https://github.com/starsss0416/workbuddy-manager.git
cd workbuddy-manager

# 复制到 Skill 目录（依赖已打包，无需 npm install）
Copy-Item -Recurse . ~/.workbuddy/skills/workbuddy-manager
```

### 方式三：命令行独立使用

```powershell
git clone https://github.com/starsss0416/workbuddy-manager.git
cd workbuddy-manager
npm install
node scripts/sessions.mjs list  # 直接使用
```

## 📁 目录结构

```
workbuddy-manager/
├── scripts/
│   ├── _utils.mjs          # 共享工具函数（路径常量、格式化、SQLite 操作、Brain 扫描）
│   ├── sessions.mjs        # 会话管理
│   ├── workspaces.mjs      # 工作空间管理
│   ├── automations.mjs     # 自动化任务管理
│   └── resources.mjs       # 系统资源管理
├── references/
│   ├── paths.md            # WorkBuddy 路径参考文档
│   └── status-report.md    # 状态报告格式参考
├── SKILL.md                # Skill 定义文件（AI 触发条件与工作流）
├── README.md               # 本文档
├── .gitignore
├── package.json
└── package-lock.json
```

源码仅 **~42 KB**，`node_modules`（sql.js WASM）约 **18 MB**。

## 🛠️ 命令参考

### 会话管理

```bash
# 列出所有会话
node scripts/sessions.mjs list

# 仅查看最近 N 条
node scripts/sessions.mjs list --recent 5

# 按关键词搜索（匹配标题、工作空间路径、会话 ID）
node scripts/sessions.mjs search HTML5

# 删除会话（支持细粒度控制）
node scripts/sessions.mjs delete <session-id>              # 预览，不实际删除
node scripts/sessions.mjs delete <session-id> --force      # 同时删除 DB 记录 + Brain 产物
node scripts/sessions.mjs delete <session-id> --force --db-only    # 仅删数据库记录
node scripts/sessions.mjs delete <session-id> --force --brain-only # 仅删 Brain 产物

# 备份
node scripts/sessions.mjs backup <session-id>             # 备份单个会话
node scripts/sessions.mjs backup all                       # 备份全部会话
node scripts/sessions.mjs backup all --output ./my-backup  # 备份到指定目录

# 恢复（不覆盖已存在的文件）
node scripts/sessions.mjs restore <backup-path>

# 迁移 Brain 产物（复制模式，不删源）
node scripts/sessions.mjs migrate <source-dir> <target-dir>
```

> **会话 ID 支持缩写**：只需输入前几位即可匹配完整 UUID（如 `ffec10aa` 即可）。

### 工作空间管理

```bash
node scripts/workspaces.mjs list                     # 列出所有工作空间
node scripts/workspaces.mjs info <workspace-path>    # 查看详情
node scripts/workspaces.mjs memory <workspace-path>  # 查看 memory 内容
```

### 自动化任务

```bash
node scripts/automations.mjs list            # 列出所有任务
node scripts/automations.mjs info <task-id>  # 查看任务完整配置
```

### 系统资源

```bash
node scripts/resources.mjs overview                  # 查看资源占用
node scripts/resources.mjs clean-cache               # 清理全部缓存
node scripts/resources.mjs clean-logs [days]         # 清理旧日志（默认 7 天）
node scripts/resources.mjs clean-brain --keep-days 30  # 清理旧 Brain 产物（默认 30 天）
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

  目录                          大小         文件数
  ─────────────────────────────────────
  cache         40.7 MB      122
  logs          59.3 MB      449
  crash         146.5 MB     6
  brain         0 B          0
  ─────────────────────────────────────
  总计           248.0 MB     593
```

### sessions delete (预览模式)

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

## 🔧 技术实现

### 数据库

WorkBuddy 的会话存储在 **vscdb** 格式的 SQLite 数据库中：

| 项目 | 说明 |
|------|------|
| 路径 | `%APPDATA%/WorkBuddy/codebuddy-sessions.vscdb` |
| 表名 | `ItemTable` |
| 结构 | `key TEXT, value BLOB` |
| Key 格式 | `session:<uuid>` |
| Value | JSON 字符串（可能以 BLOB 存储，需 `TextDecoder` 转换） |

使用 [sql.js](https://github.com/sql-js/sql.js)（WASM 版 SQLite）读写数据库，无需安装原生依赖。

### 关键路径

| 资源 | 路径 |
|------|------|
| WorkBuddy 根目录 | `%APPDATA%/WorkBuddy/` |
| 会话数据库 | `%APPDATA%/WorkBuddy/codebuddy-sessions.vscdb` |
| Brain 产物 | `%APPDATA%/WorkBuddy/User/globalStorage/tencent-cloud.coding-copilot/brain/` |
| 自动化任务 | `~/.workbuddy/automations/<id>/automation.toml` |
| 备份默认目录 | `%APPDATA%/WorkBuddy/Backups/sessions/` |
| 工作空间存储 | `%APPDATA%/WorkBuddy/User/workspaceStorage/` |

## ⚠️ 安全设计

| 原则 | 说明 |
|------|------|
| **只读优先** | 所有查询操作不修改任何数据 |
| **删除需确认** | `delete` 不加 `--force` 仅预览 |
| **先备份再删除** | 建议删除前先 `backup` |
| **恢复不覆盖** | `restore` 遇到已存在的目标会跳过 |
| **迁移不删源** | `migrate` 采用复制模式 |

## 📦 迁移到其他机器

```powershell
# 1. 仅拷贝源码（排除 node_modules，约 42 KB）
# 2. 在目标机器上：
cd workbuddy-manager
npm install

# 3. 安装为 Skill
Copy-Item -Recurse . ~/.workbuddy/skills/workbuddy-manager
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
