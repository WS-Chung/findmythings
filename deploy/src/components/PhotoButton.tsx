import type { MouseEvent } from "react";
import "./PhotoButton.css";

export interface PhotoButtonProps {
  itemName: string;
  onClick: () => void;
}

/**
 * 사진이 등록된 물건의 "사진 보기" 버튼.
 *
 * 사용자 지시로 이 📷 이모지만 의도적으로 유지한다. 이 앱의 다른 곳에는
 * 이모지·장식 아이콘을 쓰지 않는다. 사진이 있는 행에서만 그려야 한다.
 */
export function PhotoButton({ itemName, onClick }: PhotoButtonProps) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    // 행 선택과 분리한다.
    e.stopPropagation();
    onClick();
  };

  return (
    <button
      type="button"
      className="photo-btn"
      onClick={handleClick}
      aria-label={`${itemName} 사진 보기`}
    >
      📷
    </button>
  );
}
