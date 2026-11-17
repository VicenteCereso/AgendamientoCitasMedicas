// Página pública "Consultar mis citas": próximas citas de un paciente por su cédula.
// POST { cedula }  ->  { citas: [...] }
// Va por el servidor porque las tablas pacientes y citas tienen RLS y el navegador
// sin sesión (anon) ya no puede leerlas. Solo devuelve los datos que la página muestra.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { conManejoErrores, leerBody, responderError } from '@/lib/adminAuth';
import { CEDULA } from '@/lib/agendaServidor';
import { ahoraEcuador } from '@/lib/agenda';

const pad = (n: number) => String(n).padStart(2, '0');

async function manejarPOST(req: NextRequest) {
  const body = await leerBody(req);
  const cedula = typeof body?.cedula === 'string' ? body.cedula.trim() : '';
  if (!CEDULA.test(cedula)) return responderError('Ingresa un número de cédula válido.', 400);

  const { data: paciente, error: errPaciente } = await supabaseAdmin
    .from('pacientes')
    .select('id')
    .eq('cedula', cedula)
    .maybeSingle();
  if (errPaciente) throw new Error('No se pudo verificar la cédula: ' + errPaciente.message);
  if (!paciente) return NextResponse.json({ citas: [] });

  // fecha_hora se guarda como hora local de Ecuador sin zona horaria
  const ahora = ahoraEcuador();
  const desde = `${ahora.fecha}T${pad(Math.floor(ahora.minutos / 60))}:${pad(ahora.minutos % 60)}:00`;

  const { data: citas, error } = await supabaseAdmin
    .from('citas')
    .select('id, fecha_hora, estado, tipo_consulta, enlace_videollamada, medicos ( nombre, especialidad, direccion, consultorio )')
    .eq('paciente_id', paciente.id)
    .gte('fecha_hora', desde)
    .order('fecha_hora', { ascending: true });
  if (error) throw new Error('No se pudieron leer las citas: ' + error.message);

  return NextResponse.json({ citas: citas || [] });
}

export const POST = conManejoErrores(manejarPOST);
