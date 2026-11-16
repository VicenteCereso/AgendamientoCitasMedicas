// SOLO SE USA EN EL SERVIDOR (rutas dentro de app/api).
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export function responderError(mensaje: string, status: number) {
  return NextResponse.json({ error: mensaje }, { status });
}

export async function leerBody(req: NextRequest): Promise<any | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// Comprueba que quien llama es un administrador con sesión válida.
// Devuelve el perfil del admin o null.
export async function obtenerAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) {
    console.error('[admin] Sin token de sesión en la petición.');
    return null;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    console.error('[admin] Token inválido o clave de servidor incorrecta:', error?.message);
    return null;
  }

  const { data: perfil, error: errPerfil } = await supabaseAdmin
    .from('medicos')
    .select('id, rol')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();

  if (errPerfil) {
    console.error('[admin] No se pudo leer el perfil (¿SUPABASE_SERVICE_ROLE_KEY correcta?):', errPerfil.message);
    return null;
  }
  if (perfil?.rol !== 'admin') {
    console.error('[admin] El usuario no tiene rol admin en la tabla medicos.');
    return null;
  }
  return perfil;
}
