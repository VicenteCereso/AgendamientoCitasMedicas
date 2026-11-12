import { supabase } from '@/lib/supabaseClient';

export const MedicoService = {
  async obtenerSesionYPerfil() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { userAuth: null, perfilUsuario: null, esAdmin: false, listaMedicos: [] };

    const userAuth = session.user;
    
    let perfil = null;
    if (userAuth.email) {
      const { data: perfilPorEmail } = await supabase
        .from('medicos')
        .select('*')
        .eq('email', userAuth.email)
        .maybeSingle();
      
      if (perfilPorEmail) {
        perfil = perfilPorEmail;
      }
    }

    if (!perfil) {
      const { data: perfilPorAuth } = await supabase
        .from('medicos')
        .select('*')
        .eq('auth_user_id', userAuth.id)
        .maybeSingle();
      
      perfil = perfilPorAuth;
    }

    if (!perfil) {
      const nombreDefault = userAuth.email ? userAuth.email.split('@')[0] : 'Doctor';
      const { data: nuevoPerfil } = await supabase
        .from('medicos')
        .insert([{
          auth_user_id: userAuth.id,
          nombre: nombreDefault.charAt(0).toUpperCase() + nombreDefault.slice(1),
          email: userAuth.email,
          especialidad: 'Medicina General',
          rol: userAuth.email?.includes('admin') ? 'admin' : 'medico'
        }])
        .select()
        .single();

      perfil = nuevoPerfil || {
        id: userAuth.id,
        nombre: nombreDefault,
        email: userAuth.email,
        especialidad: 'Medicina General',
        rol: 'medico'
      };
    }

    const esAdmin = perfil?.rol === 'admin';

    const { data: listaMedicos } = await supabase
      .from('medicos')
      .select('*')
      .order('nombre', { ascending: true });

    return {
      userAuth,
      perfilUsuario: perfil,
      esAdmin,
      listaMedicos: listaMedicos || []
    };
  },

  async iniciarSesion(email: string, pass: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  },

  async cerrarSesion() {
    await supabase.auth.signOut();
  },

  async obtenerCitas(medicoId: string) {
    if (!medicoId) return [];
    const { data, error } = await supabase
      .from('citas')
      .select(`
        id,
        medico_id,
        fecha_hora,
        estado,
        tipo_consulta,
        enlace_videollamada,
        pacientes (
          id,
          nombre,
          cedula,
          telefono
        )
      `)
      .eq('medico_id', medicoId)
      .order('fecha_hora', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async actualizarEstadoCita(citaId: string, nuevoEstado: string) {
    const { error } = await supabase
      .from('citas')
      .update({ estado: nuevoEstado })
      .eq('id', citaId);

    if (error) throw error;
  },

  async obtenerDisponibilidad(medicoId: string) {
    if (!medicoId) return [];
    const { data, error } = await supabase
      .from('disponibilidad_medico')
      .select('*')
      .eq('medico_id', medicoId)
      .order('id', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async eliminarDisponibilidad(id: string) {
    const { error } = await supabase
      .from('disponibilidad_medico')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async guardarDisponibilidadMultiplesFechas(params: {
    medico_id: string;
    fechas: string[];
    hora_inicio: string;
    hora_fin: string;
    duracion_cita_minutos: number;
    hora_inicio_almuerzo?: string;
    hora_fin_almuerzo?: string;
  }) {
    const registros = params.fechas.map((fecha) => {
      // Normalizar fecha a formato YYYY-MM-DD estándar
      let fechaLimpia = fecha;
      if (fecha.includes('/')) {
        const p = fecha.split('/');
        if (p[0].length === 4) {
          fechaLimpia = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
        } else {
          fechaLimpia = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        }
      }

      const dateObj = new Date(fechaLimpia + 'T00:00:00');
      const diaSemana = dateObj.getDay();

      return {
        medico_id: params.medico_id,
        fecha_especifica: fechaLimpia,
        dia_semana: diaSemana,
        hora_inicio: params.hora_inicio,
        hora_fin: params.hora_fin,
        duracion_cita_minutos: params.duracion_cita_minutos,
        hora_inicio_almuerzo: params.hora_inicio_almuerzo || null,
        hora_fin_almuerzo: params.hora_fin_almuerzo || null
      };
    });

    const { error } = await supabase
      .from('disponibilidad_medico')
      .insert(registros);

    if (error) throw error;
  },

  async buscarPacientePorCedula(cedula: string) {
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('cedula', cedula.trim())
      .maybeSingle();

    if (error) throw error;
    return data;
  },

 // En tu medico.service.ts
 async buscarPacientesPorCriterio(criterio: string) {
  const termino = `%${criterio.trim()}%`;
  
  const { data, error } = await supabase
    .from('pacientes')
    .select('*')
    .or(`cedula.ilike.${termino},nombre.ilike.${termino}`)
    .limit(10);

  if (error) throw error;
  return data || [];
},

  async crearPaciente(paciente: { nombre: string; cedula: string; telefono: string; email: string }) {
    const { data, error } = await supabase
      .from('pacientes')
      .insert([paciente])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // En tu services/medico.service.ts
 async agendarCitaManual(params: {
  medico_id: string;
  paciente_id: string;
  fecha_hora: string;
  tipo_consulta: string;
  enlace_videollamada?: string;
}) {
  const { data, error } = await supabase
    .from('citas')
    .insert([
      {
        medico_id: params.medico_id,
        paciente_id: params.paciente_id,
        fecha_hora: params.fecha_hora,
        tipo_consulta: params.tipo_consulta,
        enlace_videollamada: params.enlace_videollamada || null,
        estado: 'confirmada' // <--- Forzamos que nazca confirmada
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
},

  async generarHorariosDisponibles(medicoId: string, fechaStr: string) {
    if (!fechaStr) return [];
    
    // Normalización estricta de cualquier formato (YYYY-MM-DD o DD/MM/YYYY con / o -)
    let fechaLimpia = fechaStr.trim();
    if (fechaLimpia.includes('/')) {
      const partes = fechaLimpia.split('/');
      if (partes[0].length === 4) {
        // Formato YYYY/MM/DD
        fechaLimpia = `${partes[0]}-${partes[1].padStart(2, '0')}-${partes[2].padStart(2, '0')}`;
      } else {
        // Formato DD/MM/YYYY
        fechaLimpia = `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`;
      }
    }

    // Asegurar objeto de fecha local exacto
    const [anio, mes, dia] = fechaLimpia.split('-').map(Number);
    const dateObj = new Date(anio, mes - 1, dia);
    const diaSemanaIndex = dateObj.getDay();

    const { data: todasDisponibilidades, error } = await supabase
      .from('disponibilidad_medico')
      .select('*')
      .eq('medico_id', medicoId);

    if (error || !todasDisponibilidades) return [];

    // Filtrar haciendo match estricto con la fecha normalizada YYYY-MM-DD
    const disponibilidades = todasDisponibilidades.filter((d: any) => {
      if (d.fecha_especifica) {
        const fechaBD = d.fecha_especifica.split('T')[0].trim();
        return fechaBD === fechaLimpia;
      }
      return d.dia_semana === diaSemanaIndex && !d.fecha_especifica;
    });

    if (!disponibilidades || disponibilidades.length === 0) return [];

    const citasTomadas = await MedicoService.obtenerCitas(medicoId);
    const horasOcupadas = citasTomadas
      .filter((c: any) => {
        if (!c.fecha_hora || c.estado === 'cancelada') return false;
        const fechaCita = c.fecha_hora.split('T')[0].trim();
        return fechaCita === fechaLimpia;
      })
      .map((c: any) => {
        const d = new Date(c.fecha_hora);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      });

    const listaHoras: string[] = [];

    disponibilidades.forEach((disp: any) => {
      const [hInicio, mInicio] = disp.hora_inicio.split(':').map(Number);
      const [hFin, mFin] = disp.hora_fin.split(':').map(Number);
      const duracion = disp.duracion_cita_minutos || 30;

      let inicioAlmuerzoMin = null;
      let finAlmuerzoMin = null;

      if (disp.hora_inicio_almuerzo && disp.hora_fin_almuerzo) {
        const [hAlmIni, mAlmIni] = disp.hora_inicio_almuerzo.split(':').map(Number);
        const [hAlmFin, mAlmFin] = disp.hora_fin_almuerzo.split(':').map(Number);
        inicioAlmuerzoMin = hAlmIni * 60 + mAlmIni;
        finAlmuerzoMin = hAlmFin * 60 + mAlmFin;
      }

      let actualMinutos = hInicio * 60 + mInicio;
      const finMinutos = hFin * 60 + mFin;

      while (actualMinutos + duracion <= finMinutos) {
        const caeEnAlmuerzo =
          inicioAlmuerzoMin !== null &&
          finAlmuerzoMin !== null &&
          actualMinutos >= inicioAlmuerzoMin &&
          actualMinutos < finAlmuerzoMin;

        if (!caeEnAlmuerzo) {
          const hh = String(Math.floor(actualMinutos / 60)).padStart(2, '0');
          const mm = String(actualMinutos % 60).padStart(2, '0');
          const horaString = `${hh}:${mm}`;

          if (!horasOcupadas.includes(horaString)) {
            listaHoras.push(horaString);
          }
        }

        actualMinutos += duracion;
      }
    });

    return listaHoras;
  },

 async obtenerHistorialPaciente(pacienteId: string) {
  const { data, error } = await supabase
    .from('historias_clinicas')
    .select('*, medicos(nombre, especialidad)')
    .eq('paciente_id', pacienteId)
    .order('fecha_registro', { ascending: true }); // <--- Cambiado a true para ir de la más antigua a la más actual

  if (error) throw error;
  return data || [];
},

  async guardarAtencionClinica(params: {
  citaId?: string | null;
  pacienteId: string;
  medicoId: string;
  motivoConsulta: string;
  diagnostico: string;
  tratamiento: string;
  fechaRegistro?: string; // <-- Nuevo parámetro opcional
}) {
  const payload: any = {
    cita_id: params.citaId || null,
    paciente_id: params.pacienteId,
    medico_id: params.medicoId,
    motivo_consulta: params.motivoConsulta,
    diagnostico: params.diagnostico,
    tratamiento_prescripcion: params.tratamiento,
  };

  // Si viene una fecha histórica, la asignamos (agregamos T12:00:00 para evitar desfases de zona horaria)
  if (params.fechaRegistro) {
    payload.fecha_registro = `${params.fechaRegistro}T12:00:00`;
  }

    // En tu services/medico.service.ts dentro de guardarAtencionClinica
    const { error: errorHistoria } = await supabase
    .from('historias_clinicas')
    .insert([{
        cita_id: params.citaId && params.citaId.trim() !== '' ? params.citaId : null, // <--- Esto previene el error con UUID vacío
        paciente_id: params.pacienteId,
        medico_id: params.medicoId,
        motivo_consulta: params.motivoConsulta,
        diagnostico: params.diagnostico,
        tratamiento_prescripcion: params.tratamiento,
        fecha_registro: params.fechaRegistro ? `${params.fechaRegistro}T12:00:00` : new Date().toISOString()
    }]);

    if (errorHistoria) throw errorHistoria;

    if (params.citaId && params.citaId.trim() !== '') {
    await MedicoService.actualizarEstadoCita(params.citaId, 'atendida');
    }
},

  async crearMedico(medico: any) {
    const { error } = await supabase.from('medicos').insert([medico]);
    if (error) throw error;
  },

  async actualizarMedico(id: string, medico: any) {
    const { error } = await supabase.from('medicos').update(medico).eq('id', id);
    if (error) throw error;
  },

  async calcularHorariosDisponiblesReagendamiento(medicoId: string, fecha: string, citaIdExcluir: string) {
    const slots = await MedicoService.generarHorariosDisponibles(medicoId, fecha);
    return slots;
  },

  async reagendarCita(citaId: string, medicoId: string, tipoConsulta: string, nuevaFecha: string, nuevaHora: string) {
    const fechaHoraISO = `${nuevaFecha}T${nuevaHora}:00`;
    let enlaceJitsi = null;
    if (tipoConsulta === 'telemedicina') {
      const salaUnica = `ConsultaMedica-${medicoId.substring(0, 5)}-${nuevaFecha}-${nuevaHora.replace(':', '')}`;
      enlaceJitsi = `https://meet.jit.si/${salaUnica}`;
    }

    const { error } = await supabase
      .from('citas')
      .update({
        fecha_hora: fechaHoraISO,
        enlace_videollamada: enlaceJitsi || undefined,
        estado: 'confirmada'
      })
      .eq('id', citaId);

    if (error) throw error;
  },

  async enviarCorreoRecuperacion(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/medico`,
    });
    if (error) throw error;
  },


  // 2. Editar datos de un paciente existente
  async actualizarPaciente(pacienteId: string, datos: { nombre: string; cedula: string; telefono: string; email: string }) {
    const { data, error } = await supabase
      .from('pacientes')
      .update(datos)
      .eq('id', pacienteId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // 3. Eliminar lógicamente (o físicamente si no tiene restricciones de FK) un paciente
  async eliminarPaciente(pacienteId: string) {
    // Nota: Si usas eliminación lógica, asegúrate de tener una columna 'activo' o 'eliminado'. 
    // Si tu base permite borrado directo y no hay citas bloqueando por FK, se usa delete:
    const { error } = await supabase
      .from('pacientes')
      .delete()
      .eq('id', pacienteId);

    if (error) throw error;
  },
};