import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  MAX_HASHTAGS,
  MAX_HASHTAG_LEN,
  MAX_NAME_LEN,
  STORAGE_BUCKET,
  TABLES,
} from "../lib/constants";
import {
  assertImage,
  extensionFromMime,
  resizeTo300,
} from "../lib/imageProcessor";
import { supabase } from "../lib/supabase";
import {
  validateHashtags,
  validateName,
  validateParent,
} from "../lib/validators";
import type { Item, Location, UUID } from "../types/db";
import "./RegisterForm.css";

export interface RegisterFormProps {
  /** 폼이 활성화된 Location (헤더는 ItemPopup이 표시함, 등록 모드의 기본 location). */
  location: Location;
  /** 전체 locations (수정 모드에서 수납장 이동 드롭다운 옵션). */
  locations: Location[];
  /** 전체 items (parent 후보를 selectedLocationId 기준으로 동적 계산). */
  allItems: Item[];
  /**
   * 같은 Location 내 Parent_Item 후보들 — 등록 모드의 초기 옵션.
   * 수정 모드에서 수납장 이동 시 allItems에서 재계산되므로 fallback 용도.
   */
  parentCandidates: Item[];
  /** 취소 또는 저장 성공 후 폼을 닫는다. */
  onClose: () => void;
  /** 저장 성공 시 호출되어 부모의 useAllItems.refetch()를 트리거한다. */
  onSaved: () => void;
  /**
   * 수정 대상 Item. 없으면 등록 모드(=insert), 있으면 수정 모드(=update).
   * 초기 폼 상태는 (name, hashtags, image_url, parent_id, location_id) 모두
   * 이 값에서 가져온다 (Property 10).
   */
  editItem?: Item;
}

/**
 * 물품 등록/수정 공용 폼 (요구 4.1–4.11, 5.1–5.6, 9.3/9.4, 11.5, 14.4).
 *
 * 모드 분기:
 *   - editItem === undefined → 등록 모드. supabase.from(items).insert(...).
 *     location_id는 props.location.id로 고정 (현재 마커 위치).
 *   - editItem !== undefined → 수정 모드. supabase.from(items).update(...).
 *     location_id를 폼에서 변경 가능 (수납장 이동).
 *
 * Property 10 보존:
 *   - 수정 모드에서 새 사진 파일을 선택하지 않으면 update payload의 image_url은
 *     editItem.image_url 그대로 유지된다.
 *
 * 수납장 이동 (수정 모드 전용):
 *   - selectedLocationId state로 현재 폼이 가리키는 location을 관리.
 *   - 사용자가 드롭다운으로 변경하면 parent_id를 null로 리셋해 다른 수납장의
 *     1계층 물품을 새로 고를 수 있게 한다 (요구 9.3 무결성과 호환).
 *   - parentCandidates는 selectedLocationId 기준 allItems에서 동적 계산.
 */
