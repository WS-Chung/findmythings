import { ALL_LABELS_MIN_WIDTH, CANVAS_W } from "../lib/constants";
import { labelWidth, markerBox, planLabelSides } from "../lib/markerPosition";
import { NEW_MARKER_ID, type UseMarkerEditorResult } from "../hooks/useMarkerEditor";
import type { Location, UUID } from "../types/db";
import { Marker } from "./Marker";

export interface MarkerLayerProps {
  locations: Location[];
  /** FloorPlan이 측정한 캔버스 폭(px). */
  wrapperWidth: number;
  /** 검색 결과로 강조된 수납장. */
  highlightedLocationId: UUID | null;
  /**
   * 물품 표(팝업)가 열려 있는 수납장. 있으면 어떤 마커를 골랐는지 알 수 있도록
   * 나머지 마커를 50% 투명도로 흐리게 한다.
   */
  openLocationId?: UUID | null;
  editor: Pick<
    UseMarkerEditorResult,
    | "editing"
    | "adding"
    | "positionOf"
    | "move"
    | "activeId"
    | "activate"
    | "newName"
    | "newPoint"
    | "moveNew"
  >;
  onMarkerClick: (locationId: UUID) => void;
}

/** 이름을 아직 입력하지 않았을 때 새 마커에 붙는 이름표. */
const NEW_MARKER_PLACEHOLDER_NAME = "새 수납장";

/**
 * 평면도 위의 모든 마커.
 *
 * 이름표는 강조된 마커와, 마커 수정 모드의 마커에만 보인다.
 * 수정 모드에서 평면도가 넓으면 모든 마커의 이름표를 서로 겹치지 않게 위/아래로 나눠
 * 보이고, 좁으면(휴대폰) 방금 잡은(= 선택한) 마커의 이름표만 보인다.
 * 선택한 마커는 삭제 대상이라 네이비 테두리로 따로 표시한다.
 *
 * 추가 모드: 아직 DB에 없는 새 마커를 맨 위에 그린다. 강조 링과 이름표(입력 중인
 * 이름)가 붙고, 끌거나 방향키로 옮길 수 있다. 기존 마커는 누를 수 없고 흐려진다.
 */
export function MarkerLayer({
  locations,
  wrapperWidth,
  highlightedLocationId,
  openLocationId = null,
  editor,
  onMarkerClick,
}: MarkerLayerProps) {
  const { editing, adding, positionOf, move, activeId, activate } = editor;
  const showAllLabels = editing && wrapperWidth >= ALL_LABELS_MIN_WIDTH;

  const sides = showAllLabels
    ? planLabelSides(
        locations.map((loc) => {
          const b = markerBox(positionOf(loc), wrapperWidth / CANVAS_W);
          return {
            id: loc.id,
            left: b.left,
            top: b.top,
            pinHeight: b.height,
            labelWidth: labelWidth(loc.name),
          };
        }),
      )
    : {};

  const newMarker: Location = {
    id: NEW_MARKER_ID,
    name: editor.newName.trim() || NEW_MARKER_PLACEHOLDER_NAME,
    x_pos: editor.newPoint.x,
    y_pos: editor.newPoint.y,
  };

  return (
    <>
      {locations.map((loc) => {
        const highlighted = loc.id === highlightedLocationId;
        return (
          <Marker
            key={loc.id}
            location={loc}
            position={positionOf(loc)}
            wrapperWidth={wrapperWidth}
            highlighted={highlighted}
            editing={editing}
            selected={editing && loc.id === activeId}
            faded={openLocationId !== null && loc.id !== openLocationId}
            showLabel={
              highlighted || showAllLabels || (editing && loc.id === activeId)
            }
            labelSide={sides[loc.id]}
            onClick={onMarkerClick}
            onMove={move}
            onActivate={activate}
          />
        );
      })}

      {adding ? (
        <Marker
          key={NEW_MARKER_ID}
          location={newMarker}
          position={editor.newPoint}
          wrapperWidth={wrapperWidth}
          highlighted
          editing
          showLabel
          onMove={(_id, point) => editor.moveNew(point)}
        />
      ) : null}
    </>
  );
}
