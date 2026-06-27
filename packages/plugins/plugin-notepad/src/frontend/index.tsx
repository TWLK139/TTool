import { useState, useEffect, useRef, useCallback } from 'react';
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
import { $patchStyleText } from '@lexical/selection';
import { $getSelection, $isRangeSelection } from 'lexical';
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

/** 文字颜色选择器按钮 */
function ColorPickerButton() {
  const rootEditor = useCellValue(rootEditor$);
  const [color, setColor] = useState('#ff0000');

  const applyColor = useCallback(() => {
    if (!rootEditor) return;
    rootEditor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { color });
      }
    });
  }, [rootEditor, color]);

  return (
    <div className="color-picker-btn" title="文字颜色">
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
      />
      <button className="color-picker-apply" onClick={applyColor}>
        <span className="color-indicator" style={{ color }}>A</span>
      </button>
    </div>
  );
}

/** 背景色选择器按钮 */
function BgColorPickerButton() {
  const rootEditor = useCellValue(rootEditor$);
  const [bgColor, setBgColor] = useState('#ffff00');

  const applyBgColor = useCallback(() => {
    if (!rootEditor) return;
    rootEditor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { 'background-color': bgColor });
      }
    });
  }, [rootEditor, bgColor]);

  return (
    <div className="color-picker-btn" title="背景颜色">
      <input
        type="color"
        value={bgColor}
        onChange={(e) => setBgColor(e.target.value)}
      />
      <button className="color-picker-apply" onClick={applyBgColor}>
        <span className="color-indicator" style={{ backgroundColor: bgColor }}>A</span>
      </button>
    </div>
  );
}

/** 清除文字颜色 */
function ClearColorButton() {
  const rootEditor = useCellValue(rootEditor$);

  const clearColor = useCallback(() => {
    if (!rootEditor) return;
    rootEditor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        $patchStyleText(selection, { color: null, 'background-color': null });
      }
    });
  }, [rootEditor]);

  return (
    <button className="color-clear-btn" onClick={clearColor} title="清除颜色">
      A̸
    </button>
  );
}

export default function Notepad() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [activeNote, setActiveNote] = useState<NoteItem | null>(null);
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef(null);
  const activeNoteRef = useRef<NoteItem | null>(null);
  const contentRef = useRef('');
  const switchingRef = useRef(false);
  const [diffMarkdown, setDiffMarkdown] = useState('');

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

  const handleDelete = async (note: NoteItem) => {
    await window.ttool.invoke('notepad:delete', note.fileName);
    await syncRoutes();
    const list = await loadNotes();
    if (activeNoteRef.current?.fileName === note.fileName) {
      if (list.length > 0) {
        selectNote(list[0]);
        window.location.hash = `/notepad/${encodeURIComponent(list[0].fileName)}`;
      } else {
        activeNoteRef.current = null;
        setActiveNote(null);
        setContent('');
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

  return (
    <div className="notepad">
      <main className="notepad-editor" onClick={handleEditorAreaClick}>
        {activeNote ? (
          <>
            <div className="editor-header">
              <span className="editor-title">{activeNote.name}</span>
              <div className="editor-actions">
                <button className="btn-baseline" onClick={() => setDiffMarkdown(contentRef.current)} title="创建基线">⇓</button>
                <button className="btn-new" onClick={handleCreate} title="新建笔记">+</button>
                <button className="btn-delete-header" onClick={() => handleDelete(activeNote)} title="删除笔记">&times;</button>
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
                      <ClearColorButton />
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
