import { useCallback, useMemo, useState } from "react";
import { TABLES } from "../lib/constants";
import { buildItemTree, type TreeRow } from "../lib/itemTree";
import { formatDate } from "../lib/sheet";
import { supabase } from "../lib/supabase";
import type { Item, Location, UUID } from "../types/db";
import { ConfirmDialog } from "./ConfirmDialog";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { ImagePreview } from "./ImagePreview";
import { PhotoButton } from "./PhotoButton";
import { RegisterForm } from "./RegisterForm";
import { SheetGrid, type SheetColumn } from "./SheetGrid";
import "./ItemPopup.css";

export interface ItemPopupProps {
  location: Location;
  /** 이미 해당 location_id로 필터된 items (App에서 메모리 캐시를 슬라이스해 전달). */
  items: Item[];
  /** 전체 items (수정 시 수납장 이동을 위해 다른 location의 parent 후보를 동적 계산). */
  allItems: Item[];
  /** 전체 locations (수정 시 수납장 이동 선택지). */
  locations: Location[];
  /** 전체 items prefetch가 실패했을 때만 not-null. */
  itemsError: Error | null;
  /** 등록/수정/삭제 성공 후 App의 useAllItems.refetch()를 트리거한다. */
  onItemsChanged: () => void;
  onClose: () => void;
}

/** ItemPopup 내부에서 활성화될 수 있는 폼 모드. */
type FormMode = "register" | "edit" | null;

interface NameCellProps {
  row: TreeRow;
  childCount: number;
  expanded: boolean;
  onToggle: (parentId: UUID) => void;
}

/** 이름 칸: 상위 물품은 접기 버튼과 하위 개수, 하위 물품은 들여쓰기. */
function NameCell({ row, childCount, expanded, onToggle }: NameCellProps) {
  const { item, indent, hasChildren } = row;
  return (
    <span className={indent === 1 ? "name-cell name-cell--child" : "name-cell"}>
      {hasChildren ? (
        <button
          type="button"
          className="name-cell__toggle"
          aria-expanded={expanded}
          aria-label={`${item.name} 하위 물품 ${expanded ? "접기" : "펼치기"}`}
          onClick={() => onToggle(item.id)}
        >
          <Icon name="chevron" />
        </button>
      ) : (
        <span className="name-cell__slot" aria-hidden="true" />
      )}
      <span className="name-cell__text">{item.name}</span>
      {hasChildren ? (
        <span className="name-cell__count">하위 {childCount}</span>
      ) : null}
    </span>
  );
}

