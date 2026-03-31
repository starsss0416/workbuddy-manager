# WorkBuddy 路径参考

## Windows 默认路径

| 资源 | 路径 | 说明 |
|------|------|------|
| WorkBuddy 根目录 | `%APPDATA%/WorkBuddy/` | 所有数据存储根目录 |
| 会话数据库 | `%APPDATA%/WorkBuddy/codebuddy-sessions.vscdb` | vscdb 格式的会话存储 |
| Brain/Artifacts | `%APPDATA%/WorkBuddy/User/globalStorage/tencent-cloud.coding-copilot/brain/` | 每个会话一个子目录 |
| Workspace Storage | `%APPDATA%/WorkBuddy/User/workspaceStorage/` | VSCode 工作空间注册信息 |
| 自动化任务 DB | `%APPDATA%/WorkBuddy/automations/automations.db` | SQLite 数据库 |
| 自动化任务配置 | `~/.workbuddy/automations/<id>/automation.toml` | TOML 配置文件 |
| 缓存 | `%APPDATA%/WorkBuddy/Cache/` | HTTP/资源缓存 |
| 日志 | `%APPDATA%/WorkBuddy/logs/` | 运行日志 (.log) |
| 崩溃报告 | `%APPDATA%/WorkBuddy/CrashReport/` | 崩溃转储 |
| GPU 缓存 | `%APPDATA%/WorkBuddy/GPUCache/` | GPU 渲染缓存 |
| Blob 存储 | `%APPDATA%/WorkBuddy/blob_storage/` | 二进制大对象存储 |
| 全局设置 | `%APPDATA%/WorkBuddy/User/settings.json` | 用户设置 |
| 全局身份 | `~/.workbuddy/` | IDENTITY.md, SOUL.md, USER.md |
| 用户技能 | `~/.workbuddy/skills/` | 全局安装的技能 |
| 项目技能 | `<workspace>/.workbuddy/skills/` | 项目级技能 |

## 工作空间内 .workbuddy 结构

```
<workspace>/.workbuddy/
├── memory/
│   ├── MEMORY.md           # 长期记忆（持续更新）
│   └── YYYY-MM-DD.md       # 每日日志（追加式）
├── skills/                 # 项目级技能
│   └── <skill-name>/
│       └── SKILL.md
└── teams/                  # 团队协作数据
```

## Brain 会话目录结构

```
brain/
└── <conversation-id>/      # 每个会话一个目录 (UUID)
    ├── metadata.json       # 会话元信息
    ├── *.md                # 产物文档
    ├── *.html              # 生成的前端页面
    └── *.json              # 其他数据
```

## Automation TOML 结构

```toml
name = "任务名称"
prompt = "任务描述"
status = "ACTIVE"          # ACTIVE 或 PAUSED
scheduleType = "recurring" # recurring 或 once
rrule = "FREQ=HOURLY;INTERVAL=1"
# scheduledAt = "2026-03-20T14:30"  # 一次性任务用
cwds = '["e:/Desktop/WBSpace"]'
# validFrom = "2026-03-18"
# validUntil = "2026-03-22"
# maxDurationMinutes = 30
```
