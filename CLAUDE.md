# Find My Things (물건 빨리 찾기)

집 안 물건을 어디에 뒀는지 기록하고 빨리 찾기 위한 **1인용 개인 웹앱**.
집 평면도 위에 수납장 마커를 찍어 두고, 검색창에 글자를 치면 해당 물건이 든 수납장 마커가 평면도에서 강조된다.

- 핵심 UX
  1. **검색 → 위치 강조**: 한 글자만 쳐도(예: "가") 이름·해시태그 부분일치 결과가 엑셀형 표에 바로 뜨고, 행을 누르면 그 수납장 마커가 평면도에서 강조된다.
  2. **마커 → 물품 표**: 마커를 누르면 그 수납장의 물품 표(대화상자)가 뜨고, 여기서 등록·수정·삭제한다.
  3. **마커 추가·수정**: 평면도에는 모드가 둘이다. "마커 추가"는 새 수납장을 이름과 위치와 함께 한 번에 등록한다. "마커 수정"은 기존 마커를 끌어서(방향키도 가능) 옮기고, **이 모드에서만** 선택한 마커(수납장)를 삭제한다.
- 텍스트 목록보다 **공간(도면) 중심**으로 보는 것이 이 앱의 의도다.
- 주 사용 환경: **1920×1080 PC 모니터**와 **iPhone 13 mini(375×812)**. 두 환경에서 모두 확인한 뒤 끝낸다.
- 이 저장소는 원래 Kiro IDE에서 만들었고, 2026-11-24에 스펙 문서(.kiro, PRD)를 걷어낸 뒤 이 문서로 정리했다. 같은 날 UI 전체를 사내 디자인 규칙(DA UI hallmark)에 맞춰 다시 만들었고, 규칙 원본 폴더는 지우고 핵심만 아래 "디자인"에 옮겼다. 제품 의도와 규칙은 이 문서와 코드가 기준이다.

## 기술 스택

- Vite 5 + React 18 + TypeScript (strict, `noUnusedLocals`/`noUnusedParameters`)
- Supabase (Postgres + Storage)를 브라우저에서 anon key로 직접 호출. **별도 서버 코드 없음.**
- Vercel 호스팅. Vercel 프로젝트의 **Root Directory = `deploy`**.
- 테스트: Vitest + happy-dom + Testing Library. 상태 관리 라이브러리, 라우터, UI 라이브러리 없음. 순수 React state + 컴포넌트별 CSS 파일.

## 폴더 구조

```
findmythings/                 ← git 루트
├─ deploy/                    ← 앱 전체 (Vercel Root Directory). npm 명령은 모두 여기서
│  ├─ public/                 # background.png(평면도), marker.png(마커/파비콘)
│  ├─ src/
│  │  ├─ main.tsx             # tokens.css·ui.css import → <PasswordGate><App/></PasswordGate>
│  │  ├─ App.tsx / App.css    # 전역 state 보유, 화면 배치(검색 / 평면도 / 물품 표)
│  │  ├─ components/          # 컴포넌트 1개 = .tsx + 같은 이름 .css. 테스트는 __tests__/
│  │  ├─ hooks/               # useLocations, useAllItems, useSearch, useDebounce, useMarkerEditor(마커 추가·수정·삭제). 테스트는 __tests__/
│  │  ├─ lib/                 # supabase 클라이언트, 순수 로직, constants. 테스트는 __tests__/
│  │  ├─ styles/              # tokens.css(디자인 토큰 + 기본 규칙), ui.css(버튼·입력·꼬리표 등 공용)
│  │  └─ types/db.ts          # Location, Item 타입 (DB 스키마와 1:1)
│  ├─ vercel.json             # vite preset + SPA rewrite
│  └─ .env.local              # (git 미추적) VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
└─ db/                        # Supabase SQL Editor에서 직접 실행하는 SQL (마이그레이션 도구 없음)
   ├─ schema.sql              # 테이블, 무결성 트리거, 인덱스, RLS (v5)
   ├─ storage.sql             # fmt-item-images 버킷 + 정책
   └─ seed.sql                # 수납장(마커) 좌표 시드
```

