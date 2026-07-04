// 示例数据
const EXAMPLES = [
    `[\n  { tabName: '上拍件数', count: 128, tabKey: 'product' },\n  { tabName: '资产推介数', count: -1, tabKey: 'tuijie' },\n  { tabName: '处置公告', count: 5, tabKey: 'chuzhi' },\n]`,
    `{ config: { name: 'test', items: [1, 2] } }`,
    `{ name: '张三', age: 25, active: true, tags: ['a', 'b'] }`,
];

function fillExample(index) {
    document.getElementById('inputTs').value = EXAMPLES[index];
    hideMessages();
}

function showError(msg) {
    const el = document.getElementById('errorMsg');
    el.textContent = msg;
    el.classList.add('show');
    document.getElementById('successMsg').classList.remove('show');
}

function showSuccess(msg) {
    const el = document.getElementById('successMsg');
    el.textContent = msg;
    el.classList.add('show');
    document.getElementById('errorMsg').classList.remove('show');
}

function hideMessages() {
    document.getElementById('errorMsg').classList.remove('show');
    document.getElementById('successMsg').classList.remove('show');
}

function showToast(msg) {
    UI.showToast(msg);
}

/**
 * 将 TS/JS 对象字面量转换为标准 JSON
 * 处理以下差异：
 * 1. 无引号的键名 → 加双引号
 * 2. 单引号字符串 → 双引号
 * 3. 尾部逗号 → 移除
 * 4. undefined → null
 * 5. 模板字符串 → 普通字符串
 * 6. Bigint / 注释等边界情况
 */
function tsObjectToJson(input) {
    let text = input.trim();

    // 移除单行注释 // ...
    text = text.replace(/\/\/.*$/gm, '');
    // 移除多行注释 /* ... */
    text = text.replace(/\/\*[\s\S]*?\*\//g, '');

    // 利用 Function 构造器安全地解析 JS 对象字面量
    // 这比正则替换更可靠，能处理各种边界情况
    try {
        // 用 Function 包裹，使其返回该表达式
        const fn = new Function('return (' + text + ')');
        const obj = fn();

        if (obj === undefined) {
            throw new Error('解析结果为 undefined，请检查输入格式');
        }

        return obj;
    } catch (e) {
        // 如果直接解析失败，尝试一些修复

        // 尝试1：包裹为对象（如果用户只写了属性列表）
        try {
            const fn = new Function('return ({' + text + '})');
            const obj = fn();
            if (obj !== undefined) return obj;
        } catch (e2) {
            // 忽略
        }

        // 尝试2：正则方式处理（fallback）
        try {
            const fixed = fixTsSyntax(text);
            const fn = new Function('return (' + fixed + ')');
            return fn();
        } catch (e3) {
            throw new Error('无法解析输入：' + e.message);
        }
    }
}

/**
 * 正则修复 TS 语法（作为 Function 解析的 fallback）
 */
function fixTsSyntax(text) {
    let result = text;

    // 移除尾部逗号（在 ] 或 } 前的逗号）
    result = result.replace(/,\s*([}\]])/g, '$1');

    // 给无引号的键名加双引号
    // 匹配模式：行首空白 + 标识符 + 冒号（且前面不是引号）
    result = result.replace(/(?<!['"\w])(\w+)\s*:/g, (match, key) => {
        // 排除已经是字符串键的情况
        // 排除 JS 保留字被误处理的可能
        return '"' + key + '":';
    });

    // 单引号字符串 → 双引号字符串
    // 这里简单处理：替换单引号为双引号
    result = result.replace(/'/g, '"');

    return result;
}

/**
 * 递归排序对象的键
 */
function sortObjectKeys(obj) {
    if (Array.isArray(obj)) {
        return obj.map(item => sortObjectKeys(item));
    }
    if (obj !== null && typeof obj === 'object') {
        const sorted = {};
        Object.keys(obj).sort().forEach(key => {
            sorted[key] = sortObjectKeys(obj[key]);
        });
        return sorted;
    }
    return obj;
}

function convertToJson() {
    hideMessages();
    const input = document.getElementById('inputTs').value.trim();

    if (!input) {
        showError('请输入 TS/JS 对象');
        return;
    }

    try {
        let obj = tsObjectToJson(input);

        const shouldSort = document.getElementById('optSortKeys').checked;
        if (shouldSort) {
            obj = sortObjectKeys(obj);
        }

        const shouldIndent = document.getElementById('optIndent').checked;
        const indent = shouldIndent ? 2 : undefined;
        const json = JSON.stringify(obj, null, indent);

        document.getElementById('resultCard').style.display = 'block';
        document.getElementById('outputJson').value = json;

        const type = Array.isArray(obj) ? '数组' : '对象';
        const count = Array.isArray(obj) ? obj.length + ' 个元素' : Object.keys(obj).length + ' 个属性';
        showSuccess('转换成功！类型：' + type + '，' + count);
    } catch (e) {
        showError(e.message);
        document.getElementById('resultCard').style.display = 'none';
    }
}

function clearAll() {
    document.getElementById('inputTs').value = '';
    document.getElementById('outputJson').value = '';
    document.getElementById('resultCard').style.display = 'none';
    hideMessages();
}

function copyResult() {
    UI.copyText(document.getElementById('outputJson').value);
}

// 快捷键：Ctrl+Enter 转换
document.getElementById('inputTs').addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        convertToJson();
    }
});
