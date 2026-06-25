import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // 빌드/런타임 모두에서 누락을 즉시 감지할 수 있도록 throw 한다.
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check your .env.local.",
  );
}

export const supabase = createClient(url, anon, {
  auth: { persistSession: false },
});
