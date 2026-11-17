// SOLO SE USA EN EL SERVIDOR (rutas dentro de app/api).
// Nunca importes este archivo desde un componente con 'use client'.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cliente: SupabaseClient | null = null;

// El cliente se crea al primer uso (en una petición), no al importar el archivo.
// Así `next build` no falla cuando las variables solo existen en tiempo de ejecución.
function obtenerCliente(): SupabaseClient {
  if (!cliente) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      const faltantes = [!url && 'NEXT_PUBLIC_SUPABASE_URL', !key && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean).join(' y ');
      const ambiente = process.env.VERCEL_ENV || process.env.NODE_ENV || 'desconocido';
      // Solo NOMBRES (nunca valores) de las variables relacionadas, para diagnosticar errores de escritura
      const parecidas = Object.keys(process.env).filter((k) => /SUPA|SERVICE|ROLE/i.test(k));
      console.error(`[supabaseAdmin] Falta ${faltantes} (ambiente: ${ambiente}). Variables relacionadas visibles:`, parecidas);
      throw new Error(`Falta ${faltantes} en las variables de entorno del servidor (ambiente: ${ambiente}).`);
    }
    cliente = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return cliente;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_destino, propiedad) {
    const c = obtenerCliente();
    const valor = Reflect.get(c, propiedad, c);
    return typeof valor === 'function' ? valor.bind(c) : valor;
  },
});
