-- ============================================================
-- find-my-things : storage.sql
-- 'fmt-item-images' 버킷 생성 + anon 쓰기 + 공개 read 정책
-- (Storage 버킷 ID는 '_' 미허용 → '-' 사용)
-- 멱등(on conflict / drop ... if exists)으로 재실행 안전
-- 실행 순서: 1) schema.sql  2) storage.sql  3) seed.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1) 버킷 생성 (public)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('fmt-item-images', 'fmt-item-images', true)
on conflict (id) do update set public = excluded.public;

-- ------------------------------------------------------------
-- 2) 기존 정책 정리
-- ------------------------------------------------------------
drop policy if exists "fmt-item-images public read"  on storage.objects;
drop policy if exists "fmt-item-images anon insert"  on storage.objects;
drop policy if exists "fmt-item-images anon update"  on storage.objects;
drop policy if exists "fmt-item-images anon delete"  on storage.objects;

-- ------------------------------------------------------------
-- 3) public read (버킷 자체가 public이지만 정책으로 한 번 더 명시)
-- ------------------------------------------------------------
create policy "fmt-item-images public read"
  on storage.objects for select
  to anon
  using (bucket_id = 'fmt-item-images');

-- ------------------------------------------------------------
-- 4) anon insert (업로드)
-- ------------------------------------------------------------
create policy "fmt-item-images anon insert"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'fmt-item-images');

-- ------------------------------------------------------------
-- 5) anon update (수정 시 덮어쓰기 허용)
-- ------------------------------------------------------------
create policy "fmt-item-images anon update"
  on storage.objects for update
  to anon
  using (bucket_id = 'fmt-item-images')
  with check (bucket_id = 'fmt-item-images');

-- ------------------------------------------------------------
-- 6) anon delete (물품 삭제 시 객체 정리)
-- ------------------------------------------------------------
create policy "fmt-item-images anon delete"
  on storage.objects for delete
  to anon
  using (bucket_id = 'fmt-item-images');
