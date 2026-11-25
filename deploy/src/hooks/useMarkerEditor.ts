import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CANVAS_H, CANVAS_W, TABLES } from "../lib/constants";
import {
  changedMarkers,
  type MarkerChange,
  type MarkerPoint,
} from "../lib/markerPosition";
import { supabase } from "../lib/supabase";
import { validateLocationName } from "../lib/validators";
import type { Location, LocationPosition, UUID } from "../types/db";

/** 추가하는 중인 마커(아직 DB에 없음)를 평면도에 그릴 때 쓰는 id. */
export const NEW_MARKER_ID = "new-marker";

/** 새 마커는 평면도 한가운데에서 시작한다. 사용자가 끌어서 위치를 정한다. */
const NEW_MARKER_START: MarkerPoint = {
  x: Math.round(CANVAS_W / 2),
  y: Math.round(CANVAS_H / 2),
};

const NOTICE_MS = 3500;

const POLICY_MISSING_ADD =
  "저장되지 않았습니다. Supabase에 db/schema.sql의 수납장 추가 정책을 적용했는지 확인하세요";
const POLICY_MISSING_MOVE =
  "저장되지 않았습니다. Supabase에 db/schema.sql의 수납장 수정 정책을 적용했는지 확인하세요";
const POLICY_MISSING_DELETE =
  "삭제되지 않았습니다. Supabase에 db/schema.sql의 수납장 삭제 정책을 적용했는지 확인하세요";

export interface UseMarkerEditorResult {
  /** idle: 평소, edit: 마커 수정 중(위치 옮기기·삭제), add: 새 마커 추가 중. 한 번에 하나만. */
  mode: "idle" | "edit" | "add";
  /** 마커 수정 모드인지. */
  editing: boolean;
  /** 새 마커 추가 모드인지. */
  adding: boolean;
  /** 아직 저장하지 않은, 위치가 달라진 마커 수 (수정 모드). */
  changedCount: number;
  saving: boolean;
  /** 저장 실패·입력 오류 문구. 다음 시도나 취소 때 지워진다. */
  error: string | null;
  /** 저장 성공 문구. 몇 초 뒤 사라진다. */
  notice: string | null;
  /** 수정 중이면 초안 위치, 아니면 DB 값. */
  positionOf: (loc: Location) => MarkerPoint;
  /**
   * 마커 수정 모드에서 방금 잡거나 초점을 받은 마커 = 선택한 마커.
   * "삭제"의 대상이고, 좁은 화면에서는 이 마커의 이름표만 보인다.
   */
  activeId: UUID | null;
  activate: (id: UUID) => void;
  /** 추가 모드: 입력 중인 수납장 이름과 새 마커의 위치. */
  newName: string;
  setNewName: (name: string) => void;
  newPoint: MarkerPoint;
  moveNew: (point: MarkerPoint) => void;
  start: () => void;
  startAdd: () => void;
  cancel: () => void;
  move: (id: UUID, point: MarkerPoint) => void;
  save: () => Promise<void>;
  /** 새 마커를 저장한다. 성공하면 새 수납장의 id, 실패하면 null. */
  submitAdd: () => Promise<UUID | null>;
  /**
   * 수납장(마커)을 지운다. 그 안의 물품도 DB의 on delete cascade 로 함께 지워진다.
   * 성공하면 null, 실패하면 사용자에게 보일 문장을 돌려준다.
   * 확인 대화상자는 호출하는 쪽이 먼저 거친다.
   */
  deleteLocation: (id: UUID) => Promise<string | null>;
}

export interface MarkerEditorActions {
  /** 위치 저장 후 화면 상태에 반영. */
  applyPositions: (rows: LocationPosition[]) => void;
  /** 새 수납장을 화면 상태에 추가. */
  addLocation: (row: Location) => void;
  /** 삭제한 수납장과 그 안의 물품을 화면 상태에서 뺀다. */
  removeLocation: (id: UUID) => void;
}

