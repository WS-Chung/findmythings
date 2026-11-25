import type { KeyboardEvent, ReactNode, RefObject } from "react";
import type { UseMarkerEditorResult } from "../hooks/useMarkerEditor";
import { MAX_LOCATION_NAME_LEN } from "../lib/constants";
import { Icon } from "./Icon";
import "./FloorPlanPanel.css";

export interface FloorPlanPanelProps {
  /** 평면도 블록 자체의 위치. 휴대폰에서 검색 결과를 누르면 이 블록으로 스크롤한다. */
  panelRef: RefObject<HTMLElement>;
  /** 표시 중인 마커 수. */
  markerCount: number;
  /** 위치 정보를 불러오는 중. */
  loading: boolean;
  /** locations fetch가 실패하면 마커 대신 안내 문장과 다시 시도를 표시한다. */
  error?: Error | null;
  onRetry: () => void;
  /** 마커 수정(위치 옮기기·삭제) / 새 마커 추가 모드의 상태와 동작. */
  editor: Pick<
    UseMarkerEditorResult,
    | "editing"
    | "adding"
    | "changedCount"
    | "saving"
    | "error"
    | "notice"
    | "newName"
    | "setNewName"
    | "start"
    | "startAdd"
    | "cancel"
    | "save"
  >;
  /** 수정·추가 모드에 들어가기 직전에 화면 상태(강조 등)를 정리한다. */
  onModeStart: () => void;
  /** 마커 수정 모드에서 선택한 마커의 이름. 없으면 null. 삭제 버튼의 대상이다. */
  selectedName: string | null;
  /** "삭제" 버튼. 확인 대화상자는 부모가 띄운다. */
  onDeleteRequest: () => void;
  /** 삭제를 막는다. 지워지는 물품 수를 알 수 없을 때(물품을 아직 못 불러왔을 때) 쓴다. */
  deleteBlocked?: boolean;
  /** "마커 추가" 저장. 성공 뒤의 화면 처리(새 마커 강조)는 부모가 한다. */
  onAddSubmit: () => void;
  /** error가 없을 때 렌더할 자식(보통 `<FloorPlan>`). */
  children?: ReactNode;
}

/**
 * 평면도 블록: 제목 줄 + 평면도.
 *
 * 제목 줄은 세 가지 모양이다.
 *   - 평소: 마커 수(또는 방금 한 일의 결과), "마커 추가", "마커 수정"
 *   - 마커 수정: 안내 문장(선택한 마커 이름), 삭제(마커를 선택했을 때만 켜짐), 취소,
 *     변경 내용 저장(위치가 달라진 마커가 있을 때만 켜짐)
 *   - 마커 추가: 수납장 이름 입력, 안내 문장, 취소, 마커 추가(이름이 있을 때만 켜짐)
 * 제목 줄은 높이 32px로 고정해 모양이 바뀌어도 평면도가 움직이지 않는다(데스크톱).
 * 실패 문장은 제목 줄에 남고, 성공 문장은 몇 초 뒤 사라진다.
 */
