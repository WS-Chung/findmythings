import { useEffect, useMemo, useState, type MouseEvent } from "react";
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
  /** 이미 해당 location_id로 필터된 items (App에서 메모리 캐시를 슬라이스해 전달). */
  items: Item[];
  /** 전체 items (수정 시 수납장 이동을 위해 다른 location의 parent 후보를 동적 계산). */
  allItems: Item[];
  /** 전체 locations (수정 시 수납장 이동 드롭다운 옵션). */
  locations: Location[];
  /** 전체 items prefetch가 실패했을 때만 not-null. 본문에 안내 텍스트로 노출된다. */
  itemsError: Error | null;
  /** 등록/수정/삭제 성공 후 App의 useAllItems.refetch()를 트리거한다. */
  onItemsChanged: () => void;
  onClose: () => void;
}

/** ItemPopup 내부에서 활성화될 수 있는 폼 모드. */
type FormMode = "register" | "edit" | null;

/**
 * 마커 클릭 시 표시되는 모달 (요구 2.2–2.9, 4.1, 5.1, 6.1).
 *
 * 데이터 소스:
 *   - 부모(App)가 useAllItems로 미리 가져온 전체 items 중 해당 location 슬라이스를
 *     props.items로 넘긴다. 따라서 자체적인 fetch / loading 상태가 없다.
 *   - 등록/수정/삭제 성공 시 props.onItemsChanged()로 전체 items 재조회를 트리거한다.
 *
 * - 헤더: location.name (tagline 21/600)
 * - 본문:
 *     formMode === "register" → 빈 RegisterForm
 *     formMode === "edit"     → editingItem을 초기값으로 채운 RegisterForm
 *     itemsError !== null     → "물품 정보를 불러오지 못했습니다"
 *     그 외에는 props.items를 buildItemTree로 평탄화 → ItemRow 렌더.
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
export function ItemPopup({
  location,
  items,
  allItems,
  locations,
  itemsError,
  onItemsChanged,
  onClose,
}: ItemPopupProps) {
  const [previewItem, setPreviewItem] = useState<Item | null>(null);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  /**
   * 현재 접힌 Parent_Item id 집합. 기본값은 "자식이 있는 모든 부모"로,
   * 마커 클릭 직후에는 최상위 항목만 보이는 상태가 된다.
   * items가 변하면(refetch 후) 같은 규칙으로 재설정한다.
   */
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(
    () => new Set(),
  );

  // 부모/자식 트리화 + parent 후보 목록은 데이터가 바뀔 때만 다시 계산한다.
  const tree = useMemo(() => buildItemTree(items), [items]);
  const parentCandidates = useMemo(
    () => items.filter((i) => i.parent_id === null),
    [items],
  );

  // tree가 갱신될 때마다 "자식 있는 부모"를 모두 접힌 상태로 리셋한다.
  useEffect(() => {
    const next = new Set<string>();
    for (const row of tree) {
      if (row.indent === 0 && row.hasChildren) {
        next.add(row.item.id);
      }
    }
    setCollapsedParents(next);
  }, [tree]);

  const handleToggleParent = (item: Item) => {
    setCollapsedParents((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  /**
   * collapsed=true인 부모 아래의 자식 행(indent=1)을 숨겨 렌더한다.
   * 자식의 부모는 item.parent_id로 식별되므로 추가 인덱스는 불필요.
   */
  const visibleTree = useMemo(
    () =>
      tree.filter((row) => {
        if (row.indent === 0) return true;
        const pid = row.item.parent_id;
        return pid === null || !collapsedParents.has(pid);
      }),
    [tree, collapsedParents],
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
      onItemsChanged();
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
  const handleFormSaved = () => onItemsChanged();

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
              locations={locations}
              allItems={allItems}
              parentCandidates={parentCandidates}
              onClose={handleFormClose}
              onSaved={handleFormSaved}
              editItem={
                formMode === "edit" && editingItem ? editingItem : undefined
              }
            />
          ) : itemsError ? (
            <p className="item-popup__hint" role="alert">
              물품 정보를 불러오지 못했습니다
            </p>
          ) : tree.length === 0 ? (
            <p className="item-popup__hint">등록된 물품이 없습니다</p>
          ) : (
            <ul className="item-popup__list">
              {visibleTree.map(({ item, indent, hasChildren }) => {
                const collapsible = indent === 0 && Boolean(hasChildren);
                return (
                  <ItemRow
                    key={item.id}
                    item={item}
                    indent={indent}
                    collapsible={collapsible}
                    collapsed={
                      collapsible ? collapsedParents.has(item.id) : false
                    }
                    onToggle={collapsible ? handleToggleParent : undefined}
                    onPhotoClick={setPreviewItem}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteClick}
                  />
                );
              })}
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
