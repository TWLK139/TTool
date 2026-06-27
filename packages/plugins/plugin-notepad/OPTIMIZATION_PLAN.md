# Notepad 插件优化实施文档

> 基于 `@mdxeditor/editor` v4.x，逐步实现行号、文字颜色、背景色、Diff 模式四项功能。

---

## 功能一：对接 Diff 模式

> 优先级：高 | 复杂度：低 | 预计改动：`index.tsx`

### 背景

当前 `diffSourcePlugin` 已导入，`DiffSourceToggleWrapper` 也在工具栏，但未传入 `diffMarkdown`（对比基准），导致 diff 模式无法展示差异。

### 实施步骤

#### 步骤 1.1：添加 `diffMarkdown` 状态

在 `Notepad` 组件中新增一个 ref 保存笔记的"已保存版本"内容：

```tsx
const diffMarkdownRef = useRef('');
```

#### 步骤 1.2：在新增和删除按钮旁边增加一个新的按钮“创建基线”，当用户点击时更新 `diffMarkdown`

- `selectNote` 加载笔记时，将读取到的内容存入 `diffMarkdownRef`
- `saveCurrentNote` 在用户点击创建基线按钮时，将当前内容存入 `diffMarkdownRef`
- `handleCreate` 新建笔记时，`diffMarkdownRef` 重置为空字符串

```tsx
// selectNote 中，读取内容后：
diffMarkdownRef.current = text;

// saveCurrentNote 中，保存成功后：
diffMarkdownRef.current = contentRef.current;

// handleCreate 中，新建笔记时：
diffMarkdownRef.current = '';
```

#### 步骤 1.3：将 `diffMarkdown` 传入 `diffSourcePlugin`

将 `diffSourcePlugin` 的静态配置改为动态配置。由于 `diffSourcePlugin` 的 `diffMarkdown` 是初始化参数，需要通过 MDXEditor 的受控方式更新。

使用 `useState` 代替 `useRef`，确保编辑器重新渲染时能获取最新值：

```tsx
const [diffMarkdown, setDiffMarkdown] = useState('');
```

在对应的加载/创建基线/新建位置同步调用 `setDiffMarkdown(...)`。

更新 `diffSourcePlugin` 配置：

```tsx
diffSourcePlugin({ viewMode: 'rich-text', readOnlyDiff: false, diffMarkdown: diffMarkdown }),
```

注意：创建基线按钮也需要按照当前的风格，用一个图标显示

#### 步骤 1.4：验证

1. 打开一个已有笔记 → 编辑内容 → 点击创建基线按钮 → 切换到 Diff 模式 → 应能看到与上次保存版本的差异
2. 切换回富文本模式 → 编辑 → 点击创建基线按钮 → 再切换 Diff → 差异应基于新保存的版本
3. 新建笔记 → 切换 Diff → 无差异（基准为空）

---

## 功能二：显示行号

> 优先级：高 | 复杂度：低 | 预计改动：`style.css`

### 背景

MDXEditor 富文本模式基于 Lexical，内容是块级元素（段落、标题、列表等），不是逐行文本。CSS counter 方案可为每个块级元素编号，在编辑区左侧 gutter 显示行号。

### 实施步骤

#### 步骤 2.1：在 `style.css` 中添加行号 CSS

在 `.notepad-editor .mdxeditor-root-contenteditable` 下添加行号相关样式：

```css
/* ---- 行号 ---- */
.notepad-editor .mdxeditor-root-contenteditable {
  /* 已有样式保留，新增以下内容 */
  counter-reset: line-number;
}

/* 为每个块级段落递增计数器 */
.notepad-editor .editor-content > p,
.notepad-editor .editor-content > h1,
.notepad-editor .editor-content > h2,
.notepad-editor .editor-content > h3,
.notepad-editor .editor-content > h4,
.notepad-editor .editor-content > h5,
.notepad-editor .editor-content > h6,
.notepad-editor .editor-content > ul > li,
.notepad-editor .editor-content > ol > li,
.notepad-editor .editor-content > blockquote > p,
.notepad-editor .editor-content > pre {
  counter-increment: line-number;
  position: relative;
  padding-left: 40px;
}

/* 用伪元素显示行号 */
.notepad-editor .editor-content > p::before,
.notepad-editor .editor-content > h1::before,
.notepad-editor .editor-content > h2::before,
.notepad-editor .editor-content > h3::before,
.notepad-editor .editor-content > h4::before,
.notepad-editor .editor-content > h5::before,
.notepad-editor .editor-content > h6::before,
.notepad-editor .editor-content > ul > li::before,
.notepad-editor .editor-content > ol > li::before,
.notepad-editor .editor-content > blockquote > p::before,
.notepad-editor .editor-content > pre::before {
  content: counter(line-number);
  position: absolute;
  left: 0;
  width: 30px;
  text-align: right;
  color: var(--text-faint, #999);
  font-size: 12px;
  font-family: var(--font-mono, monospace);
  line-height: inherit;
  user-select: none;
  pointer-events: none;
}
```

