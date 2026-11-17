// SOLO SE USA EN EL SERVIDOR (rutas dentro de app/api).
// Envío de correos por SMTP (Brevo) con control de cupo y registro en la tabla correos_enviados.
//
// Variables de entorno:
//   SMTP_USER, SMTP_PASS, EMAIL_FROM            (obligatorias)
//   SMTP_HOST (smtp-relay.brevo.com), SMTP_PORT (587)
//   BREVO_LIMITE_DIARIO   (por defecto 300, el del plan gratuito)
//   BREVO_LIMITE_MENSUAL  (opcional; 0 o vacío = sin límite mensual)
import nodemailer, { type Transporter } from 'nodemailer';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Al agregar la factura electrónica basta con sumar 'factura' aquí y en el CHECK de la tabla.
export type TipoCorreo = 'confirmacion_cita';
export type EstadoCorreo = 'enviado' | 'error' | 'omitido_limite';

export const LIMITE_DIARIO = Number(process.env.BREVO_LIMITE_DIARIO || 300);
export const LIMITE_MENSUAL = Number(process.env.BREVO_LIMITE_MENSUAL || 0);

// Ecuador continental: UTC-5 sin horario de verano
const OFFSET_HORAS = -5;

export function hoyLocal(): string {
  const ahora = new Date(Date.now() + OFFSET_HORAS * 3600_000);
  return ahora.toISOString().slice(0, 10);
}

// 'YYYY-MM-DD' (hora local) -> instante UTC del inicio de ese día
export function inicioDiaUTC(fecha: string): string {
  return new Date(`${fecha}T00:00:00-05:00`).toISOString();
}

let transporter: Transporter | null = null;
function obtenerTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.EMAIL_FROM) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port,
      secure: port === 465, // 587 usa STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function contarEnviadosDesde(desdeUTC: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('correos_enviados')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'enviado')
    .gte('created_at', desdeUTC);
  if (error) throw new Error(error.message);
  return count || 0;
}

async function hayCupo(): Promise<boolean> {
  const hoy = hoyLocal();
  if ((await contarEnviadosDesde(inicioDiaUTC(hoy))) >= LIMITE_DIARIO) return false;
  if (LIMITE_MENSUAL > 0) {
    const enviadosMes = await contarEnviadosDesde(inicioDiaUTC(`${hoy.slice(0, 8)}01`));
    if (enviadosMes >= LIMITE_MENSUAL) return false;
  }
  return true;
}

async function registrar(fila: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from('correos_enviados').insert([fila]);
  if (error) console.error('[correo] No se pudo registrar el envío:', error.message);
}

export interface EnvioCorreo {
  tipo: TipoCorreo;
  destinatario: string;
  asunto: string;
  html: string;
  origen: 'medico' | 'agenda_publica';
  citaId?: string | null;
  pacienteId?: string | null;
  medicoId?: string | null;
  // Para la factura electrónica (PDF/XML) más adelante
  adjuntos?: { filename: string; content: Buffer | string; contentType?: string }[];
}

export type ResultadoEnvio =
  | { enviado: true }
  | { enviado: false; motivo: 'no_configurado' | 'limite' | 'error' };

export async function enviarCorreo(c: EnvioCorreo): Promise<ResultadoEnvio> {
  const base = {
    tipo: c.tipo,
    destinatario: c.destinatario,
    asunto: c.asunto,
    origen: c.origen,
    cita_id: c.citaId || null,
    paciente_id: c.pacienteId || null,
    medico_id: c.medicoId || null,
  };

  const smtp = obtenerTransporter();
  if (!smtp) {
    console.error('[correo] Faltan SMTP_USER, SMTP_PASS o EMAIL_FROM en las variables de entorno.');
    return { enviado: false, motivo: 'no_configurado' };
  }

  if (!(await hayCupo())) {
    await registrar({ ...base, estado: 'omitido_limite' as EstadoCorreo });
    return { enviado: false, motivo: 'limite' };
  }

  try {
    const info = await smtp.sendMail({
      from: process.env.EMAIL_FROM,
      to: c.destinatario,
      subject: c.asunto,
      html: c.html,
      attachments: c.adjuntos,
    });
    await registrar({ ...base, estado: 'enviado' as EstadoCorreo, message_id: info.messageId || null });
    return { enviado: true };
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error('[correo] Error SMTP:', mensaje);
    await registrar({ ...base, estado: 'error' as EstadoCorreo, error: mensaje.slice(0, 500) });
    return { enviado: false, motivo: 'error' };
  }
}

// Evita que datos escritos por usuarios inyecten HTML en el correo
export function esc(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
