'use client';

import { useState, useEffect } from 'react';
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
  const [disponabilidades, setDisponibilidades] = useState<Disponibilidad[]>([]);

  // Reagendamiento
  const [citaEditando, setCitaEditando] = useState<CitaDetalle | null>(null);
  const [nuevaFechaReagendar, setNuevaFechaReagendar] = useState<string>('');
  const [nuevaHoraReagendar, setNuevaHoraReagendar] = useState<string>('');
  const [horariosReagendar, setHorariosReagendar] = useState<string[]>([]);
  const [loadingReagendar, setLoadingReagendar] = useState<boolean>(false);

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
    setNuevaPassword(''); // La contraseña solo se actualiza si ingresa una nueva
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

  // Guardar (Crear o Actualizar) Médico
  async function guardarMedicoPorAdmin(e: React.FormEvent) {
    e.preventDefault();
    setLoadingCrearMedico(true);

    if (medicoEditandoId) {
      // MODO EDICIÓN: Actualizar registro existente
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
      // MODO CREACIÓN: Nuevo médico en Auth y BD
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
        alert(`¡Perfil creado con éxito! ${nuevoNombre} ya puede ingresar con su contraseña.`);
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
        pacientes ( nombre, cedula, telefono )
      `)
      .eq('medico_id', id)
      .order('fecha_hora', { ascending: true });

    if (error) {
      console.error('Error al cargar citas:', error);
    } else if (data) {
      setCitas(data as unknown as CitaDetalle[]);
    }
  }

  async function cambiarEstadoCita(citaId: string, nuevoEstado: string) {
    const { error } = await supabase
      .from('citas')
      .update({ estado: nuevoEstado })
      .eq('id', citaId);

    const targetId = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
    if (!error && targetId) {
      cargarCitasMedico(targetId);
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
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md p-8 border border-slate-200">
        
        {/* Encabezado */}
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-800">
                {esAdmin ? '👑 Panel Administrador General' : `Dr(a). ${perfilUsuario.nombre}`}
              </h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${esAdmin ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                {esAdmin ? 'ADMINISTRADOR' : perfilUsuario.especialidad}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Usuario: {perfilUsuario.email}</p>
          </div>

          <button
            onClick={cerrarSesion}
            className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 text-xs font-semibold py-2 px-3 rounded-lg transition border"
          >
            🚪 Cerrar Sesión
          </button>
        </div>

        {/* Filtro Global para el Administrador */}
        {esAdmin && (
          <div className="mb-6 p-4 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between">
            <label className="text-xs font-bold text-purple-900 uppercase">Ver agenda del médico:</label>
            <select
              value={medicoSeleccionadoAdmin}
              onChange={(e) => setMedicoSeleccionadoAdmin(e.target.value)}
              className="p-2 border rounded-lg bg-white text-slate-800 text-sm font-semibold w-72"
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
        <div className="flex border-b mb-6 overflow-x-auto">
          <button
            onClick={() => setTabActiva('citas')}
            className={`py-2 px-4 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
              tabActiva === 'citas' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            📅 Citas ({citas.filter((c) => c.estado !== 'cancelada').length})
          </button>

          {esAdmin && (
            <button
              onClick={() => setTabActiva('gestion_medicos')}
              className={`py-2 px-4 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
                tabActiva === 'gestion_medicos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              👥 Registrar / Gestionar Médicos
            </button>
          )}

          <button
            onClick={() => setTabActiva('agendar_asistente')}
            className={`py-2 px-4 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
              tabActiva === 'agendar_asistente' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            ➕ Agendar Cita Manual
          </button>
          <button
            onClick={() => setTabActiva('horarios')}
            className={`py-2 px-4 font-semibold text-sm border-b-2 transition whitespace-nowrap ${
              tabActiva === 'horarios' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            ⚙️ Configurar Horarios
          </button>
        </div>

        {/* TAB 1: CITAS */}
        {tabActiva === 'citas' && (
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Agenda de Citas</h2>
            {citas.length === 0 ? (
              <p className="text-slate-500 text-sm">No hay citas agendadas.</p>
            ) : (
              <div className="space-y-3">
                {citas.map((c) => {
                  const fechaObj = new Date(c.fecha_hora);
                  const fechaFormatted = fechaObj.toLocaleDateString('es-EC', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });
                  const horaFormatted = fechaObj.toLocaleTimeString('es-EC', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={c.id}
                      className={`p-4 border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                        c.estado === 'cancelada'
                          ? 'bg-red-50 border-red-200 opacity-60'
                          : c.estado === 'confirmada'
                          ? 'bg-green-50 border-green-200'
                          : c.estado === 'atendida'
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-white border-slate-200 shadow-sm'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-slate-800 text-base">
                            {c.pacientes?.nombre || 'Paciente Desconocido'}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${
                              c.estado === 'confirmada'
                                ? 'bg-green-200 text-green-800'
                                : c.estado === 'cancelada'
                                ? 'bg-red-200 text-red-800'
                                : c.estado === 'atendida'
                                ? 'bg-blue-200 text-blue-800'
                                : 'bg-amber-200 text-amber-800'
                            }`}
                          >
                            {c.estado}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">
                          📅 <strong>{fechaFormatted}</strong> a las <strong>{horaFormatted} hs</strong> | Tipo:{' '}
                          <span className="capitalize">{c.tipo_consulta}</span>
                        </p>
                        <p className="text-xs text-slate-500 mb-2">
                          🪪 Cédula: {c.pacientes?.cedula} | 📱 Tel: {c.pacientes?.telefono}
                        </p>

                        {c.tipo_consulta === 'telemedicina' && c.enlace_videollamada && (
                          <div className="pt-2 border-t border-slate-200/60">
                            <a
                              href={c.enlace_videollamada}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center space-x-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-1.5 px-3 rounded-md transition shadow-sm"
                            >
                              <span>📹 Iniciar Videoconsulta (Jitsi)</span>
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {c.estado !== 'cancelada' && (
                          <button
                            onClick={() => iniciarReagendamiento(c)}
                            className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold py-1.5 px-3 rounded-md shadow-sm transition"
                          >
                            ✏️ Reagendar / Cambiar Hora
                          </button>
                        )}

                        {c.estado !== 'confirmada' && c.estado !== 'cancelada' && c.estado !== 'atendida' && (
                          <button
                            onClick={() => cambiarEstadoCita(c.id, 'confirmada')}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md shadow-sm transition"
                          >
                            🟢 Confirmar
                          </button>
                        )}

                        {c.estado !== 'atendida' && c.estado !== 'cancelada' && (
                          <button
                            onClick={() => cambiarEstadoCita(c.id, 'atendida')}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md shadow-sm transition"
                          >
                            🔵 Atendida
                          </button>
                        )}

                        {c.estado !== 'cancelada' && (
                          <button
                            onClick={() => cambiarEstadoCita(c.id, 'cancelada')}
                            className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md shadow-sm transition"
                          >
                            🔴 Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MODAL DE REAGENDAMIENTO */}
        {citaEditando && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800 mb-1">✏️ Reagendar Cita</h3>
              <p className="text-xs text-slate-500 mb-4">
                Paciente: <strong>{citaEditando.pacientes?.nombre}</strong>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nueva Fecha</label>
                  <input
                    type="date"
                    value={nuevaFechaReagendar}
                    onChange={(e) => {
                      setNuevaFechaReagendar(e.target.value);
                      setNuevaHoraReagendar('');
                    }}
                    className="w-full p-2.5 border rounded-xl text-xs text-slate-800 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nuevo Horario Disponibles</label>
                  {horariosReagendar.length === 0 ? (
                    <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                      No hay turnos disponibles para la fecha seleccionada.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
                      {horariosReagendar.map((hora) => (
                        <button
                          key={hora}
                          type="button"
                          onClick={() => setNuevaHoraReagendar(hora)}
                          className={`p-2 text-xs font-bold rounded-lg border transition ${
                            nuevaHoraReagendar === hora
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50'
                          }`}
                        >
                          {hora} hs
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-6">
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

        {/* TAB 2 EXCLUSIVA ADMIN: CREAR Y MODIFICAR MÉDICOS */}
        {tabActiva === 'gestion_medicos' && esAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* FORMULARIO CREAR / EDITAR */}
            <div className="lg:col-span-5 bg-slate-50 p-6 rounded-xl border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-md font-bold text-slate-800">
                  {medicoEditandoId ? '✏️ Editar Datos del Médico' : '➕ Registrar Nuevo Médico'}
                </h2>
                {medicoEditandoId && (
                  <button
                    onClick={cancelarEdicionMedico}
                    className="text-xs text-slate-500 hover:text-slate-800 underline font-semibold"
                  >
                    Cancelar Edición
                  </button>
                )}
              </div>

              <form onSubmit={guardarMedicoPorAdmin} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    placeholder="Ej. Dr. Mario Silva"
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    className="w-full p-2 border rounded-lg text-xs text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Especialidad</label>
                  <input
                    type="text"
                    placeholder="Ej. Dermatología"
                    value={nuevaEspecialidad}
                    onChange={(e) => setNuevaEspecialidad(e.target.value)}
                    className="w-full p-2 border rounded-lg text-xs text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Dirección del Consultorio</label>
                  <input
                    type="text"
                    placeholder="Ej. Av. Principal 123, Guayaquil"
                    value={nuevaDireccion}
                    onChange={(e) => setNuevaDireccion(e.target.value)}
                    className="w-full p-2 border rounded-lg text-xs text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Número / Piso del Consultorio</label>
                  <input
                    type="text"
                    placeholder="Ej. Piso 2, Consultorio 3"
                    value={nuevoConsultorio}
                    onChange={(e) => setNuevoConsultorio(e.target.value)}
                    className="w-full p-2 border rounded-lg text-xs text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Correo (Usuario de Acceso)</label>
                  <input
                    type="email"
                    placeholder="msilva@clinica.ec"
                    value={nuevoEmail}
                    onChange={(e) => setNuevoEmail(e.target.value)}
                    className="w-full p-2 border rounded-lg text-xs text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">WhatsApp / Teléfono</label>
                  <input
                    type="tel"
                    placeholder="0991234567"
                    value={nuevoTelefono}
                    onChange={(e) => setNuevoTelefono(e.target.value)}
                    className="w-full p-2 border rounded-lg text-xs text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Rol en el Sistema</label>
                  <select
                    value={nuevoRol}
                    onChange={(e) => setNuevoRol(e.target.value)}
                    className="w-full p-2 border rounded-lg text-xs text-slate-800 font-semibold"
                  >
                    <option value="medico">👨‍⚕️ Médico / Especialista</option>
                    <option value="admin">👑 Administrador General</option>
                  </select>
                </div>

                {!medicoEditandoId && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Contraseña Inicial de Acceso</label>
                    <input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      value={nuevaPassword}
                      onChange={(e) => setNuevaPassword(e.target.value)}
                      className="w-full p-2 border rounded-lg text-xs text-slate-800"
                      required
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loadingCrearMedico}
                  className={`w-full font-bold py-2.5 rounded-lg transition text-xs shadow text-white mt-2 ${
                    medicoEditandoId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {loadingCrearMedico
                    ? 'Procesando...'
                    : medicoEditandoId
                    ? '💾 Guardar Cambios del Médico'
                    : '✨ Registrar Médico y Asignar Credenciales'}
                </button>
              </form>
            </div>

            {/* LISTADO DE MÉDICOS REGISTRADOS CON BOTÓN DE EDITAR/ELIMINAR */}
            <div className="lg:col-span-7">
              <h2 className="text-md font-bold text-slate-800 mb-3">📋 Personal Médico Registrado ({listaMedicos.length})</h2>
              <div className="space-y-3">
                {listaMedicos.map((m) => (
                  <div
                    key={m.id}
                    className={`p-4 border rounded-xl flex items-center justify-between transition ${
                      medicoEditandoId === m.id ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">{m.nombre}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            m.rol === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {m.rol || 'medico'}
                        </span>
                      </div>
                      <p className="text-xs text-blue-600 font-semibold">{m.especialidad}</p>
                      <p className="text-xs text-slate-500 mt-0.5">📍 {m.direccion || 'Sin dirección'} | 🏢 {m.consultorio || 'Sin consultorio'}</p>
                      <p className="text-[11px] text-slate-400">✉️ {m.email} | 📱 {m.telefono}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => seleccionarParaEditar(m)}
                        className="bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold py-1.5 px-3 rounded-lg transition"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => eliminarMedico(m.id, m.nombre)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold py-1.5 px-2.5 rounded-lg transition"
                      >
                        🗑️
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
          <div className="p-6 bg-slate-100 rounded-xl text-center">
            <p className="text-slate-700 text-sm mb-4">
              Registrar manualmente una cita por teléfono o en recepción para el paciente.
            </p>
            <Link
              href={`/agendar?medicoId=${esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id}`}
              target="_blank"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-sm transition shadow"
            >
              🔗 Abrir Formulario de Agendamiento
            </Link>
          </div>
        )}

        {/* TAB 4: CONFIGURACIÓN DE HORARIOS */}
        {tabActiva === 'horarios' && (
          <div>
            <form onSubmit={guardarHorario} className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-6 mb-6">
              <h2 className="md:col-span-2 text-md font-bold text-slate-700">Agregar Horario de Atención</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Día de la Semana</label>
                <select
                  value={diaSemana}
                  onChange={(e) => setDiaSemana(Number(e.target.value))}
                  className="w-full p-2 border rounded-md text-slate-700"
                >
                  {DIAS.map((d, index) => (
                    <option key={index} value={index}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Duración por Cita</label>
                <select
                  value={duracion}
                  onChange={(e) => setDuracion(Number(e.target.value))}
                  className="w-full p-2 border rounded-md text-slate-700"
                >
                  <option value={15}>15 Minutos</option>
                  <option value={20}>20 Minutos</option>
                  <option value={30}>30 Minutos</option>
                  <option value={45}>45 Minutos</option>
                  <option value={60}>60 Minutos</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hora de Inicio</label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="w-full p-2 border rounded-md text-slate-700"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hora de Fin</label>
                <input
                  type="time"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                  className="w-full p-2 border rounded-md text-slate-700"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={loadingHorario}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition"
                >
                  {loadingHorario ? 'Guardando...' : '➕ Agregar Horario de Atención'}
                </button>
              </div>

              {mensajeHorario && <p className="md:col-span-2 text-sm font-medium text-green-600 mt-2">{mensajeHorario}</p>}
            </form>

            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-3">Horarios Configurados</h2>
              {disponabilidades.length === 0 ? (
                <p className="text-slate-500 text-sm">No hay horarios configurados para este perfil.</p>
              ) : (
                <div className="space-y-2">
                  {disponabilidades.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-3 bg-slate-100 rounded-md text-slate-700">
                      <div>
                        <span className="font-bold text-blue-900">{DIAS[d.dia_semana]}</span>: de{' '}
                        <span>{d.hora_inicio.substring(0, 5)}</span> a <span>{d.hora_fin.substring(0, 5)}</span> ({d.duracion_cita_minutos} min por turno)
                      </div>
                      <button
                        onClick={() => d.id && eliminarHorario(d.id)}
                        className="text-red-500 hover:text-red-700 text-sm font-semibold px-2 py-1"
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