import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  StrikeThroughSupSubToggles,
  ListsToggle,
  BlockTypeSelect,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  InsertCodeBlock,
  DiffSourceToggleWrapper,
  UndoRedo,
  Separator,
  rootEditor$,
} from '@mdxeditor/editor';
import { useCellValue } from '@mdxeditor/gurx';
import { $patchStyleText, $getSelectionStyleValueForProperty } from '@lexical/selection';
import { $getSelection, $isRangeSelection, type RangeSelection, SELECTION_CHANGE_COMMAND } from 'lexical';
import '@mdxeditor/editor/style.css';
import './style.css';
import { textStylePlugin } from './textStylePlugin';

interface NoteItem {
  name: string;
  fileName: string;
  updatedAt: number;
  createdAt: number;
}

/** 从 URL hash 解析当前笔记 fileName，如 /notepad/xxx.md -> xxx.md */
function getFileNameFromHash(): string | null {
  const hash = window.location.hash.slice(1); // 去掉 #
  const prefix = '/notepad/';
  if (hash.startsWith(prefix)) {
    return decodeURIComponent(hash.slice(prefix.length));
  }
  return null;
}

/** 预设颜色 */
const PRESET_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc',
  '#ff0000', '#ff6600', '#ffcc00', '#33cc33', '#0099ff',
  '#6633cc', '#cc0066', '#ff9999', '#ffcc99', '#ffff99',
  '#99ff99', '#99ccff', '#cc99ff', '#ff66cc', '#996633',
];

/** 通用色板弹窗（通过 Portal 挂载到 body，避免被 overflow:hidden 裁切） */
function ColorPalettePopup({
  anchorRef,
  activeColor,
  customColor,
  onCustomColorChange,
  onApply,
  onClose,
  showNoColor,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  activeColor: string | null;
  customColor: string;
  onCustomColorChange: (c: string) => void;
  onApply: (c: string | null) => void;
  onClose: () => void;
  showNoColor?: boolean;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // 计算弹窗位置
  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  }, [anchorRef]);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.color-palette-popup')) {
        onClose();
      }
    };
    // 延迟绑定，避免当前 click 事件立即触发关闭
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  if (!pos) return null;

  return createPortal(
    <div className="color-palette-popup" style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}>
      <div className="color-palette-grid">
        {showNoColor && (
          <button
            className={`color-swatch no-color-swatch${activeColor === null || activeColor === 'transparent' ? ' active' : ''}`}
            onClick={() => { onApply(null); onClose(); }}
            title="无背景色"
          >
            <span className="no-color-line" />
          </button>
        )}
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            className={`color-swatch${activeColor === c ? ' active' : ''}`}
            style={{ backgroundColor: c }}
            onClick={() => { onApply(c); onClose(); }}
            title={c}
          />
        ))}
      </div>
      <div className="color-custom-row">
        <input
          type="color"
          value={customColor}
          onChange={(e) => onCustomColorChange(e.target.value)}
        />
        <button className="color-custom-apply" onClick={() => { onApply(customColor); onClose(); }}>应用</button>
      </div>
    </div>,
    document.body,
  );
}

