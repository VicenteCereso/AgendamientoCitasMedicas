'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

interface Disponibilidad {
  id?: string;
  medico_id?: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  duracion_cita_minutos: number;
}

interface Medico {
  id: string;
  nombre: string;
  especialidad: string;
  email: string;
  telefono?: string;
  direccion?: string;
  consultorio?: string;
  rol?: string;
}

interface CitaDetalle {
  id: string;
  medico_id: string;
  fecha_hora: string;
  estado: string;
  tipo_consulta: string;
  enlace_videollamada?: string;
  pacientes: {
    id?: string;
    nombre: string;
    cedula: string;
    telefono: string;
  };
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function PanelMedicoPage() {
  const [tabActiva, setTabActiva] = useState<'citas' | 'gestion_medicos' | 'agendar_asistente' | 'horarios'>('citas');

  // Autenticación
  const [userAuth, setUserAuth] = useState<any>(null);
  const [perfilUsuario, setPerfilUsuario] = useState<Medico | null>(null);
  const [esAdmin, setEsAdmin] = useState<boolean>(false);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);

  // Login
  const [emailLogin, setEmailLogin] = useState<string>('');
  const [passwordLogin, setPasswordLogin] = useState<string>('');
  const [errorLogin, setErrorLogin] = useState<string>('');
  const [loadingLogin, setLoadingLogin] = useState<boolean>(false);

  // Médicos (Admin)
  const [listaMedicos, setListaMedicos] = useState<Medico[]>([]);
  const [medicoSeleccionadoAdmin, setMedicoSeleccionadoAdmin] = useState<string>('');

  // Formulario Crear / Editar Médico
  const [medicoEditandoId, setMedicoEditandoId] = useState<string | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState<string>('');
  const [nuevaEspecialidad, setNuevaEspecialidad] = useState<string>('');
  const [nuevaDireccion, setNuevaDireccion] = useState<string>('');
  const [nuevoConsultorio, setNuevoConsultorio] = useState<string>('');
  const [nuevoEmail, setNuevoEmail] = useState<string>('');
  const [nuevoTelefono, setNuevoTelefono] = useState<string>('');
  const [nuevaPassword, setNuevaPassword] = useState<string>('');
  const [nuevoRol, setNuevoRol] = useState<string>('medico');
  const [loadingCrearMedico, setLoadingCrearMedico] = useState<boolean>(false);

  // Citas y Horarios
  const [citas, setCitas] = useState<CitaDetalle[]>([]);
  const [disponibilidades, setDisponibilidades] = useState<Disponibilidad[]>([]);

  // Estados de Búsqueda y Filtros UX (Citas)
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todas');
  const [fechaFiltro, setFechaFiltro] = useState<string>('');

  // Reagendamiento
  const [citaEditando, setCitaEditando] = useState<CitaDetalle | null>(null);
  const [nuevaFechaReagendar, setNuevaFechaReagendar] = useState<string>('');
  const [nuevaHoraReagendar, setNuevaHoraReagendar] = useState<string>('');
  const [horariosReagendar, setHorariosReagendar] = useState<string[]>([]);
  const [loadingReagendar, setLoadingReagendar] = useState<boolean>(false);

  // Agendamiento Manual por Asistente/Doctor
  const [cedulaBusquedaManual, setCedulaBusquedaManual] = useState<string>('');
  const [pacienteEncontrado, setPacienteEncontrado] = useState<any>(null);
  const [buscandoPaciente, setBuscandoPaciente] = useState<boolean>(false);
  const [fechaManual, setFechaManual] = useState<string>('');
  const [horariosManuales, setHorariosManuales] = useState<string[]>([]);
  const [horaManualSeleccionada, setHoraManualSeleccionada] = useState<string>('');
  const [tipoConsultaManual, setTipoConsultaManual] = useState<string>('presencial');
  const [loadingManual, setLoadingManual] = useState<boolean>(false);

  // Horarios Formulario
  const [diaSemana, setDiaSemana] = useState<number>(1);
  const [horaInicio, setHoraInicio] = useState<string>('09:00');
  const [horaFin, setHoraFin] = useState<string>('17:00');
  const [duracion, setDuracion] = useState<number>(30);
  const [loadingHorario, setLoadingHorario] = useState<boolean>(false);
  const [mensajeHorario, setMensajeHorario] = useState<string>('');

  useEffect(() => {
    verificarSesion();
  }, []);

