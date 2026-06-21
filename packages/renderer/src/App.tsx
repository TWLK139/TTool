import { useState, useEffect } from 'react';

declare global {
  interface Window {
    ttool: {
      toggleAlwaysOnTop: (pin?: boolean) => Promise<boolean>;
      getAlwaysOnTop: () => Promise<boolean>;
    };
  }
}

function App() {
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    window.ttool?.getAlwaysOnTop().then(setIsPinned);
  }, []);

  const handleTogglePin = async () => {
    const newState = await window.ttool?.toggleAlwaysOnTop();
    setIsPinned(newState ?? false);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>TTool</h1>
        <button className="pin-btn" onClick={handleTogglePin}>
          {isPinned ? '📌 已置顶' : '📌 置顶'}
        </button>
      </header>
      <main className="app-main">
        <p>桌面日常工具集</p>
        <p className="hint">通过菜单栏「视图 → 窗口置顶」或点击上方按钮切换置顶模式</p>
      </main>
    </div>
  );
}

export default App;