#### 步骤 2.2：可选 — 添加行号分隔线

```css
/* 行号与内容之间的分隔线 */
.notepad-editor .editor-content > p::before,
.notepad-editor .editor-content > h1::before,
.notepad-editor .editor-content > h2::before,
.notepad-editor .editor-content > h3::before,
.notepad-editor .editor-content > h4::before,
.notepad-editor .editor-content > h5::before,
.notepad-editor .editor-content > h6::before,
.notepad-editor .editor-content > ul > li::before,
.notepad-editor .editor-content > ol > li::before,
.notepad-editor .editor-content > blockquote > p::before,
.notepad-editor .editor-content > pre::before {
  /* 在上面的 ::before 规则中追加 */
  border-right: 1px solid var(--border-muted, #e0e0e0);
  padding-right: 8px;
  margin-right: 8px;
}
```

#### 步骤 2.3：验证

1. 打开一个多段落笔记 → 左侧应显示 1, 2, 3... 行号
2. 添加新段落 → 行号自动递增
3. 删除段落 → 行号自动重排
4. 切换到 Source/Diff 模式 → 行号消失（预期行为，这两种模式有自己的行号）

---

## 功能三：文本修改颜色 & 背景色

> 优先级：中 | 复杂度：高 | 预计改动：新建 `textStylePlugin.ts`，修改 `index.tsx`、`style.css`

### 背景

MDXEditor 官方不支持文字颜色和背景色（markdown 设计约束）。需要自定义 Lexical 插件，通过 HTML `<span>` 标签在 markdown 中保留样式信息。

### 技术方案

- 自定义 `StyledTextNode`（扩展 Lexical `TextNode`），携带 `textStyle` 属性（包含 `color` 和 `backgroundColor`）
- MDAST 导入时识别 `<span style="color:...">` 和 `<span style="background-color:...">`
- MDAST 导出时将样式信息还原为 HTML span 标签
- 工具栏添加颜色/背景色选择器

### 实施步骤

#### 步骤 3.1：创建 `StyledTextNode`

新建文件 `src/frontend/textStylePlugin.ts`：