주요 컴포넌트

| 컴포넌트 | 역할 |
|---|---|
| `Layout` | 회색 틀(상단 막대) + 흰 시트 셸 |
| `SheetGrid` | **엑셀형 표** 공용 컴포넌트. 검색 결과 표와 수납장 물품 표가 모두 이것을 쓴다 |
| `ResultSheet` | 검색 결과 표 (`SheetGrid` 사용) |
| `FloorPlanPanel` / `FloorPlan` / `MarkerLayer` / `Marker` | 평면도 블록 / 1060:740 캔버스 / 마커 배치 / 마커 1개(끌기·강조) |
| `ItemPopup` | 수납장 대화상자: 도구 막대 + 물품 표. 등록·수정·삭제 |
| `RegisterForm` | 물품 등록/수정 폼 (`editItem` 유무로 구분) |
| `Dialog` | 모든 대화상자의 공용 틀 (Esc 스택, Tab 가두기, 초점 복원) |
| `ConfirmDialog`, `ImagePreview` | `Dialog` 위에 만든 삭제 확인 / 사진 보기 |
| `PhotoButton` | 📷 버튼 (아래 "디자인"의 유일한 이모지 예외) |
| `Icon` | 16px 선 아이콘 모음. 아이콘은 여기에 추가한다 |
| `PasswordGate` | 진입 비밀번호 화면 |

## 명령어 (`deploy/`에서 실행)

```bash
npm install
npm run dev         # http://localhost:5173
npm run typecheck   # tsc -b --noEmit
npm run test:run    # vitest 1회 실행
npm run build       # tsc -b && vite build → dist/
```

- 변경 후에는 `typecheck`와 `test:run`을 돌려 확인한다. UI를 바꿨으면 **1920×1080과 375×812에서 직접 띄워서** 확인한다(타입체크·테스트는 화면을 보지 못한다).
- `src/lib/supabase.ts`는 env가 없으면 import 시점에 throw한다. `sanity.test.ts`가 이 모듈을 import하므로 **`.env.local` 없이는 테스트도 실패**한다.
- 실제 Supabase에 붙는 앱이므로 `npm run dev`에서 등록·삭제·마커 저장을 하면 **운영 데이터가 바뀐다** (개발용 DB 분리 없음).

## 아키텍처

### 데이터 흐름
- 앱 시작 시 `useLocations()`가 수납장 전체, `useAllItems()`가 물품 **전체**를 1회씩 가져와 메모리에 둔다.
- 마커 클릭(해당 수납장 물품 필터)과 검색은 모두 **메모리에서 필터링**한다. 네트워크 호출 없음.
- 등록·수정·삭제가 성공하면 `useAllItems().refetch()`로 전체를 다시 가져온다.
- Supabase를 직접 호출하는 곳은 hooks(`useLocations`, `useAllItems`, `useMarkerEditor`), `RegisterForm`(insert/update/업로드), `ItemPopup`(delete)뿐이다. 다른 컴포넌트는 props로만 데이터를 받는다.

### 화면 배치 (`App.css`)
- 제목 줄(`h1` + 지금 화면이 알려 주는 사실 한 줄) 아래에 작업 영역 `.work`(CSS grid 영역: search / map / sheet).
- **데스크톱(1101px 이상)**: 왼쪽 위 검색, 그 아래 물품 표, 오른쪽에 평면도. 평면도 폭은 `clamp(480px, (100dvh - 230px) × 1060/740, 64%)`, 즉 **화면 높이에 맞는 폭**이라 1920×1080에서 세로 스크롤 없이 평면도 전체와 표가 한 화면에 들어온다. 표는 평면도 높이에 맞춰 늘어난다(표 칸이 `position: absolute; inset: 0`).
- **1100px 이하(태블릿·휴대폰)**: 검색 → 평면도 → 표 순서로 쌓는다. 평면도가 표 위에 있어야 결과를 눌렀을 때 마커 강조가 바로 보인다. 결과를 누르면 평면도로 스크롤한다(`App.handleSearchSelect`).
- 제목 아래 한 줄(`summary`)은 검색어가 있으면 결과 수, 없으면 전체 수를 말한다.