export function RegisterForm({
  location,
  locations,
  allItems,
  parentCandidates,
  onClose,
  onSaved,
  editItem,
}: RegisterFormProps) {
  const isEdit = editItem !== undefined;

  // 초기 location: 수정 모드면 editItem 소속, 등록 모드면 폼이 열린 location.
  const [selectedLocationId, setSelectedLocationId] = useState<UUID>(
    editItem?.location_id ?? location.id,
  );

  // 초기값은 수정 대상이 있으면 그 값으로, 없으면 빈 폼.
  const [name, setName] = useState<string>(editItem?.name ?? "");
  const [hashtags, setHashtags] = useState<string[]>(
    editItem ? [...editItem.hashtags] : [],
  );
  const [tagDraft, setTagDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(
    editItem?.parent_id ?? null,
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 사진 미리보기 object URL은 컴포넌트 lifecycle 동안 revoke를 보장한다.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // 이름 trim 후 1..20자일 때만 저장 버튼 활성 (요구 4.8 / Property 6).
  const nameValid = useMemo(() => validateName(name).ok, [name]);
  const canSave = nameValid && !submitting;

  /**
   * Parent_Item 후보 — selectedLocationId 기준으로 동적 계산.
   *   - 같은 location의 parent_id=null 항목
   *   - 자기 자신은 제외 (자기 참조 방지)
   *
   * 수정 모드에서 수납장 이동이 발생하면 자동으로 새 location의 후보 목록으로 갱신.
   * 등록 모드에서는 props.parentCandidates를 사용하지 않고 동일 식으로 일관 처리.
   */
  const visibleParentCandidates = useMemo(() => {
    const list = allItems.filter(
      (i) => i.parent_id === null && i.location_id === selectedLocationId,
    );
    return isEdit ? list.filter((p) => p.id !== editItem!.id) : list;
  }, [allItems, selectedLocationId, isEdit, editItem]);

  // 새 파일이 없고 수정 모드라면 기존 image_url을 미리보기로 사용한다.
  const displayPreviewUrl =
    previewUrl ?? (isEdit ? editItem?.image_url ?? null : null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setFile(null);
      return;
    }
    try {
      assertImage(f);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "이미지 파일만 업로드할 수 있습니다",
      );
      setFile(null);
      e.target.value = "";
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleLocationChange = (newLocationId: UUID) => {
    setSelectedLocationId(newLocationId);
    // 수납장이 바뀌면 기존 parent_id는 다른 location의 parent이므로 무효.
    // 사용자에게 다시 고르게 강제한다 (요구 9.3 무결성 사전 보장).
    setParentId(null);
  };

  const commitTagDraft = () => {
    const draft = tagDraft.trim();
    if (!draft) {
      setTagDraft("");
      return;
    }
    if (hashtags.length >= MAX_HASHTAGS) {
      setError(`해시태그는 최대 ${MAX_HASHTAGS}개까지 입력할 수 있습니다`);
      setTagDraft("");
      return;
    }
    if (draft.length > MAX_HASHTAG_LEN) {
      setError(`해시태그는 각 ${MAX_HASHTAG_LEN}자 이하여야 합니다`);
      return;
    }
    setHashtags((prev) => [...prev, draft]);
    setTagDraft("");
    setError(null);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitTagDraft();
    } else if (
      e.key === "Backspace" &&
      tagDraft.length === 0 &&
      hashtags.length > 0
    ) {
      setHashtags((prev) => prev.slice(0, -1));
    }
  };

  const removeTagAt = (idx: number) => {
    setHashtags((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    // 1) 클라이언트 검증.
    const nameRes = validateName(name);
    if (!nameRes.ok) {
      setError(nameRes.message);
      return;
    }
    const pendingDraft = tagDraft.trim();
    const allTags = pendingDraft ? [...hashtags, pendingDraft] : hashtags;
    const tagsRes = validateHashtags(allTags);
    if (!tagsRes.ok) {
      setError(tagsRes.message);
      return;
    }
    // parent 무결성은 selectedLocationId 기준으로 검증.
    const parentRes = validateParent(
      parentId,
      allItems,
      selectedLocationId,
    );
    if (!parentRes.ok) {
      setError(parentRes.message);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 2) image_url 결정.
      let image_url: string | null = isEdit ? editItem!.image_url : null;

      if (file) {
        const blob = await resizeTo300(file);
        const ext = extensionFromMime(blob.type);
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, blob, {
            contentType: blob.type,
            upsert: false,
          });
        if (upErr) throw new Error(upErr.message);

        const { data: pub } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(path);
        image_url = pub.publicUrl;
      }

      // 3) insert (등록) 또는 update (수정).
      const cleanedTags = allTags.map((t) => t.trim()).filter(Boolean);

      if (isEdit) {
        const { error: updErr } = await supabase
          .from(TABLES.items)
          .update({
            location_id: selectedLocationId, // 수납장 이동 반영
            name: name.trim(),
            hashtags: cleanedTags,
            image_url,
            parent_id: parentId,
          })
          .eq("id", editItem!.id);
        if (updErr) throw new Error(updErr.message);
      } else {
        const { error: insErr } = await supabase.from(TABLES.items).insert({
          location_id: location.id, // 등록은 폼이 열린 location 그대로
          name: name.trim(),
          hashtags: cleanedTags,
          image_url,
          parent_id: parentId,
        });
        if (insErr) throw new Error(insErr.message);
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error("[RegisterForm] save failed:", err);
      setError(isEdit ? "수정에 실패했습니다" : "저장에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const originalLocation = isEdit
    ? locations.find((l) => l.id === editItem!.location_id)
    : null;
  const targetLocation = locations.find((l) => l.id === selectedLocationId);
  const locationChanged =
    isEdit && originalLocation && targetLocation
      ? originalLocation.id !== targetLocation.id
      : false;

  // parentCandidates prop은 더 이상 직접 사용하지 않으나 backward-compat 차원에서 보존.
  void parentCandidates;

  return (
    <form className="register-form" onSubmit={handleSave} noValidate>
      <div className="register-form__field">
        <label className="register-form__label" htmlFor="rf-name">
          이름 <span className="register-form__required">*</span>
        </label>
        <input
          id="rf-name"
          type="text"
          className="register-form__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LEN}
          placeholder="예) 드라이버 세트"
          autoFocus
        />
        <p className="register-form__hint">
          {name.trim().length}/{MAX_NAME_LEN}
        </p>
      </div>

      <div className="register-form__field">
        <label className="register-form__label" htmlFor="rf-tag">
          해시태그
        </label>
        {hashtags.length > 0 ? (
          <ul className="register-form__chips" aria-label="선택된 해시태그">
            {hashtags.map((t, i) => (
              <li key={`${t}-${i}`} className="register-form__chip">
                <span>#{t}</span>
                <button
                  type="button"
                  className="register-form__chip-remove"
                  onClick={() => removeTagAt(i)}
                  aria-label={`${t} 제거`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          id="rf-tag"
          type="text"
          className="register-form__input"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={handleTagKeyDown}
          onBlur={commitTagDraft}
          maxLength={MAX_HASHTAG_LEN}
          disabled={hashtags.length >= MAX_HASHTAGS}
          placeholder={
            hashtags.length >= MAX_HASHTAGS
              ? `최대 ${MAX_HASHTAGS}개`
              : "Enter 또는 콤마로 추가"
          }
        />
        <p className="register-form__hint">
          {hashtags.length}/{MAX_HASHTAGS}
        </p>
      </div>

      <div className="register-form__field">
        <label className="register-form__label" htmlFor="rf-file">
          사진
        </label>
        <input
          id="rf-file"
          type="file"
          accept="image/*"
          className="register-form__file"
          onChange={handleFileChange}
        />
        {displayPreviewUrl ? (
          <img
            src={displayPreviewUrl}
            alt={
              previewUrl ? "선택한 사진 미리보기" : "기존 사진 미리보기"
            }
            className="register-form__preview"
            width={100}
            height={100}
          />
        ) : null}
      </div>

      <div className="register-form__field">
        <label className="register-form__label" htmlFor="rf-parent">
          상위 물품
        </label>
        <select
          id="rf-parent"
          className="register-form__input"
          value={parentId ?? ""}
          onChange={(e) =>
            setParentId(e.target.value === "" ? null : e.target.value)
          }
        >
          <option value="">(없음)</option>
          {visibleParentCandidates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* 수납장 이동 — 수정 모드에서만 노출 (요구 5의 확장: 물품을 다른 수납공간으로 이동) */}
      {isEdit ? (
        <div className="register-form__field">
          <label className="register-form__label" htmlFor="rf-location">
            수납장 이동
          </label>
          <select
            id="rf-location"
            className="register-form__input"
            value={selectedLocationId}
            onChange={(e) => handleLocationChange(e.target.value)}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          {locationChanged && originalLocation && targetLocation ? (
            <p className="register-form__hint">
              "{originalLocation.name}" → "{targetLocation.name}" 로 이동
            </p>
          ) : (
            <p className="register-form__hint">
              현재 위치를 유지하려면 그대로 두세요
            </p>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="register-form__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="register-form__actions">
        <button
          type="button"
          className="register-form__cancel"
          onClick={handleCancel}
          disabled={submitting}
        >
          취소
        </button>
        <button
          type="submit"
          className="register-form__save"
          disabled={!canSave}
        >
          {submitting ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}
