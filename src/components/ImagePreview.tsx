import { useEffect, useState, type MouseEvent } from "react";
import "./ImagePreview.css";

export interface ImagePreviewProps {
  imageUrl: string;
  alt: string;
  onClose: () => void;
}

/**
 * 300×300 이미지 미리보기 모달 (요구 3.1–3.4).
 *
 * 닫기 트리거 (요구 3.3):
 *   - 백드롭(외부 영역) 클릭
 *   - 우상단 닫기 버튼(×)
 *   - Esc 키
 *
 * 이미지 로드 실패 시 onError로 "이미지를 불러오지 못했습니다" 텍스트 전환 (요구 3.4).
 *
 * 이 컴포넌트는 부모(ItemPopup)에서 사진 아이콘 클릭 시에만 마운트되므로
 * 사진 미존재 행에는 `<img>`가 DOM에 존재하지 않는다 (요구 3.1 = Property 4).
 */
export function ImagePreview({ imageUrl, alt, onClose }: ImagePreviewProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleBackdropClick = () => {
    onClose();
  };

  const stop = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="image-preview__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="사진 미리보기"
      onClick={handleBackdropClick}
    >
      <div className="image-preview" onClick={stop}>
        <button
          type="button"
          className="image-preview__close"
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>
        <div className="image-preview__frame">
          {failed ? (
            <p className="image-preview__error" role="alert">
              이미지를 불러오지 못했습니다
            </p>
          ) : (
            <img
              className="image-preview__img"
              src={imageUrl}
              alt={alt}
              width={300}
              height={300}
              onError={() => setFailed(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
