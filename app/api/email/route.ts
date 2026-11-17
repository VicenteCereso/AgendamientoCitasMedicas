// Notificación de cita por correo (Brevo SMTP), usada por el panel del médico (requiere sesión).
// La agenda pública notifica desde /api/agenda/citas.
// El mensaje se arma en lib/notificaciones.ts con datos de la base; cada cita se notifica una sola vez.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { obtenerMedicoSesion, leerBody, responderError, conManejoErrores } from '@/lib/adminAuth';
import { notificarCita } from '@/lib/notificaciones';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Respuesta: { enviado: boolean, motivo?: 'sin_correo' | 'ya_enviado' | 'limite' | 'no_configurado' | 'error' }
async function manejarPOST(req: NextRequest) {
  const medico = await obtenerMedicoSesion(req);
  if (!medico) return responderError('No autorizado.', 403);

  const body = await leerBody(req);
  if (!body || body.tipo !== 'confirmacion_cita') return responderError('Solicitud inválida.', 400);

  const medicoId = typeof body.medicoId === 'string' ? body.medicoId : '';
  const pacienteId = typeof body.pacienteId === 'string' ? body.pacienteId : '';
  const fechaHora = typeof body.fechaHora === 'string' ? body.fechaHora.slice(0, 40) : '';
  if (!UUID.test(medicoId) || !UUID.test(pacienteId) || !fechaHora) {
    return responderError('Faltan datos de la cita.', 400);
  }

  const { data: cita, error } = await supabaseAdmin
    .from('citas')
    .select('id')
    .eq('medico_id', medicoId)
    .eq('paciente_id', pacienteId)
    .eq('fecha_hora', fechaHora)
    .neq('estado', 'cancelada')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[email] No se pudo leer la cita:', error.message);
    return responderError('No se pudo validar la cita.', 500);
  }
  if (!cita) return responderError('La cita no existe.', 404);

  return NextResponse.json(await notificarCita(cita.id, 'medico'));
}

export const POST = conManejoErrores(manejarPOST);
