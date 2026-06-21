import { useState, useEffect, useCallback, useRef } from 'react';
import type { NavRoute } from './types';
import { useTheme } from './contexts/ThemeContext';
import Notepad from './pages/Notepad';
import Example from './pages/Example';
import Welcome from './pages/Welcome';

/** 路由路径 -> 渲染组件映射（内嵌插件） */
const pluginComponents: Record<string, React.FC> = {
  '/notepad': Notepad,
  '/example': Example,
};

export default function App() {
  const [routes, setRoutes] = useState<NavRoute[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  // 初始化：获取路由 + 置顶状态 + 监听 hash
  useEffect(() => {
    window.ttool?.routes.get().then(setRoutes);
    window.ttool?.getAlwaysOnTop().then(setIsPinned);
    window.ttool?.isMaximized().then(setIsMaximized);

    // 监听路由更新
    const off = window.ttool?.routes.onUpdated(setRoutes);

    // 读取 hash 路由
    const syncHash = () => {
      const hash = window.location.hash.slice(1) || '/';
      setCurrentPath(hash);
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);

    return () => {
      off?.();
      window.removeEventListener('hashchange', syncHash);
    };
  }, []);

  // 点击外部关闭设置菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTogglePin = async () => {
    const newState = await window.ttool?.toggleAlwaysOnTop();
    setIsPinned(newState ?? false);
  };

  const handleReload = () => {
    window.ttool?.reload();
    setSettingsOpen(false);
    setThemeMenuOpen(false);
  };

  const handleOpenDevTools = () => {
    window.ttool?.openDevTools();
    setSettingsOpen(false);
    setThemeMenuOpen(false);
  };

  const handleMinimize = () => {
    window.ttool?.minimize();
  };

  const handleMaximize = async () => {
    await window.ttool?.maximize();
    const maximized = await window.ttool?.isMaximized();
    setIsMaximized(maximized ?? false);
  };

  const handleClose = () => {
    window.ttool?.close();
  };

  const navigate = useCallback((path: string, standalone?: boolean) => {
    if (standalone) {
      // 独立窗口插件：通知主进程打开新窗口
      const pluginName = path.slice(1); // '/example' -> 'example'
      window.ttool?.plugin.openStandalone(pluginName);
      return;
    }
    window.location.hash = path;
  }, []);

  // 排序路由
  const sortedRoutes = [...routes].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  // 查找当前匹配的一级路由
  const activeRoute = sortedRoutes.find((r) => currentPath.startsWith(r.path));

  // 渲染当前插件页面
  const renderPage = () => {
    if (!activeRoute) {
      return <Welcome />;
    }
    const Component = pluginComponents[activeRoute.path];
    if (!Component) {
      return (
        <div className="page-missing">
          <p>插件页面未注册: {activeRoute.path}</p>
        </div>
      );
    }
    return <Component />;
  };

  return (
    <div className="app">
      {/* 自定义标题栏 */}
      <div className="titlebar">
        <div className="titlebar-drag">
          <span className="titlebar-icon">⚡</span>
          <span className="titlebar-title">TTool</span>
        </div>
        <div className="titlebar-controls">
          <button className="titlebar-btn" onClick={handleMinimize} title="最小化">
            <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
          </button>
          <button className="titlebar-btn" onClick={handleMaximize} title={isMaximized ? '还原' : '最大化'}>
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1"/>
                <rect x="0" y="2" width="8" height="8" className="titlebar-restore-bg" stroke="currentColor" strokeWidth="1"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1"/>
              </svg>
            )}
          </button>
          <button className="titlebar-btn titlebar-btn-close" onClick={handleClose} title="关闭">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2"/>
              <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* 内容区：侧边导航 + 主内容 */}
      <div className="app-body">
        <nav className="app-nav">
        <div className="nav-header">
          <h1>TTool</h1>
        </div>
        <ul className="nav-list">
          {sortedRoutes.map((route) => {
            const isActive = activeRoute?.path === route.path;
            return (
              <li key={route.path} className={`nav-item ${isActive ? 'active' : ''}`}>
                <button
                  className="nav-item-btn"
                  onClick={() => navigate(route.path, route.standalone)}
                >
                  <span className="nav-icon">{route.icon ?? '📦'}</span>
                  <span className="nav-label">{route.title}</span>
                  {route.standalone && <span className="nav-badge">↗</span>}
                </button>
                {/* 二级路由 */}
                {isActive && route.children.length > 0 && (
                  <ul className="nav-sub-list">
                    {route.children
                      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
                      .map((sub) => (
                        <li key={sub.path} className="nav-sub-item">
                          <button
                            className={`nav-sub-btn ${currentPath === sub.path ? 'active' : ''}`}
                            onClick={() => navigate(sub.path)}
                          >
                            {sub.icon && <span className="nav-icon">{sub.icon}</span>}
                            {sub.title}
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        {/* 底部设置按钮 */}
        <div className="nav-footer" ref={settingsRef}>
          <button
            className="nav-settings-btn"
            onClick={() => setSettingsOpen(!settingsOpen)}
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">设置</span>
          </button>
          {settingsOpen && (
            <ul className="settings-menu">
              <li className="settings-menu-item theme-item">
                <button
                  className="settings-menu-item"
                  onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                >
                  {theme === 'dark' ? '🌙 深色模式' : '☀️ 浅色模式'}
                </button>
                {themeMenuOpen && (
                  <ul className="theme-submenu">
                    <li>
                      <button
                        className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                        onClick={() => { setTheme('light'); setThemeMenuOpen(false); }}
                      >
                        <span className="theme-option-check">{theme === 'light' ? '✓' : ''}</span>
                        ☀️ 浅色
                      </button>
                    </li>
                    <li>
                      <button
                        className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                        onClick={() => { setTheme('dark'); setThemeMenuOpen(false); }}
                      >
                        <span className="theme-option-check">{theme === 'dark' ? '✓' : ''}</span>
                        🌙 深色
                      </button>
                    </li>
                  </ul>
                )}
              </li>
              <li>
                <button className="settings-menu-item" onClick={handleTogglePin}>
                  {isPinned ? '📌 取消置顶' : '📍 窗口置顶'}
                </button>
              </li>
              <li>
                <button className="settings-menu-item" onClick={handleReload}>
                  🔄 刷新页面
                </button>
              </li>
              <li>
                <button className="settings-menu-item" onClick={handleOpenDevTools}>
                  🛠️ 打开控制台
                </button>
              </li>
            </ul>
          )}
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="app-main">
        {renderPage()}
      </main>
      </div>
    </div>
  );
}
