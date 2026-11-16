// SOLO SE USA EN EL SERVIDOR (rutas dentro de app/api).
// Nunca importes este archivo desde un componente con 'use client'.
import { createClient } from '@supabase/supabase-js';


export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);