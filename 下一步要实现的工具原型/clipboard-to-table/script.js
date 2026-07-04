// ============================================================
// 剪贴板转表格：解析输入 → 生成 MD / HTML / CSV / Excel
// 解析与生成逻辑独立于其它页面，自成一体。
// ============================================================

// 当前解析出的二维数组（含表头行），供各格式生成与切换复用
let currentRows = [];
let currentHasHeader = true;
let currentFormat = 'md';

function showError(msg) {
    const el = document.getElementById('errorMsg');
    el.textContent = msg;
    el.classList.add('show');
}
function hideError() {
    document.getElementById('errorMsg').classList.remove('show');
}

// ---------- 解析 HTML 中的 <table> 为二维数组 ----------
// 表格从 Excel / 备忘录 / 飞书 / 网页复制时，剪贴板里带有 text/html，
// 其中含真正的 <table><tr><td> 结构，空单元格、列数都完整保留。
// 纯文本表示常把所有单元格都用换行分隔、丢掉列结构，无法可靠还原，
// 因此只要拿得到 HTML 就优先用它。返回 null 表示 HTML 里没有表格。
function parseHtmlTable(html) {
    if (!html || !/<table[\s>]/i.test(html)) return null;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const table = doc.querySelector('table');
    if (!table) return null;

    const rows = [];
    // 直接取所有 tr（thead/tbody 都算），保持源顺序
    for (const tr of table.querySelectorAll('tr')) {
        const cells = [];
        for (const cell of tr.querySelectorAll('th, td')) {
            // <br> 视为单元格内换行；其余标签只取文本，去掉首尾空白
            const text = cell.innerHTML
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<[^>]+>/g, '');
            const el = document.createElement('textarea');
            el.innerHTML = text;                 // 还原 &nbsp; &amp; 等实体
            const colspan = parseInt(cell.getAttribute('colspan') || '1', 10) || 1;
            cells.push(el.value.replace(/ /g, ' ').trim());
            // 合并单元格：占位补齐后续列，保证列对齐
            for (let k = 1; k < colspan; k++) cells.push('');
        }
        if (cells.length) rows.push(cells);
    }
    return rows.length ? rows : null;
}

