import { supabase } from '@/lib/supabaseClient';

export const MedicoService = {
  // Autenticación
  async iniciarSesion(email: string, pass: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) throw new Error('Credenciales incorrectas. Revisa tu correo y contraseña.');
    return data;
  },

  async obtenerSesionYPerfil() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user?.email) return { userAuth: null, perfilUsuario: null, esAdmin: false, listaMedicos: [] };

    const email = session.user.email;
    const { data: medico } = await supabase
      .from('medicos')
      .select('*')
      .eq('email', email)
      .single();

    if (!medico) return { userAuth: session.user, perfilUsuario: null, esAdmin: false, listaMedicos: [] };

    const esAdmin = medico.rol === 'admin';
    let listaMedicos = [];

    if (esAdmin) {
      const { data: medicos } = await supabase.from('medicos').select('*').order('nombre', { ascending: true });
      listaMedicos = medicos || [];
    }

    return { userAuth: session.user, perfilUsuario: medico, esAdmin, listaMedicos };
  },

  async cerrarSesion() {
    await supabase.auth.signOut();
  },

  // Operaciones de Citas
  async obtenerCitas(medicoId: string) {
    const { data, error } = await supabase
      .from('citas')
      .select(`
        id,
        medico_id,
        fecha_hora,
        estado,
        tipo_consulta,
        enlace_videollamada,
        pacientes ( id, nombre, cedula, telefono )
      `)
      .eq('medico_id', medicoId)
      .order('fecha_hora', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async actualizarEstadoCita(citaId: string, nuevoEstado: string) {
    const { error } = await supabase
      .from('citas')
      .update({ estado: nuevoEstado })
      .eq('id', citaId);

    if (error) throw new Error(error.message);
  },

  async obtenerDisponibilidad(medicoId: string) {
    const { data } = await supabase
      .from('disponibilidad_medico')
      .select('*')
      .eq('medico_id', medicoId)
      .order('dia_semana', { ascending: true });
    return data || [];
  },

  // Horarios de Reagendamiento
  async calcularHorariosDisponiblesReagendamiento(medicoId: string, fechaStr: string, citaExcluidaId: string) {
    const dateObj = new Date(fechaStr + 'T00:00:00');
    const diaSemanaIndex = dateObj.getDay();

    const dispMedicas = await this.obtenerDisponibilidad(medicoId);
    const filtradas = dispMedicas.filter((d: any) => d.dia_semana === diaSemanaIndex);

    if (filtradas.length === 0) return [];

    const citasTomadas = await this.obtenerCitas(medicoId);
    const horasOcupadas = citasTomadas
      .filter((c: any) => c.id !== citaExcluidaId && c.estado !== 'cancelada')
      .map((c: any) => {
        const d = new Date(c.fecha_hora);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      });

    const listaHoras: string[] = [];
    filtradas.forEach((disp: any) => {
      const [hInicio, mInicio] = disp.hora_inicio.split(':').map(Number);
      const [hFin, mFin] = disp.hora_fin.split(':').map(Number);
      const duracion = disp.duracion_cita_minutos;

      let actualMinutos = hInicio * 60 + mInicio;
      const finMinutos = hFin * 60 + mFin;

      while (actualMinutos + duracion <= finMinutos) {
        const hh = String(Math.floor(actualMinutos / 60)).padStart(2, '0');
        const mm = String(actualMinutos % 60).padStart(2, '0');
        const horaString = `${hh}:${mm}`;

        if (!horasOcupadas.includes(horaString)) {
          listaHoras.push(horaString);
        }
        actualMinutos += duracion;
      }
    });

    return listaHoras;
  },

  async reagendarCita(citaId: string, medicoId: string, tipoConsulta: string, nuevaFecha: string, nuevaHora: string) {
    const nuevaFechaHoraISO = `${nuevaFecha}T${nuevaHora}:00`;
    let nuevoEnlace = null;
    
    if (tipoConsulta === 'telemedicina') {
      const salaUnica = `ConsultaMedica-${medicoId.substring(0, 5)}-${nuevaFecha}-${nuevaHora.replace(':', '')}`;
      nuevoEnlace = `https://meet.jit.si/${salaUnica}`;
    }

    const { error } = await supabase
      .from('citas')
      .update({ fecha_hora: nuevaFechaHoraISO, enlace_videollamada: nuevoEnlace, estado: 'pendiente' })
      .eq('id', citaId);

    if (error) throw new Error(error.message);
  },

  // Agrega estos métodos dentro del objeto MedicoService en services/medico.service.ts:

// 1. Obtener el historial clínico previo de un paciente
async obtenerHistorialPaciente(pacienteId: string) {
  const { data, error } = await supabase
    .from('historias_clinicas')
    .select(`
      id,
      motivo_consulta,
      diagnostico,
      tratamiento_prescripcion,
      notas_privadas,
      fecha_registro,
      medicos ( nombre, especialidad )
    `)
    .eq('paciente_id', pacienteId)
    .order('fecha_registro', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
},

// 2. Guardar o actualizar la consulta médica y receta
async guardarAtencionClinica(datos: {
  citaId: string;
  pacienteId: string;
  medicoId: string;
  motivoConsulta: string;
  diagnostico: string;
  tratamiento: string;
}) {
  // Insertar en la historia clínica
  const { data: historia, error: errHistoria } = await supabase
    .from('historias_clinicas')
    .insert([{
      cita_id: datos.citaId,
      paciente_id: datos.pacienteId,
      medico_id: datos.medicoId,
      motivo_consulta: datos.motivoConsulta,
      diagnostico: datos.diagnostico,
      tratamiento_prescripcion: datos.tratamiento
    }])
    .select()
    .single();

  if (errHistoria) throw new Error(errHistoria.message);

  // Marcar la cita como atendida
  await this.actualizarEstadoCita(datos.citaId, 'atendida');

  return historia;
}
};