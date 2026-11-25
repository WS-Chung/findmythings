import { useState } from "react";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import "./ImagePreview.css";

export interface ImagePreviewProps {
  imageUrl: string;
  /** 물품 이름. 대화상자 제목과 이미지 대체 글에 쓴다. */
  alt: string;
  onClose: () => void;
}

/**
 * 300×300 사진 보기 대화상자.
 *
 * 닫기: × 버튼, 배경 클릭, Esc (Dialog가 처리).
 * 이미지 로드에 실패하면 "이미지를 불러오지 못했습니다" 문장으로 바뀐다.
 *
 * 부모는 사진 아이콘을 눌렀을 때만 이 컴포넌트를 마운트하므로, 사진이 없는 행에는
 * `<img>`가 DOM에 존재하지 않는다.
 */
export function ImagePreview({ imageUrl, alt, onClose }: ImagePreviewProps) {
  const [failed, setFailed] = useState(false);

  return (
    <Dialog title={alt} width={380} onClose={onClose}>
      <div className="image-preview__frame">
        {failed ? (
          <p className="err" role="alert">
            <Icon name="alert" />
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
    </Dialog>
  );
}
