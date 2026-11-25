import { useEffect, useRef, type ChangeEvent } from "react";
import { Icon } from "./Icon";
import "./SearchInput.css";

export interface SearchInputProps {
  value: string;
  onChange: (next: string) => void;
}

/**
 * 검색 입력. 화면에 하나뿐이다.
 *
 * - 높이 32px, 앞에 돋보기. 휴대폰에서는 40px.
 * - `/` 키를 누르면(다른 입력칸에 있지 않을 때) 이 칸으로 이동한다.
 * - Controlled component. 디바운스는 부모가 useSearch로 처리한다.
 */
export function SearchInput({ value, onChange }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
        return;
      }
      // 대화상자가 열려 있으면 가로채지 않는다.
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="search" role="search">
      <label className="sr" htmlFor="search-input">
        물품 검색
      </label>
      <Icon name="search" />
      <input
        id="search-input"
        ref={inputRef}
        type="search"
        className="inp"
        value={value}
        onChange={handleChange}
        placeholder="물품 이름 또는 해시태그"
        autoComplete="off"
        enterKeyHint="search"
      />
      <kbd className="search__key" aria-hidden="true">
        /
      </kbd>
    </div>
  );
}
