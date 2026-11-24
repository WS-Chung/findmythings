# Find My Things

집 안 물건을 어디에 뒀는지 평면도 위 수납장 마커로 기록하고, 검색창으로 바로 찾아 주는 1인용 개인 웹앱.

- 검색창에 한 글자만 입력해도 이름·해시태그가 일치하는 물건이 나오고, 결과를 누르면 그 물건이 있는 수납장 마커가 평면도에서 깜빡인다.
- 마커를 누르면 그 수납장의 물건 목록이 뜨고, 여기서 등록·수정·삭제한다. 물건은 "보관함 → 안의 물건" 2단계까지 넣을 수 있고 사진(300×300 자동 축소)을 붙일 수 있다.

## 기술 스택

- Vite + React + TypeScript (SPA)
- Supabase: Postgres + Storage, 브라우저에서 anon key로 직접 호출 (서버 코드 없음)
- Vercel 호스팅

## 폴더 구조

```
deploy/   앱 코드 전체 (Vercel Root Directory)
db/       Supabase SQL Editor에서 실행하는 SQL (schema → storage → seed)
```

## 로컬 개발

`deploy/.env.local.example`을 복사해 `deploy/.env.local`을 만들고 값을 채운 뒤:

```bash
cd deploy
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm run test:run
npm run build
```

`.env.local`:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

`.env.local`은 git에 올리지 않는다. 테스트도 이 파일이 있어야 통과한다.

## Supabase 셋업

DB 객체는 모두 `fmt_` 접두사(버킷은 `fmt-item-images`)를 써서, 다른 앱과 같은 Supabase 프로젝트를 써도 충돌하지 않는다.

1. Supabase 콘솔 **SQL Editor**에서 아래 파일을 순서대로 실행한다. 모두 멱등이라 다시 실행해도 안전하다.
   1. `db/schema.sql`: 테이블 `fmt_locations`, `fmt_items`, 무결성 트리거, 인덱스, RLS
   2. `db/storage.sql`: `fmt-item-images` 버킷과 정책
   3. `db/seed.sql`: 수납장(마커) 시드. 좌표는 평면도에 맞게 고쳐서 쓴다.
2. **Project Settings → API**에서 Project URL과 `anon` `public` key를 복사해 `.env.local`에 넣는다.

마커 좌표는 1060×740 평면도 기준 픽셀이다. 위치를 고칠 때는 Table Editor에서 바꾸거나 SQL로 업데이트한다.

```sql
update public.fmt_locations set x_pos = 230, y_pos = 410 where name = '거실 수납장';
```

## Vercel 배포

1. GitHub 저장소를 Vercel에 Import한다.
2. **Root Directory를 `deploy`로 설정**한다. Framework Preset은 Vite로 자동 감지된다 (Build `npm run build`, Output `dist`).
3. **Environment Variables**에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 등록한다. `.env.local`은 저장소에 없으므로 이 등록이 꼭 필요하다.
4. 이후 `main` 브랜치에 push하면 자동 배포된다.

## 보안 정책

개인용 취미 앱이라 단순하게 운영한다.

- 로그인 없음. anon key로 `fmt_items` 전체 CRUD를 허용한다(RLS는 켜 두고 anon 정책으로 허용).
- 앱 진입 시 4자리 비밀번호 화면이 있지만 클라이언트에서만 확인하는 가림막일 뿐 보안 장치는 아니다.
- `service_role` key는 코드, 저장소, Vercel 환경변수 어디에도 넣지 않는다.
