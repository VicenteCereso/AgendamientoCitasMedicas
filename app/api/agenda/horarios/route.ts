// Agenda pública: turnos libres de un médico en una fecha.
// GET /api/agenda/horarios?medicoId=<uuid>&fecha=YYYY-MM-DD  ->  { horarios: ["09:00", ...] }
import { NextRequest, NextResponse } from 'next/server';
import { conManejoErrores, responderError } from '@/lib/adminAuth';
import { FECHA, obtenerMedicoPublico, obtenerTurnosLibres } from '@/lib/agendaServidor';

async function manejarGET(req: NextRequest) {
  const medicoId = req.nextUrl.searchParams.get('medicoId') || '';
  const fecha = req.nextUrl.searchParams.get('fecha') || '';
  if (!FECHA.test(fecha)) return responderError('Fecha inválida.', 400);

  const medico = await obtenerMedicoPublico(medicoId);
  if (!medico) return responderError('Médico no encontrado.', 404);

  return NextResponse.json({ horarios: await obtenerTurnosLibres(medico.id, fecha) });
}

export const GET = conManejoErrores(manejarGET);