### App 상태 (`App.tsx`)
| state | 의미 |
|---|---|
| `selectedLocationId` | 열린 ItemPopup의 수납장 |
| `query` | 검색창 입력값 (raw) |
| `selectedSearchItemId` | 검색 결과에서 선택한 행 |
| `highlightedLocationId` | 강조 중인 마커 (항상 0~1개) |
| `searchPreviewItem` | 검색 결과의 📷 클릭 시 띄울 사진 |
| `useMarkerEditor()` | 마커 추가·수정 모드(`mode`: idle / edit / add), 위치 초안, 저장, 삭제 |
| `deleteTargetId` | 삭제 확인 대화상자의 대상 수납장(마커 수정 모드에서 "삭제"를 눌렀을 때) |

- 강조 해제: 검색창 비우기, 다른 결과 클릭, 결과 행 밖 아무 곳 클릭(document click 리스너. 결과 표는 `data-keep-highlight`로 표시).
- 강조 중에는 `FloorPlan`이 `dimmed` → 배경 투명도 0.7→0.45, 다른 마커 0.35.
- 검색 결과 클릭 시 ItemPopup은 자동으로 열지 않는다. 사용자가 강조된 마커를 직접 누른다.
- ItemPopup이 열려 있는 동안에는 어떤 마커를 골랐는지 알 수 있도록 **열린 수납장이 아닌 마커를 50% 투명도로 흐리게** 한다(`MarkerLayer`의 `openLocationId` → `Marker`의 `faded` → `marker--faded`). 선택한 마커가 팝업에 가려지는 것은 알려진 한계로 두었다.

### 좌표계와 마커
- 평면도 = **1060×740 가상 캔버스**. DB의 `x_pos`, `y_pos`는 이 기준 정수 픽셀이다.
- `FloorPlan`이 `ResizeObserver`로 실제 폭 W를 재고 render prop `children(wrapperWidth)`로 넘긴다. `scale = W / 1060`을 x, y에 똑같이 적용한다.
- 마커는 **중심**이 좌표에 온다. 크기는 원본 19.2×28.8(예전 24×36의 80%)에 scale을 곱하되 **최소 14.4×21.6**이다(휴대폰에서 너무 작아지지 않게. 비율 2:3 유지). 누르는 영역은 `Marker.css`의 `::before`로 44px까지 넓혀 있다. 좌표·크기 계산은 `lib/markerPosition.ts`의 순수 함수(`markerBox` 등)이고 테스트가 있다.
- **강조**: 무한 펄스 대신 고정 링 + 이름표(네이비 면) + 퍼져 나가는 링 **3번**. (hallmark가 반복 장식을 금지한다)

### 마커 추가
- 평면도 제목 줄의 "마커 추가" → 추가 모드. 제목 줄에 **수납장 이름 입력**이 생기고, 평면도 한가운데(530, 370)에 새 마커가 나타난다(강조 링 + 입력 중인 이름의 이름표). 마커를 끌거나 방향키로 위치를 정하고 "마커 추가"를 누르면 **이름과 위치를 한 번의 INSERT**로 저장한다. 저장 전에는 DB에 아무것도 없다.
- 이름은 trim 후 1~20자, 이미 있는 수납장 이름과 같으면 안 된다(`validateLocationName`, 클라이언트만 검사. DB에는 유일 제약이 없다). 이름이 비어 있으면 저장 버튼이 꺼져 있다. 입력칸에서 Enter = 저장, Esc = 취소.
- 추가 중에는 기존 마커가 흐려지고 눌러도 물품 표가 열리지 않는다. 저장에 성공하면 `addLocation`으로 화면 상태에 바로 넣고, 새 마커를 강조해 어디에 생겼는지 보여 준다.
- **INSERT 정책이 없으면 오류 코드 `42501`** 이 돌아오고, 그러면 "db/schema.sql의 수납장 추가 정책을 적용했는지 확인하세요" 문장이 뜬다.