// 把二维数组转成 TSV，喂回输入框与既有解析管线（Tab 分隔最稳，不与内容冲突）
function rowsToTsv(rows) {
    return rows
        .map(r => r.map(c => c.replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t'))
        .join('\n');
}

// ---------- 从剪贴板读取（优先富文本 HTML，回退纯文本） ----------
async function pasteFromClipboard() {
    try {
        let html = '';
        let text = '';
        // 1) Electron 原生剪贴板：能直接读到 text/html 富文本（最可靠）
        //    经 IPC 由主进程读取，返回 Promise，需 await。
        if (window.electronAPI && window.electronAPI.readClipboardHTML) {
            html = (await window.electronAPI.readClipboardHTML()) || '';
            text = (await window.electronAPI.readClipboardText()) || '';
        }
        // 2) 回退到 Web Async Clipboard（浏览器 / 未暴露原生 API 时）
        if (!html && navigator.clipboard && navigator.clipboard.read) {
            try {
                const items = await navigator.clipboard.read();
                for (const item of items) {
                    if (item.types.includes('text/html')) {
                        html = await (await item.getType('text/html')).text();
                    }
                    if (item.types.includes('text/plain')) {
                        text = await (await item.getType('text/plain')).text();
                    }
                }
            } catch (_) { /* 某些环境 read() 不可用，继续走 readText */ }
        }
        if (!text && navigator.clipboard && navigator.clipboard.readText) {
            text = await navigator.clipboard.readText();
        }

        const tableRows = parseHtmlTable(html);
        if (tableRows) {
            // 富文本表格：转成 TSV 放入输入框，强制按 Tab 解析，列结构 100% 保留
            document.getElementById('inputText').value = rowsToTsv(tableRows);
            document.getElementById('optDelim').value = 'tab';
            hideError();
            convertTable();
            return;
        }

        if (!text) {
            showError('剪贴板为空，或无法读取内容');
            return;
        }
        document.getElementById('inputText').value = text;
        hideError();
        convertTable();
    } catch (e) {
        showError('读取剪贴板失败：' + e.message + '（可手动 Cmd/Ctrl+V 粘贴到输入框）');
    }
}

// ---------- 分隔符识别 ----------
function detectDelimiter(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    const firstLine = lines[0] || '';
    // 竖线优先判断 Markdown 表格
    if (/^\s*\|.*\|\s*$/.test(firstLine)) return 'pipe';
    const counts = {
        tab: (firstLine.match(/\t/g) || []).length,
        comma: (firstLine.match(/,/g) || []).length,
        semicolon: (firstLine.match(/;/g) || []).length,
    };
    // Tab 最可靠（Excel 复制默认 Tab 分隔），优先
    if (counts.tab > 0) return 'tab';
    if (counts.semicolon > counts.comma) return 'semicolon';
    if (counts.comma > 0) return 'comma';
    // 首行无分隔符：若有多行且全篇都不含任何分隔符，视为「换行分列」——
    // 表格被拉直成「每个单元格独占一行」，需按列数重排还原（否则只会得到一列）。
    if (lines.length > 1 && !lines.some(l => /[\t,;|]/.test(l))) return 'newline';
    return 'tab'; // 单列/单行无分隔时按 Tab 处理（整行一列）
}

// ---------- 换行分列时猜测列数（找最接近 √n 的因子，保证 ≥2 行） ----------
function guessCols(n) {
    if (n < 4) return 1; // 数据太少，保持单列更稳妥
    let best = 1;
    let bestDist = Infinity;
    const target = Math.sqrt(n);
    for (let d = 2; d <= n / 2; d++) {
        if (n % d !== 0) continue;
        const dist = Math.abs(d - target);
        if (dist < bestDist) { bestDist = dist; best = d; }
    }
    return best; // 找不到合适因子（如质数）时返回 1，交给用户手动指定列数
}

// ---------- Markdown 单行按 | 切分（转义的 \| 还原） ----------
function splitPipeLine(line) {
    let s = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    const parts = [];
    let cur = '';
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
        if (s[i] === '|') { parts.push(cur); cur = ''; continue; }
        cur += s[i];
    }
    parts.push(cur);
    return parts.map(p => p.trim());
}

/**
 * 引号感知的整篇文档解析（用于 Tab / 逗号 / 分号）。
 * 关键点：引号内的换行 / 分隔符都属于单元格内容，不切分。
 * 这样从 Excel 复制的「多行单元格」（引号包裹跨行）能被正确还原为一格。
 */
function parseDelimitedDoc(text, delim) {
    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') { cur += '"'; i++; }
                else inQuotes = false;
            } else cur += ch;
        } else {
            if (ch === '"') inQuotes = true;
            else if (ch === delim) { row.push(cur); cur = ''; }
            else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
            else cur += ch;
        }
    }
    // 收尾最后一格 / 最后一行
    row.push(cur);
    rows.push(row);
    return rows;
}

// ---------- Markdown 表格行判断（分隔线 |---|---|） ----------
function isMarkdownSeparator(cells) {
    return cells.length > 0 && cells.every(c => /^:?-{1,}:?$/.test(c.trim()));
}

// 最近一次解析的识别结果，供转换后给出提示（换行分列时告知用户按几列重排）
let lastParseInfo = { kind: 'tab', cols: 0 };

