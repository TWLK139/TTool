import {
  realmPlugin,
  addImportVisitor$,
  addExportVisitor$,
} from '@mdxeditor/editor';
import { $isParagraphNode, $createParagraphNode, $createTextNode, type LexicalNode } from 'lexical';

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

/**
 * 导出 visitor：空行和仅含空白字符的段落需要特殊处理，
 * 否则 markdown 序列化后这些内容会被折叠丢失。
 * - 真正空行：导出为 \u200B（零宽空格）占位
 * - 仅空格/制表符的行：将空格转为 \u00A0（不可断空格）保留数量
 */
const EmptyParagraphExportVisitor = {
  testLexicalNode: (node: LexicalNode) => {
    if (!$isParagraphNode(node)) return false;
    const text = node.getTextContent();
    return text.replace(/\u200B/g, '').trim() === '';
  },
  visitLexicalNode: ({ lexicalNode, mdastParent, actions }: { lexicalNode: LexicalNode; mdastParent: any; actions: any }) => {
    const text = lexicalNode.getTextContent();
    const cleanText = text.replace(/\u200B/g, '');
    if (cleanText === '') {
      // 真正空行 → 零宽空格占位
      actions.appendToParent(mdastParent, {
        type: 'paragraph' as const,
        children: [{ type: 'text' as const, value: '\u200B' }],
      });
    } else {
      // 仅含空格/制表符的行 → 空格转 \u00A0 保留数量
      const preserved = cleanText.replace(/ /g, '\u00A0').replace(/\t/g, '\u00A0\u00A0');
      actions.appendToParent(mdastParent, {
        type: 'paragraph' as const,
        children: [{ type: 'text' as const, value: preserved }],
      });
    }
  },
  priority: 1,
} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * 导入 visitor：
 * - 仅含 \u200B 的段落 → 还原为空段落（空行）
 * - 仅含 \u00A0 的段落 → 还原空格（保留数量）
 */
const EmptyParagraphImportVisitor = {
  testNode: (mdastNode: { type: string; children?: Array<{ type: string; value?: string }> }) => {
    if (mdastNode.type !== 'paragraph') return false;
    const children = mdastNode.children;
    if (!children || children.length !== 1) return false;
    const child = children[0];
    if (child.type !== 'text' || child.value === undefined) return false;
    return child.value === '\u200B' || /^[\u00A0]+$/.test(child.value);
  },
  visitNode: ({ mdastNode, lexicalParent }: { mdastNode: { type: string; children?: Array<{ type: string; value?: string }> }; lexicalParent: any }) => {
    const text = mdastNode.children![0].value!;
    if (text === '\u200B') {
      // 空行
      lexicalParent.append($createParagraphNode());
    } else {
      // 还原空格
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(text.replace(/\u00A0/g, ' ')));
      lexicalParent.append(paragraph);
    }
  },
  priority: 1,
} as any; // eslint-disable-line @typescript-eslint/no-explicit-any

export const textStylePlugin = realmPlugin({
  init(realm) {
    // 注册 MDAST 导入 visitor，使 <span style="..."> 能被正确解析
    realm.pub(addImportVisitor$, MdastSpanStyleVisitor);
    // 注册空行保留的导出/导入 visitor
    realm.pub(addExportVisitor$, EmptyParagraphExportVisitor);
    realm.pub(addImportVisitor$, EmptyParagraphImportVisitor);
  },
});
