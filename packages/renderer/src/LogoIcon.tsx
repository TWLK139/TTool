interface LogoIconProps {
  width?: number;
  height?: number;
  className?: string;
}

export default function LogoIcon({ width = 28, height = 28, className }: LogoIconProps) {
  return (
    <img src="./icon.svg" alt="TTool" width={width} height={height} className={className} />
  );
}
