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

export type ItemInsert = Omit<Item, "id" | "created_at">;
export type ItemUpdate = Partial<Omit<Item, "id" | "created_at" | "location_id">>;

export type Mode = "view" | "register" | "edit";