### 마커 수정 (위치 옮기기 · 삭제)
- 평면도 제목 줄의 "마커 수정" → 수정 모드. 마커를 끌거나(마우스·터치, 포인터 이벤트) 마커에 초점을 두고 방향키 1칸 / Shift+방향키 10칸. 이때는 마커를 눌러도 팝업이 열리지 않는다.
- 마커를 잡거나 초점을 받으면 그 마커가 **선택**(`activeId`)된다. 선택한 마커는 네이비 테두리와 이름표로 표시되고(`marker--selected`, `aria-pressed`), 제목 줄에 "선택: 이름"이 뜬다.
- 끄는 동안은 `draft`(초안)에만 쌓고, **"변경 내용 저장"** 에서 달라진 마커만 `fmt_locations`를 UPDATE한다. "취소"는 초안을 버린다. 저장하면 `applyPositions`로 화면 상태에 바로 반영한다.
- **RLS에 UPDATE 정책이 없으면 Supabase는 오류 없이 0행을 갱신한다.** 그래서 `.update(...).select()`로 돌려받은 행이 있어야 성공으로 센다. 정책이 없으면 "db/schema.sql의 수납장 수정 정책을 적용했는지 확인하세요" 문장이 뜬다.
- 이름표: 수정 모드에서 평면도가 넓으면(640px 이상) 모든 마커의 이름을 겹치지 않게 위/아래로 나눠(`planLabelSides`) 보이고, 좁으면(휴대폰) 방금 잡은 마커의 이름만 보인다.
- **삭제**: 마커를 선택한 뒤 제목 줄의 "삭제"(선택이 없으면 꺼져 있다) → 확인 대화상자(`ConfirmDialog`: 수납장 이름과 **함께 지워질 물품 수**를 문장으로 보인다) → "삭제". 위치 초안 없이 바로 `fmt_locations`를 DELETE 하고, 수정 모드는 유지한다(여러 개를 이어서 지울 수 있다). **수납장을 지우면 그 안의 물품도 `on delete cascade`로 함께 지워진다.** 그래서 화면 상태에서도 `removeLocation`(마커)과 `removeByLocation`(물품)으로 같이 뺀다. 물품을 아직 못 불러왔으면 지워질 개수를 알릴 수 없으므로 삭제 버튼을 막는다.
- **RLS에 DELETE 정책이 없어도 Supabase는 오류 없이 0행을 지운다**(권한 자체가 없으면 `42501`). 그래서 `.delete().eq(...).select("id")`로 돌려받은 행이 있어야 성공으로 센다. 실패하면 확인 대화상자가 열린 채로 "db/schema.sql의 수납장 삭제 정책을 적용했는지 확인하세요" 등의 문장이 뜬다.
- 마커 **이름 변경**은 UI에 없다. SQL이나 Supabase Table Editor로 한다.

### 엑셀형 표 (`SheetGrid`)
- 구성: 수식 줄(칸 주소 + 값) / 열 문자 행(A, B…) / 1행 머리글 / 데이터 행(행 번호 2부터) / 보이는 높이만큼의 빈 행 / 시트 탭 / 상태 막대. 열 문자 행과 1행 머리글, 행 번호 열은 스크롤해도 고정된다.
- 조작: 칸을 누르면 행 선택(`onSelectRow`), 두 번 누르거나 Enter면 `onOpenRow`, 방향키·Home/End·PageUp/Down은 칸 이동(선택은 바뀌지 않음), Delete는 `onDeleteRow`. 칸 안의 버튼(📷, 접기)을 누르면 행 선택은 일어나지 않는다.
- 열은 `{ id, header, width, phoneWidth?, render, text }`. `width`는 px이고 컨테이너가 넓으면 비율대로 늘어난다. 휴대폰(≤640px)은 `phoneWidth`를 쓴다. 표 폭은 열 폭의 합을 CSS 변수(`--sum`, `--sum-p`)로 넘겨 정한다(`max-content`는 셀 내용 길이를 따라가 쓰지 않는다).
- 휴대폰에서는 행을 40px로 키우고 행 번호 열을 30px로 줄이며 시트 탭을 접는다. 수식 줄은 잘린 값을 읽는 용도라 남긴다.
- 상태: `ready | loading | error`(+ 빈 상태 문장, 다시 시도).