```tsx
import {
  realmPlugin,
  createRootEditorSubscription$,
  addLexicalNode$,
  addImportVisitor$,
  addExportVisitor$,
} from '@mdxeditor/editor';
import {
  TextNode,
  TextFormatType,
  $applyTextFormat,
} from 'lexical';
import { rootEditor$ } from '@mdxeditor/editor';

// ---- 1. 自定义 Lexical 节点 ----

export class StyledTextNode extends TextNode {
  __textStyle: { color?: string; backgroundColor?: string };

  constructor(
    text: string,
    textStyle: { color?: string; backgroundColor?: string },
    key?: string,
  ) {
    super(text, key);
    this.__textStyle = textStyle;
  }

  static getType(): string {
    return 'styled-text';
  }

  static clone(node: StyledTextNode): StyledTextNode {
    return new StyledTextNode(node.__text, node.__textStyle, node.__key);
  }

  createDOM(config: any): HTMLElement {
    const dom = super.createDOM(config);
    const { color, backgroundColor } = this.__textStyle;
    if (color) dom.style.color = color;
    if (backgroundColor) dom.style.backgroundColor = backgroundColor;
    return dom;
  }

  updateDOM(prevNode: StyledTextNode, dom: HTMLElement, config: any): boolean {
    const update = super.updateDOM(prevNode, dom, config);
    const { color, backgroundColor } = this.__textStyle;
    if (color) dom.style.color = color;
    else dom.style.removeProperty('color');
    if (backgroundColor) dom.style.backgroundColor = backgroundColor;
    else dom.style.removeProperty('background-color');
    return update;
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      type: 'styled-text',
      textStyle: this.__textStyle,
    };
  }

  static importJSON(json: any): StyledTextNode {
    const node = new StyledTextNode(json.text, json.textStyle || {});
    node.setFormat(json.format);
    node.setDetail(json.detail);
    node.setMode(json.mode);
    return node;
  }

  setTextStyle(style: { color?: string; backgroundColor?: string }): StyledTextNode {
    const self = this.getWritable();
    self.__textStyle = style;
    return self;
  }

  canInsertTextBefore(): boolean {
    return true;
  }

  canInsertTextAfter(): boolean {
    return true;
  }
}

// ---- 2. 替换默认 TextNode ----
// 在编辑器初始化时，将普通 TextNode 替换为 StyledTextNode
// 这样后续的格式操作都能在 StyledTextNode 上进行

function $replaceTextNodeWithStyled(node: TextNode): StyledTextNode {
  if (node instanceof StyledTextNode) return node;
  const styled = new StyledTextNode(node.__text, {});
  styled.setFormat(node.__format);
  styled.setDetail(node.__detail);
  styled.setMode(node.__mode);
  node.replace(styled);
  return styled;
}

// ---- 3. MDAST Visitors ----

// 导入：识别 HTML <span style="color:...; background-color:..."> 标签
// 需要配合 @mdxeditor/editor 的 MDAST 处理管道

// 导出：将 StyledTextNode 带有样式的部分转为 HTML span

// ---- 4. 插件主体 ----

export const textStylePlugin = realmPlugin({
  init(realm) {
    // 注册自定义 Lexical 节点
    realm.pub(addLexicalNode$, StyledTextNode);

    // 注册订阅：在编辑器初始化时替换 TextNode 节点映射
    realm.pub(createRootEditorSubscription$, (rootEditor) => {
      // 将 Lexical 的 TextNode 映射到 StyledTextNode
      // 使得新创建的文本节点默认使用 StyledTextNode
      const originalNodeMap = rootEditor._nodes;
      // 替换 TextNode 的替换节点
      rootEditor._nodes = new Map(originalNodeMap);
      return () => {};
    });
  },
});
```

> **注意**：上面的 `textStylePlugin.ts` 是骨架代码，实际实现还需要完善 MDAST 导入/导出 visitor。详见步骤 3.2 和 3.3。

#### 步骤 3.2：实现 MDAST 导入 Visitor

在 `textStylePlugin.ts` 中添加 MDAST 导入逻辑，识别 markdown 中的 HTML `<span>` 标签：

```tsx
import type { MdxJsxTextElement } from 'mdast-util-mdx-jsx';

// 在 markdown 中用 HTML span 语法表示颜色：
// <span style="color: red">红色文字</span>
// <span style="background-color: yellow">高亮背景</span>
// <span style="color: red; background-color: yellow">红色+黄底</span>

// 导入 visitor 需要将 mdast 的 html 节点或 jsx 元素转为 Lexical StyledTextNode
// 这部分需要根据 @mdxeditor/editor 的 visitor 接口实现
```

**MDAST 导入的关键流程**：

1. MDXEditor 解析 markdown 时遇到 HTML `<span style="...">` 会生成 `html` 类型的 mdast 节点
2. 自定义 visitor 需要将这些 `html` 节点解析为 `StyledTextNode`
3. 解析 style 属性中的 `color` 和 `background-color` 值

#### 步骤 3.3：实现 MDAST 导出 Visitor

在 `textStylePlugin.ts` 中添加 MDAST 导出逻辑：

```tsx
// 导出时将 StyledTextNode 的样式信息转为 HTML span 标签
// 例如：带 color:red 的 StyledTextNode → <span style="color: red">文字</span>
```

**MDAST 导出的关键流程**：

1. Lexical 遍历时遇到 `StyledTextNode` 且 `__textStyle` 非空
2. 将其转为 mdast 的 `html` 节点，内容为 `<span style="color: ...; background-color: ...">文字</span>`
3. 这样 markdown 输出中会包含 HTML 标签，渲染时能保留样式

#### 步骤 3.4：添加工具栏颜色选择器

在 `index.tsx` 的工具栏中添加颜色选择按钮。两种实现方式：

**方案 A：简单原生 input[type=color]**（推荐先实现）

