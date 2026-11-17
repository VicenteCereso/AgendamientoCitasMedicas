// Reporte de correos enviados (solo administrador) para controlar el cupo de Brevo.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { obtenerAdmin, responderError, conManejoErrores } from '@/lib/adminAuth';
import { LIMITE_DIARIO, LIMITE_MENSUAL, contarEnviadosDesde, hoyLocal, inicioDiaUTC } from '@/lib/correo';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_REGISTROS = 1000;

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// GET /api/admin/correos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
async function manejarGET(req: NextRequest) {
  const admin = await obtenerAdmin(req);
  if (!admin) return responderError('No autorizado.', 403);

  const hoy = hoyLocal();
  const params = req.nextUrl.searchParams;
  const desde = FECHA.test(params.get('desde') || '') ? params.get('desde')! : `${hoy.slice(0, 8)}01`;
  const hasta = FECHA.test(params.get('hasta') || '') ? params.get('hasta')! : hoy;
  if (hasta < desde) return responderError('La fecha "hasta" debe ser posterior a "desde".', 400);

  try {
    const [enviadosHoy, enviadosMes, consulta] = await Promise.all([
      contarEnviadosDesde(inicioDiaUTC(hoy)),
      contarEnviadosDesde(inicioDiaUTC(`${hoy.slice(0, 8)}01`)),
      supabaseAdmin
        .from('correos_enviados')
        .select('id, created_at, tipo, destinatario, asunto, estado, error, origen, pacientes(nombre), medicos(nombre)', { count: 'exact' })
        .gte('created_at', inicioDiaUTC(desde))
        .lt('created_at', inicioDiaUTC(sumarDias(hasta, 1)))
        .order('created_at', { ascending: false })
        .limit(MAX_REGISTROS),
    ]);

    if (consulta.error) throw new Error(consulta.error.message);

    return NextResponse.json({
      hoy,
      desde,
      hasta,
      limiteDiario: LIMITE_DIARIO,
      limiteMensual: LIMITE_MENSUAL,
      enviadosHoy,
      enviadosMes,
      total: consulta.count || 0,
      truncado: (consulta.count || 0) > MAX_REGISTROS,
      registros: consulta.data || [],
    });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error('[correos] Error generando el reporte:', mensaje);
    return responderError('No se pudo generar el reporte: ' + mensaje, 500);
  }
}

export const GET = conManejoErrores(manejarGET);