### 검색
- `useSearch(query, allItems)` → `useDebounce` 200ms → `filterItems()` (이름 또는 해시태그, 대소문자 무시 부분일치).
- 검색어가 비어 있으면 **전체 물품을 가나다순**으로 보여준다.
- 결과 표 열: 물건 / 사진 / 보관위치 / 상위 물품 / 해시태그. 페이지 나누기는 없다(표 스크롤).
- `/` 키로 검색칸에 초점이 간다(다른 입력칸이나 대화상자에 있을 때는 제외).

### ItemPopup / RegisterForm
- 행을 **고른 뒤** 도구 막대의 "수정" / "삭제"를 누른다. Enter(또는 두 번 누름) = 수정, Delete 키 = 삭제 확인. 행마다 버튼을 두지 않는다.
- 물품 표는 `buildItemTree()`로 부모 → 자식 순. 상위 물품은 **기본 접힘**이고 이름 앞 화살표로 펼친다(`expanded` 집합이라 새로 불러와도 펼친 상태가 유지됨). 하위 물품을 저장하면 그 상위 물품이 자동으로 펼쳐진다.
- Esc 순서: 사진 보기 → 삭제 확인 → 등록/수정 폼 → 팝업 닫기. 겹친 대화상자는 `Dialog`가 맨 위 것만 닫고, 사진 보기와 삭제 확인은 ItemPopup의 **형제**로 렌더한다(부모의 자식으로 넣으면 키·초점 처리가 섞인다). 폼이 열려 있는 동안은 배경을 눌러도 닫히지 않는다.
- `RegisterForm`은 수정 모드에서만 **수납장 이동** 선택이 있고, 이동하면 `parent_id`를 비운다.
- 사진: `resizeTo300()` → 300×300 cover 크롭, webp(q0.85, 안 되면 jpeg) → `fmt-item-images/<uuid>.<ext>` 업로드 → public URL을 `image_url`에 저장.
- 상위 물품 삭제 시 하위를 먼저 지우고 상위를 지운다 (DB에도 `on delete cascade` 있음).

## 도메인 규칙

- **수납장(Location) = 마커.** `fmt_locations`의 행 1개가 마커 1개다. 새 마커는 새 테이블이 아니라 이 테이블에 행을 넣는다. UI에서 추가하고 위치를 옮기고 삭제할 수 있고, 이름 변경은 SQL로만 한다.
- **물품(Item)은 최대 2계층.**
  - 상위 물품(Parent_Item): `parent_id = null`. 단독 물건(청소기) 또는 보관함(구급상자).
  - 하위 물품(Child_Item): `parent_id` = **같은 수납장**의 상위 물품. (구급상자 안의 타이레놀)
- 이름: trim 후 1~20자, 필수. 해시태그: 최대 4개, 각 1~20자. 사진: 선택.
- 위 규칙은 **클라이언트(`lib/validators.ts`, `lib/constants.ts`)와 DB(CHECK + `fmt_items_check_integrity` 트리거) 양쪽**에 있다. 규칙을 바꾸면 둘 다 고친다.

## Supabase

