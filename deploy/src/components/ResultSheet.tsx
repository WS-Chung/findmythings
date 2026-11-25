import { useMemo } from "react";
import type { Item, Location, UUID } from "../types/db";
import { PhotoButton } from "./PhotoButton";
import { SheetGrid, type SheetColumn } from "./SheetGrid";

export interface SearchResultRow {
  item: Item;
  /** location_id에 매칭되는 Location. 시드 정합성이 깨지면 undefined일 수 있다. */
  location: Location | undefined;
  /** 하위 물품이면 그 상위 물품. */
  parent: Item | undefined;
}

export interface ResultSheetProps {
  results: SearchResultRow[];
  /** 등록된 물품 전체 수. 상태 막대의 "N개 중 M개"에 쓴다. */
  total: number;
  /** 사용자가 검색어를 입력한 상태 여부 (빈 상태 문구 분기). */
  hasQuery: boolean;
  state: "ready" | "loading" | "error";
  onRetry: () => void;
  /** 선택한 결과 행의 item.id. */
  selectedItemId: UUID | null;
  /** 행 선택 시 부모(App)의 마커 강조 핸들러로 위임한다. */
  onSelect: (item: Item) => void;
  /** 📷 클릭. image_url이 있는 행에서만 호출된다. */
  onPhotoClick: (item: Item) => void;
}

/**
 * 좌측(휴대폰에서는 아래) 검색 결과 표. 엑셀형 표(SheetGrid)를 쓴다.
 * 검색어가 없으면 전체 물품이 가나다순으로 보인다.
 */
export function ResultSheet({
  results,
  total,
  hasQuery,
  state,
  onRetry,
  selectedItemId,
  onSelect,
  onPhotoClick,
}: ResultSheetProps) {
  const columns = useMemo<SheetColumn<SearchResultRow>[]>(
    () => [
      {
        id: "name",
        header: "물건",
        width: 128,
        phoneWidth: 120,
        render: (r) => r.item.name,
        text: (r) => r.item.name,
      },
      {
        id: "photo",
        header: "사진",
        width: 44,
        phoneWidth: 44,
        align: "center",
        render: (r) =>
          r.item.image_url ? (
            <PhotoButton
              itemName={r.item.name}
              onClick={() => onPhotoClick(r.item)}
            />
          ) : null,
        text: (r) => (r.item.image_url ? "사진 있음" : ""),
      },
      {
        id: "location",
        header: "보관위치",
        width: 148,
        phoneWidth: 140,
        render: (r) => r.location?.name ?? "위치 미상",
        text: (r) => r.location?.name ?? "위치 미상",
      },
      {
        id: "parent",
        header: "상위 물품",
        width: 108,
        render: (r) => r.parent?.name ?? "",
        text: (r) => r.parent?.name ?? "",
      },
      {
        id: "tags",
        header: "해시태그",
        width: 180,
        render: (r) => r.item.hashtags.map((t) => `#${t}`).join(" "),
        text: (r) => r.item.hashtags.map((t) => `#${t}`).join(" "),
      },
    ],
    [onPhotoClick],
  );

  return (
    <div data-keep-highlight className="result-sheet">
      <SheetGrid
        rows={results}
        columns={columns}
        getRowId={(r) => r.item.id}
        selectedRowId={selectedItemId}
        onSelectRow={(r) => onSelect(r.item)}
        tabName="물품"
        ariaLabel="물품 검색 결과"
        state={state}
        emptyText={hasQuery ? "검색 결과가 없습니다" : "등록된 물품이 없습니다"}
        errorText="물품 정보를 불러오지 못했습니다"
        onRetry={onRetry}
        status={
          state === "ready" ? (
            <>
              <span>
                {hasQuery
                  ? `${total}개 중 ${results.length}개`
                  : `물품 ${total}개`}
              </span>
              <span className="sp" />
              <span>행을 누르면 평면도에 표시됩니다</span>
            </>
          ) : null
        }
      />
    </div>
  );
}