/** 文字颜色选择器 */
function ColorPickerButton() {
  const rootEditor = useCellValue(rootEditor$);
  const [open, setOpen] = useState(false);
  const [customColor, setCustomColor] = useState('#ff0000');
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const savedSelection = useRef<RangeSelection | null>(null);

  // 监听选区变化 + 内容变化，实时更新按钮状态
  useEffect(() => {
    if (!rootEditor) return;
    const readColor = () => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const val = $getSelectionStyleValueForProperty(selection, 'color', '');
        setActiveColor(val || null);
      } else {
        setActiveColor(null);
      }
    };
    // 内容变化时更新
    const unsubUpdate = rootEditor.registerUpdateListener(({ editorState }) => {
      editorState.read(readColor);
    });
    // 选区变化时更新（点击、键盘移动光标等）
    const unsubSelection = rootEditor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => { readColor(); return false; },
      1,
    );
    return () => { unsubUpdate(); unsubSelection(); };
  }, [rootEditor]);

  const handleOpen = useCallback(() => {
    if (rootEditor) {
      rootEditor.getEditorState().read(() => {
        const sel = $getSelection();
        if ($isRangeSelection(sel)) {
          savedSelection.current = sel.clone() as RangeSelection;
        }
      });
    }
    setOpen((v) => !v);
  }, [rootEditor]);

  const applyColor = useCallback((color: string | null) => {
    if (!rootEditor) return;
    rootEditor.update(() => {
      let selection = $getSelection();
      if ((!selection || !$isRangeSelection(selection)) && savedSelection.current) {
        selection = savedSelection.current;
      }
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { color });
      }
    });
    setActiveColor(color);
  }, [rootEditor]);

  return (
    <>
      <button
        ref={btnRef}
        className={`color-trigger-btn${activeColor ? ' has-color' : ''}`}
        onClick={handleOpen}
        title="文字颜色"
      >
        <span className="color-trigger-label">A</span>
        <span className="color-trigger-bar" style={{ backgroundColor: activeColor || 'currentColor' }} />
      </button>
      {open && (
        <ColorPalettePopup
          anchorRef={btnRef}
          activeColor={activeColor}
          customColor={customColor}
          onCustomColorChange={setCustomColor}
          onApply={applyColor}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/** 背景色选择器 */
function BgColorPickerButton() {
  const rootEditor = useCellValue(rootEditor$);
  const [open, setOpen] = useState(false);
  const [customColor, setCustomColor] = useState('#ffff00');
  const [activeBg, setActiveBg] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const savedSelection = useRef<RangeSelection | null>(null);

  useEffect(() => {
    if (!rootEditor) return;
    const readBg = () => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const val = $getSelectionStyleValueForProperty(selection, 'background-color', '');
        setActiveBg(val || null);
      } else {
        setActiveBg(null);
      }
    };
    const unsubUpdate = rootEditor.registerUpdateListener(({ editorState }) => {
      editorState.read(readBg);
    });
    const unsubSelection = rootEditor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => { readBg(); return false; },
      1,
    );
    return () => { unsubUpdate(); unsubSelection(); };
  }, [rootEditor]);

  const handleOpen = useCallback(() => {
    if (rootEditor) {
      rootEditor.getEditorState().read(() => {
        const sel = $getSelection();
        if ($isRangeSelection(sel)) {
          savedSelection.current = sel.clone() as RangeSelection;
        }
      });
    }
    setOpen((v) => !v);
  }, [rootEditor]);

  const applyBgColor = useCallback((color: string | null) => {
    if (!rootEditor) return;
    rootEditor.update(() => {
      let selection = $getSelection();
      if ((!selection || !$isRangeSelection(selection)) && savedSelection.current) {
        selection = savedSelection.current;
      }
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'background-color': color });
      }
    });
    setActiveBg(color);
  }, [rootEditor]);

  return (
    <>
      <button
        ref={btnRef}
        className={`color-trigger-btn bgcolor-trigger${activeBg ? ' has-color' : ''}`}
        onClick={handleOpen}
        title="背景颜色"
      >
        <span className="color-trigger-label" style={{ backgroundColor: activeBg || 'transparent' }}>A</span>
      </button>
      {open && (
        <ColorPalettePopup
          anchorRef={btnRef}
          activeColor={activeBg}
          customColor={customColor}
          onCustomColorChange={setCustomColor}
          onApply={applyBgColor}
          onClose={() => setOpen(false)}
          showNoColor
        />
      )}
    </>
  );
}

