import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { leerBody, obtenerAdmin, responderError, conManejoErrores } from '@/lib/adminAuth';
import { NextRequest, NextResponse } from 'next/server';

// Mantenedor de especialidades (solo administradores).
// La lectura se hace desde el navegador (RLS de solo lectura); las escrituras pasan por aquí.

const TIPOS_ATENCION = ['medica', 'psicologica'] as const;

function mensajeDb(err: { code?: string; message: string }) {
  if (err.code === '23505') return 'Ya existe una especialidad con ese nombre.';
  return err.message;
}

// ---- Crear especialidad ----
async function manejarPOST(req: NextRequest) {
  const admin = await obtenerAdmin(req);
  if (!admin) return responderError('No autorizado.', 403);

  const body = await leerBody(req);
  if (!body) return responderError('Datos inválidos.', 400);

  const nombre = String(body.nombre || '').trim().replace(/\s+/g, ' ');
  const tipo = String(body.tipo_atencion || 'medica');
  if (nombre.length < 3 || nombre.length > 80) {
    return responderError('El nombre debe tener entre 3 y 80 caracteres.', 400);
  }
  if (!TIPOS_ATENCION.includes(tipo as any)) return responderError('Tipo de atención inválido.', 400);

  const { data, error } = await supabaseAdmin
    .from('especialidades')
    .insert([{ nombre, tipo_atencion: tipo, activo: true }])
    .select('*')
    .single();

  if (error) return responderError(mensajeDb(error), error.code === '23505' ? 409 : 500);
  return NextResponse.json({ ok: true, especialidad: data });
}

// ---- Editar, desactivar (eliminación lógica) o reactivar ----
async function manejarPATCH(req: NextRequest) {
  const admin = await obtenerAdmin(req);
  if (!admin) return responderError('No autorizado.', 403);

  const body = await leerBody(req);
  if (!body) return responderError('Datos inválidos.', 400);

  const id = String(body.id || '');
  if (!id) return responderError('Falta la especialidad a editar.', 400);

  const cambios: Record<string, any> = { updated_at: new Date().toISOString() };

  if (body.nombre !== undefined) {
    const nombre = String(body.nombre || '').trim().replace(/\s+/g, ' ');
    if (nombre.length < 3 || nombre.length > 80) {
      return responderError('El nombre debe tener entre 3 y 80 caracteres.', 400);
    }
    cambios.nombre = nombre;
  }
  if (body.tipo_atencion !== undefined) {
    if (!TIPOS_ATENCION.includes(body.tipo_atencion)) return responderError('Tipo de atención inválido.', 400);
    cambios.tipo_atencion = body.tipo_atencion;
  }
  if (body.activo !== undefined) cambios.activo = body.activo === true;

  const { data, error } = await supabaseAdmin
    .from('especialidades')
    .update(cambios)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) return responderError(mensajeDb(error), error.code === '23505' ? 409 : 500);
  if (!data) return responderError('Especialidad no encontrada.', 404);

  // Mantener sincronizado el nombre que se muestra en agendar, consultar, recetas, etc.
  if (cambios.nombre) {
    const { error: errSync } = await supabaseAdmin
      .from('medicos')
      .update({ especialidad: cambios.nombre })
      .eq('especialidad_id', id);
    if (errSync) console.error('[admin/especialidades] No se pudo sincronizar el nombre en medicos:', errSync.message);
  }

  return NextResponse.json({ ok: true, especialidad: data });
}

export const POST = conManejoErrores(manejarPOST);
export const PATCH = conManejoErrores(manejarPATCH);
