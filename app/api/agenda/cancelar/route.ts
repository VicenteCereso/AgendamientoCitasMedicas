// Página pública "Consultar mis citas": el paciente cancela una de sus citas.
// POST { cedula, citaId }  ->  { ok: true }
// Solo cancela si la cita pertenece al paciente de esa cédula, no ha pasado
// y no está ya cancelada o atendida. Al cancelarse, el turno vuelve a quedar libre.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { conManejoErrores, leerBody, responderError } from '@/lib/adminAuth';
import { CEDULA, UUID } from '@/lib/agendaServidor';
import { esPasado, partesFechaHora } from '@/lib/agenda';

const NO_CANCELABLES = ['cancelada', 'atendida', 'completada', 'no_asistio'];

async function manejarPOST(req: NextRequest) {
  const body = await leerBody(req);
  const cedula = typeof body?.cedula === 'string' ? body.cedula.trim() : '';
  const citaId = typeof body?.citaId === 'string' ? body.citaId : '';
  if (!CEDULA.test(cedula) || !UUID.test(citaId)) return responderError('Datos inválidos.', 400);

  const { data: cita, error } = await supabaseAdmin
    .from('citas')
    .select('id, fecha_hora, estado, pacientes!inner ( cedula )')
    .eq('id', citaId)
    .eq('pacientes.cedula', cedula)
    .maybeSingle();
  if (error) throw new Error('No se pudo leer la cita: ' + error.message);
  if (!cita) return responderError('Cita no encontrada.', 404);

  if (NO_CANCELABLES.includes(cita.estado ?? '')) return responderError('Esta cita ya no se puede cancelar.', 409);
  const { fecha, hora } = partesFechaHora(String(cita.fecha_hora));
  if (esPasado(fecha, hora)) return responderError('La cita ya pasó y no se puede cancelar.', 409);

  const { error: errUpdate } = await supabaseAdmin.from('citas').update({ estado: 'cancelada' }).eq('id', cita.id);
  if (errUpdate) throw new Error('No se pudo cancelar la cita: ' + errUpdate.message);

  return NextResponse.json({ ok: true });
}

export const POST = conManejoErrores(manejarPOST);
