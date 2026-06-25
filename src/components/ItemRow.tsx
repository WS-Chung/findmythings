import type { Item } from "../types/db";
import "./ItemRow.css";

export interface ItemRowProps {
  item: Item;
  /** 0 = Parent_Item, 1 = Child_Item (좌측 들여쓰기) */
  indent: number;
  /** 📷 아이콘 클릭 → ImagePreview 오픈. image_url이 있는 행에서만 호출된다. */
  onPhotoClick: (item: Item) => void;
  /** "수정" 클릭 → 부모(ItemPopup)에서 RegisterForm을 edit 모드로 오픈. */
  onEdit: (item: Item) => void;
  /** "삭제" 클릭 → 부모에서 ConfirmDialog 오픈. */
  onDelete: (item: Item) => void;
}

/**
 * Item_Popup의 한 행.
 *
 * 레이아웃: CSS grid 3컬럼.
 *   [lead: 이름 + 사진]  [해시태그]  [수정/삭제]
 *
 * - 각 컬럼의 폭이 고정되어 있어 이름 길이가 달라도 세 영역이 좌우로 정렬된다.
 *   이름이 컬럼 폭을 넘으면 ellipsis 처리.
 * - 들여쓰기는 lead 컬럼 안의 padding-left로 처리해 grid 정렬을 깨지 않는다.
 * - 해시태그가 없는 행에는 빈 placeholder를 렌더링해 grid cell 자리를 유지한다.
 * - 사진 아이콘(📷)은 `item.image_url`이 truthy일 때만 노출 (요구 2.5, 2.6).
 * - "수정"/"삭제" 버튼은 부모로 위임(onEdit/onDelete).
 */
export function ItemRow({
  item,
  indent,
  onPhotoClick,
  onEdit,
  onDelete,
}: ItemRowProps) {
  const handlePhotoClick = () => {
    if (item.image_url) onPhotoClick(item);
  };

  const handleEditClick = () => {
    onEdit(item);
  };

  const handleDeleteClick = () => {
    onDelete(item);
  };

  return (
    <li
      className={`item-row item-row--indent-${indent}`}
      data-item-id={item.id}
    >
      <div className="item-row__lead">
        <span className="item-row__name">{item.name}</span>
        {item.image_url ? (
          <button
            type="button"
            className="item-row__photo"
            onClick={handlePhotoClick}
            aria-label={`${item.name} 사진 보기`}
          >
            📷
          </button>
        ) : null}
      </div>

      {item.hashtags.length > 0 ? (
        <ul className="item-row__tags" aria-label="해시태그">
          {item.hashtags.map((t, i) => (
            <li key={`${t}-${i}`} className="item-row__tag">
              #{t}
            </li>
          ))}
        </ul>
      ) : (
        <span className="item-row__tags-empty" aria-hidden="true" />
      )}

      <div className="item-row__actions">
        <button
          type="button"
          className="item-row__action"
          onClick={handleEditClick}
        >
          수정
        </button>
        <button
          type="button"
          className="item-row__action item-row__action--danger"
          onClick={handleDeleteClick}
        >
          삭제
        </button>
      </div>
    </li>
  );
}
