// Agenda pública: verifica si una cédula ya está registrada.
// POST { cedula }  ->  { existe: false }  |  { existe: true, nombre: "Vic**** Cer***" }
// Nunca devuelve teléfono, correo ni el id del paciente.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { conManejoErrores, leerBody, responderError } from '@/lib/adminAuth';
import { CEDULA, enmascararNombre } from '@/lib/agendaServidor';

async function manejarPOST(req: NextRequest) {
  const body = await leerBody(req);
  const cedula = typeof body?.cedula === 'string' ? body.cedula.trim() : '';
  if (!CEDULA.test(cedula)) return responderError('Ingresa un número de cédula válido.', 400);

  const { data, error } = await supabaseAdmin
    .from('pacientes')
    .select('nombre')
    .eq('cedula', cedula)
    .maybeSingle();
  if (error) throw new Error('No se pudo verificar la cédula: ' + error.message);

  return NextResponse.json(data ? { existe: true, nombre: enmascararNombre(data.nombre) } : { existe: false });
}

export const POST = conManejoErrores(manejarPOST);
