import { Resend } from 'resend';

// Inicialización segura que evita errores de compilación si la variable aún no está cargada
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ ADVERTENCIA: RESEND_API_KEY no está configurada en las variables de entorno.');
  }
  return new Resend(apiKey || 're_placeholder_key');
};

export class EmailService {
  static async enviarConfirmacionCita(params: {
    emailDestino: string;
    nombrePaciente: string;
    nombreMedico: string;
    fechaHora: string;
    tipoConsulta: string;
    enlaceVideollamada?: string;
  }) {
    if (!params.emailDestino || !process.env.RESEND_API_KEY) return;

    try {
      const resend = getResendClient();
      const fechaFormateada = new Date(params.fechaHora).toLocaleString('es-EC', {
        dateStyle: 'full',
        timeStyle: 'short'
      });

      await resend.emails.send({
        from:'vicerafa0428@gmail.com', //'Portal Clínico <onboarding@resend.dev>',
        to: [params.emailDestino],
        subject: `Confirmación de Cita Médica — Dr(a). ${params.nombreMedico}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc;">
            <h2 style="color: #2563eb; text-align: center;">Confirmación de Cita Médica</h2>
            <p>Estimado/a <strong>${params.nombrePaciente}</strong>,</p>
            <p>Su cita ha sido agendada con éxito. A continuación los detalles:</p>
            
            <div style="background: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; margin: 20px 0;">
              <p><strong>Médico:</strong> Dr(a). ${params.nombreMedico}</p>
              <p><strong>Fecha y Hora:</strong> ${fechaFormateada}</p>
              <p><strong>Modalidad:</strong> <span style="text-transform: uppercase;">${params.tipoConsulta}</span></p>
              ${params.enlaceVideollamada ? `<p><strong>Enlace de Videoconsulta:</strong> <a href="${params.enlaceVideollamada}" target="_blank" style="color: #2563eb;">Unirse a la Videollamada</a></p>` : ''}
            </div>

            <p style="font-size: 12px; color: #64748b; text-align: center;">Por favor, procure estar 5 minutos antes de su cita. Si necesita reagendar, comuníquese con el centro médico.</p>
          </div>
        `
      });
    } catch (err) {
      console.error('Error enviando correo de confirmación:', err);
    }
  }

  static async enviarRecetaMedica(params: {
    emailDestino: string;
    nombrePaciente: string;
    nombreMedico: string;
    especialidadMedico: string;
    diagnostico: string;
    medicamentos: Array<{ cantidad: string; medicamento: string; posologia: string }>;
  }) {
    if (!params.emailDestino || !process.env.RESEND_API_KEY) return;

    const filasMedicamentos = params.medicamentos
      .map(
        (m) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${m.cantidad}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${m.medicamento}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${m.posologia}</td>
        </tr>`
      )
      .join('');

    try {
      const resend = getResendClient();
      await resend.emails.send({
        from: 'Portal Clínico <onboarding@resend.dev>',
        to: [params.emailDestino],
        subject: `Receta Médica Prescrita — Dr(a). ${params.nombreMedico}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px;">
              <h2 style="color: #1e293b; margin: 0;">RECETA MÉDICA DIGITAL</h2>
              <p style="font-size: 14px; color: #475569; margin: 5px 0 0 0;">Dr(a). ${params.nombreMedico} (${params.especialidadMedico})</p>
            </div>

            <div style="margin: 20px 0; font-size: 14px;">
              <p><strong>Paciente:</strong> ${params.nombrePaciente}</p>
              <p><strong>Diagnóstico:</strong> ${params.diagnostico}</p>
            </div>

            <h3 style="font-size: 14px; color: #334155; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">Prescripción:</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="background-color: #f1f5f9; text-align: left; color: #475569;">
                  <th style="padding: 8px;">Cant.</th>
                  <th style="padding: 8px;">Medicamento</th>
                  <th style="padding: 8px;">Posología</th>
                </tr>
              </thead>
              <tbody>
                ${filasMedicamentos}
              </tbody>
            </table>

            <div style="margin-top: 40px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
              <p style="font-size: 12px; color: #94a3b8;">Documento generado electrónicamente por el Sistema Clínico Profesional.</p>
            </div>
          </div>
        `
      });
    } catch (err) {
      console.error('Error enviando receta por correo:', err);
    }
  }
}