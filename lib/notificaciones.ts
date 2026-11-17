// SOLO SERVIDOR. Notificación de una cita por correo: arma el mensaje con los datos de la
// base (no del navegador) y lo envía una sola vez por cita.
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { enviarCorreo, esc } from '@/lib/correo';

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export type ResultadoNotificacion = {
  enviado: boolean;
  motivo?: 'sin_correo' | 'ya_enviado' | 'limite' | 'no_configurado' | 'error';
};

export async function notificarCita(citaId: string, origen: 'medico' | 'agenda_publica'): Promise<ResultadoNotificacion> {
  const { data, error } = await supabaseAdmin
    .from('citas')
    .select('id, fecha_hora, tipo_consulta, enlace_videollamada, paciente_id, medico_id, pacientes(nombre, email), medicos(nombre)')
    .eq('id', citaId)
    .maybeSingle();
  if (error) throw new Error('No se pudo leer la cita: ' + error.message);
  const cita = data as unknown as (CitaConDatos & { paciente_id: string; medico_id: string }) | null;
  if (!cita) throw new Error('La cita no existe.');

  // El paciente debe tener un correo registrado
  const destinatario = (cita.pacientes?.email || '').trim();
  if (!EMAIL_VALIDO.test(destinatario)) return { enviado: false, motivo: 'sin_correo' };

  // Cada cita se notifica una sola vez (evita reenvíos y abuso de la agenda pública)
  const { count } = await supabaseAdmin
    .from('correos_enviados')
    .select('id', { count: 'exact', head: true })
    .eq('cita_id', cita.id)
    .eq('estado', 'enviado');
  if ((count || 0) > 0) return { enviado: false, motivo: 'ya_enviado' };

  const { asunto, html } = correoConfirmacion(cita, cita.fecha_hora);
  return enviarCorreo({
    tipo: 'confirmacion_cita',
    destinatario,
    asunto,
    html,
    origen,
    citaId: cita.id,
    pacienteId: cita.paciente_id,
    medicoId: cita.medico_id,
  });
}