export default function Notepad() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [activeNote, setActiveNote] = useState<NoteItem | null>(null);
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [displayMode, setDisplayMode] = useState<'normal' | 'minimal' | 'floatball'>('normal');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef(null);
  const activeNoteRef = useRef<NoteItem | null>(null);
  const contentRef = useRef('');
  const switchingRef = useRef(false);
  const [diffMarkdown, setDiffMarkdown] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const editNameInputRef = useRef<HTMLInputElement>(null);

  const loadNotes = useCallback(async () => {
    const list = (await window.ttool.invoke('notepad:list')) as NoteItem[];
    setNotes(list);
    return list;
  }, []);

  const syncRoutes = useCallback(async () => {
    await window.ttool.invoke('notepad:sync-routes');
  }, []);

  const selectNote = useCallback(async (note: NoteItem) => {
    if (activeNoteRef.current?.fileName === note.fileName) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    switchingRef.current = true;
    if (activeNoteRef.current) {
      await saveCurrentNote();
    }
    const text = (await window.ttool.invoke('notepad:read', note.fileName)) as string;
    activeNoteRef.current = note;
    contentRef.current = text;
    setActiveNote(note);
    setContent(text);
    setDiffMarkdown(text);
    setTimeout(() => {
      switchingRef.current = false;
    }, 0);
  }, []);

  const saveCurrentNote = useCallback(async () => {
    if (!activeNoteRef.current) return;
    setIsSaving(true);
    try {
      await window.ttool.invoke('notepad:save', activeNoteRef.current.fileName, contentRef.current);
      await loadNotes();
    } finally {
      setIsSaving(false);
    }
  }, [loadNotes]);

  // 监听显示模式变化
  useEffect(() => {
    window.ttool?.displayMode.get().then(setDisplayMode);
    const off = window.ttool?.displayMode.onChanged((mode) => {
      setDisplayMode(mode);
    });
    return () => { off?.(); };
  }, []);

  // 初始化：加载笔记列表，根据 URL hash 选择笔记
  useEffect(() => {
    loadNotes().then((list) => {
      const fileName = getFileNameFromHash();
      if (fileName) {
        const match = list.find((n) => n.fileName === fileName);
        if (match) {
          selectNote(match);
          return;
        }
      }
      // 没有匹配的 hash 或无 hash，选中第一个笔记并更新 hash
      if (list.length > 0) {
        selectNote(list[0]);
        window.location.hash = `/notepad/${encodeURIComponent(list[0].fileName)}`;
      }
    });
  }, []);

  // 监听 hash 变化，切换笔记
  useEffect(() => {
    const handleHashChange = () => {
      const fileName = getFileNameFromHash();
      if (!fileName) return;
      // 找到对应的笔记
      loadNotes().then((list) => {
        const match = list.find((n) => n.fileName === fileName);
        if (match) {
          selectNote(match);
        }
      });
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [selectNote, loadNotes]);

  const handleContentChange = (newContent: string) => {
    if (switchingRef.current) return;
    setContent(newContent);
    contentRef.current = newContent;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    const currentFileName = activeNoteRef.current?.fileName;
    saveTimerRef.current = setTimeout(() => {
      if (currentFileName) {
        window.ttool.invoke('notepad:save', currentFileName, newContent);
        loadNotes();
      }
    }, 500);
  };

  const handleCreate = async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    switchingRef.current = true;
    if (activeNoteRef.current) {
      await saveCurrentNote();
    }
    const now = new Date();
    const name = `笔记 ${now.getMonth() + 1}-${now.getDate()} ${now.getHours()}.${String(now.getMinutes()).padStart(2, '0')}`;
    const fileName = (await window.ttool.invoke('notepad:create', name)) as string;
    await syncRoutes();
    const list = await loadNotes();
    const newNote = list.find((n) => n.fileName === fileName);
    if (newNote) {
      activeNoteRef.current = newNote;
      contentRef.current = '';
      setActiveNote(newNote);
      setContent('');
      setDiffMarkdown('');
      window.location.hash = `/notepad/${encodeURIComponent(newNote.fileName)}`;
    }
    setTimeout(() => {
      switchingRef.current = false;
    }, 0);
  };

  const handleRename = useCallback(async () => {
    if (!activeNoteRef.current) return;
    const newName = editNameValue.trim();
    if (!newName || newName === activeNoteRef.current.name) {
      setEditingName(false);
      return;
    }
    const oldFileName = activeNoteRef.current.fileName;
    const newFileName = `${newName}.md`;
    await window.ttool.invoke('notepad:rename', oldFileName, newFileName);
    await syncRoutes();
    const list = await loadNotes();
    const updated = list.find((n) => n.fileName === newFileName);
    if (updated) {
      activeNoteRef.current = updated;
      setActiveNote(updated);
      window.location.hash = `/notepad/${encodeURIComponent(newFileName)}`;
    }
    setEditingName(false);
  }, [editNameValue, syncRoutes, loadNotes]);

  const startEditName = useCallback(() => {
    if (!activeNoteRef.current) return;
    setEditNameValue(activeNoteRef.current.name);
    setEditingName(true);
    setTimeout(() => editNameInputRef.current?.focus(), 0);
  }, []);

  const handleDelete = async (note: NoteItem) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const isActiveNote = activeNoteRef.current?.fileName === note.fileName;
    if (isActiveNote) {
      activeNoteRef.current = null;
    }
    await window.ttool.invoke('notepad:delete', note.fileName);
    await syncRoutes();
    const list = await loadNotes();
    if (isActiveNote) {
      if (list.length > 0) {
        selectNote(list[0]);
        window.location.hash = `/notepad/${encodeURIComponent(list[0].fileName)}`;
      } else {
        setActiveNote(null);
        setContent('');
        setDiffMarkdown('');
        window.location.hash = '/notepad';
      }
    }
  };

  // 点击编辑区空白处时聚焦编辑器
  const handleEditorAreaClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('[contenteditable]') && !target.closest('.mdxeditor-toolbar')) {
      const ce = (e.currentTarget as HTMLElement).querySelector('[contenteditable="true"]');
      if (ce instanceof HTMLElement) {
        ce.focus();
      }
    }
  }, []);

  const isMinimal = displayMode === 'minimal';

  return (
    <div className={`notepad${isMinimal ? ' minimal' : ''}`}>
      <main className="notepad-editor" onClick={handleEditorAreaClick}>
        {activeNote ? (
          <>
            <div className="editor-header">
              <div className="editor-title-group">
                {editingName ? (
                  <input
                    ref={editNameInputRef}
                    className="editor-title-input"
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename();
                      if (e.key === 'Escape') setEditingName(false);
                    }}
                    onBlur={handleRename}
                  />
                ) : (
                  <>
                    <span className="editor-title">{activeNote.name}</span>
                    <button className="btn-edit-name" onClick={startEditName} title="重命名">✎</button>
                  </>
                )}
              </div>
              <div className="editor-actions">
                <button className="btn-baseline" onClick={() => setDiffMarkdown(contentRef.current)} title="创建基线">⇓</button>
                <button className="btn-new" onClick={handleCreate} title="新建笔记">+</button>
                <button className="btn-delete-header" onClick={() => { if (confirm(`确定删除「${activeNote.name}」吗？`)) handleDelete(activeNote); }} title="删除笔记">&times;</button>
                {isSaving && <span className="saving-hint">保存中...</span>}
              </div>
            </div>
            <MDXEditor
              key={activeNote.fileName}
              ref={editorRef}
              markdown={content}
              onChange={handleContentChange}
              plugins={[
                headingsPlugin(),
                listsPlugin(),
                quotePlugin(),
                thematicBreakPlugin(),
                markdownShortcutPlugin(),
                linkPlugin(),
                imagePlugin(),
                tablePlugin(),
                codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
                codeMirrorPlugin({ codeBlockLanguages: { js: 'JavaScript', css: 'CSS', txt: 'text', tsx: 'TypeScript', python: 'Python', html: 'HTML' } }),
                diffSourcePlugin({ viewMode: 'rich-text', readOnlyDiff: false, diffMarkdown }),
                textStylePlugin(),
                toolbarPlugin({
                  toolbarContents: () => (
                    <>
                      <UndoRedo />
                      <Separator />
                      <BoldItalicUnderlineToggles />
                      <StrikeThroughSupSubToggles />
                      <Separator />
                      <BlockTypeSelect />
                      <ListsToggle />
                      <Separator />
                      <CreateLink />
                      <InsertImage />
                      <InsertTable />
                      <InsertThematicBreak />
                      <InsertCodeBlock />
                      <Separator />
                      <ColorPickerButton />
                      <BgColorPickerButton />
                      <Separator />
                      <DiffSourceToggleWrapper>
                        <></>
                      </DiffSourceToggleWrapper>
                    </>
                  ),
                }),
              ]}
              contentEditableClassName="editor-content"
            />
          </>
        ) : (
          <div className="editor-empty">
            <p>点击左侧笔记或新建一个笔记</p>
            <button className="btn-new-main" onClick={handleCreate}>新建笔记</button>
          </div>
        )}
      </main>
    </div>
  );
}
