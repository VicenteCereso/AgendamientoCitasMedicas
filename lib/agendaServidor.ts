// SOLO SERVIDOR. Consultas de agenda para la página pública de reservas.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { turnosLibres, type CitaAgenda, type DisponibilidadAgenda } from '@/lib/agenda';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const FECHA = /^\d{4}-\d{2}-\d{2}$/;
export const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
export const CEDULA = /^[A-Za-z0-9]{6,15}$/;

export interface MedicoPublico {
  id: string;
  nombre: string;
  especialidad: string;
  direccion: string | null;
  consultorio: string | null;
}

// Médico que atiende (nunca el administrador)
export async function obtenerMedicoPublico(medicoId: string): Promise<MedicoPublico | null> {
  if (!UUID.test(medicoId)) return null;
  const { data, error } = await supabaseAdmin
    .from('medicos')
    .select('id, nombre, especialidad, direccion, consultorio, rol')
    .eq('id', medicoId)
    .maybeSingle();
  if (error) throw new Error('No se pudo leer el médico: ' + error.message);
  if (!data || data.rol === 'admin') return null;
  return { id: data.id, nombre: data.nombre, especialidad: data.especialidad, direccion: data.direccion, consultorio: data.consultorio };
}

function diaSiguiente(fecha: string) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Turnos libres y futuros de un médico en una fecha. Las citas canceladas liberan su horario.
export async function obtenerTurnosLibres(medicoId: string, fecha: string): Promise<string[]> {
  const [disp, citas] = await Promise.all([
    supabaseAdmin.from('disponibilidad_medico').select('*').eq('medico_id', medicoId),
    supabaseAdmin
      .from('citas')
      .select('fecha_hora, estado')
      .eq('medico_id', medicoId)
      .neq('estado', 'cancelada')
      .gte('fecha_hora', `${fecha}T00:00:00`)
      .lt('fecha_hora', `${diaSiguiente(fecha)}T00:00:00`),
  ]);
  if (disp.error) throw new Error('No se pudo leer la disponibilidad: ' + disp.error.message);
  if (citas.error) throw new Error('No se pudieron leer las citas: ' + citas.error.message);
  return turnosLibres((disp.data || []) as DisponibilidadAgenda[], (citas.data || []) as CitaAgenda[], fecha);
}

// "Vicente Cereso Goya" -> "Vic**** Cer*** G***" (confirma la identidad sin exponer el nombre)
export function enmascararNombre(nombre: string) {
  return nombre
    .trim()
    .split(/\s+/)
    .map((p) => {
      const visibles = p.length <= 3 ? 1 : 3;
      return p.slice(0, visibles) + '*'.repeat(Math.max(1, p.length - visibles));
    })
    .join(' ');
}