/**
 * 마커 수정(위치 옮기기·삭제) / 새 마커 추가 모드의 상태와 저장.
 *
 * 위치 수정
 *   - 끄는 동안의 위치는 `draft`에만 쌓고, "변경 내용 저장"에서 달라진 마커만 UPDATE 한다.
 *   - 일부만 실패하면 성공한 마커는 반영하고 실패한 마커의 초안은 남겨 다시 저장할 수 있게 한다.
 *   - RLS에 UPDATE 정책이 없으면 Supabase는 오류 없이 0행을 갱신한다. 그래서
 *     `.select()`로 돌려받은 행이 있어야만 성공으로 센다. (db/schema.sql 참고)
 *
 * 마커 삭제
 *   - 위치 수정과 달리 초안 없이 바로 DELETE 한다. (위치 초안과는 서로 영향이 없다)
 *   - DELETE 정책이 없으면 Supabase는 오류 없이 0행을 지우므로 위치 수정과 같이
 *     `.select()`로 돌려받은 행이 있어야만 성공으로 센다.
 *
 * 새 마커 추가
 *   - 이름과 위치를 한 번의 INSERT로 저장한다. 저장하기 전에는 DB에 아무것도 없다.
 *   - INSERT 정책이 없으면 Supabase가 오류(코드 42501)를 돌려준다.
 */
