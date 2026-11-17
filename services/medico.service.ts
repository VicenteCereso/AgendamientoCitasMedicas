import { supabase } from '@/lib/supabaseClient';

// Médico con los datos de su especialidad del catálogo (tipo_atencion decide la pantalla de atención)
const SELECT_MEDICO = '*, especialidades(id, nombre, tipo_atencion, activo)';

export interface Especialidad {
  id: string;
  nombre: string;
  tipo_atencion: 'medica' | 'psicologica';
  activo: boolean;
}

// Llama a una API de administración enviando el token de la sesión actual
async function llamarApiAdmin(url: string, method: 'POST' | 'PATCH', datos: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(datos),
  });
  const json = await res.json().catch(() => null);
  if (!json) throw new Error(`El servidor respondió con un error inesperado (${res.status}). Revisa los logs del servidor.`);
  if (!res.ok) throw new Error(json.error || 'No se pudo guardar.');
  return json;
}

export type EstadoFechaRecurrente = 'disponible' | 'fuera_horario' | 'ocupada' | 'pasada';

// Normaliza YYYY-MM-DD, YYYY/MM/DD o DD/MM/YYYY a YYYY-MM-DD
function normalizarFecha(fechaStr: string) {
  let fechaLimpia = fechaStr.trim();
  if (fechaLimpia.includes('/')) {
    const p = fechaLimpia.split('/');
    fechaLimpia = p[0].length === 4
      ? `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`
      : `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
  }
  return fechaLimpia;
}

// Turnos configurados para una fecha (según disponibilidad del médico) y horas ya ocupadas por citas
function calcularTurnosFecha(todasDisponibilidades: any[], citasTomadas: any[], fechaLimpia: string) {
  const [anio, mes, dia] = fechaLimpia.split('-').map(Number);
  const diaSemanaIndex = new Date(anio, mes - 1, dia).getDay();

  // Fecha específica tiene match exacto; si no, se usa la configuración por día de la semana
  const disponibilidades = todasDisponibilidades.filter((d: any) => {
    if (d.fecha_especifica) return d.fecha_especifica.split('T')[0].trim() === fechaLimpia;
    return d.dia_semana === diaSemanaIndex;
  });

  const ocupadas = new Set<string>(
    citasTomadas
      .filter((c: any) => c.fecha_hora && c.estado !== 'cancelada' && c.fecha_hora.split('T')[0].trim() === fechaLimpia)
      .map((c: any) => {
        const d = new Date(c.fecha_hora);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      })
  );

  const turnos: string[] = [];
  disponibilidades.forEach((disp: any) => {
    const [hInicio, mInicio] = disp.hora_inicio.split(':').map(Number);
    const [hFin, mFin] = disp.hora_fin.split(':').map(Number);
    const duracion = disp.duracion_cita_minutos || 30;

    let inicioAlmuerzo: number | null = null;
    let finAlmuerzo: number | null = null;
    if (disp.hora_inicio_almuerzo && disp.hora_fin_almuerzo) {
      const [ha, ma] = disp.hora_inicio_almuerzo.split(':').map(Number);
      const [hb, mb] = disp.hora_fin_almuerzo.split(':').map(Number);
      inicioAlmuerzo = ha * 60 + ma;
      finAlmuerzo = hb * 60 + mb;
    }

    let actual = hInicio * 60 + mInicio;
    const finMin = hFin * 60 + mFin;
    while (actual + duracion <= finMin) {
      const caeEnAlmuerzo = inicioAlmuerzo !== null && finAlmuerzo !== null && actual >= inicioAlmuerzo && actual < finAlmuerzo;
      if (!caeEnAlmuerzo) {
        turnos.push(`${String(Math.floor(actual / 60)).padStart(2, '0')}:${String(actual % 60).padStart(2, '0')}`);
      }
      actual += duracion;
    }
  });

  return { turnos, ocupadas };
}

export const MedicoService = {
  async obtenerSesionYPerfil() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { userAuth: null, perfilUsuario: null, esAdmin: false, listaMedicos: [] };

    const userAuth = session.user;
    // Si la tabla 'especialidades' aún no existe, se cae a la consulta simple para no cerrar la sesión
    const leerPerfil = (sel: string) =>
      supabase.from('medicos').select(sel).eq('auth_user_id', userAuth.id).maybeSingle<any>();

    let selectMedico = SELECT_MEDICO;
    const primerIntento = await leerPerfil(selectMedico);
    let perfil = primerIntento.data;
    if (primerIntento.error) {
      console.warn('No se pudo leer la especialidad del catálogo:', primerIntento.error.message);
      selectMedico = '*';
      perfil = (await leerPerfil(selectMedico)).data;
    }

if (!perfil) {
  await supabase.auth.signOut();
  return { userAuth: null, perfilUsuario: null, esAdmin: false, listaMedicos: [] };
}
    /* let perfil = null;
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
    }*/

    const esAdmin = perfil?.rol === 'admin';

    const { data: listaMedicos } = await supabase
      .from('medicos')
      .select(selectMedico)
      .order('nombre', { ascending: true })
      .returns<any[]>();

    return {
      userAuth,
      perfilUsuario: perfil,
      esAdmin,
      listaMedicos: listaMedicos || []
    };
  },

  /* async iniciarSesion(email: string, pass: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  } */
  
  async iniciarSesion(usuario: string, pass: string) {
  const u = usuario.trim().toLowerCase();
  const email = u.includes('@') ? u : `${u}@agendamiento.internal`;
  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) throw new Error('Usuario o contraseña incorrectos');
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

  // Crea varias citas de una vez, agrupadas con un mismo serie_id
  async agendarCitasRecurrentes(params: {
    medico_id: string;
    paciente_id: string;
    fechas: string[]; // YYYY-MM-DD
    hora: string;     // HH:MM
    tipo_consulta: string;
  }) {
    const serieId = crypto.randomUUID();
    const registros = params.fechas.map((fecha) => ({
      medico_id: params.medico_id,
      paciente_id: params.paciente_id,
      fecha_hora: `${fecha}T${params.hora}:00`,
      tipo_consulta: params.tipo_consulta,
      enlace_videollamada: params.tipo_consulta === 'telemedicina'
        ? `https://meet.jit.si/ConsultaMedica-${params.medico_id.substring(0, 5)}-${fecha}-${params.hora.replace(':', '')}`
        : null,
      estado: 'confirmada',
      serie_id: serieId,
    }));

    const { data, error } = await supabase.from('citas').insert(registros).select('id, fecha_hora, enlace_videollamada');
    if (error) throw error;
    return { serieId, citas: data || [] };
  },

  async generarHorariosDisponibles(medicoId: string, fechaStr: string) {
    if (!fechaStr) return [];
    const fechaLimpia = normalizarFecha(fechaStr);

    const { data: todasDisponibilidades, error } = await supabase
      .from('disponibilidad_medico')
      .select('*')
      .eq('medico_id', medicoId);

    if (error || !todasDisponibilidades) return [];

    const citasTomadas = await MedicoService.obtenerCitas(medicoId);
    const { turnos, ocupadas } = calcularTurnosFecha(todasDisponibilidades, citasTomadas, fechaLimpia);
    return turnos.filter((h) => !ocupadas.has(h));
  },

  // Evalúa varias fechas a una misma hora (citas recurrentes) con solo 2 consultas a la BD.
  // Estado por fecha: disponible | fuera_horario (no hay turno a esa hora) | ocupada | pasada
  async evaluarFechasRecurrentes(medicoId: string, fechas: string[], hora: string) {
    const [{ data: todasDisponibilidades }, citasTomadas] = await Promise.all([
      supabase.from('disponibilidad_medico').select('*').eq('medico_id', medicoId),
      MedicoService.obtenerCitas(medicoId),
    ]);
    const ahora = new Date();

    return fechas.map((fecha) => {
      const { turnos, ocupadas } = calcularTurnosFecha(todasDisponibilidades || [], citasTomadas, fecha);
      const [anio, mes, dia] = fecha.split('-').map(Number);
      const [hh, mm] = hora.split(':').map(Number);
      let estado: EstadoFechaRecurrente = 'disponible';
      if (new Date(anio, mes - 1, dia, hh, mm) <= ahora) estado = 'pasada';
      else if (ocupadas.has(hora)) estado = 'ocupada';
      else if (!turnos.includes(hora)) estado = 'fuera_horario';
      return { fecha, estado };
    });
  },

 async obtenerHistorialPaciente(pacienteId: string, medicoId: string) {
  if (!pacienteId || !medicoId) return [];
  const { data, error } = await supabase
    .from('historias_clinicas')
    .select('*, medicos(nombre, especialidad, especialidades(tipo_atencion))')
    .eq('paciente_id', pacienteId)
    .eq('medico_id', medicoId)
    .order('fecha_registro', { ascending: true });

  if (error) throw error;
  return data || [];
},

  // Diagnóstico único por paciente y psicólogo (se registra una vez y luego se edita)
  async obtenerDiagnosticoPaciente(pacienteId: string, medicoId: string) {
    const { data, error } = await supabase
      .from('diagnosticos_pacientes')
      .select('id, diagnostico, updated_at')
      .eq('paciente_id', pacienteId)
      .eq('medico_id', medicoId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async guardarDiagnosticoPaciente(pacienteId: string, medicoId: string, diagnostico: string) {
    const { data, error } = await supabase
      .from('diagnosticos_pacientes')
      .upsert(
        [{ paciente_id: pacienteId, medico_id: medicoId, diagnostico, updated_at: new Date().toISOString() }],
        { onConflict: 'paciente_id,medico_id' }
      )
      .select('id, diagnostico, updated_at')
      .single();

    if (error) throw error;
    return data;
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

  // Registrar (POST) o editar (PATCH, cuando viene medicoId) un médico.
  // Siempre pasa por el servidor: el navegador nunca escribe en 'medicos' ni decide el rol.
  async guardarMedicoAdmin(datos: {
    medicoId?: string;
    nombre: string;
    especialidadId: string;
    email?: string;
    telefono?: string;
    tiene_historia_clinica?: boolean;
    usuario?: string;
    password?: string;
  }) {
    return llamarApiAdmin('/api/admin/medicos', datos.medicoId ? 'PATCH' : 'POST', datos);
  },

  // ---------- Mantenedor de especialidades ----------
  async obtenerEspecialidades(): Promise<Especialidad[]> {
    const { data, error } = await supabase
      .from('especialidades')
      .select('id, nombre, tipo_atencion, activo')
      .order('nombre', { ascending: true });
    if (error) throw error;
    return (data || []) as Especialidad[];
  },

  // Crear (sin id) o editar (con id). Para eliminar lógicamente: { id, activo: false }
  async guardarEspecialidad(datos: { id?: string; nombre?: string; tipo_atencion?: string; activo?: boolean }) {
    const json = await llamarApiAdmin('/api/admin/especialidades', datos.id ? 'PATCH' : 'POST', datos);
    return json.especialidad as Especialidad;
  },

};