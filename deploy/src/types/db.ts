/**
 * Domain types for Find My Things.
 * Mirrors the SQL schema in `db/schema.sql` (tables prefixed with `fmt_`).
 */

export type UUID = string;

export interface Location {
  id: UUID;
  name: string;
  /** 0..1060, virtual canvas X coordinate. */
  x_pos: number;
  /** 0..740, virtual canvas Y coordinate. */
  y_pos: number;
}

/** 마커 위치 저장 후 화면 상태에 반영할 최소 정보. */
export type LocationPosition = Pick<Location, "id" | "x_pos" | "y_pos">;

export interface Item {
  id: UUID;
  location_id: UUID;
  /** length 1..20 */
  name: string;
  /** length 0..4, each element 1..20 */
  hashtags: string[];
  image_url: string | null;
  parent_id: UUID | null;
  /** ISO timestamptz */
  created_at: string;
}
