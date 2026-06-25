import { IMAGE_OUTPUT_SIZE } from "./constants";

/**
 * 클라이언트 측 이미지 리사이저 (요구 11.1–11.5).
 *
 * - 정확히 300×300 px Blob을 반환한다 (요구 4.6, 11.1).
 * - 출력 MIME은 image/webp 우선, 인코딩이 실제로 webp로 떨어지지 않으면
 *   image/jpeg 폴백을 시도한다 (요구 11.2: jpeg 또는 webp).
 * - 서버측 함수를 호출하지 않는다 (요구 11.3: 순수 Canvas API).
 * - 임의 비율 입력에 대해 자연스러운 결과를 위해 'cover' 방식(중앙 크롭 후 스케일)을
 *   채택했다. 결과 픽셀은 항상 300×300 정사각이다.
 */

/**
 * 입력 파일의 MIME이 `image/*`가 아니면 throw한다 (요구 11.5).
 * RegisterForm은 이 가드에 의해 비-이미지 파일을 즉시 거부할 수 있다.
 */
export function assertImage(file: File): void {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드할 수 있습니다");
  }
}

/**
 * 선택된 파일을 정확히 300×300 px로 리사이즈한 Blob을 반환한다.
 *
 * 알고리즘:
 *   1. createImageBitmap으로 디코드.
 *   2. 300×300 canvas에 cover-fit으로 그리기 (짧은 변에 맞춰 스케일, 중앙 크롭).
 *   3. canvas.toBlob('image/webp', 0.85)로 인코딩.
 *      - 결과 Blob.type이 image/webp가 아니면(구형 Safari 등) image/jpeg 폴백.
 */
export async function resizeTo300(file: File): Promise<Blob> {
  assertImage(file);

  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = IMAGE_OUTPUT_SIZE;
    canvas.height = IMAGE_OUTPUT_SIZE;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context를 사용할 수 없습니다");
    }

    // cover-fit: 짧은 변에 맞춰 source 영역을 잘라 300×300으로 스케일.
    const scale = Math.max(
      IMAGE_OUTPUT_SIZE / bitmap.width,
      IMAGE_OUTPUT_SIZE / bitmap.height,
    );
    const sw = IMAGE_OUTPUT_SIZE / scale;
    const sh = IMAGE_OUTPUT_SIZE / scale;
    const sx = (bitmap.width - sw) / 2;
    const sy = (bitmap.height - sh) / 2;

    ctx.drawImage(
      bitmap,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      IMAGE_OUTPUT_SIZE,
      IMAGE_OUTPUT_SIZE,
    );

    const webp = await canvasToBlob(canvas, "image/webp", 0.85);
    if (webp.type === "image/webp") return webp;

    // webp 인코딩 실패(구형 Safari 등) → jpeg 폴백.
    return await canvasToBlob(canvas, "image/jpeg", 0.9);
  } finally {
    // createImageBitmap이 반환한 ImageBitmap은 명시적 close가 권장된다.
    bitmap.close?.();
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("canvas.toBlob이 null을 반환했습니다"));
      },
      type,
      quality,
    );
  });
}

/**
 * Storage 업로드 시 사용할 파일 확장자를 MIME으로부터 추론.
 * 알 수 없는 MIME은 'bin'으로 폴백한다 (실무에서 발생하지 않음).
 */
export function extensionFromMime(mime: string): string {
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  return "bin";
}
