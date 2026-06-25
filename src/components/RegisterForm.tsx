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
import type { Item, Location } from "../types/db";
import "./RegisterForm.css";

export interface RegisterFormProps {
  /** 폼이 활성화된 Location (헤더는 ItemPopup이 표시함). */
  location: Location;
  /**
   * 같은 Location 내 Parent_Item 후보들 (parent_id IS NULL).
   * select 옵션의 source가 된다. 빈 배열이면 "(없음)"만 선택 가능.
   * 수정 모드에서는 자기 자신이 자동으로 옵션에서 제외된다.
   */
  parentCandidates: Item[];
  /** 취소 또는 저장 성공 후 폼을 닫는다. */
  onClose: () => void;
  /** 저장 성공 시 호출되어 부모의 useItems.refetch()를 트리거한다. */
  onSaved: () => void;
  /**
   * 수정 대상 Item. 없으면 등록 모드(=insert), 있으면 수정 모드(=update).
   * 초기 폼 상태는 (name, hashtags, image_url, parent_id) 모두 이 값에서 가져온다 (Property 10).
   */
  editItem?: Item;
}

/**
 * 물품 등록/수정 공용 폼 (요구 4.1–4.11, 5.1–5.6, 9.3/9.4, 11.5, 14.4).
 *
 * 모드 분기:
 *   - editItem === undefined → 등록 모드. supabase.from(items).insert(...)
 *   - editItem !== undefined → 수정 모드. supabase.from(items).update(...).eq('id', editItem.id)
 *
 * Property 10 보존:
 *   - 수정 모드에서 새 사진 파일을 선택하지 않으면 update payload의 image_url은
 *     editItem.image_url 그대로 유지된다.
 *
 * 디자인 토큰:
 *   - 저장 버튼: button-primary
 *   - 취소 버튼: button-secondary-pill
 *
 * 해시태그 입력 UX:
 *   - 단일 input + 콤마/Enter로 chip 추가. ×로 chip 제거.
 *   - 최대 MAX_HASHTAGS(=4)개에 도달하면 더 이상 추가되지 않는다.
 */
export function RegisterForm({
  location,
  parentCandidates,
  onClose,
  onSaved,
  editItem,
}: RegisterFormProps) {
  const isEdit = editItem !== undefined;

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
  const nameValid = useMemo(
    () => validateName(name).ok,
    [name],
  );

  const canSave = nameValid && !submitting;

  // 수정 모드에서는 parent 옵션에서 자기 자신을 제외한다 (자기 참조 방지).
  // 등록 모드에서는 그대로 노출.
  const visibleParentCandidates = useMemo(
    () =>
      isEdit
        ? parentCandidates.filter((p) => p.id !== editItem!.id)
        : parentCandidates,
    [isEdit, parentCandidates, editItem],
  );

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
      // 요구 11.5: 비-이미지 MIME → 메시지 표시 + 파일 상태 폐기.
      setError(
        err instanceof Error
          ? err.message
          : "이미지 파일만 업로드할 수 있습니다",
      );
      setFile(null);
      // input value를 직접 비워 동일 파일 재선택 시 onChange가 다시 fire되도록.
      e.target.value = "";
      return;
    }
    setError(null);
    setFile(f);
  };

  const commitTagDraft = () => {
    const draft = tagDraft.trim();
    if (!draft) {
      setTagDraft("");
      return;
    }
    if (hashtags.length >= MAX_HASHTAGS) {
      setError(
        `해시태그는 최대 ${MAX_HASHTAGS}개까지 입력할 수 있습니다`,
      );
      setTagDraft("");
      return;
    }
    if (draft.length > MAX_HASHTAG_LEN) {
      setError(
        `해시태그는 각 ${MAX_HASHTAG_LEN}자 이하여야 합니다`,
      );
      return;
    }
    setHashtags((prev) => [...prev, draft]);
    setTagDraft("");
    setError(null);
  };

  const handleTagKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
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

    // 1) 클라이언트 검증 — supabase 호출 전 모두 통과해야 한다.
    const nameRes = validateName(name);
    if (!nameRes.ok) {
      setError(nameRes.message);
      return;
    }
    // tagDraft가 남아있으면 commit해서 함께 검증한다.
    const pendingDraft = tagDraft.trim();
    const allTags = pendingDraft ? [...hashtags, pendingDraft] : hashtags;
    const tagsRes = validateHashtags(allTags);
    if (!tagsRes.ok) {
      setError(tagsRes.message);
      return;
    }
    const parentRes = validateParent(
      parentId,
      parentCandidates,
      location.id,
    );
    if (!parentRes.ok) {
      setError(parentRes.message);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 2) image_url 결정:
      //    - 새 파일이 선택된 경우: 리사이즈 + 업로드 → 새 publicUrl (Property 8)
      //    - 새 파일이 없는 경우:
      //        · 등록 모드 → null
      //        · 수정 모드 → 기존 editItem.image_url 보존 (Property 10)
      let image_url: string | null = isEdit
        ? editItem!.image_url
        : null;

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
            name: name.trim(),
            hashtags: cleanedTags,
            image_url,
            parent_id: parentId,
          })
          .eq("id", editItem!.id);
        if (updErr) throw new Error(updErr.message);
      } else {
        const { error: insErr } = await supabase
          .from(TABLES.items)
          .insert({
            location_id: location.id,
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
      // 요구 4.11 / 5.6: 폼을 닫지 않고 메시지만 표시. 모드별로 문구를 구분한다.
      console.error("[RegisterForm] save failed:", err);
      setError(isEdit ? "수정에 실패했습니다" : "저장에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    // 요구 4.10 / Property 9: supabase 호출 없이 즉시 닫기.
    onClose();
  };

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
              previewUrl
                ? "선택한 사진 미리보기"
                : "기존 사진 미리보기"
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