/**
 * 마커를 눌렀을 때 열리는 수납장 대화상자: 물품 표 + 등록·수정·삭제.
 *
 * 데이터 소스:
 *   - 부모(App)가 useAllItems로 미리 가져온 전체 items 중 해당 location 슬라이스를
 *     props.items로 넘긴다. 자체적인 fetch / loading 상태가 없다.
 *   - 등록/수정/삭제 성공 시 props.onItemsChanged()로 전체 items 재조회를 트리거한다.
 *
 * 조작: 표에서 행을 고른 뒤 도구 막대의 "수정" / "삭제"를 누른다.
 *   Enter(또는 두 번 누름) = 수정, Delete 키 = 삭제 확인.
 *   상위 물품은 처음에 접혀 있고, 이름 앞의 화살표로 하위 물품을 펼친다.
 *
 * Esc 우선순위: 사진 보기 → 삭제 확인 → 등록/수정 폼 → 팝업 닫기.
 *   (겹친 대화상자는 Dialog가 맨 위 것만 닫는다. 사진 보기와 삭제 확인은 이 대화상자의
 *   형제로 렌더해 서로의 키·초점 처리가 섞이지 않게 한다.)
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
  const [selectedId, setSelectedId] = useState<UUID | null>(null);
  /** 펼쳐 둔 상위 물품. 기본은 비어 있어 모두 접힌 상태다. */
  const [expanded, setExpanded] = useState<Set<UUID>>(() => new Set());

  const tree = useMemo(() => buildItemTree(items), [items]);

  const childCount = useMemo(() => {
    const counts = new Map<UUID, number>();
    for (const i of items) {
      if (i.parent_id !== null) {
        counts.set(i.parent_id, (counts.get(i.parent_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [items]);

  /** 접힌 상위 물품 아래의 하위 행은 숨긴다. 상위가 없는 행은 항상 보인다. */
  const visibleTree = useMemo(() => {
    const parentIds = new Set(
      tree.filter((r) => r.indent === 0).map((r) => r.item.id),
    );
    return tree.filter((row) => {
      const pid = row.item.parent_id;
      return (
        row.indent === 0 || pid === null || !parentIds.has(pid) || expanded.has(pid)
      );
    });
  }, [tree, expanded]);

  /** 보이는 행 중 선택된 물품. 접혀서 사라졌거나 삭제됐으면 선택 없음. */
  const selected = useMemo(
    () => visibleTree.find((r) => r.item.id === selectedId)?.item ?? null,
    [visibleTree, selectedId],
  );

  const toggleParent = useCallback((parentId: UUID) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }, []);

  const closeForm = () => {
    setFormMode(null);
    setEditingItem(null);
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setFormMode("edit");
  };

  const handleRegister = () => {
    setEditingItem(null);
    setFormMode("register");
  };

  const handleDelete = (item: Item) => {
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
      // 상위 물품이면 하위 → 상위 순서로 두 번 지운다. 하위 물품이면 본인만.
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
      setSelectedId(null);
      onItemsChanged();
    } catch (err) {
      // 실패 시 대화상자를 유지하고 문장으로 알린다.
      console.error("[ItemPopup] delete failed:", err);
      setDeleteError("삭제에 실패했습니다");
    }
  };

  /** 저장 성공: 목록을 다시 불러오고, 하위 물품을 저장했다면 그 상위 물품을 펼쳐 보여 준다. */
  const handleFormSaved = (parentId: UUID | null) => {
    if (parentId !== null) {
      setExpanded((prev) => new Set(prev).add(parentId));
    }
    onItemsChanged();
  };

  const columns = useMemo<SheetColumn<TreeRow>[]>(
    () => [
      {
        id: "name",
        header: "물건",
        width: 170,
        phoneWidth: 140,
        text: (r) => r.item.name,
        render: (r) => (
          <NameCell
            row={r}
            childCount={childCount.get(r.item.id) ?? 0}
            expanded={expanded.has(r.item.id)}
            onToggle={toggleParent}
          />
        ),
      },
      {
        id: "photo",
        header: "사진",
        width: 48,
        phoneWidth: 44,
        align: "center",
        text: (r) => (r.item.image_url ? "사진 있음" : ""),
        render: (r) =>
          r.item.image_url ? (
            <PhotoButton
              itemName={r.item.name}
              onClick={() => setPreviewItem(r.item)}
            />
          ) : null,
      },
      {
        id: "tags",
        header: "해시태그",
        width: 200,
        phoneWidth: 150,
        text: (r) => r.item.hashtags.map((t) => `#${t}`).join(" "),
        render: (r) => r.item.hashtags.map((t) => `#${t}`).join(" "),
      },
      {
        id: "created",
        header: "등록일",
        width: 96,
        phoneWidth: 92,
        text: (r) => formatDate(r.item.created_at),
        render: (r) => formatDate(r.item.created_at),
      },
    ],
    [childCount, expanded, toggleParent],
  );

  const confirmMessage = deletingItem
    ? deletingItem.parent_id === null && (childCount.get(deletingItem.id) ?? 0) > 0
      ? `"${deletingItem.name}"과(와) 그 안의 하위 물품 ${childCount.get(deletingItem.id)}개를 삭제합니다. 되돌릴 수 없습니다.`
      : `"${deletingItem.name}"을(를) 삭제합니다. 되돌릴 수 없습니다.`
    : "";

  return (
    <>
      <Dialog
        title={location.name}
        note={`물품 ${items.length}개`}
        width={formMode ? 600 : 900}
        onClose={onClose}
        onEscape={() => (formMode ? closeForm() : onClose())}
        closeOnBackdrop={formMode === null}
      >
        {formMode ? (
          <RegisterForm
            location={location}
            locations={locations}
            allItems={allItems}
            onClose={closeForm}
            onSaved={handleFormSaved}
            editItem={
              formMode === "edit" && editingItem ? editingItem : undefined
            }
          />
        ) : (
          <div className="popup">
            <div className="popup__bar">
              <button
                type="button"
                className="btn btn-1"
                onClick={handleRegister}
              >
                물건 등록
              </button>
              <button
                type="button"
                className="btn btn-2"
                disabled={!selected}
                onClick={() => selected && handleEdit(selected)}
              >
                수정
              </button>
              <button
                type="button"
                className="btn btn-2"
                disabled={!selected}
                onClick={() => selected && handleDelete(selected)}
              >
                삭제
              </button>
            </div>

            <div className="popup__sheet">
              <SheetGrid
                rows={visibleTree}
                columns={columns}
                getRowId={(r) => r.item.id}
                selectedRowId={selected?.id ?? null}
                onSelectRow={(r) => setSelectedId(r.item.id)}
                onOpenRow={(r) => handleEdit(r.item)}
                onDeleteRow={(r) => handleDelete(r.item)}
                tabName={location.name}
                ariaLabel={`${location.name} 물품 목록`}
                state={itemsError ? "error" : "ready"}
                emptyText="등록된 물품이 없습니다"
                errorText="물품 정보를 불러오지 못했습니다"
                onRetry={onItemsChanged}
                status={
                  <>
                    <span>
                      {tree.length === visibleTree.length
                        ? `물품 ${items.length}개`
                        : `${items.length}개 중 ${visibleTree.length}개 표시`}
                    </span>
                    <span className="sp" />
                    <span>
                      {selected
                        ? `선택: ${selected.name}`
                        : "행을 고르면 수정·삭제할 수 있습니다"}
                    </span>
                  </>
                }
              />
            </div>
          </div>
        )}
      </Dialog>

      {previewItem && previewItem.image_url ? (
        <ImagePreview
          imageUrl={previewItem.image_url}
          alt={previewItem.name}
          onClose={() => setPreviewItem(null)}
        />
      ) : null}

      {deletingItem ? (
        <ConfirmDialog
          title="물건 삭제"
          message={confirmMessage}
          confirmLabel="삭제"
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          errorMessage={deleteError}
        />
      ) : null}
    </>
  );
}
