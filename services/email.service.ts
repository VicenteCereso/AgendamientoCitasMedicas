// Versión para el NAVEGADOR. No envía correos por sí misma: llama a /api/email,
// donde el servidor arma el correo con los datos de la base y lo envía por Brevo.
import { supabase } from '@/lib/supabaseClient';

export type ResultadoCorreo = {
  enviado: boolean;
  motivo?: 'sin_correo' | 'ya_enviado' | 'limite' | 'no_configurado' | 'error';
};

export class EmailService {
  // Notifica una cita (presencial o telemedicina con su enlace) al correo registrado del paciente.
  // NO lanza error: la cita ya quedó guardada y un fallo del correo no debe interrumpir el flujo.
  static async enviarConfirmacionCita(params: {
    medicoId: string;
    pacienteId: string;
    fechaHora: string;
  }): Promise<ResultadoCorreo> {
    try {
      // Si hay un médico con sesión se envía su token; los pacientes (agenda pública) no tienen sesión.
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ tipo: 'confirmacion_cita', ...params }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('Correo de confirmación no enviado:', json.error || res.status);
        return { enviado: false, motivo: 'error' };
      }
      return json as ResultadoCorreo;
    } catch (err) {
      console.error('Correo de confirmación no enviado:', err);
      return { enviado: false, motivo: 'error' };
    }
  }

  // Texto para mostrar al usuario según el resultado
  static describirResultado(r: ResultadoCorreo): string {
    if (r.enviado) return 'Se envió la notificación por correo al paciente.';
    switch (r.motivo) {
      case 'sin_correo': return 'El paciente no tiene correo registrado: no se envió notificación.';
      case 'ya_enviado': return 'La notificación de esta cita ya había sido enviada.';
      case 'limite': return 'Se alcanzó el límite de correos de Brevo: no se envió la notificación.';
      case 'no_configurado': return 'El envío de correos no está configurado: no se envió la notificación.';
      default: return 'No se pudo enviar la notificación por correo.';
    }
  }
}
