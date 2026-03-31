# Bun 迁移可行性分析

> 编写日期：2026-04-01 | 基于 Bun v1.2.x 文档和社区反馈

## 结论：暂不建议迁移，可作为 v2.0 长期方向

---

## 一、Bun 的优势

| 优势 | 说明 |
|------|------|
| **内置 SQLite** | Bun 原生支持 `bun:sqlite`，零依赖，无需 WASM |
| **单文件编译** | `bun build --compile` 可生成独立可执行文件，用户无需 Node |
| **性能更快** | 启动速度和 I/O 性能显著优于 Node.js |
| **更小的产物** | 单文件 exe 预估 20-30MB（Node + sql.js WASM 方案约 40-50MB） |
| **交叉编译** | `--target` 支持 Windows/macOS/Linux，一套代码打多平台 |

## 二、核心障碍：sql.js WASM 兼容性

当前项目的数据库访问依赖 **sql.js**（WASM 版 SQLite），这是迁移的最大障碍：

### 2.1 Bun compile + WASM 的已知问题

- GitHub Issue [#6567](https://github.com/oven-sh/bun/issues/6567)（已关闭，但变通方案仍需要）：
  - `bun build --compile` 打包含 WASM 依赖的项目时，WASM 文件可能无法正确嵌入
  - sql.js 在运行时动态加载 `.wasm` 文件，路径在打包后会失效

### 2.2 解决方案：用 bun:sqlite 替代 sql.js

Bun 内置 `bun:sqlite`，可以完全替代 sql.js，**消除 WASM 依赖**：

```typescript
// 替代前（sql.js，依赖 WASM）
import initSqlJs from 'sql.js';
const SQL = await initSqlJs();
const db = new SQL.Database(buffer);

// 替代后（bun:sqlite，零依赖）
import { Database } from 'bun:sqlite';
const db = new Database('path/to/file.db', { readonly: true });
```

**注意**：`bun:sqlite` 只支持从**文件路径**打开数据库，不支持从 `Buffer` 创建内存数据库。当前代码 `new SQL.Database(buf)` 这种用法需要改为先读取文件再操作。

## 三、迁移工作量评估

| 模块 | 改动 | 难度 |
|------|------|------|
| `_utils.mjs` | `getSqlModule()` 重写为 `bun:sqlite`，`parseSessionsFromDB()` 改文件路径读取 | 中 |
| `sessions.mjs` | 无直接依赖 sql.js（通过 _utils），需测试兼容性 | 低 |
| `workspaces.mjs` | 无 sql.js 依赖 | 无 |
| `automations.mjs` | 无 sql.js 依赖 | 无 |
| `resources.mjs` | 无 sql.js 依赖 | 无 |
| 构建脚本 | 新增 `build.mjs`，用 `bun build --compile` 打包 | 中 |
| SKILL.md | 前置依赖从 "Node.js" 改为 "无需依赖" | 低 |

**总估时**：约 1-2 天

## 四、风险与不确定性

| 风险 | 等级 | 说明 |
|------|------|------|
| `bun:sqlite` 写入 vscdb 格式兼容性 | 🟡 中 | WorkBuddy 的 vscdb 可能使用 SQLite 扩展特性，需实测 |
| Bun 版本稳定性 | 🟡 中 | Bun 更新频繁，API 可能有 breaking changes |
| 用户安装 Bun 的意愿 | 🟢 低 | 如果目标是免安装，单文件 exe 本身解决了这个问题 |
| sql.js → bun:sqlite 事务行为差异 | 🟡 中 | 需验证 delete + export + 写回文件的完整流程 |
| Bun 不支持 Windows 7 / 旧系统 | 🟢 低 | WorkBuddy 本身需要较新系统 |

## 五、推荐路线图

### 当前（v1.x）
- ✅ C 方案：SKILL.md 加 Node.js 前置检测
- ✅ dist 包含 node_modules，用户免 `npm install`

### 中期（v1.5）— 可选
- 新增 `build.mjs` 脚本，用 `pkg` 或 `nexe` 打包 Node.js 单文件 exe
- 发布时同时提供：源码包 + Windows exe
- 验证 `bun:sqlite` 对 vscdb 的读写兼容性

### 长期（v2.0）— Bun 全面迁移
- 代码迁移到 TypeScript + `bun:sqlite`
- `bun build --compile` 生成跨平台单文件可执行
- 完全脱离 Node.js 依赖
- 前置依赖变为"无"

---

## 参考资料

- [Bun 单文件可执行文件文档](https://bun.com/docs/bundler/executables)
- [Bun SQLite 文档](https://bun.com/docs/api/sqlite)
- [GitHub #6567: bun build --compile fails with WASM](https://github.com/oven-sh/bun/issues/6567)
- [Bun v1.2 发布博客](https://bun.com/blog/bun-v1.2.3)
