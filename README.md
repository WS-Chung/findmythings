# Find My Things

집안 물품의 위치를 평면도(도면) 위 마커로 시각화하고, 좌측 검색바로 물품 보관 위치를 즉시 찾아주는 1인용 취미 웹 앱이다. Vite + React + TypeScript SPA로 작성되며, Supabase(Database + Storage)를 백엔드로, Vercel을 호스팅 플랫폼으로 사용한다.

## Tech Stack

- **Frontend**: TypeScript, Vite, React
- **Backend**: Supabase (PostgreSQL + Storage), 별도 서버 코드 없음
- **Deployment**: Vercel

## Supabase 적용 가이드

이 프로젝트는 **기존 Supabase 프로젝트와 공유 사용**할 수 있도록 모든 데이터베이스 객체에 `fmt_` 접두사를 적용했다.

| 종류 | 이름 |
|---|---|
| 테이블 | `public.fmt_locations`, `public.fmt_items` |
| RPC 함수 | `public.fmt_search_items(q text)` |
| 트리거 함수 | `public.fmt_items_check_integrity()` (hashtag 길이 + parent 2계층 통합 검증) |
| Storage 버킷 | `fmt-item-images` (Storage는 `_` 미허용이므로 `-` 사용) |

기존 프로젝트의 다른 테이블/버킷과 충돌하지 않으며, anon key도 그대로 재사용할 수 있다.

### 1. SQL 실행 순서

Supabase 콘솔의 **SQL Editor**에서 아래 순서대로 각 파일의 내용을 복사·붙여넣기·Run 한다. 멱등 작성이므로 재실행해도 안전하다.

1. `db/schema.sql` — 테이블, 트리거, 인덱스, `fmt_search_items` RPC, RLS 정책
2. `db/storage.sql` — `fmt-item-images` 버킷 생성과 anon 정책
3. `db/seed.sql` — `fmt_locations`에 마커 좌표 5건 시드 (운영자가 평면도에 맞게 수정)

### 2. anon key 확보 → `.env.local` 작성

Supabase 콘솔의 **Project Settings → API**에서 다음을 복사한다.

- `Project URL` (예: `https://xxxxxxxx.supabase.co`)
- `anon` `public` key (긴 JWT 문자열)

프로젝트 루트에 `.env.local` 파일을 만들고 아래 형식으로 채운다.

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

> ⚠️ **service_role key는 절대 클라이언트 코드나 git 저장소에 커밋하지 말 것.**
> anon key는 1인용 취미 프로젝트 정책상 git에 커밋해도 무방하다(이 README의 정책 결정 참고).

### 3. 마커 좌표 수정 방법

1차 Vercel 배포 후 실제 평면도 위에 찍힌 마커 위치를 보고 좌표를 보정해야 할 수 있다. 두 가지 방법이 있다.

**A. seed.sql 다시 실행**: `db/seed.sql`을 편집한 뒤 Supabase SQL Editor에서 재실행. `on conflict do nothing` 때문에 기존 행은 변경되지 않으므로 우선 해당 행을 지우고 재실행하거나, 아래 B 방식을 사용한다.

**B. 직접 UPDATE 문 실행** (권장):

```sql
update public.fmt_locations
   set x_pos = 230, y_pos = 410
 where name = '거실 수납장';
```

## 로컬 개발

```bash
npm install
npm run dev          # Vite dev server (http://localhost:5173)
npm run typecheck    # tsc --noEmit
npm run test:run     # vitest run
npm run build        # dist/ 빌드 산출물 생성
```

## Vercel 배포

이 프로젝트는 정적 SPA + Supabase 백엔드 조합이므로 Vercel의 Vite 프리셋으로 별 설정 없이 배포된다.

### 1. GitHub 저장소에 push

```bash
git add .
git commit -m "Initial Find My Things"
git push origin main
```

> `.env.local`은 anon key만 들어 있으므로 git에 커밋해도 무방하다. service_role key가 들어가지 않았는지 한 번 더 확인.

### 2. Vercel 프로젝트 import

1. [vercel.com](https://vercel.com) → **Add New… → Project**
2. GitHub 저장소를 선택 → **Import**
3. Framework Preset이 자동으로 **Vite**로 감지됨 (아니면 수동 선택)
4. **Build Command**: `npm run build`
5. **Output Directory**: `dist`
6. **Install Command**: `npm install` (기본값)
7. **Root Directory**: 그대로

### 3. Environment Variables 등록

Vercel 프로젝트 설정 → **Environment Variables**에 두 개 추가:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `<anon-public-key>` |

> ⚠️ **`SUPABASE_SERVICE_ROLE_KEY`는 절대 추가하지 말 것.** 클라이언트 SPA에는 anon key만 노출되어야 한다.

`.env.local`에 이미 동일한 값이 있어도 Vercel 환경변수는 **별도 등록 필요**하다(빌드는 Vercel 서버에서 실행되므로 git 파일의 .env.local을 읽지 않음).

### 4. Deploy

**Deploy** 버튼 클릭 → 1–2분 후 배포 URL이 발급된다.

이후 `main` 브랜치로 push할 때마다 자동 재배포된다.

### 5. 배포 후 점검

배포 URL을 열어 다음을 확인:

- 평면도와 마커가 정상 표시되는지 (좌표가 어긋나면 Supabase SQL Editor에서 `update fmt_locations set x_pos=..., y_pos=... where name='...';`로 보정)
- 마커 클릭 → ItemPopup이 뜨는지
- 물건 등록 → 사진 첨부 → 저장 시 `fmt_items` 테이블과 `fmt-item-images` 버킷에 반영되는지
- 좌측 검색바에 글자 입력 시 결과 리스트가 뜨고, 결과 클릭 시 마커가 펄스 애니메이션으로 강조되는지

문제가 발생하면 브라우저 콘솔(F12)에서 에러 메시지를 확인하면 대부분 환경변수 누락이거나 RLS 정책 누락이다.

## 디렉터리 구조

```
findmythings/
├─ public/              # background.png, marker.png
├─ src/
│  ├─ components/       # Layout, FloorPlan, Marker, ItemPopup, ItemRow,
│  │                    # ImagePreview, RegisterForm, ConfirmDialog,
│  │                    # SearchPanel, SearchInput, SearchResultList
│  ├─ hooks/            # useLocations, useItems, useDebounce, useSearch
│  ├─ lib/              # supabase, imageProcessor, validators, itemTree, constants
│  ├─ types/            # db.ts (Location, Item, ...)
│  └─ styles/           # tokens.css (Apple 디자인 토큰), animations.css (pulse)
├─ db/
│  ├─ schema.sql        # fmt_locations, fmt_items, RPC, RLS
│  ├─ storage.sql       # fmt-item-images 버킷 + 정책
│  └─ seed.sql          # 마커 좌표 시드
├─ index.html, vite.config.ts, tsconfig*.json, package.json
├─ .env.local           # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (git 커밋 OK)
└─ .env.local.example   # 빈 값 템플릿
```

## 보안 정책 결정사항

이 프로젝트는 **1인용 취미용**이며 민감 정보를 다루지 않는다. 따라서 다음 결정을 명시한다.

- 인증 시스템 없음. anon key로 모든 CRUD 허용.
- RLS는 활성화하되, anon 역할에 대해 SELECT/INSERT/UPDATE/DELETE 모두 허용.
- `fmt-item-images` Storage 버킷은 public read + anon write.
- anon key는 git 커밋 OK. service_role key는 절대 금지.

## License

Personal hobby project. No license specified.
