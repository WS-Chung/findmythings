import type { ReactNode } from "react";

/**
 * 16px 회색 선 아이콘 모음. 아이콘은 이 파일에 추가한다.
 * 색은 부모의 글자색(currentColor)을 따른다.
 */
const PATHS = {
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.4 10.4L14 14" />
    </>
  ),
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  chevron: <path d="M6 3.5L10.5 8 6 12.5" />,
  alert: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.8v3.8M8 10.9v.1" />
    </>
  ),
  plus: <path d="M8 3v10M3 8h10" />,
  move: (
    <path d="M8 2v12M2 8h12M6.2 3.8L8 2l1.8 1.8M6.2 12.2L8 14l1.8-1.8M3.8 6.2L2 8l1.8 1.8M12.2 6.2L14 8l-1.8 1.8" />
  ),
  pin: (
    <>
      <path d="M8 14.2s4.6-4.3 4.6-7.6a4.6 4.6 0 0 0-9.2 0c0 3.3 4.6 7.6 4.6 7.6z" />
      <circle cx="8" cy="6.6" r="1.6" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export interface IconProps {
  name: IconName;
  className?: string;
}

export function Icon({ name, className }: IconProps) {
  return (
    <svg
      className={className ? `ic ${className}` : "ic"}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
