import LogoIcon from '../LogoIcon';

export default function Welcome() {
  return (
    <div className="welcome-page">
      <LogoIcon width={48} height={48} className="welcome-logo" />
      <h2>欢迎使用 TTool</h2>
      <p>请从左侧导航选择一个工具开始使用。</p>
    </div>
  );
}
