-- ============================================================
-- find-my-things : schema.sql
-- 기존 Supabase 프로젝트 공유 사용을 위해 모든 객체에 'fmt_' 접두사 적용
-- 멱등(IF NOT EXISTS / OR REPLACE / IF EXISTS) 으로 작성되어 재실행해도 안전
-- 실행 순서: 1) schema.sql  2) storage.sql  3) seed.sql
-- ============================================================
--
-- 변경 이력:
--   v1: hashtags 각 원소 길이 검증을 CHECK + subquery 로 작성 → PG 제약 위반 (0A000)
--   v2(현재): hashtag 원소 검증을 트리거로 이동, parent_id 검증과 통합
--
-- ------------------------------------------------------------
-- 1) 확장
-- ------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()
create extension if not exists pg_trgm;    -- gin_trgm_ops (name ILIKE 검색 최적화)

-- ------------------------------------------------------------
-- 2) 이전 시도(v1)에서 만들어졌을 수 있는 잔재 정리 (멱등 — 없으면 no-op)
--    NOTE: DROP TRIGGER IF EXISTS ... ON <table> 은 트리거 존재 여부만 가드하고
--          테이블 자체가 없으면 "relation does not exist" 에러를 던지므로,
--          to_regclass() 로 테이블 존재 여부부터 확인한 뒤 정리한다.
-- ------------------------------------------------------------
do $$ begin
  if to_regclass('public.fmt_items') is not null then
    drop trigger if exists trg_fmt_items_check_parent on public.fmt_items;
    alter table public.fmt_items
      drop constraint if exists fmt_items_hashtags_each_len;
  end if;
end $$;
drop function if exists public.fmt_items_check_parent();

-- ------------------------------------------------------------
-- 3) fmt_locations (수납장 위치)
-- ------------------------------------------------------------
create table if not exists public.fmt_locations (
  id    uuid primary key default gen_random_uuid(),
  name  text not null,
  x_pos integer not null check (x_pos between 0 and 1060),
  y_pos integer not null check (y_pos between 0 and 740)
);

-- ------------------------------------------------------------
-- 4) fmt_items (물품)
--    hashtags 배열 길이(≤4)는 인라인 CHECK로 검증
--    각 hashtag 원소 1..20자 길이는 아래 무결성 트리거에서 검증
--    (PG CHECK 제약은 subquery/foreach 불가)
-- ------------------------------------------------------------
create table if not exists public.fmt_items (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.fmt_locations(id) on delete cascade,
  name        varchar(20) not null check (char_length(name) between 1 and 20),
  hashtags    text[] not null default '{}'
              check (
                array_length(hashtags, 1) is null
                or array_length(hashtags, 1) <= 4
              ),
  image_url   text,
  parent_id   uuid references public.fmt_items(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5) 통합 무결성 트리거
--    (a) 각 hashtag 원소가 1..20자인지
--    (b) parent_id 가 가리키는 row 가 자기 자신의 parent_id 가 NULL 이고
--        동일 location_id 인지 (2계층 보장)
-- ------------------------------------------------------------
create or replace function public.fmt_items_check_integrity()
returns trigger language plpgsql as $$
declare
  p public.fmt_items%rowtype;
  t text;
begin
  -- (a) 해시태그 각 원소 1..20자
  if new.hashtags is not null and array_length(new.hashtags, 1) is not null then
    foreach t in array new.hashtags loop
      if t is null or char_length(t) < 1 or char_length(t) > 20 then
        raise exception 'each hashtag must be 1..20 chars (got %)', coalesce(t, '<null>');
      end if;
    end loop;
  end if;

  -- (b) parent_id 2계층 무결성
  if new.parent_id is not null then
    select * into p from public.fmt_items where id = new.parent_id;
    if not found then
      raise exception 'parent_id % not found', new.parent_id;
    end if;
    if p.parent_id is not null then
      raise exception 'parent must be a top-level item (parent_id null)';
    end if;
    if p.location_id <> new.location_id then
      raise exception 'parent must belong to the same location';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fmt_items_check_integrity on public.fmt_items;
create trigger trg_fmt_items_check_integrity
  before insert or update on public.fmt_items
  for each row execute function public.fmt_items_check_integrity();

-- ------------------------------------------------------------
-- 6) Indexes (검색/조회 최적화)
-- ------------------------------------------------------------
create index if not exists idx_fmt_items_location_id  on public.fmt_items (location_id);
create index if not exists idx_fmt_items_parent_id    on public.fmt_items (parent_id);
create index if not exists idx_fmt_items_name         on public.fmt_items (name);
create index if not exists idx_fmt_items_name_trgm    on public.fmt_items using gin (name gin_trgm_ops);
create index if not exists idx_fmt_items_hashtags_gin on public.fmt_items using gin (hashtags);

-- ------------------------------------------------------------
-- 7) 검색 RPC (이름 또는 해시태그 부분일치, 대소문자 무시)
-- ------------------------------------------------------------
create or replace function public.fmt_search_items(q text)
returns setof public.fmt_items
language sql stable as $$
  select i.*
  from public.fmt_items i
  where q is not null and length(q) > 0
    and (
      i.name ilike '%' || q || '%'
      or exists (
        select 1 from unnest(i.hashtags) t
        where t ilike '%' || q || '%'
      )
    );
$$;

-- ------------------------------------------------------------
-- 8) RLS : anon 전체 허용 (1인용 취미 서비스 정책)
-- ------------------------------------------------------------
alter table public.fmt_locations enable row level security;
alter table public.fmt_items     enable row level security;

drop policy if exists "fmt_locations anon select" on public.fmt_locations;
create policy "fmt_locations anon select"
  on public.fmt_locations for select
  to anon using (true);

drop policy if exists "fmt_items anon select" on public.fmt_items;
create policy "fmt_items anon select"
  on public.fmt_items for select
  to anon using (true);

drop policy if exists "fmt_items anon insert" on public.fmt_items;
create policy "fmt_items anon insert"
  on public.fmt_items for insert
  to anon with check (true);

drop policy if exists "fmt_items anon update" on public.fmt_items;
create policy "fmt_items anon update"
  on public.fmt_items for update
  to anon using (true) with check (true);

drop policy if exists "fmt_items anon delete" on public.fmt_items;
create policy "fmt_items anon delete"
  on public.fmt_items for delete
  to anon using (true);

-- RPC 실행 권한
grant execute on function public.fmt_search_items(text) to anon;
