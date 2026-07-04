import { useState, useEffect, useCallback, useRef } from 'react';
import type { NavRoute, DisplayMode } from './types';
import { useTheme } from './contexts/ThemeContext';
import { useDisplayMode } from './contexts/DisplayModeContext';
import { pluginComponents } from './plugin-registry';
import Welcome from './pages/Welcome';

export default function App() {
  const [routes, setRoutes] = useState<NavRoute[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [showTitlebar, setShowTitlebar] = useState(true);
  const [floatballMenuOpen, setFloatballMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const settingsRef = useRef<HTMLDivElement>(null);
  const floatballRef = useRef<HTMLDivElement>(null);
  const floatballMenuRef = useRef<HTMLDivElement>(null);

  const { theme, setTheme } = useTheme();
  const { mode, setMode, previousPath } = useDisplayMode();

  useEffect(() => {
    window.ttool?.routes.get().then(setRoutes);
    window.ttool?.getAlwaysOnTop().then(setIsPinned);
    window.ttool?.isMaximized().then(setIsMaximized);

    const off = window.ttool?.routes.onUpdated(setRoutes);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
        setThemeMenuOpen(false);
        setModeMenuOpen(false);
      }
      if (floatballMenuRef.current && !floatballMenuRef.current.contains(e.target as Node)) {
        if (!floatballRef.current?.contains(e.target as Node)) {
          setFloatballMenuOpen(false);
          window.ttool?.floatball.restoreSize();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 浮球模式：窗口失焦时关闭菜单
  useEffect(() => {
    const handleBlur = () => {
      if (mode === 'floatball' && floatballMenuOpen) {
        setFloatballMenuOpen(false);
        window.ttool?.floatball.restoreSize();
      }
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [mode, floatballMenuOpen]);

  useEffect(() => {
    if (mode === 'minimal') {
      setShowTitlebar(false);
    } else {
      setShowTitlebar(true);
    }
    document.body.classList.toggle('floatball-active', mode === 'floatball');
  }, [mode]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (mode === 'minimal' && e.clientY < 10) {
        setShowTitlebar(true);
      } else if (mode === 'minimal' && e.clientY >= 10) {
        setShowTitlebar(false);
      }
    };

    if (mode === 'minimal') {
      document.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [mode]);

  const handleTogglePin = async () => {
    const newState = await window.ttool?.toggleAlwaysOnTop();
    setIsPinned(newState ?? false);
  };

  const handleReload = () => {
    window.ttool?.reload();
    setSettingsOpen(false);
    setThemeMenuOpen(false);
    setModeMenuOpen(false);
  };

  const handleOpenDevTools = () => {
    window.ttool?.openDevTools();
    setSettingsOpen(false);
    setThemeMenuOpen(false);
    setModeMenuOpen(false);
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
      const pluginName = path.slice(1);
      window.ttool?.plugin.openStandalone(pluginName);
      return;
    }
    window.location.hash = path;
  }, []);

  const handleModeChange = (newMode: DisplayMode) => {
    if (newMode === 'floatball') {
      setMode('floatball', currentPath);
    } else {
      setMode(newMode);
    }
    setModeMenuOpen(false);
    setSettingsOpen(false);
  };

  const handleFloatballDoubleClick = async () => {
    setFloatballMenuOpen(false);
    window.ttool?.floatball.restoreSize();
    const prevPath = await window.ttool?.floatball.getPreviousPath();
    if (prevPath) {
      window.location.hash = prevPath;
    }
    setMode('normal');
  };

  const handleFloatballRightClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!floatballMenuOpen) {
      await window.ttool?.floatball.expandWindow(240, 300);
    } else {
      await window.ttool?.floatball.restoreSize();
    }
    setFloatballMenuOpen(!floatballMenuOpen);
  };

  const handleFloatballMenuItemClick = (route: NavRoute) => {
    setFloatballMenuOpen(false);
    window.ttool?.floatball.restoreSize();
    if (!route.standalone) {
      window.location.hash = route.path;
    }
    setMode('normal');
  };

  const handleFloatballMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.screenX, y: e.screenY });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.screenX - dragStart.x;
        const deltaY = e.screenY - dragStart.y;
        window.ttool?.invoke('window:get-position').then((pos) => {
          const position = pos as { x: number; y: number };
          window.ttool?.floatball.moveWindow(position.x + deltaX, position.y + deltaY);
        });
        setDragStart({ x: e.screenX, y: e.screenY });
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const sortedRoutes = [...routes].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  const activeRoute = sortedRoutes.find((r) => currentPath.startsWith(r.path));

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

  if (mode === 'floatball') {
    return (
      <div className="floatball-container">
        <div
          ref={floatballRef}
          className="floatball"
          onMouseDown={handleFloatballMouseDown}
          onDoubleClick={handleFloatballDoubleClick}
          onContextMenu={handleFloatballRightClick}
        >
          <span className="floatball-icon">⚡</span>
        </div>
        {floatballMenuOpen && (
          <div ref={floatballMenuRef} className="floatball-menu">
            <div className="floatball-menu-header">
              <span>功能目录</span>
            </div>
            <ul className="floatball-menu-list">
              {sortedRoutes.map((route) => (
                <li key={route.path} className="floatball-menu-item">
                  <button
                    className="floatball-menu-item-btn"
                    onClick={() => handleFloatballMenuItemClick(route)}
                  >
                    <span className="floatball-menu-icon">{route.icon ?? '📦'}</span>
                    <span className="floatball-menu-label">{route.title}</span>
                    {route.standalone && <span className="floatball-menu-badge">↗</span>}
                  </button>
                </li>
              ))}
              <li className="floatball-menu-item">
                <button
                  className="floatball-menu-item-btn"
                  onClick={() => { setFloatballMenuOpen(false); window.ttool?.floatball.restoreSize(); setMode('normal'); }}
                >
                  <span className="floatball-menu-icon">🔙</span>
                  <span className="floatball-menu-label">恢复常规模式</span>
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`app ${mode}`}>
      <div className={`titlebar ${mode === 'minimal' && !showTitlebar ? 'hidden' : ''}`}>
        <div className="titlebar-drag">
          <span className="titlebar-icon">⚡</span>
          <span className="titlebar-title">TTool</span>
        </div>
        <div className="titlebar-controls">
          {mode === 'minimal' && (
            <button className="titlebar-btn" onClick={() => setMode('normal')} title="恢复常规模式">
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M2 8L5 5L8 8M5 5V2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
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

      <div className="app-body">
        <nav className={`app-nav ${mode === 'minimal' ? 'hidden' : ''}`}>
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
                <li className="settings-menu-item mode-item">
                  <button
                    className="settings-menu-item"
                    onClick={() => setModeMenuOpen(!modeMenuOpen)}
                  >
                    {mode === 'normal' ? '📱 常规模式' : mode === 'minimal' ? '📐 简约模式' : '⚽ 浮球模式'}
                  </button>
                  {modeMenuOpen && (
                    <ul className="mode-submenu">
                      <li>
                        <button
                          className={`mode-option ${mode === 'normal' ? 'active' : ''}`}
                          onClick={() => handleModeChange('normal')}
                        >
                          <span className="mode-option-check">{mode === 'normal' ? '✓' : ''}</span>
                          📱 常规模式
                        </button>
                      </li>
                      <li>
                        <button
                          className={`mode-option ${mode === 'minimal' ? 'active' : ''}`}
                          onClick={() => handleModeChange('minimal')}
                        >
                          <span className="mode-option-check">{mode === 'minimal' ? '✓' : ''}</span>
                          📐 简约模式
                        </button>
                      </li>
                      <li>
                        <button
                          className="mode-option"
                          onClick={() => handleModeChange('floatball')}
                        >
                          <span className="mode-option-check"></span>
                          ⚽ 浮球模式
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

        <main className="app-main">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}