// ---------- 解析文本为二维数组 ----------
function parseText(text, delimOpt, mergeContinuation, colsOpt) {
    const delimMap = { tab: '\t', comma: ',', semicolon: ';', pipe: '|' };
    const kind = delimOpt === 'auto' ? detectDelimiter(text) : delimOpt;
    const delim = delimMap[kind];

    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    let rows = [];
    if (kind === 'newline') {
        // 换行分列：每个单元格独占一行，按列数重排还原成表格
        const items = normalized.split('\n').map(l => l.trim()).filter(l => l !== '');
        const cols = (colsOpt && colsOpt >= 1) ? colsOpt : guessCols(items.length);
        for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
        lastParseInfo = { kind, cols };
    } else if (kind === 'pipe') {
        // Markdown：按物理行处理，跳过分隔线 |---|---|
        for (const line of normalized.split('\n')) {
            if (line.trim() === '') continue;
            const cells = splitPipeLine(line);
            if (isMarkdownSeparator(cells)) continue;
            rows.push(cells);
        }
        lastParseInfo = { kind, cols: 0 };
    } else {
        // Tab / 逗号 / 分号：整篇引号感知解析（引号内换行不切行）
        rows = parseDelimitedDoc(normalized, delim)
            .filter(r => !(r.length === 1 && r[0].trim() === ''));
        lastParseInfo = { kind, cols: 0 };
    }
    if (rows.length === 0) return [];

    // 目标列数：取最大列数，作为补齐基准
    const maxCols = Math.max(...rows.map(r => r.length));

    if (mergeContinuation) {
        // 少列的行 = 上一行最后一列的续行，合并进去
        const merged = [];
        for (const cells of rows) {
            if (merged.length > 0 && cells.length < maxCols && cells.length <= 1) {
                const prev = merged[merged.length - 1];
                prev[prev.length - 1] += '\n' + cells.join('');
            } else {
                merged.push(cells.slice());
            }
        }
        rows = merged;
    }

    // 补齐 / 归一列数（保留单元格内部换行，仅去首尾空白）
    return rows.map(r => {
        const copy = r.map(c => c.trim());
        while (copy.length < maxCols) copy.push('');
        return copy;
    });
}

// ---------- 生成：Markdown ----------
function toMarkdown(rows, hasHeader) {
    if (!rows.length) return '';
    const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
    const cols = rows[0].length;
    const header = hasHeader ? rows[0] : rows[0].map((_, i) => '列' + (i + 1));
    const body = hasHeader ? rows.slice(1) : rows;

    const lines = [];
    lines.push('| ' + header.map(esc).join(' | ') + ' |');
    lines.push('| ' + Array(cols).fill('---').join(' | ') + ' |');
    for (const r of body) lines.push('| ' + r.map(esc).join(' | ') + ' |');
    return lines.join('\n');
}

