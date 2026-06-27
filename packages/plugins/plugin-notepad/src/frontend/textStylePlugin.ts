import {
  realmPlugin,
  addImportVisitor$,
} from '@mdxeditor/editor';

interface MdxJsxAttr {
  type: string;
  name: string;
  value?: string | null;
}

interface MdxJsxTextNode {
  type: string;
  name: string;
  attributes?: MdxJsxAttr[];
  children: MdxJsxChild[];
}

interface MdxJsxChild {
  type: string;
  value?: string;
  children?: MdxJsxChild[];
}

/**
 * MDAST 导入 visitor：识别 <span style="..."> 标签，将样式信息注入 Lexical TextNode 的 style 属性。
 * 导出已由 MDXEditor 内置的 LexicalTextVisitor 处理（读取 getStyle() 生成 <span style="...">）。
 */
const MdastSpanStyleVisitor = {
  testNode: (node: { type: string; name?: string }) => {
    return node.type === 'mdxJsxTextElement' && node.name === 'span' && hasStyleAttribute(node as MdxJsxTextNode);
  },
  visitNode({ mdastNode, actions, lexicalParent }: { mdastNode: MdxJsxTextNode; actions: any; lexicalParent: any }) {
    const styleValue = getStyleFromMdxNode(mdastNode);
    if (styleValue) {
      actions.addStyle(styleValue);
    }
    actions.visitChildren(mdastNode, lexicalParent);
  },
} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

function hasStyleAttribute(node: MdxJsxTextNode): boolean {
  return node.attributes?.some(
    (attr: MdxJsxAttr) => attr.type === 'mdxJsxAttribute' && attr.name === 'style' && typeof attr.value === 'string' && attr.value.trim() !== '',
  ) ?? false;
}

function getStyleFromMdxNode(node: MdxJsxTextNode): string | null {
  if (!node.attributes) return null;
  for (const attr of node.attributes) {
    if (attr.type === 'mdxJsxAttribute' && attr.name === 'style' && typeof attr.value === 'string') {
      return attr.value;
    }
  }
  return null;
}

export const textStylePlugin = realmPlugin({
  init(realm) {
    // 注册 MDAST 导入 visitor，使 <span style="..."> 能被正确解析
    realm.pub(addImportVisitor$, MdastSpanStyleVisitor);
  },
});
