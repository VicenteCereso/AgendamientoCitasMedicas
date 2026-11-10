'use client';

import { useState, useEffect, useMemo } from 'react';
import { MedicoService } from '@/services/medico.service';

interface CitaDetalle {
  id: string;
  medico_id: string;
  fecha_hora: string;
  estado: string;
  tipo_consulta: string;
  enlace_videollamada?: string;
  pacientes: {
    id: string;
    nombre: string;
    cedula: string;
    telefono: string;
  };
}

export default function PanelMedicoPage() {
  const [tabActiva, setTabActiva] = useState<'citas' | 'gestion_medicos' | 'agendar_asistente' | 'horarios'>('citas');

  // Autenticación y Perfil
  const [userAuth, setUserAuth] = useState<any>(null);
  const [perfilUsuario, setPerfilUsuario] = useState<any>(null);
  const [esAdmin, setEsAdmin] = useState<boolean>(false);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [listaMedicos, setListaMedicos] = useState<any[]>([]);
  const [medicoSeleccionadoAdmin, setMedicoSeleccionadoAdmin] = useState<string>('');

  // Login
  const [emailLogin, setEmailLogin] = useState<string>('');
  const [passwordLogin, setPasswordLogin] = useState<string>('');
  const [errorLogin, setErrorLogin] = useState<string>('');
  const [loadingLogin, setLoadingLogin] = useState<boolean>(false);

  // Formulario Crear / Editar Médico (Admin)
  const [medicoEditandoId, setMedicoEditandoId] = useState<string | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState<string>('');
  const [nuevaEspecialidad, setNuevaEspecialidad] = useState<string>('');
  const [nuevaDireccion, setNuevaDireccion] = useState<string>('');
  const [nuevoConsultorio, setNuevoConsultorio] = useState<string>('');
  const [nuevoEmail, setNuevoEmail] = useState<string>('');
  const [nuevoTelefono, setNuevoTelefono] = useState<string>('');
  const [nuevaPassword, setNuevaPassword] = useState<string>('');
  const [nuevoRol, setNuevoRol] = useState<string>('medico');
  const [tieneHistoriaClinica, setTieneHistoriaClinica] = useState<boolean>(false); // 👈 Bandera
  const [loadingCrearMedico, setLoadingCrearMedico] = useState<boolean>(false);

  // Citas y Horarios
  const [citas, setCitas] = useState<CitaDetalle[]>([]);
  const [disponibilidades, setDisponibilidades] = useState<any[]>([]);

  // Filtros Citas UX
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todas');
  const [fechaFiltro, setFechaFiltro] = useState<string>('');

  // Reagendamiento
  const [citaEditando, setCitaEditando] = useState<CitaDetalle | null>(null);
  const [nuevaFechaReagendar, setNuevaFechaReagendar] = useState<string>('');
  const [nuevaHoraReagendar, setNuevaHoraReagendar] = useState<string>('');
  const [horariosReagendar, setHorariosReagendar] = useState<string[]>([]);
  const [loadingReagendar, setLoadingReagendar] = useState<boolean>(false);

  // Atención e Historia Clínica
  const [citaAtendiendoId, setCitaAtendiendoId] = useState<string | null>(null);
  const [motivoConsulta, setMotivoConsulta] = useState<string>('');
  const [diagnostico, setDiagnostico] = useState<string>('');
  const [tratamiento, setTratamiento] = useState<string>('');
  const [guardandoHistoria, setGuardandoHistoria] = useState<boolean>(false);

  // Modales
  const [modalHistorialPaciente, setModalHistorialPaciente] = useState<any | null>(null);
  const [listaHistorialPrevio, setListaHistorialPrevio] = useState<any[]>([]);
  const [loadingHistorialModal, setLoadingHistorialModal] = useState<boolean>(false);
  const [recetaParaImprimir, setRecetaParaImprimir] = useState<any | null>(null);

  useEffect(() => {
    inicializar();
  }, []);

  async function inicializar() {
    setLoadingAuth(true);
    try {
      const res = await MedicoService.obtenerSesionYPerfil();
      setUserAuth(res.userAuth);
      setPerfilUsuario(res.perfilUsuario);
      setEsAdmin(res.esAdmin);
      setListaMedicos(res.listaMedicos);

      // Seleccionar por defecto el primer médico que NO sea admin puro
      const medicosOperativos = res.listaMedicos.filter((m: any) => m.rol !== 'admin' || m.id === res.perfilUsuario?.id);
      const targetId = res.esAdmin && medicosOperativos.length > 0 
        ? medicosOperativos[0].id 
        : res.perfilUsuario?.id;

      if (res.esAdmin && medicosOperativos.length > 0) {
        setMedicoSeleccionadoAdmin(medicosOperativos[0].id);
      }

      if (targetId) {
        await cargarAgenda(targetId);
      }
    } catch (err) {
      console.error('Error al inicializar sesión:', err);
    }
    setLoadingAuth(false);
  }

  async function ejecutarLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoadingLogin(true);
    setErrorLogin('');
    try {
      await MedicoService.iniciarSesion(emailLogin, passwordLogin);
      await inicializar();
    } catch (err: any) {
      setErrorLogin(err.message);
    }
    setLoadingLogin(false);
  }

  async function cargarAgenda(id: string) {
    try {
      const [citasData, dispData] = await Promise.all([
        MedicoService.obtenerCitas(id),
        MedicoService.obtenerDisponibilidad(id)
      ]);
      setCitas(citasData as unknown as CitaDetalle[]);
      setDisponibilidades(dispData);
    } catch (err) {
      console.error('Error al cargar agenda:', err);
    }
  }

  useEffect(() => {
    if (esAdmin && medicoSeleccionadoAdmin) {
      cargarAgenda(medicoSeleccionadoAdmin);
    }
  }, [medicoSeleccionadoAdmin, esAdmin]);

  async function cambiarEstado(citaId: string, nuevoEstado: string) {
    try {
      await MedicoService.actualizarEstadoCita(citaId, nuevoEstado);
      const targetId = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
      if (targetId) cargarAgenda(targetId);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  async function cerrarSesionSistema() {
    await MedicoService.cerrarSesion();
    setUserAuth(null);
    setPerfilUsuario(null);
    setEmailLogin('');
    setPasswordLogin('');
  }

  // Cargar médico en formulario para editar (Admin)
  function seleccionarParaEditar(med: any) {
    setMedicoEditandoId(med.id);
    setNuevoNombre(med.nombre || '');
    setNuevaEspecialidad(med.especialidad || '');
    setNuevaDireccion(med.direccion || '');
    setNuevoConsultorio(med.consultorio || '');
    setNuevoEmail(med.email || '');
    setNuevoTelefono(med.telefono || '');
    setNuevoRol(med.rol || 'medico');
    setTieneHistoriaClinica(med.tiene_historia_clinica || false);
  }

  function limpiarFormularioMedico() {
    setMedicoEditandoId(null);
    setNuevoNombre('');
    setNuevaEspecialidad('');
    setNuevaDireccion('');
    setNuevoConsultorio('');
    setNuevoEmail('');
    setNuevoTelefono('');
    setNuevaPassword('');
    setNuevoRol('medico');
    setTieneHistoriaClinica(false);
  }

  // Abrir Modal Historial Previo
  async function abrirModalHistorial(paciente: any) {
    setModalHistorialPaciente(paciente);
    setLoadingHistorialModal(true);
    try {
      const historial = await MedicoService.obtenerHistorialPaciente(paciente.id);
      setListaHistorialPrevio(historial);
    } catch (err: any) {
      alert('Error al consultar historial: ' + err.message);
    }
    setLoadingHistorialModal(false);
  }

  // Guardar Atención Clínica
  async function guardarHistoriaClinica(cita: CitaDetalle) {
    if (!motivoConsulta || !diagnostico) {
      alert('Por favor, ingresa motivo de consulta y diagnóstico.');
      return;
    }

    setGuardandoHistoria(true);
    try {
      await MedicoService.guardarAtencionClinica({
        citaId: cita.id,
        pacienteId: cita.pacientes.id,
        medicoId: cita.medico_id,
        motivoConsulta,
        diagnostico,
        tratamiento
      });

      alert('¡Atención registrada con éxito!');
      
      if (tratamiento) {
        setRecetaParaImprimir({
          paciente: cita.pacientes,
          medico: perfilUsuario,
          fecha: new Date().toLocaleDateString('es-EC'),
          diagnostico,
          tratamiento
        });
      }

      setCitaAtendiendoId(null);
      setMotivoConsulta('');
      setDiagnostico('');
      setTratamiento('');

      const targetId = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
      if (targetId) cargarAgenda(targetId);
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    }
    setGuardandoHistoria(false);
  }

  function iniciarReagendamiento(cita: CitaDetalle) {
    setCitaEditando(cita);
    const fechaObj = new Date(cita.fecha_hora);
    setNuevaFechaReagendar(fechaObj.toISOString().split('T')[0]);
    setNuevaHoraReagendar('');
  }

  useEffect(() => {
    const targetId = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
    if (citaEditando && nuevaFechaReagendar && targetId) {
      MedicoService.calcularHorariosDisponiblesReagendamiento(targetId, nuevaFechaReagendar, citaEditando.id)
        .then(setHorariosReagendar);
    } else {
      setHorariosReagendar([]);
    }
  }, [nuevaFechaReagendar, citaEditando, medicoSeleccionadoAdmin]);

  async function confirmarReagendamiento() {
    if (!citaEditando || !nuevaFechaReagendar || !nuevaHoraReagendar) return;
    setLoadingReagendar(true);
    try {
      await MedicoService.reagendarCita(
        citaEditando.id, 
        citaEditando.medico_id, 
        citaEditando.tipo_consulta, 
        nuevaFechaReagendar, 
        nuevaHoraReagendar
      );
      alert('¡Cita reagendada con éxito!');
      setCitaEditando(null);
      const targetId = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
      if (targetId) cargarAgenda(targetId);
    } catch (err: any) {
      alert('Error al reagendar: ' + err.message);
    }
    setLoadingReagendar(false);
  }

  const citasFiltradas = useMemo(() => {
    return (Array.isArray(citas) ? citas : []).filter((c) => {
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

  const citasAgrupadasPorDia = useMemo(() => {
    const grupos: { [key: string]: CitaDetalle[] } = {};
    [...citasFiltradas]
      .sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime())
      .forEach((cita) => {
        if (!cita.fecha_hora) return;
        const fechaFormateada = new Date(cita.fecha_hora).toLocaleDateString('es-EC', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
        const key = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
        if (!grupos[key]) grupos[key] = [];
        grupos[key].push(cita);
      });
    return grupos;
  }, [citasFiltradas]);

  if (loadingAuth) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-medium">Cargando sistema...</div>;
  }

  // Formulario Login
  if (!userAuth || !perfilUsuario) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-lg p-8 border border-slate-100">
          <div className="text-center mb-8">
            <span className="text-4xl">🔐</span>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">Acceso Administrativo / Médico</h1>
            <p className="text-xs text-slate-500 mt-1">Ingresa tus credenciales para acceder</p>
          </div>
          <form onSubmit={ejecutarLogin} className="space-y-4">
            {errorLogin && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {errorLogin}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Correo Electrónico</label>
              <input
                type="email"
                value={emailLogin}
                onChange={(e) => setEmailLogin(e.target.value)}
                className="w-full p-3 border rounded-xl text-xs font-semibold"
                placeholder="medico@ejemplo.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Contraseña</label>
              <input
                type="password"
                value={passwordLogin}
                onChange={(e) => setPasswordLogin(e.target.value)}
                className="w-full p-3 border rounded-xl text-xs font-semibold"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loadingLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition"
            >
              {loadingLogin ? 'Validando...' : 'Iniciar Sesión'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const tieneModuloHistoria = perfilUsuario?.tiene_historia_clinica || esAdmin;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #seccion-receta-impresion, #seccion-receta-impresion * { visibility: visible; }
          #seccion-receta-impresion { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-lg p-6 md:p-8 border space-y-6">
        
        {/* Encabezado */}
        <div className="flex justify-between items-center border-b pb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-800">
              {esAdmin ? '👑 Panel Administrador General' : `Dr(a). ${perfilUsuario.nombre}`}
            </h1>
            <span className="text-xs px-3 py-1 rounded-full font-bold uppercase bg-blue-100 text-blue-800">
              {esAdmin ? 'ADMINISTRADOR' : perfilUsuario.especialidad}
            </span>
          </div>
          <button onClick={cerrarSesionSistema} className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-xs font-bold py-2 px-3 rounded-xl border">
            🚪 Cerrar Sesión
          </button>
        </div>

        {/* Admin Selector */}
        {esAdmin && (
          <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 flex justify-between items-center">
            <label className="text-xs font-bold text-purple-900 uppercase">Ver agenda del médico:</label>
            <select
              value={medicoSeleccionadoAdmin}
              onChange={(e) => setMedicoSeleccionadoAdmin(e.target.value)}
              className="p-2 border rounded-xl bg-white text-sm font-semibold w-80 shadow-sm"
            >
              {listaMedicos.map((m) => (
                <option key={m.id} value={m.id}>{m.nombre} — {m.especialidad}</option>
              ))}
            </select>
          </div>
        )}

        {/* 👑 RESTAURACIÓN DE TODAS LAS PESTAÑAS PARA EL ADMINISTRADOR */}
        <div className="flex border-b overflow-x-auto gap-2">
          <button
            onClick={() => setTabActiva('citas')}
            className={`py-2 px-4 font-bold text-xs border-b-2 transition whitespace-nowrap ${
              tabActiva === 'citas' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            📅 Citas ({citas.filter((c) => c.estado !== 'cancelada').length})
          </button>

          {esAdmin && (
            <button
              onClick={() => setTabActiva('gestion_medicos')}
              className={`py-2 px-4 font-bold text-xs border-b-2 transition whitespace-nowrap ${
                tabActiva === 'gestion_medicos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
              }`}
            >
              👥 Registrar / Gestionar Médicos
            </button>
          )}

          <button
            onClick={() => setTabActiva('horarios')}
            className={`py-2 px-4 font-bold text-xs border-b-2 transition whitespace-nowrap ${
              tabActiva === 'horarios' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            ⚙️ Horarios
          </button>
        </div>

        {/* TAB 1: CITAS */}
        {tabActiva === 'citas' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3 justify-between bg-slate-50 p-4 rounded-2xl border">
              <input
                type="text"
                placeholder="Buscar paciente o cédula..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="p-2 bg-white border rounded-xl text-xs w-full md:w-80 font-semibold"
              />
              <div className="flex gap-2">
                <input type="date" value={fechaFiltro} onChange={(e) => setFechaFiltro(e.target.value)} className="bg-white border text-xs p-2 rounded-xl" />
                <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="bg-white border text-xs p-2 rounded-xl font-semibold">
                  <option value="todas">Todos</option>
                  <option value="pendiente">Pendientes</option>
                  <option value="confirmada">Confirmadas</option>
                  <option value="atendida">Atendidas</option>
                  <option value="cancelada">Canceladas</option>
                </select>
              </div>
            </div>

            {Object.entries(citasAgrupadasPorDia).map(([fechaHeader, listaCitas]) => (
              <div key={fechaHeader} className="space-y-3">
                <h3 className="text-xs font-extrabold text-slate-700 uppercase bg-slate-100 px-3 py-1 rounded-lg w-fit">🗓️ {fechaHeader}</h3>
                {listaCitas.map((c) => (
                  <div key={c.id} className="p-4 rounded-2xl border bg-white flex flex-col gap-4 shadow-sm">
                    <div className="flex justify-between items-center gap-4">
                      <div>
                        <h4 className="font-bold text-sm text-slate-800">
                          {c.pacientes?.nombre} <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 uppercase">{c.estado}</span>
                        </h4>
                        <p className="text-xs text-slate-500 mt-1">🪪 {c.pacientes?.cedula} | 📱 {c.pacientes?.telefono} | 🏥 {c.tipo_consulta}</p>
                        
                        {c.tipo_consulta === 'telemedicina' && c.enlace_videollamada && (
                          <a href={c.enlace_videollamada} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-xs bg-purple-600 text-white font-bold py-1 px-3 rounded-lg">🎥 Videoconsulta Jitsi</a>
                        )}
                      </div>

                      <div className="flex gap-2 flex-wrap items-center">
                        {tieneModuloHistoria && (
                          <button
                            onClick={() => abrirModalHistorial(c.pacientes)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold py-1.5 px-3 rounded-xl border border-indigo-200 transition"
                          >
                            📋 Ver Historial
                          </button>
                        )}

                        {c.estado !== 'atendida' && c.estado !== 'cancelada' && (
                          <>
                            <button onClick={() => iniciarReagendamiento(c)} className="bg-amber-500 text-white text-xs font-semibold py-1.5 px-3 rounded-xl">Reagendar</button>

                            {tieneModuloHistoria ? (
                              <button
                                onClick={() => setCitaAtendiendoId(citaAtendiendoId === c.id ? null : c.id)}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 px-3 rounded-xl transition"
                              >
                                {citaAtendiendoId === c.id ? '✕ Cancelar' : '✍️ Atender / Historia'}
                              </button>
                            ) : (
                              <button onClick={() => cambiarEstado(c.id, 'atendida')} className="bg-blue-600 text-white text-xs font-semibold py-1.5 px-3 rounded-xl">Atendida</button>
                            )}

                            <button onClick={() => cambiarEstado(c.id, 'cancelada')} className="bg-red-600 text-white text-xs font-semibold py-1.5 px-3 rounded-xl">Cancelar</button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Formulario Atención Directa */}
                    {tieneModuloHistoria && citaAtendiendoId === c.id && (
                      <div className="mt-2 p-4 bg-slate-50 rounded-2xl border space-y-3">
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase">🩺 Registro de Atención — {c.pacientes?.nombre}</h4>
                        <textarea rows={2} value={motivoConsulta} onChange={(e) => setMotivoConsulta(e.target.value)} placeholder="Motivo de consulta..." className="w-full p-2 border rounded-xl text-xs bg-white" />
                        <textarea rows={2} value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} placeholder="Diagnóstico..." className="w-full p-2 border rounded-xl text-xs bg-white" />
                        <textarea rows={3} value={tratamiento} onChange={(e) => setTratamiento(e.target.value)} placeholder="Tratamiento / Receta..." className="w-full p-2 border rounded-xl text-xs bg-white" />
                        <div className="flex justify-end gap-2 pt-2">
                          <button onClick={() => setCitaAtendiendoId(null)} className="bg-slate-200 text-xs font-bold py-2 px-4 rounded-xl">Cancelar</button>
                          <button onClick={() => guardarHistoriaClinica(c)} disabled={guardandoHistoria} className="bg-green-600 text-white text-xs font-bold py-2 px-4 rounded-xl">
                            {guardandoHistoria ? 'Guardando...' : '💾 Finalizar y Generar Receta'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* 👑 TAB 2: GESTION DE MEDICOS Y PARAMETRO HISTORIA CLINICA */}
        {esAdmin && tabActiva === 'gestion_medicos' && (
          <div className="space-y-6">
            <div className="p-6 bg-slate-50 rounded-2xl border space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-extrabold text-slate-800 text-sm">
                  {medicoEditandoId ? '✏️ Editar Médico' : '➕ Registrar Nuevo Médico'}
                </h3>
                {medicoEditandoId && (
                  <button onClick={limpiarFormularioMedico} className="text-xs text-blue-600 font-bold underline">
                    + Cancelar edición (Crear nuevo)
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nombre Completo</label>
                  <input type="text" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs" placeholder="Dr. Juan Pérez" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Especialidad</label>
                  <input type="text" value={nuevaEspecialidad} onChange={(e) => setNuevaEspecialidad(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs" placeholder="Cardiología" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Correo</label>
                  <input type="email" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs" placeholder="doctor@clinica.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Teléfono</label>
                  <input type="text" value={nuevoTelefono} onChange={(e) => setNuevoTelefono(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs" placeholder="0991234567" />
                </div>
              </div>

              {/* 🎛️ FEATURE FLAG SWITCH: HISTORIA CLINICA */}
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-3">
                <input
                  type="checkbox"
                  id="chkHistoria"
                  checked={tieneHistoriaClinica}
                  onChange={(e) => setTieneHistoriaClinica(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="chkHistoria" className="text-xs font-bold text-indigo-900 cursor-pointer">
                  Habilitar Módulo de Historia Clínica y Receta para este médico
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => alert('Función de guardar médico integrada con servicio')}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-6 rounded-xl"
                >
                  {medicoEditandoId ? 'Actualizar Médico' : 'Guardar Médico'}
                </button>
              </div>
            </div>

            {/* Listado de Médicos */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase">Médicos Registrados</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {listaMedicos.map((med) => (
                  <div key={med.id} className="p-4 bg-white border rounded-2xl shadow-sm flex justify-between items-center">
                    <div>
                      <h5 className="font-bold text-xs text-slate-800">{med.nombre}</h5>
                      <p className="text-[11px] text-slate-500">{med.especialidad} | ✉️ {med.email}</p>
                      <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded ${med.tiene_historia_clinica ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                        {med.tiene_historia_clinica ? '📋 Historia Clínica Activa' : '📅 Solo Agendamiento'}
                      </span>
                    </div>
                    <button onClick={() => seleccionarParaEditar(med)} className="bg-slate-100 text-xs font-bold py-1.5 px-3 rounded-xl border">Editar</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modal Reagendar */}
        {citaEditando && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <h3 className="font-bold text-slate-800 text-sm">Reagendar Cita</h3>
              <input type="date" value={nuevaFechaReagendar} onChange={(e) => setNuevaFechaReagendar(e.target.value)} className="w-full p-2 border rounded-xl text-xs" />
              <div className="grid grid-cols-3 gap-2 max-h-45 overflow-y-auto">
                {horariosReagendar.map((h) => (
                  <button key={h} onClick={() => setNuevaHoraReagendar(h)} className={`p-2 text-xs font-bold rounded-xl border ${nuevaHoraReagendar === h ? 'bg-blue-600 text-white' : 'bg-slate-50'}`}>{h}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCitaEditando(null)} className="w-1/2 bg-slate-100 py-2 text-xs font-bold rounded-xl">Cancelar</button>
                <button onClick={confirmarReagendamiento} disabled={loadingReagendar || !nuevaHoraReagendar} className="w-1/2 bg-blue-600 text-white py-2 text-xs font-bold rounded-xl">Confirmar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Ver Historial PrevIO */}
        {modalHistorialPaciente && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[85vh] flex flex-col">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-extrabold text-slate-800 text-sm">📋 Historial Clínico: {modalHistorialPaciente.nombre}</h3>
                <button onClick={() => setModalHistorialPaciente(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {loadingHistorialModal ? (
                  <p className="text-center text-xs text-slate-500 py-6">Cargando historial...</p>
                ) : listaHistorialPrevio.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-6">El paciente no tiene atenciones anteriores.</p>
                ) : (
                  listaHistorialPrevio.map((h) => (
                    <div key={h.id} className="p-3 bg-slate-50 rounded-2xl border text-xs space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400 font-bold border-b pb-1">
                        <span>🗓️ {new Date(h.fecha_registro).toLocaleDateString('es-EC')}</span>
                        <span>👨‍⚕️ Dr(a). {h.medicos?.nombre}</span>
                      </div>
                      <p><strong className="text-slate-700">Motivo:</strong> {h.motivo_consulta}</p>
                      <p><strong className="text-slate-700">Diagnóstico:</strong> {h.diagnostico}</p>
                      {h.tratamiento_prescripcion && <p><strong className="text-slate-700">Tratamiento:</strong> {h.tratamiento_prescripcion}</p>}
                    </div>
                  ))
                )}
              </div>
              <div className="pt-2 border-t flex justify-end">
                <button onClick={() => setModalHistorialPaciente(null)} className="bg-slate-100 text-xs font-bold py-2 px-4 rounded-xl">Cerrar</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}