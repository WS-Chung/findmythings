# Find My Things (물건 빨리 찾기)

집 안 물건을 어디에 뒀는지 기록하고 빨리 찾기 위한 **1인용 개인 웹앱**.
집 평면도 위에 수납장 마커를 찍어 두고, 좌측 검색창에 글자를 치면 해당 물건이 든 수납장 마커가 평면도에서 깜빡인다.

- 핵심 UX 두 가지
  1. **검색 → 위치 강조**: 한 글자만 쳐도(예: "가") 이름·해시태그 부분일치 결과가 바로 뜨고, 결과를 클릭하면 그 수납장 마커가 펄스 애니메이션으로 강조된다.
  2. **마커 → 물품 목록**: 마커를 클릭하면 그 수납장의 물품 목록 팝업이 뜨고, 여기서 등록·수정·삭제한다.
- 텍스트 목록보다 **공간(도면) 중심**으로 보는 것이 이 앱의 의도다.
- 이 저장소는 원래 Kiro IDE에서 만들었고, 2026-11-24에 스펙 문서(.kiro, PRD)를 걷어내고 이 문서로 정리했다. 제품 의도와 규칙은 이 문서와 코드가 기준이다.

## 기술 스택

- Vite 5 + React 18 + TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`)
- Supabase (Postgres + Storage)를 브라우저에서 anon key로 직접 호출. **별도 서버 코드 없음.**
- Vercel 호스팅. Vercel 프로젝트의 **Root Directory = `deploy`**.
- 테스트: Vitest + happy-dom (+ Testing Library, fast-check 설치돼 있으나 아직 미사용)
- 상태 관리 라이브러리, 라우터, UI 라이브러리 없음. 순수 React state + 컴포넌트별 CSS 파일.

## 폴더 구조

```
findmythings/                 ← git 루트
├─ deploy/                    ← 앱 전체 (Vercel Root Directory). npm 명령은 모두 여기서
│  ├─ public/                 # background.png(평면도), marker.png(마커/파비콘)
│  ├─ src/
│  │  ├─ main.tsx             # tokens.css·animations.css import → <PasswordGate><App/></PasswordGate>
│  │  ├─ App.tsx              # 전역 state 보유, 레이아웃 조립
│  │  ├─ components/          # 컴포넌트 1개 = .tsx + 같은 이름 .css
│  │  ├─ hooks/               # useLocations, useAllItems, useSearch, useDebounce
│  │  ├─ lib/                 # supabase 클라이언트, 순수 로직(validators, itemTree, searchFilter), imageProcessor, constants
│  │  │  └─ __tests__/        # lib 순수 함수 단위 테스트
│  │  ├─ styles/              # tokens.css(디자인 토큰), animations.css(pulse/fade-in/pop-in)
│  │  └─ types/db.ts          # Location, Item 타입 (DB 스키마와 1:1)
│  ├─ vercel.json             # vite preset + SPA rewrite
│  └─ .env.local              # (git 미추적) VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├─ db/                        # Supabase SQL Editor에서 직접 실행하는 SQL (마이그레이션 도구 없음)
│  ├─ schema.sql              # 테이블, 무결성 트리거, 인덱스, RPC, RLS
│  ├─ storage.sql             # fmt-item-images 버킷 + 정책
│  └─ seed.sql                # 수납장(마커) 좌표 시드
└─ DA_UI_hallmark/            # (git 미추적) 사내 디자인 규칙 폴더. 아래 "디자인" 참고
```

## 명령어 (`deploy/`에서 실행)

```bash
npm install
npm run dev         # http://localhost:5173
npm run typecheck   # tsc -b --noEmit
npm run test:run    # vitest 1회 실행
npm run build       # tsc -b && vite build → dist/
```

- 변경 후에는 `typecheck`와 `test:run`을 돌려 확인한다.
- `src/lib/supabase.ts`는 env가 없으면 import 시점에 throw한다. `sanity.test.ts`가 이 모듈을 import하므로 **`.env.local` 없이는 테스트도 실패**한다.
- 실제 Supabase에 붙는 앱이므로 `npm run dev`에서 등록·삭제를 하면 **운영 데이터가 바뀐다** (개발용 DB 분리 없음).

## 아키텍처

### 데이터 흐름
- 앱 시작 시 `useLocations()`가 수납장 전체, `useAllItems()`가 물품 **전체**를 1회씩 가져와 메모리에 둔다.
- 마커 클릭(해당 수납장 물품 필터)과 검색은 모두 **메모리에서 필터링**한다. 네트워크 호출 없음.
- 등록·수정·삭제가 성공하면 `useAllItems().refetch()`로 전체를 다시 가져온다.
- Supabase를 직접 호출하는 곳은 hooks, `RegisterForm`(insert/update/업로드), `ItemPopup`(delete)뿐이다. 다른 컴포넌트는 props로만 데이터를 받는다.

### App 상태 (`App.tsx`)
| state | 의미 |
|---|---|
| `selectedLocationId` | 열린 ItemPopup의 수납장 |
| `query` | 검색창 입력값 (raw) |
| `selectedSearchItemId` | 검색 결과에서 선택한 행 |
| `highlightedLocationId` | 펄스 강조 중인 마커 (항상 0~1개) |
| `searchPreviewItem` | 검색 결과의 📷 클릭 시 띄울 사진 |

- 강조 해제: 검색창 비우기, 다른 결과 클릭, 결과 행 밖 아무 곳 클릭(document click 리스너).
- 강조 중에는 `FloorPlan`이 `dimmed` → 배경 투명도 0.7→0.45, 다른 마커 0.35.
- 검색 결과 클릭 시 ItemPopup은 자동으로 열지 않는다. 사용자가 강조된 마커를 직접 클릭한다.

### 좌표계
- 평면도 = **1060×740 가상 캔버스**. DB의 `x_pos`, `y_pos`는 이 기준 픽셀 좌표다.
- `FloorPlan`이 `ResizeObserver`로 실제 폭 W를 재고 render prop `children(wrapperWidth)`로 넘긴다.
- `scale = W / 1060`을 x, y 모두에 적용 (`aspect-ratio: 1060/740`이라 동일 비율). 마커 크기(24×36)도 같은 비율로 줄어든다.
- 마커는 `translate(-50%, -50%)`로 좌표에 **중심** 정렬.

### 검색
- `useSearch(query, allItems)` → `useDebounce` 200ms → `filterItems()` (이름 또는 해시태그, 대소문자 무시 부분일치).
- 검색어가 비어 있으면 **전체 물품을 가나다순**으로 보여준다(처음 스펙의 "빈 검색 = 목록 숨김"에서 바뀐 것).
- `SearchResultList`는 3열 표(물건/보관위치/사진)이고, 패널 높이와 행 높이를 재서 페이지당 행 수를 정하는 페이지네이션이 있다.
- DB의 `fmt_search_items` RPC는 남아 있지만 런타임에서 쓰지 않는다.

### ItemPopup / RegisterForm
- 물품 목록은 `buildItemTree()`로 부모 → 자식 순으로 평탄화. 자식이 있는 부모는 **기본 접힘** 상태이고 이름 클릭으로 펼친다.
- Esc 우선순위: 사진 미리보기 → 삭제 확인 → 등록/수정 폼 → 팝업 닫기.
- `RegisterForm`은 등록/수정 겸용(`editItem` 유무로 구분). 수정 모드에서만 **수납장 이동** 드롭다운이 있고, 이동하면 `parent_id`를 비운다.
- 사진: `resizeTo300()` → 300×300 cover 크롭, webp(q0.85, 안 되면 jpeg) → `fmt-item-images/<uuid>.<ext>` 업로드 → public URL을 `image_url`에 저장.
- 부모 삭제 시 자식을 먼저 지우고 부모를 지운다 (DB에도 `on delete cascade` 있음).

## 도메인 규칙

- **수납장(Location) = 마커.** 추가·이동·삭제 UI는 일부러 없다. 좌표는 SQL(`seed.sql` 또는 `UPDATE`)이나 Supabase Table Editor로만 바꾼다.
- **물품(Item)은 최대 2계층.**
  - 상위 물품(Parent_Item): `parent_id = null`. 단독 물건(청소기) 또는 보관함(구급상자).
  - 하위 물품(Child_Item): `parent_id` = **같은 수납장**의 상위 물품. (구급상자 안의 타이레놀)
- 이름: trim 후 1~20자, 필수. 해시태그: 최대 4개, 각 1~20자. 사진: 선택.
- 위 규칙은 **클라이언트(`lib/validators.ts`, `lib/constants.ts`)와 DB(CHECK + `fmt_items_check_integrity` 트리거) 양쪽**에 있다. 규칙을 바꾸면 둘 다 고친다.

## Supabase

- 다른 앱과 **같은 Supabase 프로젝트를 공유**한다. 그래서 모든 DB 객체에 `fmt_` 접두사를 붙인다. 새 테이블·함수·정책도 반드시 `fmt_`(Storage 버킷은 `fmt-`)로 시작한다.
  - 테이블 `fmt_locations`, `fmt_items` / 트리거 함수 `fmt_items_check_integrity` / RPC `fmt_search_items` / 버킷 `fmt-item-images`
  - 코드에서는 이름을 하드코딩하지 말고 `lib/constants.ts`의 `TABLES`, `STORAGE_BUCKET`을 쓴다.
- 인증 없음. RLS는 켜져 있지만 anon에게 `fmt_items` 전체 CRUD, `fmt_locations` 조회를 허용한다. 버킷은 public read + anon 쓰기.
- 스키마 변경 절차: `db/*.sql`을 **멱등하게**(`if not exists`, `create or replace`, `drop ... if exists`) 고친 뒤, 사용자에게 SQL Editor에서 실행해 달라고 안내한다. Claude가 DB에 직접 접속하지 않는다.
- `types/db.ts`는 스키마와 손으로 맞춘다. 컬럼을 바꾸면 같이 고친다.
- service_role key는 어디에도 넣지 않는다.

## 환경 변수

- `deploy/.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. **git에 커밋하지 않는다**(템플릿 `.env.local.example`만 추적).
- Vercel은 대시보드 Environment Variables에 같은 두 값이 등록돼 있어야 빌드된 앱이 동작한다.

## 디자인

- 색·글꼴·반경·간격은 `styles/tokens.css`의 CSS 변수만 쓴다. 컴포넌트 CSS에 색상값을 직접 쓰지 않는다. (Apple 스타일을 참고한 자체 토큰)
- 글꼴: 본문 Pretendard, 팝업 헤더 등 디스플레이용 Noto Sans KR (둘 다 `index.html`에서 CDN 로드).
- 레이아웃 (`Layout.css`, `SearchPanel.css`)
  - 데스크톱(≥834px): 검색 패널 24vw + 간격 20px + 평면도 56vw, 가운데 정렬. 검색 패널 높이는 평면도와 맞추려고 `calc(56vw * 740 / 1060)`로 고정.
  - 모바일(≤833px): 검색 패널 위, 평면도 아래로 한 줄 배치.
- 레이어(z-index): ItemPopup 1000 < ConfirmDialog·ImagePreview 1100 < PasswordGate 9999.
- `DA_UI_hallmark/`는 사내 웹 디자인 규칙 폴더다. 사내 자료라 git에서 제외했다. **현재 앱은 이 규칙을 따르지 않는다**(위 Apple 스타일 토큰 사용). 적용 여부는 사용자가 정한다. 적용하게 되면 그 폴더의 `00_READ_FIRST.md`부터 읽고, 폴더 안 파일은 수정하지 않는다.

## 코드 컨벤션

- 주석·UI 문구는 한국어. 컴포넌트 상단 JSDoc에 동작과 이유를 적는 스타일을 유지한다.
- named export (`export function Foo`), props 타입은 `FooProps`로 export.
- CSS 클래스는 BEM 형태 (`item-row__name`, `marker--highlight`), 컴포넌트 CSS는 해당 `.tsx`에서 import.
- 순수 로직은 `lib/`에 두고 `lib/__tests__/`에 테스트를 붙인다.
- 줄바꿈: 작업 폴더 파일은 CRLF. `.gitattributes`(`* text=auto`)가 저장소에서는 LF로 맞춘다.

## 알려진 문제 / 개선 후보

코드로 확인한 것들. 고칠 때 우선순위는 사용자와 정한다.

1. **3계층이 만들어질 수 있음**: 자식이 있는 상위 물품을 수정해서 다른 상위 물품 아래로 넣을 수 있다. `validateParent`와 DB 트리거 모두 "수정 대상에게 자식이 있는지"를 보지 않는다.
2. **부모 이동 시 자식이 남음**: 자식이 있는 상위 물품을 다른 수납장으로 옮기면 자식은 원래 수납장에 남는다(부모와 수납장이 어긋남). 원래 수납장 팝업에서는 고아 행으로 보인다.
3. **Storage에 안 쓰는 사진이 쌓임**: 물품 삭제나 사진 교체 때 기존 이미지 파일을 지우지 않는다(`storage.remove` 호출 없음).
4. **해시태그 `#` 처리**: 검색창 placeholder가 "#해시태그 검색"이지만 `#`를 떼지 않아 `#겨울`로 검색하면 `겨울` 태그가 안 걸린다. 태그 입력 때 `#`를 붙이면 `##겨울`로 표시된다.
5. **PasswordGate는 보안 장치가 아니다**: 4자리 비밀번호가 `PasswordGate.tsx`에 하드코딩돼 있고 빌드 번들에도 평문으로 들어간다. anon key도 번들에 있으므로 누구나 Supabase에 직접 읽기·쓰기·삭제가 가능하다. 저장소를 공개하면 비밀번호도 공개된다.
6. 미사용 코드: `RegisterForm`의 `parentCandidates` prop(`void` 처리), `RPC.searchItems`, `types/db.ts`의 `Mode`·`ItemInsert`·`ItemUpdate`.
7. 테스트는 `lib/` 순수 함수 23개뿐이다. 컴포넌트·훅 테스트 없음.

## Git

- 기본 브랜치 `main`. Vercel은 `main` push 시 자동 배포된다(연결된 경우).
- GitHub 원격은 아직 없다. 사용자가 다듬은 뒤 push할 예정이다.
- 초기 셋업·배포 절차(SQL 실행 순서, Vercel 설정)는 `README.md`에 있다.
