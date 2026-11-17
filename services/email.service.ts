// Versión para el NAVEGADOR. No envía correos por sí misma: llama a /api/email,
// donde el servidor usa la clave de Resend. Las funciones y parámetros son los
// mismos de antes, así que las páginas no necesitan cambiar su import.
import { supabase } from '@/lib/supabaseClient';

async function llamarApiEmail(payload: Record<string, unknown>) {
  // Si hay un médico con sesión iniciada se envía su token; los pacientes (público) no tienen sesión.
  const { data: { session } } = await supabase.auth.getSession();

  const res = await fetch('/api/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'No se pudo enviar el correo.');
}

export class EmailService {
  // Devuelve true si se envió y false si no. NO lanza error: la cita ya quedó guardada
  // y un fallo del correo no debe interrumpir el flujo.
  static async enviarConfirmacionCita(params: {
    emailDestino: string;
    nombrePaciente: string;
    nombreMedico: string;
    fechaHora: string;
    tipoConsulta: string;
    enlaceVideollamada?: string;
  }): Promise<boolean> {
    try {
      await llamarApiEmail({ tipo: 'confirmacion_cita', ...params });
      return true;
    } catch (err) {
      console.error('Correo de confirmación no enviado:', err);
      return false;
    }
  }

  static async enviarConfirmacionCitasRecurrentes(params: {
    emailDestino: string;
    nombrePaciente: string;
    nombreMedico: string;
    tipoConsulta: string;
    citas: Array<{ fechaHora: string; enlaceVideollamada?: string | null }>;
  }): Promise<boolean> {
    try {
      await llamarApiEmail({ tipo: 'confirmacion_serie', ...params });
      return true;
    } catch (err) {
      console.error('Correo de citas recurrentes no enviado:', err);
      return false;
    }
  }

  // La receta SÍ lanza error si falla: el médico pidió enviarla y debe saber si no salió.
  static async enviarRecetaMedica(params: {
    emailDestino: string;
    nombrePaciente: string;
    nombreMedico: string;
    especialidadMedico: string;
    diagnostico: string;
    medicamentos: Array<{ cantidad: string; medicamento: string; posologia: string }>;
  }): Promise<void> {
    await llamarApiEmail({ tipo: 'receta', ...params });
  }
}