import type { Item } from "../types/db";

export interface TreeRow {
  item: Item;
  /** 0 = Parent_Item (parent_id IS NULL), 1 = Child_Item (들여쓰기) */
  indent: number;
  /** indent=0일 때만 의미 있음. 해당 Parent_Item이 자식을 가지는지 여부. */
  hasChildren?: boolean;
}

/**
 * Item 리스트를 부모→자식 순으로 평탄화한다 (요구 2.4).
 *
 * 결과 순서:
 *   - parent_id IS NULL 항목들을 입력 순으로 먼저 배치 (indent=0)
 *   - 각 Parent_Item 직후, 그 Parent_Item을 parent_id로 갖는 자식들을 입력 순으로 배치 (indent=1)
 *   - 부모가 동일 결과에 없는 "고아" 자식은 안전망으로 마지막에 indent=1로 추가 (요구 2.4는 정상 데이터 경로만 강제하지만 UX를 위해 누락 방지)
 *
 * 안정 정렬: filter는 input 순서를 보존하므로 useItems가 (parent_id NULLS FIRST, created_at ASC)로
 * 정렬된 배열을 넘겨주면 결과 트리도 created_at ASC 순이 된다.
 *
 * 부모 행에는 `hasChildren`을 함께 실어 ItemPopup이 토글 컨트롤을 표시할지 결정할 수 있게 한다.
 */
export function buildItemTree(items: Item[]): TreeRow[] {
  const parents = items.filter((i) => i.parent_id === null);
  const result: TreeRow[] = [];

  for (const p of parents) {
    const children = items.filter((i) => i.parent_id === p.id);
    result.push({ item: p, indent: 0, hasChildren: children.length > 0 });
    for (const c of children) {
      result.push({ item: c, indent: 1 });
    }
  }

  // 고아 자식: parent_id != null인데 부모가 같은 결과에 존재하지 않거나
  // 부모가 본인도 자식인 비정상 케이스를 안전하게 끝에 노출.
  const orphans = items.filter(
    (i) =>
      i.parent_id !== null &&
      !items.some(
        (other) => other.id === i.parent_id && other.parent_id === null,
      ),
  );
  for (const o of orphans) {
    if (!result.some((r) => r.item.id === o.id)) {
      result.push({ item: o, indent: 1 });
    }
  }

  return result;
}
