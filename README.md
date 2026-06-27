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
│   │       ├── plugins.config.ts# 插件注册配置
│   │       └── preload.ts       # 预加载脚本
│   ├── renderer/                # React 渲染进程
│   │   └── src/
│   │       ├── App.tsx          # 应用外壳（导航 + 路由渲染）
│   │       ├── plugin-registry.ts # 插件前端组件注册表
│   │       ├── pages/
│   │       │   └── Welcome.tsx  # 默认欢迎页（非插件）
│   │       └── main.tsx
│   └── plugins/                 # 插件目录
│       ├── plugin-types/        # 插件类型定义
│       ├── plugin-notepad/      # 记事本插件
│       │   └── src/
│       │       ├── index.ts     # 主进程逻辑（IPC、生命周期）
│       │       └── frontend/    # 渲染进程逻辑
│       │           ├── index.tsx# 页面组件（默认导出）
│       │           └── style.css
│       └── plugin-example/      # 示例插件
│           └── src/
│               ├── index.ts
│               └── frontend/
│                   ├── index.tsx
│                   └── style.css
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

## 架构强制约束

以下规则是本项目插件架构的强制约束，任何新增或修改代码必须遵守。

### 1. 插件是完整的独立模块

每个插件必须同时包含**主进程逻辑**和**渲染进程逻辑**，两者共存于同一个插件包内：

```
plugin-xxx/
  src/
    index.ts          # 主进程：IPC handlers、生命周期
    frontend/         # 渲染进程：页面组件、样式
      index.tsx       # 默认导出 React 函数组件
      style.css       # 插件私有样式
```

**禁止**将插件的 UI 组件放在 `renderer/src/pages/` 下。插件的全部代码（前端 + 后端）必须归属插件包自身。

### 2. 前端组件通过 `./frontend` 子路径导出

插件 `package.json` 必须声明 `exports` 字段，将 `./frontend` 子路径指向源码：

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./frontend": "./src/frontend/index.tsx"
  }
}
```

- `"."` — 主进程入口，编译为 CommonJS
- `"./frontend"` — 渲染进程入口，由 Vite 直接处理 TSX 源码

### 3. 渲染进程通过注册表加载插件组件

`renderer/src/plugin-registry.ts` 是插件前端组件的唯一注册点。新增插件时：

1. 在 `plugin-registry.ts` 中添加导入和路由映射
2. 在 `main/src/plugins.config.ts` 中添加插件注册条目

两处必须同步配置，缺一不可。

### 4. 主进程构建排除前端目录

插件 `tsconfig.json` 必须排除 `src/frontend`，因为前端代码由 Vite 处理，不经过 tsc 编译：

```json
{
  "exclude": ["src/frontend"]
}
```

### 5. 样式随插件走

插件的私有 CSS 必须放在 `src/frontend/style.css` 中，由前端组件 `import './style.css'` 引入。

**禁止**将插件专属样式写在 `renderer/src/styles/global.css` 中。`global.css` 仅保留：
- CSS 重置与主题变量
- 应用外壳布局（标题栏、导航栏、设置菜单）
- 通用滚动条样式
- 默认欢迎页样式

### 6. 依赖归属原则

- 插件专属依赖（如 `@mdxeditor/editor`）声明在插件包的 `dependencies` 中
- 渲染进程不直接依赖插件专属的第三方包
- 共享依赖（React、类型包）通过 `catalog:` 协议统一版本

### 7. 新增插件 Checklist

创建新插件时，必须完成以下所有步骤：

- [ ] 在 `packages/plugins/` 下创建 `plugin-xxx/` 包
- [ ] 实现 `src/index.ts`（主进程逻辑，导出 `TToolPlugin`）
- [ ] 实现 `src/frontend/index.tsx`（默认导出 React 组件）
- [ ] 编写 `src/frontend/style.css`（插件私有样式）
- [ ] 配置 `package.json`（`exports`、依赖）
- [ ] 配置 `tsconfig.json`（排除 `src/frontend`）
- [ ] 在 `main/src/plugins.config.ts` 注册插件
- [ ] 在 `renderer/src/plugin-registry.ts` 添加组件映射
- [ ] 在 `renderer/vite.config.ts` 的 `optimizeDeps.include` 添加前端入口

## License

MIT
