# 状态报告生成指南

## 报告模板

当用户请求"状态检查"、"概览"、"健康检查"时，按以下格式生成报告：

```markdown
# WorkBuddy 状态报告
> 生成时间: YYYY-MM-DD HH:mm

## 📊 会话
- 会话数据库大小: XX MB
- Brain 产物数量: XX
- Brain 占用空间: XX MB
- 最新会话: YYYY-MM-DD HH:mm

## 📂 工作空间
- 已注册工作空间数: X
- 有 .workbuddy 的: X
- 列表:
  1. `path1` — 最后修改: YYYY-MM-DD
  2. `path2` — 最后修改: YYYY-MM-DD

## ⏱ 自动化任务
- ✅ 活跃: X
- ⏸️ 暂停: X
- 列表:
  - [name1] 循环: FREQ=... — "prompt预览"
  - [name2] 一次性: YYYY-MM-DD — "prompt预览"

## 💾 资源占用
| 目录 | 大小 | 文件数 |
|------|------|--------|
| Cache | XX MB | XXX |
| Logs | XX MB | XXX |
| Brain | XX MB | XXX |
| GPU Cache | XX MB | XXX |
| Blob Storage | XX MB | XXX |
| **总计** | **XX MB** | **XXXX** |

## 💡 建议
- (根据数据给出建议，如日志过大建议清理等)
```

## 数据采集顺序

1. 运行 `node scripts/resources.mjs overview` → 获取资源占用
2. 运行 `node scripts/automations.mjs list` → 获取自动化任务
3. 运行 `node scripts/workspaces.mjs list` → 获取工作空间列表
4. 运行 `node scripts/sessions.mjs list --recent 5` → 获取最近会话
5. 汇总数据，按模板生成报告
