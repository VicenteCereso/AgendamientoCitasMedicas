// Notificación de cita por correo (Brevo SMTP). La configuración está en lib/correo.ts.
//
// Solo se notifica una cita que existe en la base. Destinatario, nombres, modalidad y enlace
// se leen de la base de datos (no del navegador), así la ruta no puede usarse para enviar
// correos arbitrarios. Cada cita se notifica una sola vez.
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { obtenerMedicoSesion, leerBody, responderError } from '@/lib/adminAuth';
import { enviarCorreo, esc } from '@/lib/correo';

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CitaConDatos = {
  id: string;
  fecha_hora: string;
  tipo_consulta: string | null;
  enlace_videollamada: string | null;
  pacientes: { nombre: string | null; email: string | null } | null;
  medicos: { nombre: string | null } | null;
};

// Solo enlaces de Jitsi generados por el sistema
function enlaceSeguro(valor: unknown): string | null {
  return typeof valor === 'string' && /^https:\/\/meet\.jit\.si\/[\w-]+$/.test(valor) ? valor : null;
}

// "2026-11-17T10:30:00" -> texto legible, sin depender de la zona horaria del servidor
function formatearFecha(fechaHora: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(fechaHora);
  if (!m) return esc(fechaHora);
  const fecha = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return fecha.toLocaleString('es-EC', { dateStyle: 'full', timeStyle: 'short' });
}

function correoConfirmacion(cita: CitaConDatos, fechaHora: string) {
  const nombreMedico = cita.medicos?.nombre || '';
  const esTele = cita.tipo_consulta === 'telemedicina';
  const enlace = esTele ? enlaceSeguro(cita.enlace_videollamada) : null;

  return {
    asunto: `Confirmación de ${esTele ? 'Teleconsulta' : 'Cita'} — Dr(a). ${nombreMedico}`,
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc;">
      <h2 style="color: #2563eb; text-align: center;">Confirmación de ${esTele ? 'Teleconsulta' : 'Cita'}</h2>
      <p>Estimado/a <strong>${esc(cita.pacientes?.nombre)}</strong>,</p>
      <p>Su cita ha sido agendada con éxito. A continuación los detalles:</p>
      <div style="background: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; margin: 20px 0;">
        <p><strong>Profesional:</strong> Dr(a). ${esc(nombreMedico)}</p>
        <p><strong>Fecha y Hora:</strong> ${formatearFecha(fechaHora)}</p>
        <p><strong>Modalidad:</strong> ${esTele ? 'TELEMEDICINA (videollamada)' : 'PRESENCIAL'}</p>
      </div>
      ${enlace ? `
      <div style="text-align: center; margin: 24px 0;">
        <a href="${enlace}" target="_blank" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: bold; padding: 12px 24px; border-radius: 8px;">Unirse a la Videollamada</a>
        <p style="font-size: 12px; color: #64748b; margin-top: 10px;">Si el botón no funciona, copie este enlace en su navegador:<br><a href="${enlace}" style="color: #2563eb;">${enlace}</a></p>
      </div>` : ''}
      <p style="font-size: 12px; color: #64748b; text-align: center;">${
        esTele
          ? 'Ingrese al enlace 5 minutos antes de la hora indicada, desde un lugar con buena conexión, cámara y micrófono.'
          : 'Por favor, procure estar 5 minutos antes de su cita.'
      } Si necesita reagendar, comuníquese con el centro médico.</p>
    </div>`,
  };
}

// Respuesta: { enviado: boolean, motivo?: 'sin_correo' | 'ya_enviado' | 'limite' | 'no_configurado' | 'error' }
export async function POST(req: NextRequest) {
  const body = await leerBody(req);
  if (!body || body.tipo !== 'confirmacion_cita') return responderError('Solicitud inválida.', 400);

  const medicoId = typeof body.medicoId === 'string' ? body.medicoId : '';
  const pacienteId = typeof body.pacienteId === 'string' ? body.pacienteId : '';
  const fechaHora = typeof body.fechaHora === 'string' ? body.fechaHora.slice(0, 40) : '';
  if (!UUID.test(medicoId) || !UUID.test(pacienteId) || !fechaHora) {
    return responderError('Faltan datos de la cita.', 400);
  }

  const { data, error } = await supabaseAdmin
    .from('citas')
    .select('id, fecha_hora, tipo_consulta, enlace_videollamada, pacientes(nombre, email), medicos(nombre)')
    .eq('medico_id', medicoId)
    .eq('paciente_id', pacienteId)
    .eq('fecha_hora', fechaHora)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[email] No se pudo leer la cita:', error.message);
    return responderError('No se pudo validar la cita.', 500);
  }
  const cita = data as unknown as CitaConDatos | null;
  if (!cita) return responderError('La cita no existe.', 404);

  // El paciente debe tener un correo registrado
  const destinatario = (cita.pacientes?.email || '').trim();
  if (!EMAIL_VALIDO.test(destinatario)) {
    return NextResponse.json({ enviado: false, motivo: 'sin_correo' });
  }

  // Cada cita se notifica una sola vez (evita reenvíos y abuso de la agenda pública)
  const { count } = await supabaseAdmin
    .from('correos_enviados')
    .select('id', { count: 'exact', head: true })
    .eq('cita_id', cita.id)
    .eq('estado', 'enviado');
  if ((count || 0) > 0) return NextResponse.json({ enviado: false, motivo: 'ya_enviado' });

  const medico = await obtenerMedicoSesion(req);
  const { asunto, html } = correoConfirmacion(cita, fechaHora);

  const resultado = await enviarCorreo({
    tipo: 'confirmacion_cita',
    destinatario,
    asunto,
    html,
    origen: medico ? 'medico' : 'agenda_publica',
    citaId: cita.id,
    pacienteId,
    medicoId,
  });

  return NextResponse.json(resultado);
}