export function useMarkerEditor(
  locations: Location[],
  { applyPositions, addLocation, removeLocation }: MarkerEditorActions,
): UseMarkerEditorResult {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Record<UUID, MarkerPoint>>({});
  const [activeId, setActiveId] = useState<UUID | null>(null);
  const [newName, setNewNameState] = useState("");
  const [newPoint, setNewPoint] = useState<MarkerPoint>(NEW_MARKER_START);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  const changes = useMemo(
    () => changedMarkers(locations, draft),
    [locations, draft],
  );

  const positionOf = useCallback(
    (loc: Location): MarkerPoint => draft[loc.id] ?? { x: loc.x_pos, y: loc.y_pos },
    [draft],
  );

  const resetTransient = useCallback(() => {
    window.clearTimeout(noticeTimer.current);
    setNotice(null);
    setError(null);
    setDraft({});
    setActiveId(null);
  }, []);

  const start = useCallback(() => {
    resetTransient();
    setAdding(false);
    setEditing(true);
  }, [resetTransient]);

  const startAdd = useCallback(() => {
    resetTransient();
    setEditing(false);
    setNewNameState("");
    setNewPoint(NEW_MARKER_START);
    setAdding(true);
  }, [resetTransient]);

  const cancel = useCallback(() => {
    setEditing(false);
    setAdding(false);
    setDraft({});
    setActiveId(null);
    setError(null);
  }, []);

  const activate = useCallback((id: UUID) => setActiveId(id), []);

  const move = useCallback((id: UUID, point: MarkerPoint) => {
    setDraft((d) => ({ ...d, [id]: point }));
  }, []);

  const setNewName = useCallback((name: string) => {
    setNewNameState(name);
    setError(null); // 고치기 시작하면 이전 오류 문구는 지운다.
  }, []);

  const moveNew = useCallback((point: MarkerPoint) => setNewPoint(point), []);

  const save = useCallback(async () => {
    if (changes.length === 0) {
      setEditing(false);
      setDraft({});
      return;
    }
    setSaving(true);
    setError(null);

    const saved: LocationPosition[] = [];
    let policyMissing = false;
    let otherFailure = false;

    await Promise.all(
      changes.map(async (c: MarkerChange) => {
        try {
          const { data, error: updErr } = await supabase
            .from(TABLES.locations)
            .update({ x_pos: c.x, y_pos: c.y })
            .eq("id", c.id)
            .select("id, x_pos, y_pos");
          if (updErr) throw new Error(updErr.message);
          if (!data || data.length === 0) {
            policyMissing = true;
            return;
          }
          saved.push(data[0] as LocationPosition);
        } catch (err) {
          console.error("[useMarkerEditor] save failed:", err);
          otherFailure = true;
        }
      }),
    );

    if (saved.length > 0) applyPositions(saved);

    const failed = changes.length - saved.length;
    if (failed === 0) {
      setDraft({});
      setEditing(false);
      setActiveId(null);
      showNotice(`마커 ${saved.length}개의 위치를 저장했습니다`);
    } else {
      // 저장된 마커의 초안은 비우고, 실패한 마커의 초안만 남긴다.
      const savedIds = new Set(saved.map((s) => s.id));
      setDraft((d) =>
        Object.fromEntries(Object.entries(d).filter(([id]) => !savedIds.has(id))),
      );
      setError(
        policyMissing && !otherFailure
          ? POLICY_MISSING_MOVE
          : `마커 ${failed}개를 저장하지 못했습니다`,
      );
    }
    setSaving(false);
  }, [applyPositions, changes, showNotice]);

  const submitAdd = useCallback(async (): Promise<UUID | null> => {
    const check = validateLocationName(
      newName,
      locations.map((l) => l.name),
    );
    if (!check.ok) {
      setError(check.message);
      return null;
    }

    setSaving(true);
    setError(null);
    try {
      const name = newName.trim();
      const { data, error: insErr } = await supabase
        .from(TABLES.locations)
        .insert({ name, x_pos: newPoint.x, y_pos: newPoint.y })
        .select("id, name, x_pos, y_pos");

      if (insErr) {
        console.error("[useMarkerEditor] add failed:", insErr);
        // 42501: RLS 정책 위반(= INSERT 정책 없음)
        setError(
          insErr.code === "42501"
            ? POLICY_MISSING_ADD
            : "수납장을 추가하지 못했습니다",
        );
        return null;
      }
      const row = data?.[0] as Location | undefined;
      if (!row) {
        setError("수납장을 추가하지 못했습니다");
        return null;
      }

      addLocation(row);
      setAdding(false);
      showNotice(`수납장 "${row.name}"을(를) 추가했습니다`);
      return row.id;
    } catch (err) {
      console.error("[useMarkerEditor] add failed:", err);
      setError("수납장을 추가하지 못했습니다");
      return null;
    } finally {
      setSaving(false);
    }
  }, [addLocation, locations, newName, newPoint, showNotice]);

  const deleteLocation = useCallback(
    async (id: UUID): Promise<string | null> => {
      const target = locations.find((l) => l.id === id);
      try {
        const { data, error: delErr } = await supabase
          .from(TABLES.locations)
          .delete()
          .eq("id", id)
          .select("id");

        if (delErr) {
          console.error("[useMarkerEditor] delete failed:", delErr);
          // 42501: 권한 없음(= DELETE 권한·정책 없음)
          return delErr.code === "42501"
            ? POLICY_MISSING_DELETE
            : "수납장을 삭제하지 못했습니다";
        }
        if (!data || data.length === 0) return POLICY_MISSING_DELETE;
      } catch (err) {
        console.error("[useMarkerEditor] delete failed:", err);
        return "수납장을 삭제하지 못했습니다";
      }

      removeLocation(id);
      // 지운 마커의 위치 초안과 선택은 더는 의미가 없다.
      setDraft((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== id)));
      setActiveId((cur) => (cur === id ? null : cur));
      setError(null);
      showNotice(`수납장 "${target?.name ?? ""}"을(를) 삭제했습니다`);
      return null;
    },
    [locations, removeLocation, showNotice],
  );

  return {
    mode: adding ? "add" : editing ? "edit" : "idle",
    editing,
    adding,
    changedCount: changes.length,
    saving,
    error,
    notice,
    positionOf,
    activeId,
    activate,
    newName,
    setNewName,
    newPoint,
    moveNew,
    start,
    startAdd,
    cancel,
    move,
    save,
    submitAdd,
    deleteLocation,
  };
}
