import {
  MAX_HASHTAGS,
  MAX_HASHTAG_LEN,
  MAX_NAME_LEN,
} from "./constants";
import type { Item, UUID } from "../types/db";

/**
 * Register_Form / Edit 시퀀스 공용 검증기 (요구 4.3, 4.4, 4.5, 9.3, 9.4, 11.5).
 *
 * 각 함수는 순수 함수이며 `{ ok: true } | { ok: false, message }` 결과를 반환한다.
 * UI 컴포넌트는 message를 그대로 표시하고, 등록 시퀀스는 ok=false면 supabase 호출을
 * 0회 수행한다.
 */
export type ValidationResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * 이름 검증 (요구 4.3 / Property 6).
 *   - trim 후 1..MAX_NAME_LEN (=20) 자.
 *   - 0자는 "저장" 버튼 비활성 사유 (요구 4.8).
 */
export function validateName(s: string): ValidationResult {
  const trimmed = s.trim();
  if (trimmed.length < 1) {
    return { ok: false, message: "이름을 입력해 주세요" };
  }
  if (trimmed.length > MAX_NAME_LEN) {
    return {
      ok: false,
      message: `이름은 ${MAX_NAME_LEN}자 이하여야 합니다`,
    };
  }
  return { ok: true };
}

/**
 * 해시태그 배열 검증 (요구 4.4, 4.5 / Property 6).
 *   - 배열 길이 ≤ MAX_HASHTAGS (=4).
 *   - 각 원소 trim 후 1..MAX_HASHTAG_LEN (=20) 자.
 *   - 빈 문자열은 폐기되어야 한다(호출부에서 filter)지만, 방어적으로 거부도 한다.
 */
export function validateHashtags(tags: string[]): ValidationResult {
  if (tags.length > MAX_HASHTAGS) {
    return {
      ok: false,
      message: `해시태그는 최대 ${MAX_HASHTAGS}개까지 입력할 수 있습니다`,
    };
  }
  for (const t of tags) {
    const trimmed = t.trim();
    if (trimmed.length < 1) {
      return { ok: false, message: "빈 해시태그는 허용되지 않습니다" };
    }
    if (trimmed.length > MAX_HASHTAG_LEN) {
      return {
        ok: false,
        message: `해시태그는 각 ${MAX_HASHTAG_LEN}자 이하여야 합니다`,
      };
    }
  }
  return { ok: true };
}

/**
 * parent_id 무결성 검증 (요구 9.3, 9.4 / Property 16).
 *
 * 허용 조건:
 *   - parentId === null (즉 본인이 Parent_Item으로 등록되는 경우), 또는
 *   - parentId가 가리키는 Item이
 *       1) 같은 location_id를 가지고,
 *       2) parent_id === null인 Parent_Item이어야 한다 (2계층 제한).
 *
 * 위반 시 단일 메시지로 응답한다 (요구 9.4 문구).
 */
export function validateParent(
  parentId: UUID | null,
  items: Item[],
  locationId: UUID,
): ValidationResult {
  if (parentId === null) return { ok: true };

  const parent = items.find((i) => i.id === parentId);
  const violationMessage =
    "상위 물품은 같은 수납장의 1계층 물품만 선택할 수 있습니다";

  if (!parent) return { ok: false, message: violationMessage };
  if (parent.parent_id !== null) {
    return { ok: false, message: violationMessage };
  }
  if (parent.location_id !== locationId) {
    return { ok: false, message: violationMessage };
  }
  return { ok: true };
}
