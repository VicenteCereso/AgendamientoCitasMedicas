import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const enNavegador = typeof window !== 'undefined';

// La sesión se guarda en sessionStorage (no en localStorage): se borra al cerrar la
// pestaña o el navegador, para que ningún médico deje su sesión abierta en el equipo.
if (enNavegador) {
  // Limpia sesiones antiguas que quedaron guardadas en localStorage.
  try {
    Object.keys(window.localStorage)
      .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
      .forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Almacenamiento bloqueado: no hay nada que limpiar.
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: enNavegador ? window.sessionStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