- 다른 앱과 **같은 Supabase 프로젝트를 공유**한다. 그래서 모든 DB 객체에 `fmt_` 접두사를 붙인다. 새 테이블·함수·정책도 반드시 `fmt_`(Storage 버킷은 `fmt-`)로 시작한다.
  - 테이블 `fmt_locations`, `fmt_items` / 트리거 함수 `fmt_items_check_integrity` / 버킷 `fmt-item-images`
  - 코드에서는 이름을 하드코딩하지 말고 `lib/constants.ts`의 `TABLES`, `STORAGE_BUCKET`을 쓴다.
- 인증 없음. RLS는 켜져 있다. anon은 `fmt_items` 전체 CRUD, `fmt_locations`는 조회, **추가(`name`, `x_pos`, `y_pos`)**, **좌표(`x_pos`, `y_pos`) 수정**, **삭제**만 가능하다(컬럼 단위 `grant insert/update`, 행 단위 `grant delete`). 버킷은 public read + anon 쓰기.
- **schema.sql v5**: v3에서 마커 위치 수정용 UPDATE 정책을 추가하고 앱이 쓰지 않는 DB 쪽 검색(RPC `fmt_search_items`, trigram·이름·해시태그 인덱스)을 지웠으며, v4에서 마커 추가용 INSERT 정책을, v5에서 수납장 삭제용 DELETE 정책을 더했다. 검색은 브라우저 메모리에서 한다. **v5 이전 DB에는 `db/schema.sql`을 한 번 다시 실행해야 마커 추가·위치 저장·삭제가 된다.**
- 스키마 변경 절차: `db/*.sql`을 **멱등하게**(`if not exists`, `create or replace`, `drop ... if exists`) 고친 뒤, 사용자에게 SQL Editor에서 실행해 달라고 안내한다. Claude가 DB에 직접 접속하지 않는다.
- `types/db.ts`는 스키마와 손으로 맞춘다. 컬럼을 바꾸면 같이 고친다.
- service_role key는 어디에도 넣지 않는다.

## 환경 변수

- `deploy/.env.local`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. **git에 커밋하지 않는다**(템플릿 `.env.local.example`만 추적).
- Vercel은 대시보드 Environment Variables에 같은 두 값이 등록돼 있어야 빌드된 앱이 동작한다.

## 디자인

사내 **DA UI hallmark v1.0** 업무 화면(`app`) 규칙을 따른다. 규칙 원본 폴더는 저장소에서 지웠으므로, 아래가 이 앱의 디자인 기준이다. 새 화면·컴포넌트도 여기에 맞춘다. 색·글꼴·반경·간격은 `styles/tokens.css`의 CSS 변수만 쓰고, 컴포넌트 CSS에 색상값을 직접 쓰지 않는다.