  async function verificarSesion() {
    setLoadingAuth(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (session && session.user) {
      setUserAuth(session.user);
      await cargarPerfilYDatos(session.user.email);
    } else {
      setUserAuth(null);
      setPerfilUsuario(null);
    }
    setLoadingAuth(false);
  }

  async function cargarPerfilYDatos(email: string | undefined) {
    if (!email) return;

    const { data: medico } = await supabase
      .from('medicos')
      .select('*')
      .eq('email', email)
      .single();

    if (medico) {
      setPerfilUsuario(medico);
      const admin = medico.rol === 'admin';
      setEsAdmin(admin);

      if (admin) {
        cargarTodosLosMedicos();
      } else {
        cargarCitasMedico(medico.id);
        cargarHorariosMedico(medico.id);
      }
    } else {
      setErrorLogin('Tu cuenta no tiene un perfil registrado en la clínica.');
    }
  }

  async function cargarTodosLosMedicos() {
    const { data } = await supabase.from('medicos').select('*').order('nombre', { ascending: true });
    if (data && data.length > 0) {
      setListaMedicos(data);
      if (!medicoSeleccionadoAdmin) {
        setMedicoSeleccionadoAdmin(data[0].id);
        cargarCitasMedico(data[0].id);
        cargarHorariosMedico(data[0].id);
      }
    }
  }

  useEffect(() => {
    if (esAdmin && medicoSeleccionadoAdmin) {
      cargarCitasMedico(medicoSeleccionadoAdmin);
      cargarHorariosMedico(medicoSeleccionadoAdmin);
    }
  }, [medicoSeleccionadoAdmin]);

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setLoadingLogin(true);
    setErrorLogin('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailLogin,
      password: passwordLogin,
    });

