import { describe, expect, it } from "vitest";
import { buildItemTree } from "../itemTree";
import type { Item } from "../../types/db";

function makeItem(over: Partial<Item> & Pick<Item, "id">): Item {
  return {
    id: over.id,
    location_id: over.location_id ?? "loc-1",
    name: over.name ?? `item-${over.id}`,
    hashtags: over.hashtags ?? [],
    image_url: over.image_url ?? null,
    parent_id: over.parent_id ?? null,
    created_at: over.created_at ?? "2024-01-01T00:00:00.000Z",
  };
}

describe("buildItemTree", () => {
  it("returns empty array for empty input", () => {
    expect(buildItemTree([])).toEqual([]);
  });

  it("places parents (indent=0) before their children (indent=1)", () => {
    const p1 = makeItem({ id: "p1", name: "Parent 1" });
    const c1 = makeItem({ id: "c1", parent_id: "p1", name: "Child 1" });
    const p2 = makeItem({ id: "p2", name: "Parent 2" });
    const c2 = makeItem({ id: "c2", parent_id: "p2", name: "Child 2" });

    // Input order mirrors useItems: parent_id NULLS FIRST, then children
    const tree = buildItemTree([p1, p2, c1, c2]);

    expect(tree).toEqual([
      { item: p1, indent: 0 },
      { item: c1, indent: 1 },
      { item: p2, indent: 0 },
      { item: c2, indent: 1 },
    ]);
  });

  it("appends orphan children (whose parent is missing) at the end with indent=1", () => {
    const p1 = makeItem({ id: "p1" });
    const orphan = makeItem({ id: "o1", parent_id: "missing-parent" });

    const tree = buildItemTree([p1, orphan]);

    expect(tree).toEqual([
      { item: p1, indent: 0 },
      { item: orphan, indent: 1 },
    ]);
  });
});
