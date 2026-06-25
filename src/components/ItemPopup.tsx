import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useItems } from "../hooks/useItems";
import { TABLES } from "../lib/constants";
import { buildItemTree } from "../lib/itemTree";
import { supabase } from "../lib/supabase";
import type { Item, Location } from "../types/db";
import { ConfirmDialog } from "./ConfirmDialog";
import { ImagePreview } from "./ImagePreview";
import { ItemRow } from "./ItemRow";
import { RegisterForm } from "./RegisterForm";
import "./ItemPopup.css";

export interface ItemPopupProps {
  location: Location;
  onClose: () => void;
}

/** ItemPopup 내부에서 활성화될 수 있는 폼 모드. */
type FormMode = "register" | "edit" | null;

/**
 * 마커 클릭 시 표시되는 모달 (요구 2.2–2.9, 4.1, 5.1, 6.1).
 *
 * - 헤더: location.name (tagline 21/600)
 * - 본문:
 *     formMode === "register" → 빈 RegisterForm
 *     formMode === "edit"     → editingItem을 초기값으로 채운 RegisterForm
 *     그 외에는 useItems 결과를 buildItemTree로 평탄화 → ItemRow 렌더.
 * - 푸터: "물건 등록" 버튼 (formMode가 활성이면 숨김).
 *
 * 추가 모달:
 *   - ImagePreview: 사진 아이콘 클릭 시
 *   - ConfirmDialog: ItemRow의 "삭제" 클릭 시
 *
 * Esc 우선순위 (요구 2.8, 6.5):
 *   1) previewItem → 미리보기만 닫기
 *   2) deletingItem → 삭제 다이얼로그만 닫기
 *   3) formMode → 폼만 닫기
 *   4) 그 외 → 모달 자체 닫기 (mode=view 복귀)
 *
 * 백드롭 클릭도 위 우선순위와 동일하게 동작한다(ImagePreview/ConfirmDialog는
 * 자체 백드롭을 가지고 있으므로 이 컴포넌트의 백드롭에는 절대 도달하지 않는다).
 */
export function ItemPopup({ location, onClose }: ItemPopupProps) {
  const { data, loading, error, refetch } = useItems(location.id);
  const [previewItem, setPreviewItem] = useState<Item | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 부모/자식 트리화 + parent 후보 목록은 데이터가 바뀔 때만 다시 계산한다.
  const tree = useMemo(() => buildItemTree(data), [data]);
  const parentCandidates = useMemo(
    () => data.filter((i) => i.parent_id === null),
    [data],
  );

  // Esc 키 우선순위 (요구 2.8, 6.5).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (previewItem) {
        setPreviewItem(null);
        return;
      }
      if (deletingItem) {
        setDeletingItem(null);
        setDeleteError(null);
        return;
      }
      if (formMode) {
        setFormMode(null);
        setEditingItem(null);
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, previewItem, deletingItem, formMode]);

  // 백드롭 클릭 우선순위: ImagePreview/ConfirmDialog는 자체 백드롭에서 흡수되므로
  // 이 컴포넌트의 백드롭은 폼이 열려있을 때 폼만 닫고, 그 외에는 모달을 닫는다.
  const handleBackdropClick = () => {
    if (formMode) {
      setFormMode(null);
      setEditingItem(null);
      return;
    }
    onClose();
  };

  const stop = (e: MouseEvent) => {
    e.stopPropagation();
  };

  const handleRegisterClick = () => {
    setEditingItem(null);
    setFormMode("register");
  };

  const handleEditClick = (item: Item) => {
    setEditingItem(item);
    setFormMode("edit");
  };

  const handleDeleteClick = (item: Item) => {
    setDeleteError(null);
    setDeletingItem(item);
  };

  const handleDeleteCancel = () => {
    setDeletingItem(null);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    try {
      // Property 11: 부모 Item이면 자식 → 부모 순서로 두 번 호출한다.
      // 자식 Item이면 본인만 삭제하면 충분.
      if (deletingItem.parent_id === null) {
        const { error: delChildErr } = await supabase
          .from(TABLES.items)
          .delete()
          .eq("parent_id", deletingItem.id);
        if (delChildErr) throw new Error(delChildErr.message);
      }

      const { error: delErr } = await supabase
        .from(TABLES.items)
        .delete()
        .eq("id", deletingItem.id);
      if (delErr) throw new Error(delErr.message);

      setDeletingItem(null);
      setDeleteError(null);
      refetch();
    } catch (err) {
      // 요구 6: 다이얼로그 유지 + 에러 메시지 표시.
      console.error("[ItemPopup] delete failed:", err);
      setDeleteError("삭제에 실패했습니다");
    }
  };

  const handleFormClose = () => {
    setFormMode(null);
    setEditingItem(null);
  };
  const handleFormSaved = () => refetch();

  const titleId = `item-popup-title-${location.id}`;

  const confirmMessage = deletingItem
    ? deletingItem.parent_id === null
      ? `"${deletingItem.name}" 그리고 그 안의 모든 하위 물품을 삭제할까요?`
      : `"${deletingItem.name}"을(를) 삭제할까요?`
    : "";

  return (
    <div
      className="item-popup__backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={handleBackdropClick}
    >
      <div className="item-popup" onClick={stop}>
        <header className="item-popup__header">
          <h2 id={titleId} className="item-popup__title">
            {location.name}
          </h2>
          <button
            type="button"
            className="item-popup__close"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </header>

        <div className="item-popup__body">
          {formMode ? (
            <RegisterForm
              location={location}
              parentCandidates={parentCandidates}
              onClose={handleFormClose}
              onSaved={handleFormSaved}
              editItem={
                formMode === "edit" && editingItem ? editingItem : undefined
              }
            />
          ) : loading ? (
            <p className="item-popup__hint">불러오는 중...</p>
          ) : error ? (
            <p className="item-popup__hint" role="alert">
              물품 정보를 불러오지 못했습니다
            </p>
          ) : tree.length === 0 ? (
            <p className="item-popup__hint">등록된 물품이 없습니다</p>
          ) : (
            <ul className="item-popup__list">
              {tree.map(({ item, indent }) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  indent={indent}
                  onPhotoClick={setPreviewItem}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                />
              ))}
            </ul>
          )}
        </div>

        {formMode === null ? (
          <footer className="item-popup__footer">
            <button
              type="button"
              className="item-popup__register"
              onClick={handleRegisterClick}
            >
              물건 등록
            </button>
          </footer>
        ) : null}
      </div>

      {previewItem && previewItem.image_url ? (
        <ImagePreview
          imageUrl={previewItem.image_url}
          alt={previewItem.name}
          onClose={() => setPreviewItem(null)}
        />
      ) : null}

      {deletingItem ? (
        <ConfirmDialog
          message={confirmMessage}
          danger
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          errorMessage={deleteError}
        />
      ) : null}
    </div>
  );
}
