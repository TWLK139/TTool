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
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import './style.css';

interface NoteItem {
  name: string;
  fileName: string;
  updatedAt: number;
  createdAt: number;
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

  const loadNotes = useCallback(async () => {
    const list = (await window.ttool.invoke('notepad:list')) as NoteItem[];
    setNotes(list);
    return list;
  }, []);

  useEffect(() => {
    loadNotes().then((list) => {
      if (list.length > 0 && !activeNote) {
        selectNote(list[0]);
      }
    });
  }, []);

  const selectNote = async (note: NoteItem) => {
    if (activeNoteRef.current?.fileName === note.fileName) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    // 标记正在切换，屏蔽 onChange 期间的自动保存
    switchingRef.current = true;
    if (activeNoteRef.current) {
      await saveCurrentNote();
    }
    // 先异步加载新笔记内容，再同步更新 state，避免中间状态
    const text = (await window.ttool.invoke('notepad:read', note.fileName)) as string;
    activeNoteRef.current = note;
    contentRef.current = text;
    // 同时更新 activeNote 和 content，确保 MDXEditor 挂载时拿到正确内容
    setActiveNote(note);
    setContent(text);
    // 延迟解除切换标记，确保 MDXEditor 完成初始化后的 onChange 不被误判
    setTimeout(() => {
      switchingRef.current = false;
    }, 0);
  };

  const saveCurrentNote = async () => {
    if (!activeNoteRef.current) return;
    setIsSaving(true);
    try {
      await window.ttool.invoke('notepad:save', activeNoteRef.current.fileName, contentRef.current);
      await loadNotes();
    } finally {
      setIsSaving(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    // 切换笔记期间，MDXEditor 初始化触发的 onChange 应被忽略
    if (switchingRef.current) return;
    setContent(newContent);
    contentRef.current = newContent;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    // 在创建计时器时捕获当前 fileName，避免延迟读取 ref 导致保存到错误文件
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
    const list = await loadNotes();
    const newNote = list.find((n) => n.fileName === fileName);
    if (newNote) {
      activeNoteRef.current = newNote;
      contentRef.current = '';
      setActiveNote(newNote);
      setContent('');
    }
    setTimeout(() => {
      switchingRef.current = false;
    }, 0);
  };

  const handleDelete = async (note: NoteItem) => {
    await window.ttool.invoke('notepad:delete', note.fileName);
    const list = await loadNotes();
    if (activeNoteRef.current?.fileName === note.fileName) {
      if (list.length > 0) {
        selectNote(list[0]);
      } else {
        activeNoteRef.current = null;
        setActiveNote(null);
        setContent('');
      }
    }
  };

  const formatTime = (ms: number) => {
    const d = new Date(ms);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="notepad">
      <aside className="notepad-sidebar">
        <div className="sidebar-header">
          <span className="sidebar-title">笔记</span>
          <button className="btn-new" onClick={handleCreate} title="新建笔记">+</button>
        </div>
        <ul className="note-list">
          {notes.map((note) => (
            <li
              key={note.fileName}
              className={`note-item ${activeNote?.fileName === note.fileName ? 'active' : ''}`}
              onClick={() => selectNote(note)}
            >
              <div className="note-item-info">
                <span className="note-item-name">{note.name}</span>
                <span className="note-item-time">{formatTime(note.updatedAt)}</span>
              </div>
              <button
                className="btn-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(note);
                }}
                title="删除"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="notepad-editor">
        {activeNote ? (
          <>
            <div className="editor-header">
              <span className="editor-title">{activeNote.name}</span>
              {isSaving && <span className="saving-hint">保存中...</span>}
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
                diffSourcePlugin({ viewMode: 'rich-text', readOnlyDiff: false }),
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
