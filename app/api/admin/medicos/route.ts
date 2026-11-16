import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';


export const runtime = 'nodejs';

const DOMINIO_INTERNO = 'agendamiento.internal';
const REGEX_USUARIO = /^[a-z0-9._-]{3,30}$/;

function responderError(mensaje: string, status: number) {
  return NextResponse.json({ error: mensaje }, { status });
}

function mensajeAuth(msg?: string) {
  if (msg && /already|registered|exists/i.test(msg)) return 'Ese usuario ya existe.';
  return 'No se pudo crear la cuenta: ' + (msg || 'error desconocido');
}

// Comprueba que quien llama es un administrador con sesión válida.
async function obtenerAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: perfil } = await supabaseAdmin
    .from('medicos')
    .select('id, rol')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();

  return perfil?.rol === 'admin' ? perfil : null;
}

export async function POST(req: NextRequest) {
  const admin = await obtenerAdmin(req);
  if (!admin) return responderError('No autorizado.', 403);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return responderError('Datos inválidos.', 400);
  }

  const usuario = String(body.usuario || '').trim().toLowerCase();
  const password = String(body.password || '');
  const medicoId: string | null = body.medicoId || null;

  if (!REGEX_USUARIO.test(usuario)) {
    return responderError(
      'El usuario debe tener entre 3 y 30 caracteres: letras minúsculas, números, punto, guion o guion bajo.',
      400
    );
  }
  if (password.length < 8) {
    return responderError('La contraseña debe tener al menos 8 caracteres.', 400);
  }

  // El usuario no puede repetirse
  const { data: repetido } = await supabaseAdmin
    .from('medicos')
    .select('id')
    .eq('usuario', usuario)
    .maybeSingle();
  if (repetido && repetido.id !== medicoId) {
    return responderError('Ese usuario ya existe.', 409);
  }

  const emailInterno = `${usuario}@${DOMINIO_INTERNO}`;

  // ---- CASO 1: médico que ya existe (dar acceso o cambiar usuario/contraseña) ----
  if (medicoId) {
    const { data: medico } = await supabaseAdmin
      .from('medicos')
      .select('id, rol, auth_user_id')
      .eq('id', medicoId)
      .maybeSingle();

    if (!medico) return responderError('Médico no encontrado.', 404);
    if (medico.rol === 'admin') {
      return responderError('La cuenta de administrador no se gestiona desde aquí.', 403);
    }

    let authId = medico.auth_user_id as string | null;
    let creadoAhora = false;

    if (authId) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(authId, {
        email: emailInterno,
        password,
        email_confirm: true,
      });
      if (error) return responderError(mensajeAuth(error.message), 400);
    } else {
      const { data: nuevo, error } = await supabaseAdmin.auth.admin.createUser({
        email: emailInterno,
        password,
        email_confirm: true,
      });
      if (error || !nuevo.user) return responderError(mensajeAuth(error?.message), 400);
      authId = nuevo.user.id;
      creadoAhora = true;
    }

    const { error: errDb } = await supabaseAdmin
      .from('medicos')
      .update({ usuario, auth_user_id: authId })
      .eq('id', medicoId);

    if (errDb) {
      if (creadoAhora && authId) await supabaseAdmin.auth.admin.deleteUser(authId);
      return responderError('No se pudo guardar el usuario: ' + errDb.message, 500);
    }

    return NextResponse.json({ ok: true, id: medicoId, usuario });
  }

  // ---- CASO 2: médico nuevo ----
  const nombre = String(body.nombre || '').trim();
  if (!nombre) return responderError('El nombre es obligatorio.', 400);

  const { data: nuevo, error: errAuth } = await supabaseAdmin.auth.admin.createUser({
    email: emailInterno,
    password,
    email_confirm: true,
  });
  if (errAuth || !nuevo.user) return responderError(mensajeAuth(errAuth?.message), 400);

  const { data: medico, error: errDb } = await supabaseAdmin
    .from('medicos')
    .insert([
      {
        nombre,
        especialidad: String(body.especialidad || '').trim(),
        email: String(body.email || '').trim() || null,
        telefono: String(body.telefono || '').trim(),
        rol: 'medico', // el rol SIEMPRE lo decide el servidor, nunca el navegador
        tiene_historia_clinica: body.tiene_historia_clinica !== false,
        usuario,
        auth_user_id: nuevo.user.id,
      },
    ])
    .select('id')
    .single();

  if (errDb || !medico) {
    await supabaseAdmin.auth.admin.deleteUser(nuevo.user.id); // deshacer la cuenta creada
    return responderError('No se pudo registrar el médico: ' + (errDb?.message || ''), 500);
  }

  return NextResponse.json({ ok: true, id: medico.id, usuario });
}