export function FloorPlanPanel({
  panelRef,
  markerCount,
  loading,
  error,
  onRetry,
  editor,
  onModeStart,
  selectedName,
  onDeleteRequest,
  deleteBlocked = false,
  onAddSubmit,
  children,
}: FloorPlanPanelProps) {
  const {
    editing,
    adding,
    changedCount,
    saving,
    error: saveError,
    notice,
  } = editor;

  const handleStartEdit = () => {
    onModeStart();
    editor.start();
  };
  const handleStartAdd = () => {
    onModeStart();
    editor.startAdd();
  };

  const handleNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (editor.newName.trim().length > 0 && !saving) onAddSubmit();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      editor.cancel();
    }
  };

  const unavailable = loading || Boolean(error);
  const headClass = adding
    ? "map-pane__head map-pane__head--editing map-pane__head--adding"
    : editing
      ? "map-pane__head map-pane__head--editing"
      : "map-pane__head";

  return (
    <section
      className="map-pane"
      aria-labelledby="map-pane-title"
      ref={panelRef}
    >
      <div className={headClass}>
        <h2 id="map-pane-title">평면도</h2>

        {adding ? (
          <>
            <div className="map-pane__add">
              <label htmlFor="new-location-name">수납장 이름</label>
              <input
                id="new-location-name"
                className="inp"
                type="text"
                value={editor.newName}
                onChange={(e) => editor.setNewName(e.target.value)}
                onKeyDown={handleNameKeyDown}
                maxLength={MAX_LOCATION_NAME_LEN}
                autoFocus
                autoComplete="off"
                aria-invalid={saveError ? true : undefined}
              />
            </div>
            <p className="map-pane__note">
              {saveError ? (
                <span className="err" role="alert">
                  <Icon name="alert" />
                  {saveError}
                </span>
              ) : (
                <>
                  마커를 끌어서 위치를 정합니다.
                  <span className="map-pane__keys">
                    {" "}
                    방향키 1칸, Shift+방향키 10칸
                  </span>
                </>
              )}
            </p>
            <div className="map-pane__actions">
              <button
                type="button"
                className="btn btn-2"
                onClick={editor.cancel}
                disabled={saving}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn-1"
                onClick={onAddSubmit}
                disabled={saving || editor.newName.trim().length === 0}
              >
                {saving ? "저장 중" : "마커 추가"}
              </button>
            </div>
          </>
        ) : editing ? (
          <>
            <p className="map-pane__note">
              {saveError ? (
                <span className="err" role="alert">
                  <Icon name="alert" />
                  {saveError}
                </span>
              ) : notice ? (
                notice
              ) : (
                <>
                  {selectedName ? (
                    <>
                      선택: <b>{selectedName}</b>
                    </>
                  ) : (
                    <>
                      마커를 끌어서 옮기거나, 눌러서 선택해 삭제합니다.
                      <span className="map-pane__keys">
                        {" "}
                        방향키 1칸, Shift+방향키 10칸
                      </span>
                    </>
                  )}
                  {changedCount > 0 ? ` · 변경 ${changedCount}개` : ""}
                </>
              )}
            </p>
            <div className="map-pane__actions">
              <button
                type="button"
                className="btn btn-2"
                onClick={onDeleteRequest}
                disabled={saving || deleteBlocked || selectedName === null}
                aria-label={selectedName ? `${selectedName} 삭제` : "삭제"}
              >
                삭제
              </button>
              <button
                type="button"
                className="btn btn-2"
                onClick={editor.cancel}
                disabled={saving}
              >
                취소
              </button>
              <button
                type="button"
                className="btn btn-1"
                onClick={() => void editor.save()}
                disabled={saving || changedCount === 0}
              >
                {saving ? "저장 중" : "변경 내용 저장"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p
              className={
                notice
                  ? "map-pane__note map-pane__note--notice"
                  : "map-pane__note map-pane__count"
              }
              aria-live="polite"
            >
              {unavailable ? "" : notice ?? `마커 ${markerCount}개`}
            </p>
            <div className="map-pane__actions">
              <button
                type="button"
                className="btn btn-2"
                onClick={handleStartAdd}
                disabled={unavailable}
              >
                <Icon name="plus" />
                마커 추가
              </button>
              <button
                type="button"
                className="btn btn-2"
                onClick={handleStartEdit}
                disabled={unavailable || markerCount === 0}
              >
                <Icon name="move" />
                마커 수정
              </button>
            </div>
          </>
        )}
      </div>

      {error ? (
        <div className="map-pane__error err" role="alert">
          <Icon name="alert" />
          위치 정보를 불러오지 못했습니다
          <button type="button" className="btn btn-t sm" onClick={onRetry}>
            다시 시도
          </button>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
