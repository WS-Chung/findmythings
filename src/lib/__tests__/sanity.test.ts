import { describe, expect, it } from "vitest";
import {
  CANVAS_H,
  CANVAS_W,
  DEBOUNCE_MS,
  IMAGE_OUTPUT_SIZE,
  MARKER_HEIGHT,
  MARKER_WIDTH,
  MAX_HASHTAGS,
  MAX_HASHTAG_LEN,
  MAX_NAME_LEN,
  RPC,
  STORAGE_BUCKET,
  TABLES,
} from "../constants";
import { supabase } from "../supabase";

describe("sanity", () => {
  it("exposes canonical canvas geometry", () => {
    expect(CANVAS_W).toBe(1060);
    expect(CANVAS_H).toBe(740);
  });

  it("exposes validation/debounce/image constants", () => {
    expect(DEBOUNCE_MS).toBeGreaterThan(0);
    expect(MARKER_WIDTH).toBe(48);
    expect(MARKER_HEIGHT).toBe(32);
    expect(MAX_HASHTAGS).toBe(4);
    expect(MAX_NAME_LEN).toBe(20);
    expect(MAX_HASHTAG_LEN).toBe(20);
    expect(IMAGE_OUTPUT_SIZE).toBe(300);
  });

  it("uses fmt_-prefixed identifiers", () => {
    expect(STORAGE_BUCKET).toBe("fmt-item-images");
    expect(TABLES.locations).toBe("fmt_locations");
    expect(TABLES.items).toBe("fmt_items");
    expect(RPC.searchItems).toBe("fmt_search_items");
  });

  it("constructs a supabase client singleton", () => {
    // 실제 네트워크 호출은 하지 않고, 클라이언트 객체가 만들어졌는지만 확인한다.
    expect(supabase).toBeTruthy();
    expect(typeof supabase.from).toBe("function");
  });
});