// ---------- 生成：HTML ----------
function toHtml(rows, hasHeader) {
    if (!rows.length) return '';
    const esc = (s) => UI.escapeHtml(s).replace(/\n/g, '<br>');
    const header = hasHeader ? rows[0] : null;
    const body = hasHeader ? rows.slice(1) : rows;

    const parts = ['<table border="1" cellspacing="0" cellpadding="6">'];
    if (header) {
        parts.push('  <thead>');
        parts.push('    <tr>' + header.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr>');
        parts.push('  </thead>');
    }
    parts.push('  <tbody>');
    for (const r of body) {
        parts.push('    <tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>');
    }
    parts.push('  </tbody>');
    parts.push('</table>');
    return parts.join('\n');
}

// ---------- 生成：CSV ----------
function toCsv(rows) {
    if (!rows.length) return '';
    const esc = (s) => {
        s = String(s);
        if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
    };
    return rows.map(r => r.map(esc).join(',')).join('\r\n');
}

// ---------- 生成：Excel（HTML-table 版 .xls，Excel/WPS/Numbers 可直接打开） ----------
function toExcelHtml(rows, hasHeader) {
    const table = toHtml(rows, hasHeader);
    return '<html xmlns:o="urn:schemas-microsoft-com:office:office" '
        + 'xmlns:x="urn:schemas-microsoft-com:office:excel" '
        + 'xmlns="http://www.w3.org/TR/REC-html40">'
        + '<head><meta charset="UTF-8"></head><body>' + table + '</body></html>';
}

// ---------- 渲染预览表 ----------
function renderPreview(rows, hasHeader) {
    const table = document.getElementById('previewTable');
    table.innerHTML = '';
    if (!rows.length) return;
    const body = hasHeader ? rows.slice(1) : rows;
    if (hasHeader) {
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        rows[0].forEach(c => {
            const th = document.createElement('th');
            th.textContent = c;
            tr.appendChild(th);
        });
        thead.appendChild(tr);
        table.appendChild(thead);
    }
    const tbody = document.createElement('tbody');
    body.forEach(r => {
        const tr = document.createElement('tr');
        r.forEach(c => {
            const td = document.createElement('td');
            td.textContent = c;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
}

// ---------- 结果/预览显隐：在「占位提示」与「预览+结果」间切换 ----------
function showResultCard(show) {
    // 右侧预览：占位 ↔ 预览卡片
    document.getElementById('previewCard').style.display = show ? 'flex' : 'none';
    document.getElementById('previewEmpty').style.display = show ? 'none' : 'flex';
    // 下方通栏：转换结果卡片
    document.getElementById('resultCard').style.display = show ? 'block' : 'none';
    syncPreviewHeight();
}

// ---------- 右侧高度跟随左侧 ----------
// 右侧预览高度锁定为左侧输入区高度：初始占位与左侧等高（不再显得矮），
// 转换出长表格时也不撑高整行、把下方「转换结果」挤到第二屏；超出部分在预览表内部滚动。
// 收起任意一侧时解除限高，让可见侧自然占满。
function syncPreviewHeight() {
    const split = document.getElementById('splitLayout');
    const inputPane = document.querySelector('.pane-input');
    const previewPane = document.querySelector('.pane-preview');
    if (!split || !inputPane || !previewPane) return;
    const collapsed = split.classList.contains('collapse-input')
        || split.classList.contains('collapse-preview');
    // 用 height 而非 max-height：既能给长表格封顶滚动，也能把矮的占位撑到等高
    previewPane.style.height = collapsed ? '' : inputPane.offsetHeight + 'px';
}

// ---------- 收起/展开某一侧（让另一侧占满） ----------
// which: 'input' 收起左侧输入区；'preview' 收起右侧解析预览
function togglePane(which) {
    const split = document.getElementById('splitLayout');
    const cls = which === 'input' ? 'collapse-input' : 'collapse-preview';
    const other = which === 'input' ? 'collapse-preview' : 'collapse-input';
    split.classList.remove(other); // 一次只收起一侧
    split.classList.toggle(cls);
    syncPreviewHeight();
}

// ---------- 主转换 ----------
function convertTable() {
    hideError();
    const input = document.getElementById('inputText').value;
    if (!input.trim()) {
        showError('请先粘贴或输入内容');
        return;
    }
    const delimOpt = document.getElementById('optDelim').value;
    const hasHeader = document.getElementById('optHeader').checked;
    const merge = document.getElementById('optMerge').checked;
    const colsRaw = parseInt(document.getElementById('optCols').value, 10);
    const colsOpt = Number.isInteger(colsRaw) && colsRaw >= 1 ? colsRaw : 0;

    const rows = parseText(input, delimOpt, merge, colsOpt);
    if (!rows.length) {
        showError('未解析出任何有效行');
        showResultCard(false);
        return;
    }

    currentRows = rows;
    currentHasHeader = hasHeader;

    renderPreview(rows, hasHeader);
    const dataRows = hasHeader ? rows.length - 1 : rows.length;
    document.getElementById('dimInfo').textContent =
        `${rows[0].length} 列 × ${dataRows} 行数据` + (hasHeader ? '（首行为表头）' : '');

    // 换行分列：提示用户实际按几列重排，方便发现列数猜错并手动调整
    const noteEl = document.getElementById('parseNote');
    if (lastParseInfo.kind === 'newline') {
        noteEl.textContent =
            `检测到「每行一个单元格」的竖排内容，已按 ${lastParseInfo.cols} 列重排。`
            + `若列数不对，请在上方「列数」中手动指定后重新转换。`;
        noteEl.style.display = 'block';
    } else {
        noteEl.style.display = 'none';
    }

    showResultCard(true);
    switchFormat(currentFormat);
}

// ---------- 生成当前格式文本 ----------
function buildOutput(fmt) {
    switch (fmt) {
        case 'md': return toMarkdown(currentRows, currentHasHeader);
        case 'html': return toHtml(currentRows, currentHasHeader);
        case 'csv': return toCsv(currentRows);
        case 'excel': return toExcelHtml(currentRows, currentHasHeader);
        default: return '';
    }
}

// ---------- 切换格式 ----------
function switchFormat(fmt) {
    currentFormat = fmt;
    document.querySelectorAll('.format-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.fmt === fmt);
    });
    document.getElementById('outputText').value = buildOutput(fmt);
    document.getElementById('excelHint').style.display = fmt === 'excel' ? 'block' : 'none';
    document.getElementById('downloadBtn').style.display =
        (fmt === 'csv' || fmt === 'excel') ? 'inline-block' : 'none';
}

// ---------- 复制纯文本 ----------
function copyCurrent() {
    UI.copyText(document.getElementById('outputText').value);
}

// ---------- 复制为富文本表格（粘贴到 Word/飞书为真表格） ----------
async function copyRichTable() {
    const html = toHtml(currentRows, currentHasHeader);
    const plain = toCsv(currentRows);
    try {
        const item = new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' }),
        });
        await navigator.clipboard.write([item]);
        UI.showToast('已复制为富文本表格');
    } catch (e) {
        UI.copyText(html, '当前环境不支持富文本，已复制 HTML 源码');
    }
}

// ---------- 下载文件（CSV / Excel） ----------
function downloadCurrent() {
    let content, mime, ext;
    if (currentFormat === 'csv') {
        content = '﻿' + toCsv(currentRows); // BOM 保证 Excel 中文不乱码
        mime = 'text/csv;charset=utf-8';
        ext = 'csv';
    } else if (currentFormat === 'excel') {
        content = toExcelHtml(currentRows, currentHasHeader);
        mime = 'application/vnd.ms-excel;charset=utf-8';
        ext = 'xls';
    } else {
        return;
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'table.' + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.showToast('已下载 table.' + ext);
}

// ---------- 清空 ----------
function clearAll() {
    document.getElementById('inputText').value = '';
    document.getElementById('outputText').value = '';
    showResultCard(false);
    currentRows = [];
    hideError();
}

// 快捷键：Ctrl/Cmd+Enter 转换
document.getElementById('inputText').addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        convertTable();
    }
});

