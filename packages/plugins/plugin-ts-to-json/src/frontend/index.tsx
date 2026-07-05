import { useState, useCallback, useRef } from 'react';
import './style.css';

const EXAMPLES = [
  `[\n  { tabName: '上拍件数', count: 128, tabKey: 'product' },\n  { tabName: '资产推介数', count: -1, tabKey: 'tuijie' },\n  { tabName: '处置公告', count: 5, tabKey: 'chuzhi' },\n]`,
  `{ config: { name: 'test', items: [1, 2] } }`,
  `{ name: '张三', age: 25, active: true, tags: ['a', 'b'] }`,
];

const EXAMPLE_LABELS = [
  '数组对象：[{ tabName: \'上拍件数\', count: 128, tabKey: \'product\' }]',
  '嵌套对象：{ config: { name: \'test\', items: [1, 2] } }',
  '混合类型：{ name: \'张三\', age: 25, active: true, tags: [\'a\', \'b\'] }',
];

function tsObjectToJson(input: string): unknown {
  let text = input.trim();

  // 移除单行注释 // ...
  text = text.replace(/\/\/.*$/gm, '');
  // 移除多行注释 /* ... */
  text = text.replace(/\/\*[\s\S]*?\*\//g, '');

  try {
    const fn = new Function('return (' + text + ')');
    const obj = fn();
    if (obj === undefined) {
      throw new Error('解析结果为 undefined，请检查输入格式');
    }
    return obj;
  } catch (e) {
    // 尝试1：包裹为对象（如果用户只写了属性列表）
    try {
      const fn = new Function('return ({' + text + '})');
      const obj = fn();
      if (obj !== undefined) return obj;
    } catch {
      // 忽略
    }

    // 尝试2：正则方式处理（fallback）
    try {
      const fixed = fixTsSyntax(text);
      const fn = new Function('return (' + fixed + ')');
      return fn();
    } catch {
      throw new Error('无法解析输入：' + (e as Error).message);
    }
  }
}

function fixTsSyntax(text: string): string {
  let result = text;
  result = result.replace(/,\s*([}\]])/g, '$1');
  result = result.replace(/(?<!['"\w])(\w+)\s*:/g, (_match, key: string) => {
    return '"' + key + '":';
  });
  result = result.replace(/'/g, '"');
  return result;
}

function sortObjectKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map((item) => sortObjectKeys(item));
  }
  if (obj !== null && typeof obj === 'object') {
    const sorted: Record<string, unknown> = {};
    Object.keys(obj as Record<string, unknown>)
      .sort()
      .forEach((key) => {
        sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
      });
    return sorted;
  }
  return obj;
}

export default function TsToJson() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [indent, setIndent] = useState(true);
  const [sortKeys, setSortKeys] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleConvert = useCallback(() => {
    setError('');
    setSuccess('');
    setOutput('');

    if (!input.trim()) {
      setError('请输入 TS/JS 对象');
      return;
    }

    try {
      let obj = tsObjectToJson(input);
      if (sortKeys) {
        obj = sortObjectKeys(obj);
      }
      const json = JSON.stringify(obj, null, indent ? 2 : undefined);
      setOutput(json);

      const type = Array.isArray(obj) ? '数组' : '对象';
      const count = Array.isArray(obj)
        ? obj.length + ' 个元素'
        : Object.keys(obj as Record<string, unknown>).length + ' 个属性';
      setSuccess('转换成功！类型：' + type + '，' + count);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [input, indent, sortKeys]);

  const handleClear = useCallback(() => {
    setInput('');
    setOutput('');
    setError('');
    setSuccess('');
  }, []);

  const handleCopy = useCallback(async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleFillExample = useCallback((index: number) => {
    setInput(EXAMPLES[index]);
    setError('');
    setSuccess('');
    setOutput('');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleConvert();
      }
    },
    [handleConvert]
  );

  return (
    <div className="ttj">
      <div className="ttj-content">
        <div className="ttj-panel">
          <div className="ttj-panel-header">
            <span className="ttj-panel-title">输入 TS/JS 对象</span>
            <div className="ttj-panel-actions">
              <button className="ttj-action-btn" onClick={handleConvert}>
                转换 → JSON
              </button>
              <button className="ttj-action-btn" onClick={handleClear}>
                清空
              </button>
            </div>
          </div>

          <textarea
            className="ttj-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`粘贴 TypeScript 或 JavaScript 对象字面量：\n\n示例：\n[\n  { tabName: '上拍件数', count: 128, tabKey: 'product' },\n  { tabName: '资产推介数', count: -1, tabKey: 'tuijie' },\n]\n\n也支持：\n{ name: 'test', value: 123, enabled: true }`}
            spellCheck={false}
          />

          {error && <div className="ttj-error">{error}</div>}
          {success && <div className="ttj-success">{success}</div>}

          <div className="ttj-options">
            <label className="ttj-checkbox-label">
              <input
                type="checkbox"
                checked={indent}
                onChange={(e) => setIndent(e.target.checked)}
              />
              格式化输出（缩进2空格）
            </label>
            <label className="ttj-checkbox-label">
              <input
                type="checkbox"
                checked={sortKeys}
                onChange={(e) => setSortKeys(e.target.checked)}
              />
              按键名排序
            </label>
          </div>

          <div className="ttj-examples">
            <span className="ttj-examples-label">快速示例：</span>
            {EXAMPLE_LABELS.map((label, i) => (
              <button
                key={i}
                className="ttj-example-btn"
                onClick={() => handleFillExample(i)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="ttj-panel">
          <div className="ttj-panel-header">
            <span className="ttj-panel-title">转换结果</span>
            <div className="ttj-panel-actions">
              <button
                className={`ttj-action-btn${copied ? ' copied' : ''}`}
                onClick={handleCopy}
                disabled={!output}
              >
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          </div>
          <pre className="ttj-output">{output || '等待输入数据...'}</pre>
        </div>
      </div>
    </div>
  );
}
