import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { leerBody, obtenerAdmin, responderError } from '@/lib/adminAuth';
import { NextRequest, NextResponse } from 'next/server';


// Se ejecuta en Node.js (runtime por defecto). No declarar `runtime`:
// es incompatible con `cacheComponents` en next.config.

const DOMINIO_INTERNO = 'agendamiento.internal';
const REGEX_USUARIO = /^[a-z0-9._-]{3,30}$/;

function mensajeAuth(msg?: string) {
  if (msg && /already|registered|exists/i.test(msg)) return 'Ese usuario ya existe.';
  return 'No se pudo crear la cuenta: ' + (msg || 'error desconocido');
}

// Valida usuario/contraseña y que el usuario no lo tenga otro médico.
// Devuelve un mensaje de error o null si todo está bien.
async function validarCredenciales(usuario: string, password: string, medicoId: string | null) {
  if (!REGEX_USUARIO.test(usuario)) {
    return 'El usuario debe tener entre 3 y 30 caracteres: letras minúsculas, números, punto, guion o guion bajo.';
  }
  if (password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  const { data: repetido } = await supabaseAdmin
    .from('medicos')
    .select('id')
    .eq('usuario', usuario)
    .maybeSingle();
  if (repetido && repetido.id !== medicoId) return 'Ese usuario ya existe.';
  return null;
}

// Busca la especialidad del catálogo. Solo se permite una inactiva si el médico ya la tenía asignada.
async function resolverEspecialidad(especialidadId: string, especialidadActualId: string | null) {
  if (!especialidadId) return { error: 'Selecciona una especialidad.' };
  const { data } = await supabaseAdmin
    .from('especialidades')
    .select('id, nombre, activo')
    .eq('id', especialidadId)
    .maybeSingle();
  if (!data) return { error: 'La especialidad seleccionada no existe.' };
  if (!data.activo && data.id !== especialidadActualId) {
    return { error: 'La especialidad seleccionada está desactivada.' };
  }
  return { especialidad: data };
}

// Solo los campos de perfil que el administrador puede cambiar.
// El rol y el auth_user_id NUNCA se toman del navegador.
function camposPerfil(body: any) {
  return {
    nombre: String(body.nombre || '').trim(),
    email: String(body.email || '').trim() || null,
    telefono: String(body.telefono || '').trim(),
    tiene_historia_clinica: body.tiene_historia_clinica !== false,
  };
}

// ---- Registrar un médico nuevo con su cuenta de acceso ----
export async function POST(req: NextRequest) {
  const admin = await obtenerAdmin(req);
  if (!admin) return responderError('No autorizado.', 403);

  const body = await leerBody(req);
  if (!body) return responderError('Datos inválidos.', 400);

  const perfil = camposPerfil(body);
  if (!perfil.nombre) return responderError('El nombre es obligatorio.', 400);

  const esp = await resolverEspecialidad(String(body.especialidadId || ''), null);
  if (esp.error) return responderError(esp.error, 400);

  const usuario = String(body.usuario || '').trim().toLowerCase();
  const password = String(body.password || '');
  const errCred = await validarCredenciales(usuario, password, null);
  if (errCred) return responderError(errCred, errCred === 'Ese usuario ya existe.' ? 409 : 400);

  const { data: nuevo, error: errAuth } = await supabaseAdmin.auth.admin.createUser({
    email: `${usuario}@${DOMINIO_INTERNO}`,
    password,
    email_confirm: true,
  });
  if (errAuth || !nuevo.user) return responderError(mensajeAuth(errAuth?.message), 400);

  const { data: medico, error: errDb } = await supabaseAdmin
    .from('medicos')
    .insert([{
      ...perfil,
      especialidad_id: esp.especialidad!.id,
      especialidad: esp.especialidad!.nombre,
      rol: 'medico',
      usuario,
      auth_user_id: nuevo.user.id,
    }])
    .select('id')
    .single();

  if (errDb || !medico) {
    await supabaseAdmin.auth.admin.deleteUser(nuevo.user.id); // deshacer la cuenta creada
    return responderError('No se pudo registrar el médico: ' + (errDb?.message || ''), 500);
  }

  return NextResponse.json({ ok: true, id: medico.id, usuario });
}

// ---- Editar un médico existente (datos y, opcionalmente, usuario/contraseña) ----
export async function PATCH(req: NextRequest) {
  const admin = await obtenerAdmin(req);
  if (!admin) return responderError('No autorizado.', 403);

  const body = await leerBody(req);
  if (!body) return responderError('Datos inválidos.', 400);

  const medicoId = String(body.medicoId || '');
  if (!medicoId) return responderError('Falta el médico a editar.', 400);

  const perfil = camposPerfil(body);
  if (!perfil.nombre) return responderError('El nombre es obligatorio.', 400);

  const { data: medico } = await supabaseAdmin
    .from('medicos')
    .select('id, rol, auth_user_id, especialidad_id')
    .eq('id', medicoId)
    .maybeSingle();
  if (!medico) return responderError('Médico no encontrado.', 404);

  const esp = await resolverEspecialidad(String(body.especialidadId || ''), medico.especialidad_id);
  if (esp.error) return responderError(esp.error, 400);

  const password = String(body.password || '');
  const cambiarAcceso = password.length > 0;
  const usuario = String(body.usuario || '').trim().toLowerCase();

  if (cambiarAcceso) {
    if (medico.rol === 'admin') {
      return responderError('La cuenta de administrador no se gestiona desde aquí.', 403);
    }
    const errCred = await validarCredenciales(usuario, password, medicoId);
    if (errCred) return responderError(errCred, errCred === 'Ese usuario ya existe.' ? 409 : 400);
  }

  let authId = medico.auth_user_id as string | null;
  let creadoAhora = false;

  if (cambiarAcceso) {
    const emailInterno = `${usuario}@${DOMINIO_INTERNO}`;
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
  }

  const datosPerfil = {
    ...perfil,
    especialidad_id: esp.especialidad!.id,
    especialidad: esp.especialidad!.nombre,
  };
  const cambios = cambiarAcceso ? { ...datosPerfil, usuario, auth_user_id: authId } : datosPerfil;
  const { error: errDb } = await supabaseAdmin.from('medicos').update(cambios).eq('id', medicoId);

  if (errDb) {
    if (creadoAhora && authId) await supabaseAdmin.auth.admin.deleteUser(authId);
    return responderError('No se pudo guardar el médico: ' + errDb.message, 500);
  }

  return NextResponse.json({ ok: true, id: medicoId, usuario: cambiarAcceso ? usuario : undefined });
}