**셸**: 회색 틀(`--frame` #F4F5F7, 상단 막대 48px) 안에 흰 시트(`--surface`, 모서리 16px, 1px `--edge`, 그림자 없음). 휴대폰(≤640px)에서는 틀이 사라지고 시트가 화면 전체가 된다. 화면(대화상자)마다 `h1`(또는 대화상자 제목) 하나, 제목 22px/600(휴대폰 20px), 그 아래 한 줄은 결론이나 발견을 쓴다("이 화면은 ~를 보여 줍니다" 같은 사용법은 쓰지 않는다).

**색**: 회사 8색과 무채색만 쓴다. 빨강·주황·노랑·보라·분홍은 쓰지 않는다. **네이비 `--navy`(#06438C)는 다섯 곳에만**: 로고, 화면(대화상자)의 주 버튼 하나, 선택 표시(선택 칸 테두리, 열·행 머리 강조, 강조 마커 링과 이름표), 주 데이터 한 계열, 강조 면. 메뉴·머리글·테두리는 회색. 경고·위험·실패도 색이 아니라 **굵은 글씨 + 아이콘 + 문장**으로 알린다(`.err`). 위험한 동작(삭제)은 대상 이름이 든 확인 대화상자를 거친다.

**글자**: 본문 Pretendard(`index.html`이 CDN으로 로드), **엑셀형 표만 맑은 고딕**(`--sheet-font`). 크기는 제목 22 / 절 제목 16 / 본문 14 / 표·입력 13 / 보조 12px, 12px 미만 금지. 보조 글자색 `--ink-3`은 `--hover`·`--active`·`--b50` 위에 쓰지 않는다(대비 부족). `#A0A0A0`을 글자색으로 쓰지 않는다. 대문자 변환과 자간 넓힘 금지. 숫자는 `tabular-nums`.

**버튼**: 주 버튼 `.btn-1`(네이비)은 화면(대화상자)에 하나, 보조 `.btn-2`(흰 바탕 + 1px 테두리), 글자 버튼 `.btn-t`. 높이 32px, 모서리 6px, 13px/600. 이름은 동작 이름("저장", "마커 수정"). "확인", "시작하기" 단독 금지. 아이콘만 있는 버튼은 `aria-label`.

**표**: 목록은 엑셀형 `SheetGrid`로 만든다(위 "엑셀형 표"). 일반 표를 새로 만들지 않는다. 마우스는 `--raised`, 선택은 `--b50`, 행이 움직이지 않는다.

**빼야 할 장치**: 그라데이션, 글로우, 반투명 흐림(`backdrop-filter`), 쉬고 있는 카드의 그림자, 마우스 올리면 떠오르는 효과, 등장 애니메이션, **무한 반복 효과**, 장식 번호·eyebrow·알약 배지, 이모지·장식 도형. 그림자는 대화상자처럼 **떠 있는 요소에만** `--float`로, 그 줄에 `hallmark-ignore: 이유` 주석을 단다. 움직임은 상태 변화에만 0.12~0.3초 `ease-out`이고, `prefers-reduced-motion`에서는 모두 꺼진다.

**휴대폰(iPhone 13 mini 375px)**: 누르는 곳은 40px 이상(버튼·입력·표 행, 마커는 `::before`로 44px). 입력칸은 `font-size: 16px`(그 미만이면 iOS가 확대한다). 가로 넘침 금지. 대화상자는 `calc(100vw - 32px)`.

**접근성**: 모든 조작이 키보드로 된다. 초점 표시는 2px 네이비. 대화상자는 `Dialog`를 쓴다(초점 가두기, Esc, 초점 복원, `aria-labelledby`). 입력칸은 `<label>`로 연결하고 placeholder를 라벨 대신 쓰지 않는다.

**규칙과 다르게 한 곳** (이유가 있어서 일부러):
- **📷 이모지**: 사진이 등록된 물건의 "사진 보기" 버튼에만 쓴다. 사용자 지시다. 다른 곳에는 이모지를 쓰지 않는다(`PhotoButton`).
- **사이드바 없음, 가운데 열 1200px 제한 없음**: 화면이 하나뿐이고 평면도와 표를 나란히 두는 작업대라 시트 전체 폭을 쓴다.
- **강조 효과**: hallmark는 반복 애니메이션을 금지하므로 무한 펄스를 쓰지 않는다. 고정 링과 이름표 + 3번만 퍼지는 링이다.
- **`marker.png`**: 광택 있는 이미지 자산이다. 지도 내용이라 그대로 둔다.
- **`background.png`**: 흑백 95% + 네이비(`#06438C`) 5%로 색조를 바꾼 평면도다(2026-11-25). 마커의 파란색이 도면 위에서 눈에 띄게 하려는 것이고, 채널 차이가 최대 7/255라 거의 회색으로 보인다. 원본 컬러 이미지는 git 이력(`01e41a7` 이전)에 있다.
- 굵기는 400·500·600·700을 모두 쓴다(700은 로고·표 머리글·시트 탭).
- hallmark의 **브라우저 검사기(`checker.html`)는 돌리지 못했다.** 대신 금지 패턴 검색과 1920×1080, 1440×900, 768×1024, 375×812 실제 화면 확인으로 갈음했다.

## 코드 컨벤션

- 주석·UI 문구는 한국어. 컴포넌트 상단 JSDoc에 동작과 이유를 적는 스타일을 유지한다.
- named export (`export function Foo`), props 타입은 `FooProps`로 export.
- CSS: 공용 모양(`btn`, `inp`, `field`, `tag`, `err`, `skel`, `ibtn`)은 `styles/ui.css`의 짧은 클래스, 컴포넌트 전용은 BEM(`marker__label`, `marker--highlight`)으로 컴포넌트 `.css`에 둔다.
- 순수 로직은 `lib/`에 두고 `lib/__tests__/`에 테스트를 붙인다. 동작이 까다로운 공용 컴포넌트(`SheetGrid`, `Dialog`)는 `components/__tests__/`에 테스트가 있다.
- Supabase 호출을 컴포넌트에 새로 흩뿌리지 않는다. hooks에 둔다.
- 줄바꿈은 `.gitattributes`(`* text=auto`)가 처리한다.

## 알려진 문제 / 개선 후보

코드로 확인한 것들. 고칠 때 우선순위는 사용자와 정한다.

1. **3계층이 만들어질 수 있음**: 자식이 있는 상위 물품을 수정해서 다른 상위 물품 아래로 넣을 수 있다. `validateParent`와 DB 트리거 모두 "수정 대상에게 자식이 있는지"를 보지 않는다.
2. **부모 이동 시 자식이 남음**: 자식이 있는 상위 물품을 다른 수납장으로 옮기면 자식은 원래 수납장에 남는다(부모와 수납장이 어긋남). 원래 수납장 팝업에서는 상위 없는 하위 행으로 보인다.
3. **Storage에 안 쓰는 사진이 쌓임**: 물품 삭제나 사진 교체 때 기존 이미지 파일을 지우지 않는다(`storage.remove` 호출 없음).
4. **해시태그 `#` 처리**: 태그를 입력할 때 `#`를 붙이면 `##겨울`로 표시되고, 검색창에 `#겨울`을 치면 `겨울` 태그가 걸리지 않는다. (검색창 안내문은 "해시태그"로만 적어 두었다)
5. **PasswordGate는 보안 장치가 아니다**: 4자리 비밀번호가 `PasswordGate.tsx`에 하드코딩돼 있고 빌드 번들에도 평문으로 들어간다. anon key도 번들에 있으므로 누구나 Supabase에 직접 읽기·쓰기·삭제가 가능하다. 저장소를 공개하면 비밀번호도 공개된다.
6. **수납장(마커) 삭제는 그 안의 물품도 지운다.** 확인 대화상자가 지워질 물품 수를 알리지만, 물품 사진 파일은 Storage에 남는다(3번과 같은 문제). 삭제는 되돌릴 수 없고 휴지통도 없다.
7. **마커 저장은 일부만 성공할 수 있다**: 마커별 UPDATE라서 일부만 실패하면 성공한 것만 반영하고 실패한 초안은 남긴다(다시 저장 가능). 한 트랜잭션은 아니다.
8. 자동 테스트는 순수 로직, `SheetGrid`, `Dialog`, `useMarkerEditor`(Supabase는 가짜로 바꿔 추가·위치 저장·삭제의 분기를 검증)까지다. `ItemPopup`, `RegisterForm`, `App` 흐름은 자동 테스트가 없다.

## Git

- 기본 브랜치 `main`. Vercel은 `main` push 시 자동 배포된다(연결된 경우).
- GitHub 원격: `https://github.com/WS-Chung/findmythings`(`origin`). 2026-11-25에 이전 버전 이력(루트에 `src/`가 있던 25개 커밋)을 force push로 덮어썼다. **Vercel 프로젝트의 Root Directory는 `deploy`여야 빌드된다**(루트로 두면 `vite: command not found`로 실패한다).
- 초기 셋업·배포 절차(SQL 실행 순서, Vercel 설정)는 `README.md`에 있다.
