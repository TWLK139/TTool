# TTool

基于 Electron + React + TypeScript 构建的桌面日常工具集，采用 pnpm monorepo + Turborepo 管理。

## 核心特性

- **窗口置顶** — 应用窗口可固定在屏幕最前端，也可随时切换回普通窗口模式
- **插件化架构** — 主进程作为基座，各功能模块独立开发、独立构建，按需加载

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron |
| 前端框架 | React |
| 开发语言 | TypeScript |
| 包管理 | pnpm (workspace) |
| 构建编排 | Turborepo |
| 渲染构建 | Vite |

## 架构设计

```
┌─────────────────────────────────────────┐
│              Electron Main              │
│  ┌───────────────────────────────────┐  │
│  │           基座 (Host)              │  │
│  │  ┌─────┐ ┌─────┐ ┌─────┐        │  │
│  │  │插件A│ │插件B│ │插件C│  ...    │  │
│  │  └─────┘ └─────┘ └─────┘        │  │
│  └───────────────────────────────────┘  │
│         窗口管理 / 置顶控制              │
└─────────────────────────────────────────┘
```

### 基座 (Host)

- 提供应用生命周期管理、窗口创建与控制
- 提供置顶/普通窗口模式切换能力
- 提供插件注册、加载、卸载机制
- 提供插件间通信通道

### 插件 (Plugin)

- 每个功能模块以独立插件形式存在
- 插件独立开发、独立构建，与基座解耦
- 通过基座提供的 API 与宿主通信
- 支持按需加载，不影响基座启动速度

## 项目结构

```
TTool/
├── packages/
│   ├── main/                    # Electron 主进程（基座）
│   │   └── src/
│   │       ├── index.ts         # 主进程入口
│   │       └── preload.ts       # 预加载脚本
│   ├── renderer/                # React 渲染进程
│   │   └── src/
│   │       ├── App.tsx
│   │       └── main.tsx
│   └── plugins/                 # 插件目录
│       ├── plugin-types/        # 插件类型定义
│       └── plugin-example/      # 示例插件
├── pnpm-workspace.yaml          # pnpm 工作区配置
├── turbo.json                   # Turborepo 任务编排
├── package.json                 # 根配置 + catalog 版本管理
└── tsconfig.json                # TypeScript 基础配置
```

## 开发

### 环境要求

- Node.js >= 18
- pnpm >= 10

### 安装依赖

```bash
pnpm install
```

### 启动开发环境

```bash
# 同时启动主进程和渲染进程
pnpm dev

# 单独启动
pnpm dev:renderer
pnpm dev:main
```

### 构建

```bash
# 构建所有包（自动处理依赖顺序）
pnpm build

# 单独构建
pnpm build:renderer
pnpm build:main
```

### 清理构建产物

```bash
pnpm clean
```

## Monorepo 管理

本项目使用以下工具链管理多包结构：

| 工具 | 用途 |
|------|------|
| **pnpm workspace** | 多包依赖管理，严格依赖隔离 |
| **pnpm catalog** | 统一管理共享依赖版本，避免版本漂移 |
| **Turborepo** | 构建任务编排，自动依赖拓扑排序 + 增量缓存 |
| **workspace:\*** | 包间引用协议，确保使用本地源码 |

### 依赖版本统一

共享依赖版本通过根 `package.json` 的 `pnpm.catalog` 统一管理，子包使用 `catalog:` 协议引用：

```jsonc
// 根 package.json
{ "pnpm": { "catalog": { "typescript": "^5.7.0" } } }

// 子包 package.json
{ "devDependencies": { "typescript": "catalog:" } }
```

## 窗口置顶

通过 Electron 的 `BrowserWindow` API 实现：

- `alwaysOnTop: true` — 置顶模式，窗口始终保持在最前
- `alwaysOnTop: false` — 普通模式，窗口行为与常规窗口一致
- 支持快捷键 / 菜单栏一键切换

## License

MIT