    if (error) {
      setErrorLogin('Credenciales incorrectas. Revisa tu correo y contraseña.');
      setLoadingLogin(false);
    } else if (data.session) {
      setUserAuth(data.session.user);
      await cargarPerfilYDatos(data.session.user.email);
      setLoadingLogin(false);
    }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    setUserAuth(null);
    setPerfilUsuario(null);
    setEmailLogin('');
    setPasswordLogin('');
    window.location.href = '/';
  }

  // Cargar formulario para Editar un médico existente
  function seleccionarParaEditar(med: Medico) {
    setMedicoEditandoId(med.id);
    setNuevoNombre(med.nombre);
    setNuevaEspecialidad(med.especialidad);
    setNuevaDireccion(med.direccion || '');
    setNuevoConsultorio(med.consultorio || '');
    setNuevoEmail(med.email);
    setNuevoTelefono(med.telefono || '');
    setNuevoRol(med.rol || 'medico');
    setNuevaPassword('');
  }

  function cancelarEdicionMedico() {
    setMedicoEditandoId(null);
    limpiarFormularioMedico();
  }

  function limpiarFormularioMedico() {
    setNuevoNombre('');
    setNuevaEspecialidad('');
    setNuevaDireccion('');
    setNuevoConsultorio('');
    setNuevoEmail('');
    setNuevoTelefono('');
    setNuevaPassword('');
    setNuevoRol('medico');
  }

  async function guardarMedicoPorAdmin(e: React.FormEvent) {
    e.preventDefault();
    setLoadingCrearMedico(true);

    if (medicoEditandoId) {
      const { error: dbError } = await supabase
        .from('medicos')
        .update({
          nombre: nuevoNombre,
          especialidad: nuevaEspecialidad,
          direccion: nuevaDireccion,
          consultorio: nuevoConsultorio,
          email: nuevoEmail,
          telefono: nuevoTelefono,
          rol: nuevoRol,
        })
        .eq('id', medicoEditandoId);

      setLoadingCrearMedico(false);

      if (dbError) {
        alert('Error al actualizar médico: ' + dbError.message);
      } else {
        alert('¡Datos del médico actualizados correctamente!');
        setMedicoEditandoId(null);
        limpiarFormularioMedico();
        cargarTodosLosMedicos();
      }
    } else {
      const { error: authError } = await supabase.auth.signUp({
        email: nuevoEmail,
        password: nuevaPassword,
      });

      if (authError) {
        alert('Error al crear usuario en Supabase Auth: ' + authError.message);
        setLoadingCrearMedico(false);
        return;
      }

      const { error: dbError } = await supabase.from('medicos').insert([
  {
    nombre: nuevoNombre,
    especialidad: nuevaEspecialidad,
    direccion: nuevaDireccion,
    consultorio: nuevoConsultorio,
    email: nuevoEmail,
    telefono: nuevoTelefono,
    rol: nuevoRol,
  },
]);

      setLoadingCrearMedico(false);

      if (dbError) {
        alert('Error al guardar médico en la base de datos: ' + dbError.message);
      } else {
        alert(`¡Perfil creado con éxito! ${nuevoNombre} ya puede ingresar.`);
        limpiarFormularioMedico();
        cargarTodosLosMedicos();
      }
    }
  }

  async function eliminarMedico(id: string, nombre: string) {
    if (!confirm(`¿Estás seguro de eliminar a ${nombre}? Se perderán sus horarios y citas asignadas.`)) return;

    const { error } = await supabase.from('medicos').delete().eq('id', id);
    if (!error) {
      alert('Médico eliminado del sistema.');
      cargarTodosLosMedicos();
    } else {
      alert('Error al eliminar médico: ' + error.message);
    }
  }

  async function cargarHorariosMedico(id: string) {
    const { data } = await supabase
      .from('disponibilidad_medico')
      .select('*')
      .eq('medico_id', id)
      .order('dia_semana', { ascending: true });

    if (data) setDisponibilidades(data);
  }

  async function cargarCitasMedico(id: string) {
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
      .eq('medico_id', id)
      .order('fecha_hora', { ascending: true });

    if (error) {
      console.error('Error al cargar citas:', error);
      setCitas([]);
    } else if (data) {
      setCitas(data as unknown as CitaDetalle[]);
    }
  }

  async function cambiarEstadoCita(citaId: string, nuevoEstado: string) {
    const { error } = await supabase
      .from('citas')
      .update({ estado: nuevoEstado })
      .eq('id', citaId);

    if (error) {
      alert('Error al actualizar estado: ' + error.message);
    } else {
      const targetId = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
      if (targetId) {
        cargarCitasMedico(targetId);
      }
    }
  }

  function iniciarReagendamiento(cita: CitaDetalle) {
    setCitaEditando(cita);
    const fechaObj = new Date(cita.fecha_hora);
    const fechaYYYYMMDD = fechaObj.toISOString().split('T')[0];
    setNuevaFechaReagendar(fechaYYYYMMDD);
    setNuevaHoraReagendar('');
  }

  useEffect(() => {
    if (citaEditando && nuevaFechaReagendar) {
      generarHorariosReagendar(citaEditando.medico_id, nuevaFechaReagendar);
    } else {
      setHorariosReagendar([]);
    }
  }, [nuevaFechaReagendar, citaEditando]);

  async function generarHorariosReagendar(medicoId: string, fechaStr: string) {
    const dateObj = new Date(fechaStr + 'T00:00:00');
    const diaSemanaIndex = dateObj.getDay();

    const { data: disponibilidades } = await supabase
      .from('disponibilidad_medico')
      .select('*')
      .eq('medico_id', medicoId)
      .eq('dia_semana', diaSemanaIndex);

    if (!disponibilidades || disponibilidades.length === 0) {
      setHorariosReagendar([]);
      return;
    }

    const { data: citasTomadas } = await supabase
      .from('citas')
      .select('id, fecha_hora')
      .eq('medico_id', medicoId)
      .neq('estado', 'cancelada');

    const horasOcupadas = (citasTomadas || [])
      .filter((c: any) => c.id !== citaEditando?.id)
      .map((c: any) => {
        const d = new Date(c.fecha_hora);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      });

    const listaHoras: string[] = [];

    disponibilidades.forEach((disp: Disponibilidad) => {
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

    setHorariosReagendar(listaHoras);
  }

  async function guardarReagendamiento() {
    if (!citaEditando || !nuevaFechaReagendar || !nuevaHoraReagendar) {
      alert('Selecciona una fecha y hora válidas.');
      return;
    }

    setLoadingReagendar(true);
    const nuevaFechaHoraISO = `${nuevaFechaReagendar}T${nuevaHoraReagendar}:00`;

    let nuevoEnlace = citaEditando.enlace_videollamada;
    if (citaEditando.tipo_consulta === 'telemedicina') {
      const salaUnica = `ConsultaMedica-${citaEditando.medico_id.substring(0, 5)}-${nuevaFechaReagendar}-${nuevaHoraReagendar.replace(':', '')}`;
      nuevoEnlace = `https://meet.jit.si/${salaUnica}`;
    }

    const { error } = await supabase
      .from('citas')
      .update({
        fecha_hora: nuevaFechaHoraISO,
        enlace_videollamada: nuevoEnlace,
        estado: 'pendiente',
      })
      .eq('id', citaEditando.id);

    setLoadingReagendar(false);

    if (error) {
      alert('Error al reagendar la cita: ' + error.message);
    } else {
      alert('¡Cita reagendada con éxito!');
      setCitaEditando(null);
      const targetId = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
      if (targetId) cargarCitasMedico(targetId);
    }
  }

  // Lógica Agendamiento Manual
  async function buscarPacientePorCedula() {
    if (!cedulaBusquedaManual.trim()) return;
    setBuscandoPaciente(true);
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('cedula', cedulaBusquedaManual.trim())
      .single();

    if (error || !data) {
      alert('No se encontró ningún paciente con esa cédula. Regístralo desde el portal público o asegúrate del número.');
      setPacienteEncontrado(null);
    } else {
      setPacienteEncontrado(data);
    }
    setBuscandoPaciente(false);
  }

  useEffect(() => {
    if (fechaManual && (esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id)) {
      generarHorariosManuales(esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id, fechaManual);
    } else {
      setHorariosManuales([]);
    }
  }, [fechaManual, medicoSeleccionadoAdmin]);

  async function generarHorariosManuales(medicoId: string, fechaStr: string) {
    const dateObj = new Date(fechaStr + 'T00:00:00');
    const diaSemanaIndex = dateObj.getDay();

    const { data: disponibilidades } = await supabase
      .from('disponibilidad_medico')
      .select('*')
      .eq('medico_id', medicoId)
      .eq('dia_semana', diaSemanaIndex);

    if (!disponibilidades || disponibilidades.length === 0) {
      setHorariosManuales([]);
      return;
    }

    const { data: citasTomadas } = await supabase
      .from('citas')
      .select('fecha_hora')
      .eq('medico_id', medicoId)
      .neq('estado', 'cancelada');

    const horasOcupadas = (citasTomadas || []).map((c: any) => {
      const d = new Date(c.fecha_hora);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    });

    const listaHoras: string[] = [];

    disponibilidades.forEach((disp: Disponibilidad) => {
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

    setHorariosManuales(listaHoras);
  }

  async function confirmarAgendamientoManual(e: React.FormEvent) {
    e.preventDefault();
    const medicoIdTarget = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;

    if (!pacienteEncontrado || !fechaManual || !horaManualSeleccionada || !medicoIdTarget) {
      alert('Faltan datos para completar el agendamiento manual.');
      return;
    }

    setLoadingManual(true);
    const fechaHoraISO = `${fechaManual}T${horaManualSeleccionada}:00`;

    let enlaceVideo = null;
    if (tipoConsultaManual === 'telemedicina') {
      const salaUnica = `ConsultaMedica-${medicoIdTarget.substring(0, 5)}-${fechaManual}-${horaManualSeleccionada.replace(':', '')}`;
      enlaceVideo = `https://meet.jit.si/${salaUnica}`;
    }

    const { error } = await supabase.from('citas').insert([
      {
        medico_id: medicoIdTarget,
        paciente_id: pacienteEncontrado.id,
        fecha_hora: fechaHoraISO,
        tipo_consulta: tipoConsultaManual,
        enlace_videollamada: enlaceVideo,
        estado: 'confirmada',
      },
    ]);

    setLoadingManual(false);

    if (error) {
      alert('Error al agendar cita: ' + error.message);
    } else {
      alert('¡Cita agendada manualmente con éxito!');
      setCedulaBusquedaManual('');
      setPacienteEncontrado(null);
      setFechaManual('');
      setHoraManualSeleccionada('');
      cargarCitasMedico(medicoIdTarget);
      setTabActiva('citas');
    }
  }

  async function guardarHorario(e: React.FormEvent) {
    e.preventDefault();
    const medicoIdTarget = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
    if (!medicoIdTarget) return;

    setLoadingHorario(true);
    setMensajeHorario('');

    const { error } = await supabase.from('disponibilidad_medico').insert([
      {
        medico_id: medicoIdTarget,
        dia_semana: diaSemana,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        duracion_cita_minutos: duracion,
      },
    ]);

    setLoadingHorario(false);

    if (error) {
      setMensajeHorario('Error al guardar horario: ' + error.message);
    } else {
      setMensajeHorario('¡Horario guardado exitosamente!');
      cargarHorariosMedico(medicoIdTarget);
    }
  }

  async function eliminarHorario(id: string) {
    if (!confirm('¿Eliminar este horario?')) return;
    const medicoIdTarget = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
    const { error } = await supabase.from('disponibilidad_medico').delete().eq('id', id);
    if (!error && medicoIdTarget) cargarHorariosMedico(medicoIdTarget);
  }

  // 🧠 1. Filtrado UX en Tiempo Real (Protegido contra undefined)
  const citasFiltradas = useMemo(() => {
    const listaSegura = Array.isArray(citas) ? citas : [];

    return listaSegura.filter((c) => {
      const coincideBusqueda =
        c.pacientes?.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.pacientes?.cedula?.includes(busqueda) ||
        c.pacientes?.telefono?.includes(busqueda);

      const coincideEstado = filtroEstado === 'todas' ? true : c.estado === filtroEstado;

      const fechaCitaStr = c.fecha_hora ? new Date(c.fecha_hora).toISOString().split('T')[0] : '';
      const coincideFecha = fechaFiltro === '' ? true : fechaCitaStr === fechaFiltro;

      return (coincideBusqueda || busqueda === '') && coincideEstado && coincideFecha;
    });
  }, [citas, busqueda, filtroEstado, fechaFiltro]);

  // 🧠 2. Agrupación por Día y Ordenamiento Estricto por Hora
  const citasAgrupadasPorDia = useMemo(() => {
    const grupos: { [key: string]: CitaDetalle[] } = {};

    const ordenadas = [...citasFiltradas].sort(
      (a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
    );

    ordenadas.forEach((cita) => {
      if (!cita.fecha_hora) return;
      const fechaObj = new Date(cita.fecha_hora);
      const fechaFormateada = fechaObj.toLocaleDateString('es-EC', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const key = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);

      if (!grupos[key]) {
        grupos[key] = [];
      }
      grupos[key].push(cita);
    });

    return grupos;
  }, [citasFiltradas]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 font-medium">Cargando sistema...</p>
      </div>
    );
  }

  if (!userAuth || !perfilUsuario) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 border border-slate-100">
          <div className="text-center mb-8">
            <span className="text-4xl">🔐</span>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">Acceso Administrativo / Médico</h1>
            <p className="text-sm text-slate-500 mt-1">Ingresa tu correo y contraseña autorizada.</p>
          </div>

          <form onSubmit={iniciarSesion} className="space-y-4">
            {errorLogin && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {errorLogin}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Correo Electrónico</label>
              <input
                type="email"
                placeholder="ejemplo@clinica.ec"
                value={emailLogin}
                onChange={(e) => setEmailLogin(e.target.value)}
                className="w-full p-3 border rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                value={passwordLogin}
                onChange={(e) => setPasswordLogin(e.target.value)}
                className="w-full p-3 border rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loadingLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow transition text-sm"
            >
              {loadingLogin ? 'Validando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-8 text-center border-t pt-4">
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-800 transition">
              ← Ir al Portal Público del Paciente
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-lg p-6 md:p-8 border border-slate-100 space-y-6">
        
        {/* Encabezado */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-slate-800">
                {esAdmin ? '👑 Panel Administrador General' : `Dr(a). ${perfilUsuario.nombre}`}
              </h1>
              <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${esAdmin ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                {esAdmin ? 'ADMINISTRADOR' : perfilUsuario.especialidad}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Usuario: {perfilUsuario.email}</p>
          </div>

          <button
            onClick={cerrarSesion}
            className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 text-xs font-bold py-2 px-3 rounded-xl transition border"
          >
            🚪 Cerrar Sesión
          </button>
        </div>

        {/* Filtro Global para el Administrador */}
        {esAdmin && (
          <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 flex flex-col md:flex-row items-center justify-between gap-3">
            <label className="text-xs font-bold text-purple-900 uppercase">Ver agenda del médico:</label>
            <select
              value={medicoSeleccionadoAdmin}
              onChange={(e) => setMedicoSeleccionadoAdmin(e.target.value)}
              className="p-2 border rounded-xl bg-white text-slate-800 text-sm font-semibold w-full md:w-80 shadow-sm"
            >
              {listaMedicos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre} — {m.especialidad}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Pestañas de Navegación */}
        <div className="flex border-b overflow-x-auto gap-2">
          <button
            onClick={() => setTabActiva('citas')}
            className={`py-2 px-4 font-bold text-xs border-b-2 transition whitespace-nowrap ${
              tabActiva === 'citas' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            📅 Citas ({citas.filter((c) => c.estado !== 'cancelada').length})
          </button>

          {esAdmin && (
            <button
              onClick={() => setTabActiva('gestion_medicos')}
              className={`py-2 px-4 font-bold text-xs border-b-2 transition whitespace-nowrap ${
                tabActiva === 'gestion_medicos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              👥 Registrar / Gestionar Médicos
            </button>
          )}

          <button
            onClick={() => setTabActiva('agendar_asistente')}
            className={`py-2 px-4 font-bold text-xs border-b-2 transition whitespace-nowrap ${
              tabActiva === 'agendar_asistente' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            ➕ Agendar Cita Manual
          </button>

          <button
            onClick={() => setTabActiva('horarios')}
            className={`py-2 px-4 font-bold text-xs border-b-2 transition whitespace-nowrap ${
              tabActiva === 'horarios' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            ⚙️ Configurar Horarios
          </button>
        </div>

        {/* TAB 1: CITAS CON FILTROS Y AGRUPAMIENTO UX */}
        {tabActiva === 'citas' && (
          <div className="space-y-6">
            
            {/* BARRA DE HERRAMIENTAS Y BÚSQUEDA */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-3">
              
              {/* BUSCADOR */}
              <div className="relative w-full md:w-80">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Buscar paciente, cédula o tel..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                />
                {busqueda && (
                  <button
                    onClick={() => setBusqueda('')}
                    className="absolute inset-y-0 right-0 pr-3 text-xs text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✖
                  </button>
                )}
              </div>

              {/* FILTROS FECHA Y ESTADO */}
              <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                <input
                  type="date"
                  value={fechaFiltro}
                  onChange={(e) => setFechaFiltro(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded-xl shadow-sm focus:outline-none"
                />
                {fechaFiltro && (
                  <button
                    onClick={() => setFechaFiltro('')}
                    className="text-[11px] text-blue-600 font-bold hover:underline whitespace-nowrap"
                  >
                    Limpiar fecha
                  </button>
                )}

                <div className="h-5 border-r border-slate-300 mx-1 hidden md:block"></div>

                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded-xl shadow-sm focus:outline-none"
                >
                  <option value="todas">📋 Todos los estados</option>
                  <option value="pendiente">🟡 Pendientes</option>
                  <option value="confirmada">🟢 Confirmadas</option>
                  <option value="atendida">🔵 Atendidas</option>
                  <option value="cancelada">🔴 Canceladas</option>
                </select>
              </div>
            </div>

            {/* LISTADO AGRUPADO POR FECHA Y HORA */}
            {Object.keys(citasAgrupadasPorDia).length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <span className="text-4xl block mb-2">🔎</span>
                <p className="text-sm font-bold text-slate-700">No se encontraron citas en la búsqueda</p>
                <p className="text-xs text-slate-400 mt-1">Ajusta los filtros de búsqueda o fecha.</p>
              </div>
            ) : (
              Object.entries(citasAgrupadasPorDia).map(([fechaHeader, listaCitas]) => (
                <div key={fechaHeader} className="space-y-3">
                  
                  {/* CABECERA DEL DÍA */}
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg">
                      🗓️ {fechaHeader}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      ({listaCitas.length} {listaCitas.length === 1 ? 'cita' : 'citas'})
                    </span>
                    <div className="flex-1 h-[1px] bg-slate-200"></div>
                  </div>

                  {/* TARJETAS DE CADA CITA */}
                  <div className="space-y-3">
                    {listaCitas.map((c) => {
                      const horaStr = c.fecha_hora
                        ? new Date(c.fecha_hora).toLocaleTimeString('es-EC', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : '--:--';

                      return (
                        <div
                          key={c.id}
                          className={`p-4 rounded-2xl border transition shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                            c.estado === 'atendida' ? 'bg-blue-50/30 border-blue-200' :
                            c.estado === 'cancelada' ? 'bg-red-50/30 border-red-200 opacity-75' :
                            c.estado === 'confirmada' ? 'bg-green-50/20 border-green-200' :
                            'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {/* INFORMACIÓN DEL PACIENTE & HORA */}
                          <div className="flex items-start gap-3.5">
                            <div className="bg-slate-800 text-white font-black text-xs px-3 py-2 rounded-xl text-center min-w-[80px] shadow-sm shrink-0">
                              🕒 {horaStr}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-slate-800 text-sm">
                                  {c.pacientes?.nombre || 'Paciente no registrado'}
                                </h4>
                                
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                  c.estado === 'atendida' ? 'bg-blue-200 text-blue-900' :
                                  c.estado === 'confirmada' ? 'bg-green-200 text-green-900' :
                                  c.estado === 'cancelada' ? 'bg-red-200 text-red-900' :
                                  'bg-amber-100 text-amber-900'
                                }`}>
                                  {c.estado}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                                <span>🪪 <strong>Cédula:</strong> {c.pacientes?.cedula || 'N/A'}</span>
                                <span>📱 <strong>Tel:</strong> {c.pacientes?.telefono || 'N/A'}</span>
                                <span className="font-semibold text-slate-700 capitalize">
                                  {c.tipo_consulta === 'telemedicina' ? '💻 Telemedicina' : '🏥 Presencial'}
                                </span>
                              </div>

                              {/* BOTÓN JITSI (SOLO SI SIGUE ACTIVA Y ES TELEMEDICINA) */}
                              {c.tipo_consulta === 'telemedicina' && c.estado !== 'atendida' && c.estado !== 'cancelada' && c.enlace_videollamada && (
                                <div className="mt-2.5">
                                  <a
                                    href={c.enlace_videollamada}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-1.5 px-3 rounded-xl shadow transition"
                                  >
                                    🎥 Iniciar Videoconsulta (Jitsi)
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* BOTONERA DE ACCIONES Y ESTADOS FINALES */}
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {c.estado !== 'atendida' && c.estado !== 'cancelada' && (
                              <>
                                <button
                                  onClick={() => iniciarReagendamiento(c)}
                                  className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold py-1.5 px-3 rounded-xl shadow-sm transition"
                                >
                                  ✏️ Reagendar
                                </button>

                                {c.estado === 'pendiente' && (
                                  <button
                                    onClick={() => cambiarEstadoCita(c.id, 'confirmada')}
                                    className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 px-3 rounded-xl shadow-sm transition"
                                  >
                                    🟢 Confirmar
                                  </button>
                                )}

                                <button
                                  onClick={() => cambiarEstadoCita(c.id, 'atendida')}
                                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 px-3 rounded-xl shadow-sm transition"
                                >
                                  🔵 Atendida
                                </button>

                                <button
                                  onClick={() => cambiarEstadoCita(c.id, 'cancelada')}
                                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-1.5 px-3 rounded-xl shadow-sm transition"
                                >
                                  🔴 Cancelar
                                </button>
                              </>
                            )}

                            {c.estado === 'atendida' && (
                              <span className="text-xs font-bold text-blue-700 bg-blue-100 px-3.5 py-1.5 rounded-xl border border-blue-200 shadow-sm flex items-center gap-1">
                                ✅ Consulta Finalizada
                              </span>
                            )}

                            {c.estado === 'cancelada' && (
                              <span className="text-xs font-bold text-red-600 bg-red-100 px-3.5 py-1.5 rounded-xl border border-red-200 shadow-sm flex items-center gap-1">
                                🚫 Cita Cancelada
                              </span>
                            )}
                          </div>

                        </div>
                      );
                    })}
                  </div>

                </div>
              ))
            )}
          </div>
        )}

        {/* MODAL DE REAGENDAMIENTO */}
        {citaEditando && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4">
              <h3 className="text-lg font-bold text-slate-800">✏️ Reagendar Cita</h3>
              <p className="text-xs text-slate-500">
                Paciente: <strong>{citaEditando.pacientes?.nombre}</strong>
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nueva Fecha</label>
                <input
                  type="date"
                  value={nuevaFechaReagendar}
                  onChange={(e) => {
                    setNuevaFechaReagendar(e.target.value);
                    setNuevaHoraReagendar('');
                  }}
                  className="w-full p-3 border rounded-xl text-xs text-slate-800 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Horarios Disponibles</label>
                {horariosReagendar.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
                    No hay turnos libres para esta fecha.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
                    {horariosReagendar.map((hora) => (
                      <button
                        key={hora}
                        type="button"
                        onClick={() => setNuevaHoraReagendar(hora)}
                        className={`p-2 text-xs font-bold rounded-xl border transition ${
                          nuevaHoraReagendar === hora
                            ? 'bg-blue-600 text-white border-blue-600 shadow'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50'
                        }`}
                      >
                        {hora} hs
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setCitaEditando(null)}
                  className="w-1/2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarReagendamiento}
                  disabled={loadingReagendar || !nuevaHoraReagendar}
                  className="w-1/2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition shadow"
                >
                  {loadingReagendar ? 'Guardando...' : 'Confirmar Cambio'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GESTIÓN DE MÉDICOS (ADMIN) */}
        {tabActiva === 'gestion_medicos' && esAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-sm font-bold text-slate-800">
                  {medicoEditandoId ? '✏️ Editar Datos del Médico' : '➕ Registrar Nuevo Médico'}
                </h2>
                {medicoEditandoId && (
                  <button onClick={cancelarEdicionMedico} className="text-xs text-blue-600 hover:underline font-bold">
                    Cancelar
                  </button>
                )}
              </div>

              <form onSubmit={guardarMedicoPorAdmin} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    required
                    className="w-full p-2.5 bg-white border rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Especialidad</label>
                  <input
                    type="text"
                    value={nuevaEspecialidad}
                    onChange={(e) => setNuevaEspecialidad(e.target.value)}
                    required
                    className="w-full p-2.5 bg-white border rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={nuevoEmail}
                    onChange={(e) => setNuevoEmail(e.target.value)}
                    required
                    className="w-full p-2.5 bg-white border rounded-xl text-xs font-semibold"
                  />
                </div>
                {!medicoEditandoId && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Contraseña Inicial</label>
                    <input
                      type="password"
                      value={nuevaPassword}
                      onChange={(e) => setNuevaPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full p-2.5 bg-white border rounded-xl text-xs font-semibold"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={nuevoTelefono}
                    onChange={(e) => setNuevoTelefono(e.target.value)}
                    className="w-full p-2.5 bg-white border rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Rol en el Sistema</label>
                  <select
                    value={nuevoRol}
                    onChange={(e) => setNuevoRol(e.target.value)}
                    className="w-full p-2.5 bg-white border rounded-xl text-xs font-semibold"
                  >
                    <option value="medico">Médico</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loadingCrearMedico}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow mt-2"
                >
                  {loadingCrearMedico ? 'Guardando...' : medicoEditandoId ? 'Actualizar Médico' : 'Crear Médico'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 space-y-3">
              <h2 className="text-sm font-bold text-slate-800">Médicos Registrados en la Clínica</h2>
              <div className="space-y-2">
                {listaMedicos.map((med) => (
                  <div key={med.id} className="p-4 bg-white border rounded-2xl flex items-center justify-between shadow-sm">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{med.nombre}</h4>
                      <p className="text-xs text-slate-500">{med.especialidad} — {med.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => seleccionarParaEditar(med)}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold py-1 px-3 rounded-lg transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => eliminarMedico(med.id, med.nombre)}
                        className="bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold py-1 px-3 rounded-lg transition"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AGENDAR CITA MANUAL */}
        {tabActiva === 'agendar_asistente' && (
          <div className="max-w-xl mx-auto bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
            <h2 className="text-md font-bold text-slate-800">➕ Agendamiento Manual de Cita</h2>
            <p className="text-xs text-slate-500">Busca al paciente por su número de cédula para asignarle un turno directamente.</p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Cédula del paciente..."
                value={cedulaBusquedaManual}
                onChange={(e) => setCedulaBusquedaManual(e.target.value)}
                className="w-full p-2.5 bg-white border rounded-xl text-xs font-semibold"
              />
              <button
                onClick={buscarPacientePorCedula}
                disabled={buscandoPaciente}
                className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
              >
                {buscandoPaciente ? 'Buscando...' : 'Buscar'}
              </button>
            </div>

            {pacienteEncontrado && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-900 space-y-1">
                <p>✅ <strong>Paciente Encontrado:</strong> {pacienteEncontrado.nombre}</p>
                <p>🪪 Cédula: {pacienteEncontrado.cedula} | Tel: {pacienteEncontrado.telefono}</p>
              </div>
            )}

            {pacienteEncontrado && (
              <form onSubmit={confirmarAgendamientoManual} className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Fecha de la Cita</label>
                  <input
                    type="date"
                    value={fechaManual}
                    onChange={(e) => setFechaManual(e.target.value)}
                    required
                    className="w-full p-2.5 bg-white border rounded-xl text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Horarios Disponibles</label>
                  {horariosManuales.length === 0 ? (
                    <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      Selecciona una fecha válida con disponibilidad configurada.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto p-1">
                      {horariosManuales.map((hora) => (
                        <button
                          key={hora}
                          type="button"
                          onClick={() => setHoraManualSeleccionada(hora)}
                          className={`p-2 text-xs font-bold rounded-xl border transition ${
                            horaManualSeleccionada === hora
                              ? 'bg-blue-600 text-white border-blue-600 shadow'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50'
                          }`}
                        >
                          {hora} hs
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Tipo de Consulta</label>
                  <select
                    value={tipoConsultaManual}
                    onChange={(e) => setTipoConsultaManual(e.target.value)}
                    className="w-full p-2.5 bg-white border rounded-xl text-xs font-semibold"
                  >
                    <option value="presencial">🏥 Presencial</option>
                    <option value="telemedicina">💻 Telemedicina (Jitsi)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loadingManual || !horaManualSeleccionada}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition shadow"
                >
                  {loadingManual ? 'Registrando...' : 'Confirmar y Agendar Cita'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB 4: CONFIGURAR HORARIOS */}
        {tabActiva === 'horarios' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
              <h2 className="text-md font-bold text-slate-800">⚙️ Agregar Disponibilidad Horaria</h2>
              <form onSubmit={guardarHorario} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Día de la Semana</label>
                  <select
                    value={diaSemana}
                    onChange={(e) => setDiaSemana(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border rounded-xl text-xs font-semibold"
                  >
                    {DIAS.map((d, index) => (
                      <option key={d} value={index}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Hora Inicio</label>
                    <input
                      type="time"
                      value={horaInicio}
                      onChange={(e) => setHoraInicio(e.target.value)}
                      className="w-full p-2.5 bg-white border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Hora Fin</label>
                    <input
                      type="time"
                      value={horaFin}
                      onChange={(e) => setHoraFin(e.target.value)}
                      className="w-full p-2.5 bg-white border rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Duración del Turno (minutos)</label>
                  <select
                    value={duracion}
                    onChange={(e) => setDuracion(Number(e.target.value))}
                    className="w-full p-2.5 bg-white border rounded-xl text-xs font-semibold"
                  >
                    <option value={15}>15 minutos</option>
                    <option value={20}>20 minutos</option>
                    <option value={30}>30 minutos</option>
                    <option value={45}>45 minutos</option>
                    <option value={60}>60 minutos</option>
                  </select>
                </div>

                {mensajeHorario && (
                  <p className="text-xs font-bold text-blue-600 bg-blue-50 p-2 rounded-xl">{mensajeHorario}</p>
                )}

                <button
                  type="submit"
                  disabled={loadingHorario}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow"
                >
                  {loadingHorario ? 'Guardando...' : 'Guardar Horario'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 space-y-3">
              <h2 className="text-sm font-bold text-slate-800">Horarios Configurados</h2>
              {disponibilidades.length === 0 ? (
                <p className="text-xs text-slate-400">No hay horarios configurados para este doctor.</p>
              ) : (
                <div className="space-y-2">
                  {disponibilidades.map((disp) => (
                    <div key={disp.id} className="p-3 bg-white border rounded-xl flex items-center justify-between text-xs font-semibold shadow-sm">
                      <span>
                        📅 <strong>{DIAS[disp.dia_semana]}</strong>: {disp.hora_inicio} - {disp.hora_fin} ({disp.duracion_cita_minutos} min/turno)
                      </span>
                      <button
                        onClick={() => eliminarHorario(disp.id!)}
                        className="bg-red-100 hover:bg-red-200 text-red-800 py-1 px-2.5 rounded-lg transition"
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}