import { useState, useCallback, useRef, useEffect } from 'react';
import './style.css';

type Delimiter = 'tab' | 'comma' | 'semicolon' | 'pipe' | 'space';

const DELIMITER_MAP: Record<Delimiter, { label: string; value: string; regex: string }> = {
  tab: { label: 'Tab', value: '\t', regex: '\t' },
  comma: { label: '逗号', value: ',', regex: ',' },
  semicolon: { label: '分号', value: ';', regex: ';' },
  pipe: { label: '竖线 |', value: '|', regex: '\\|' },
  space: { label: '空格', value: ' ', regex: '\\s+' },
};

type OutputFormat = 'markdown' | 'csv' | 'html' | 'json';

function parseTable(text: string, delimiter: Delimiter): string[][] {
  if (!text.trim()) return [];
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return [];

  const regex = new RegExp(delimiter === 'space' ? DELIMITER_MAP[delimiter].regex : escapeRegex(DELIMITER_MAP[delimiter].value));
  return lines.map((line) => line.split(regex).map((cell) => cell.trim()));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toMarkdown(table: string[][]): string {
  if (table.length === 0) return '';
  const colCount = Math.max(...table.map((row) => row.length));
  const normalized = table.map((row) => {
    const padded = [...row];
    while (padded.length < colCount) padded.push('');
    return padded;
  });

  const colWidths = Array.from({ length: colCount }, (_, i) =>
    Math.max(3, ...normalized.map((row) => row[i].length))
  );

  const pad = (cell: string, width: number) => cell.padEnd(width);
  const sep = (width: number) => '-'.repeat(width);

  const header = `| ${normalized[0].map((c, i) => pad(c, colWidths[i])).join(' | ')} |`;
  const separator = `| ${colWidths.map(sep).join(' | ')} |`;
  const rows = normalized
    .slice(1)
    .map((row) => `| ${row.map((c, i) => pad(c, colWidths[i])).join(' | ')} |`);

  return [header, separator, ...rows].join('\n');
}

function toCsv(table: string[][]): string {
  return table
    .map((row) =>
      row.map((cell) => {
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    )
    .join('\n');
}

function toHtml(table: string[][]): string {
  if (table.length === 0) return '';
  const header = `<thead>\n  <tr>\n${table[0]
    .map((c) => `    <th>${escapeHtml(c)}</th>`)
    .join('\n')}\n  </tr>\n</thead>`;
  const body =
    table.length > 1
      ? `<tbody>\n${table
          .slice(1)
          .map(
            (row) =>
              `  <tr>\n${row.map((c) => `    <td>${escapeHtml(c)}</td>`).join('\n')}\n  </tr>`
          )
          .join('\n')}\n</tbody>`
      : '';
  return `<table>\n${header}\n${body}\n</table>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toJson(table: string[][]): string {
  if (table.length <= 1) return '[]';
  const headers = table[0];
  const rows = table.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h || `col${i}`] = row[i] || '';
    });
    return obj;
  });
  return JSON.stringify(rows, null, 2);
}

function formatOutput(table: string[][], format: OutputFormat): string {
  switch (format) {
    case 'markdown':
      return toMarkdown(table);
    case 'csv':
      return toCsv(table);
    case 'html':
      return toHtml(table);
    case 'json':
      return toJson(table);
  }
}

export default function ClipboardToTable() {
  const [rawText, setRawText] = useState('');
  const [delimiter, setDelimiter] = useState<Delimiter>('tab');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('markdown');
  const [copied, setCopied] = useState(false);
  const [hasHeader, setHasHeader] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const table = parseTable(rawText, delimiter);
  const output = formatOutput(hasHeader ? table : table, outputFormat);

  const handlePaste = useCallback(async () => {
    const text = (await window.ttool.invoke('clipboard-to-table:read-clipboard')) as string;
    setRawText(text);
  }, []);

  const handleCopy = useCallback(async () => {
    await window.ttool.invoke('clipboard-to-table:write-clipboard', output);
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleClear = useCallback(() => {
    setRawText('');
    setCopied(false);
  }, []);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRawText(e.target.value);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        return;
      }
    },
    []
  );

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const colCount = table.length > 0 ? Math.max(...table.map((row) => row.length)) : 0;

  return (
    <div className="ctt">
      <div className="ctt-toolbar">
        <div className="ctt-toolbar-group">
          <span className="ctt-label">分隔符</span>
          {(Object.keys(DELIMITER_MAP) as Delimiter[]).map((key) => (
            <button
              key={key}
              className={`ctt-btn${delimiter === key ? ' active' : ''}`}
              onClick={() => setDelimiter(key)}
            >
              {DELIMITER_MAP[key].label}
            </button>
          ))}
        </div>
        <div className="ctt-toolbar-group">
          <span className="ctt-label">输出格式</span>
          {(
            [
              ['markdown', 'Markdown'],
              ['csv', 'CSV'],
              ['html', 'HTML'],
              ['json', 'JSON'],
            ] as [OutputFormat, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className={`ctt-btn${outputFormat === key ? ' active' : ''}`}
              onClick={() => setOutputFormat(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ctt-toolbar-group">
          <label className="ctt-checkbox-label">
            <input
              type="checkbox"
              checked={hasHeader}
              onChange={(e) => setHasHeader(e.target.checked)}
            />
            首行为表头
          </label>
        </div>
      </div>

      <div className="ctt-content">
        <div className="ctt-panel">
          <div className="ctt-panel-header">
            <span className="ctt-panel-title">原始文本</span>
            <div className="ctt-panel-actions">
              <button className="ctt-action-btn" onClick={handlePaste} title="从剪贴板粘贴">
                粘贴
              </button>
              <button className="ctt-action-btn" onClick={handleClear} title="清空">
                清空
              </button>
            </div>
          </div>
          <textarea
            ref={textareaRef}
            className="ctt-textarea"
            value={rawText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="在此粘贴或输入表格数据，例如从 Excel 复制的 Tab 分隔数据..."
            spellCheck={false}
          />
        </div>

        <div className="ctt-panel">
          <div className="ctt-panel-header">
            <span className="ctt-panel-title">
              转换结果
              {table.length > 0 && (
                <span className="ctt-info">
                  {table.length} 行 × {colCount} 列
                </span>
              )}
            </span>
            <div className="ctt-panel-actions">
              <button
                className={`ctt-action-btn${copied ? ' copied' : ''}`}
                onClick={handleCopy}
                disabled={!output}
                title="复制到剪贴板"
              >
                {copied ? '已复制' : '复制'}
              </button>
            </div>
          </div>
          <pre className="ctt-output">{output || '等待输入数据...'}</pre>
        </div>
      </div>

      {table.length > 0 && outputFormat === 'markdown' && (
        <div className="ctt-preview">
          <div className="ctt-panel-header">
            <span className="ctt-panel-title">预览</span>
          </div>
          <div className="ctt-preview-table-wrap">
            <table className="ctt-preview-table">
              <thead>
                <tr>
                  {table[0]?.map((cell, i) => (
                    <th key={i}>{cell}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.slice(1).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