// 直接 Cmd/Ctrl+V 粘贴：拦截 paste 事件，抢在 textarea 丢弃富文本前取到 text/html。
// 否则浏览器只把纯文本填进输入框，表格的列结构（尤其空单元格）从源头就丢了。
document.getElementById('inputText').addEventListener('paste', function (e) {
    const cd = e.clipboardData || window.clipboardData;
    if (!cd) return;
    const html = cd.getData('text/html');
    const tableRows = html ? parseHtmlTable(html) : null;
    if (!tableRows) return; // 无表格富文本时走默认粘贴（纯文本）
    e.preventDefault();
    this.value = rowsToTsv(tableRows);
    document.getElementById('optDelim').value = 'tab';
    hideError();
    convertTable();
});

// 左侧输入区高度变化时（拖拽 textarea、增删选项行、窗口宽度变化导致换行等），
// 实时把右侧预览的高度同步过去。
const inputPaneEl = document.querySelector('.pane-input');
if (inputPaneEl && window.ResizeObserver) {
    new ResizeObserver(() => syncPreviewHeight()).observe(inputPaneEl);
}
window.addEventListener('resize', syncPreviewHeight);
// 初始也同步一次，让右侧占位与左侧等高（避免刚打开时右侧很矮）
syncPreviewHeight();
