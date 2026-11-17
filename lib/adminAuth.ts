// SOLO SE USA EN EL SERVIDOR (rutas dentro de app/api).
import { NextRequest, NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
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

// Cualquier médico (o admin) con sesión válida y enlazado en la tabla medicos.
export async function obtenerMedicoSesion(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: perfil } = await supabaseAdmin
    .from('medicos')
    .select('id, nombre, rol')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();

  return perfil || null;
}

// Envuelve un handler de ruta para que cualquier error inesperado (p. ej. variables de
// entorno faltantes) responda JSON con el motivo, en vez de una página 500 sin detalle.
export function conManejoErrores(handler: (req: NextRequest) => Promise<Response>) {
  return async (req: NextRequest): Promise<Response> => {
    try {
      return await handler(req);
    } catch (err) {
      unstable_rethrow(err); // deja pasar las señales internas de Next (prerender, redirect...)
      const mensaje = err instanceof Error ? err.message : String(err);
      console.error(`[api] ${req.method} ${req.nextUrl.pathname}:`, mensaje);
      return responderError('Error del servidor: ' + mensaje, 500);
    }
  };
}
