// Agenda pública: reserva una cita.
// Todo se valida en el servidor: médico válido, fecha/hora futura, turno libre y paciente.
//
// POST {
//   medicoId, fecha: "YYYY-MM-DD", hora: "HH:MM", tipoConsulta: "presencial" | "telemedicina",
//   paciente: { modo: "registrado", cedula }
//           | { modo: "nuevo", cedula, nombre, telefono, email? }
// }
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { conManejoErrores, leerBody, responderError } from '@/lib/adminAuth';
import { esPasado } from '@/lib/agenda';
import { CEDULA, FECHA, HORA, obtenerMedicoPublico, obtenerTurnosLibres } from '@/lib/agendaServidor';
import { notificarCita, type ResultadoNotificacion } from '@/lib/notificaciones';

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONO = /^[0-9+\s()-]{7,20}$/;

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Devuelve el id del paciente, o una respuesta de error lista para enviar
async function resolverPaciente(p: Record<string, unknown> | null): Promise<{ id: string } | { error: NextResponse }> {
  const modo = p?.modo;
  const cedula = texto(p?.cedula, 20);
  if (!CEDULA.test(cedula)) return { error: responderError('Ingresa un número de cédula válido.', 400) };

  const { data: existente, error } = await supabaseAdmin.from('pacientes').select('id').eq('cedula', cedula).maybeSingle();
  if (error) throw new Error('No se pudo verificar el paciente: ' + error.message);

  if (modo === 'registrado') {
    if (!existente) {
      return { error: responderError('No encontramos un paciente con esa cédula. Si es tu primera cita, elige "Soy Nuevo Paciente".', 404) };
    }
    return { id: existente.id };
  }

  if (modo !== 'nuevo') return { error: responderError('Solicitud inválida.', 400) };
  if (existente) {
    return { error: responderError('Ya existe un paciente registrado con esa cédula. Elige "Ya soy paciente" para continuar.', 409) };
  }

  const nombre = texto(p?.nombre, 120);
  const telefono = texto(p?.telefono, 20);
  const email = texto(p?.email, 254).toLowerCase();
  if (nombre.length < 3) return { error: responderError('Ingresa el nombre completo del paciente.', 400) };
  if (!TELEFONO.test(telefono)) return { error: responderError('Ingresa un teléfono válido.', 400) };
  if (email && !EMAIL_VALIDO.test(email)) return { error: responderError('El correo electrónico no es válido.', 400) };

  const { data: nuevo, error: errNuevo } = await supabaseAdmin
    .from('pacientes')
    .insert([{ nombre, cedula, telefono, email: email || null }])
    .select('id')
    .single();
  if (errNuevo) {
    if (errNuevo.code === '23505') {
      return { error: responderError('Ya existe un paciente registrado con esa cédula. Elige "Ya soy paciente" para continuar.', 409) };
    }
    throw new Error('No se pudo registrar el paciente: ' + errNuevo.message);
  }
  return { id: nuevo.id };
}

async function manejarPOST(req: NextRequest) {
  const body = await leerBody(req);
  if (!body || typeof body !== 'object') return responderError('Solicitud inválida.', 400);

  const fecha = texto(body.fecha, 10);
  const hora = texto(body.hora, 5);
  const tipoConsulta = body.tipoConsulta === 'telemedicina' ? 'telemedicina' : 'presencial';
  if (!FECHA.test(fecha) || !HORA.test(hora)) return responderError('Selecciona una fecha y un horario válidos.', 400);
  if (esPasado(fecha, hora)) return responderError('No se puede agendar en una fecha u hora que ya pasó.', 400);

  const medico = await obtenerMedicoPublico(texto(body.medicoId, 40));
  if (!medico) return responderError('El médico seleccionado no existe.', 404);

  const libres = await obtenerTurnosLibres(medico.id, fecha);
  if (!libres.includes(hora)) {
    return responderError('Ese horario ya no está disponible. Por favor elige otro.', 409);
  }

  const paciente = await resolverPaciente(typeof body.paciente === 'object' ? body.paciente : null);
  if ('error' in paciente) return paciente.error;

  const fechaHora = `${fecha}T${hora}:00`;
  const enlace = tipoConsulta === 'telemedicina'
    ? `https://meet.jit.si/ConsultaMedica-${medico.id.substring(0, 5)}-${fecha}-${hora.replace(':', '')}`
    : null;

  const { data: cita, error: errCita } = await supabaseAdmin
    .from('citas')
    .insert([{
      medico_id: medico.id,
      paciente_id: paciente.id,
      fecha_hora: fechaHora,
      tipo_consulta: tipoConsulta,
      estado: 'confirmada',
      enlace_videollamada: enlace,
    }])
    .select('id')
    .single();
  if (errCita) {
    if (errCita.code === '23505') return responderError('Ya tienes una cita agendada a esa misma hora.', 409);
    if (errCita.code === '23514') return responderError('La cita no cumple las reglas de la agenda.', 400);
    throw new Error('No se pudo agendar la cita: ' + errCita.message);
  }

  // Dos personas pudieron reservar el mismo turno al mismo tiempo: se conserva la primera
  const { data: mismoTurno } = await supabaseAdmin
    .from('citas')
    .select('id, created_at')
    .eq('medico_id', medico.id)
    .eq('fecha_hora', fechaHora)
    .neq('estado', 'cancelada')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (mismoTurno && mismoTurno.length > 1 && mismoTurno[0].id !== cita.id) {
    await supabaseAdmin.from('citas').delete().eq('id', cita.id);
    return responderError('Ese horario acaba de ser reservado por otra persona. Por favor elige otro.', 409);
  }

  let correo: ResultadoNotificacion;
  try {
    correo = await notificarCita(cita.id, 'agenda_publica');
  } catch (err) {
    console.error('[agenda] Cita creada pero no se pudo notificar:', err instanceof Error ? err.message : err);
    correo = { enviado: false, motivo: 'error' };
  }

  return NextResponse.json({
    ok: true,
    cita: { fecha, hora, tipoConsulta, enlace },
    medico,
    correo,
  });
}

export const POST = conManejoErrores(manejarPOST);