```tsx
import { useCellValues, usePublisher } from '@mdxeditor/editor';
import {
  $getSelection,
  $isRangeSelection,
} from 'lexical';
import { $isStyledTextNode } from './textStylePlugin';

function ColorPickerButton() {
  const [rootEditor] = useCellValues(rootEditor$);

  const applyColor = (color: string) => {
    rootEditor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const nodes = selection.getNodes();
        for (const node of nodes) {
          if ($isStyledTextNode(node)) {
            const styled = node.getWritable() as StyledTextNode;
            styled.setTextStyle({ ...styled.__textStyle, color });
          }
        }
      }
    });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <label title="文字颜色" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
        <input
          type="color"
          style={{ width: 24, height: 24, padding: 0, border: 'none', cursor: 'pointer' }}
          onChange={(e) => applyColor(e.target.value)}
        />
        <span style={{ fontSize: 12, marginLeft: 2 }}>A</span>
      </label>
    </div>
  );
}

function BgColorPickerButton() {
  // 类似实现，改为设置 backgroundColor
  // ...
}
```

**方案 B：预设色板下拉**

提供一组预设颜色供快速选择，体验更好但实现更复杂。建议先完成方案 A，后续优化为色板。

#### 步骤 3.5：在 `index.tsx` 中注册插件和工具栏

```tsx
import { textStylePlugin } from './textStylePlugin';

// plugins 数组中添加：
textStylePlugin(),

// toolbarContents 中添加颜色选择器：
<ColorPickerButton />
<BgColorPickerButton />
```

#### 步骤 3.6：添加样式

在 `style.css` 中：

```css
/* 颜色选择器按钮样式 */
.color-picker-btn,
.bgcolor-picker-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  border: 1px solid var(--border-muted);
  border-radius: 4px;
  background: var(--bg-input);
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
}

.color-picker-btn:hover,
.bgcolor-picker-btn:hover {
  background: var(--bg-input-hover);
}
```

#### 步骤 3.7：验证

1. 选中一段文字 → 点击颜色选择器 → 选择红色 → 文字变红
2. 选中另一段 → 点击背景色 → 选择黄色 → 文字背景变黄
3. 切换到 Source 模式 → 应看到 `<span style="color: red">` 等 HTML 标签
4. 切换回富文本 → 样式应保留
5. 保存后重新打开 → 样式应保留

---

## 实施顺序

```
步骤 1  功能四：Diff 模式对接     ← 最简单，先验证基础设施
  ↓
步骤 2  功能一：行号显示         ← 纯 CSS，无 JS 改动
  ↓
步骤 3  功能二+三：文字色/背景色  ← 最复杂，需要自定义 Lexical 插件
```

---

## 风险与注意事项

### Diff 模式
- `diffSourcePlugin` 的 `diffMarkdown` 是初始化参数，运行时更新需要 MDXEditor 重新渲染（key 变化或受控更新）
- diff 模式下编辑内容后再切回富文本，需确认 onChange 能正确同步

### 行号
- CSS counter 方案的行号是"块级编号"而非"字符行号"，长段落折叠后只算 1 行
- 列表嵌套、blockquote 嵌套场景下行号选择器可能需要微调
- Source/Diff 模式下行号由 CodeMirror 自带，无需额外处理

### 文字色/背景色
- **最大的风险点**：需要正确替换 Lexical 的默认 TextNode 为 StyledTextNode，否则新输入的文字不会自动使用 StyledTextNode
- MDAST 导入/导出 visitor 的实现需要深入理解 `@mdxeditor/editor` 的 visitor 接口
- markdown 输出会包含 HTML 标签（`<span style="...">`），可能在其他 markdown 渲染器中不被支持
- 颜色选择器触发时需要获取当前选区并正确应用样式，需处理选区跨多个节点的情况
- `StyledTextNode` 与 `TextNode` 的格式操作（bold/italic 等）需兼容，确保不会丢失已有格式

---

## 文件清单

| 文件 | 改动内容 |
|------|----------|
| `src/frontend/index.tsx` | Diff 状态管理、插件注册、工具栏按钮 |
| `src/frontend/style.css` | 行号样式、颜色选择器样式 |
| `src/frontend/textStylePlugin.ts` | **新建** — StyledTextNode、MDAST visitors、颜色选择器组件 |
