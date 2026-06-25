import type { ChangeEvent } from "react";
import "./SearchInput.css";

export interface SearchInputProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

/**
 * 검색바 (요구 7.1, 14.3).
 *
 * design 토큰 `search-input` 사양:
 *   - 배경: canvas (#ffffff)
 *   - 텍스트: ink (#1d1d1f)
 *   - 타이포: body (17px / 400 / -0.374px)
 *   - 반경: pill (9999px)
 *   - 패딩: 12px × 20px, height 44px
 *   - focus: primary-focus border (디자인 시스템 상 outline 토큰이 없으므로 border-color 변경)
 *
 * Controlled component. 디바운스/검색 트리거는 부모(App)가 useDebounce + useSearch로 처리한다.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "물품 또는 #해시태그 검색",
}: SearchInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <input
      type="search"
      className="search-input"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      aria-label="물품 검색"
    />
  );
}
