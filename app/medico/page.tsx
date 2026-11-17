'use client';

import { useState, useEffect, useMemo } from 'react';
import { MedicoService, type Especialidad, type EstadoFechaRecurrente } from '@/services/medico.service';
import { EmailService } from '@/services/email.service';
import ReporteCorreos from './ReporteCorreos';
import CalendarioHorarios from './CalendarioHorarios';
import { esPasado, generarEnlaceVideollamada } from '@/lib/agenda';
import { useHoyEcuador } from '@/lib/useHoyEcuador';

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
    email?: string;
  };
}

interface ItemMedicamento {
  cantidad: string;
  medicamento: string;
  posologia: string;
}

// Estado del diagnóstico único (psicología) por cita abierta
interface DiagnosticoPsico {
  cargando: boolean;
  guardado: string | null; // diagnóstico ya registrado en BD (null = aún no existe)
  borrador: string;
  editando: boolean;
  visible: boolean;
  guardando: boolean;
}

// Clave del diagnóstico único cuando se usa en el formulario de migración
const CLAVE_DIAG_MIGRACION = '__migracion__';

// ¿El médico atiende con la pantalla de psicología?
// Se decide por el tipo de atención de su especialidad (catálogo de especialidades).
// Si el médico aún no tiene especialidad del catálogo, se usa el nombre como respaldo.
function esAtencionPsicologica(medico?: { especialidad?: string | null; especialidades?: { tipo_atencion?: string } | null } | null) {
  const tipo = medico?.especialidades?.tipo_atencion;
  if (tipo) return tipo === 'psicologica';
  return (medico?.especialidad || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .includes('psicolog');
}

export default function PanelMedicoPage() {
  const [tabActiva, setTabActiva] = useState<'citas' | 'agendar_asistente' | 'consultar_expediente' | 'horarios' | 'gestion_medicos' | 'correos'>('citas');

  // Autenticación y Perfil
  const [userAuth, setUserAuth] = useState<any>(null);
  const [perfilUsuario, setPerfilUsuario] = useState<any>(null);
  const [esAdmin, setEsAdmin] = useState<boolean>(false);
  const [loadingAuth, setLoadingAuth] = useState<boolean>(true);
  const [listaMedicos, setListaMedicos] = useState<any[]>([]);
  const [medicoSeleccionadoAdmin, setMedicoSeleccionadoAdmin] = useState<string>('');

  // Login y Recuperación
  const [emailLogin, setEmailLogin] = useState<string>('');
  const [passwordLogin, setPasswordLogin] = useState<string>('');
  const [mostrarPasswordLogin, setMostrarPasswordLogin] = useState<boolean>(false);
  const [errorLogin, setErrorLogin] = useState<string>('');
  const [loadingLogin, setLoadingLogin] = useState<boolean>(false);
  const [modoRecuperacion, setModoRecuperacion] = useState<boolean>(false);
  const [emailRecuperacion, setEmailRecuperacion] = useState<string>('');
  const [mensajeExitoRecuperacion, setMensajeExitoRecuperacion] = useState<string>('');
  const [loadingRecuperacion, setLoadingRecuperacion] = useState<boolean>(false);

const [nuevoUsuario, setNuevoUsuario] = useState<string>('');
const [nuevaPassword, setNuevaPassword] = useState<string>('');
  // Citas y Disponibilidad
  const [citas, setCitas] = useState<CitaDetalle[]>([]);
  const [disponibilidades, setDisponibilidades] = useState<any[]>([]);

  // Filtros Citas
  const [busqueda, setBusqueda] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('confirmada');
  const [fechaFiltro, setFechaFiltro] = useState<string>('');

  // Menú Contextual desplegable por cita ID
  const [menuAbiertoId, setMenuAbiertoId] = useState<string | null>(null);

  // Gestión de Médicos (Admin)
  const [medicoEditandoId, setMedicoEditandoId] = useState<string | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState<string>('');
  const [nuevaEspecialidadId, setNuevaEspecialidadId] = useState<string>('');

  // Mantenedor de especialidades (Admin)
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [espEditandoId, setEspEditandoId] = useState<string | null>(null);
  const [espNombre, setEspNombre] = useState<string>('');
  const [espTipo, setEspTipo] = useState<'medica' | 'psicologica'>('medica');
  const [espMostrarInactivas, setEspMostrarInactivas] = useState<boolean>(false);
  const [loadingEsp, setLoadingEsp] = useState<boolean>(false);
  const [nuevoEmail, setNuevoEmail] = useState<string>('');
  const [nuevoTelefono, setNuevoTelefono] = useState<string>('');
  const [tieneHistoriaClinicaFlag, setTieneHistoriaClinicaFlag] = useState<boolean>(true);
  const [loadingMedico, setLoadingMedico] = useState<boolean>(false);

  // Agendamiento Manual
  const [cedulaBusquedaManual, setCedulaBusquedaManual] = useState<string>('');
  const [pacienteEncontrado, setPacienteEncontrado] = useState<any | null>(null);
  const [buscandoPaciente, setBuscandoPaciente] = useState<boolean>(false);
  const [nombreNuevoPac, setNombreNuevoPac] = useState<string>('');
  const [telefonoNuevoPac, setTelefonoNuevoPac] = useState<string>('');
  const [emailNuevoPac, setEmailNuevoPac] = useState<string>('');
  const [editandoPacienteManual, setEditandoPacienteManual] = useState<boolean>(false);
  const [editNombrePac, setEditNombrePac] = useState<string>('');
  const [editTelPac, setEditTelPac] = useState<string>('');
  const [editEmailPac, setEditEmailPac] = useState<string>('');
  const [loadingEditPac, setLoadingEditPac] = useState<boolean>(false);

  // Consulta Libre / Búsqueda Intuitiva con Autocompletado
  const [criterioBusquedaLibre, setCriterioBusquedaLibre] = useState<string>('');
  const [sugerenciasPacientes, setSugerenciasPacientes] = useState<any[]>([]);
  const [pacienteConsultaLibre, setPacienteConsultaLibre] = useState<any | null>(null);
  const [historialConsultaLibre, setHistorialConsultaLibre] = useState<any[]>([]);
  const [historiaLibreSeleccionada, setHistoriaLibreSeleccionada] = useState<any | null>(null);
  const [buscandoLibre, setBuscandoLibre] = useState<boolean>(false);

  // Edición de Paciente en Consulta Libre / Migración
  const [editandoPaciente, setEditandoPaciente] = useState<boolean>(false);
  const [editNombre, setEditNombre] = useState<string>('');
  const [editCedula, setEditCedula] = useState<string>('');
  const [editTelefono, setEditTelefono] = useState<string>('');
  const [editEmail, setEditEmail] = useState<string>('');
  const [guardandoEdicion, setGuardandoEdicion] = useState<boolean>(false);

  // Formulario para Crear Paciente sin Cita (Migración)
  const [modoCrearPacienteMigracion, setModoCrearPacienteMigracion] = useState<boolean>(false);
  const [nuevaCedulaMigracion, setNuevaCedulaMigracion] = useState<string>('');
  const [nuevoNombreMigracion, setNuevoNombreMigracion] = useState<string>('');
  const [nuevoTelefonoMigracion, setNuevoTelefonoMigracion] = useState<string>('');
  const [nuevoEmailMigracion, setNuevoEmailMigracion] = useState<string>('');
  const [loadingCrearMigracion, setLoadingCrearMigracion] = useState<boolean>(false);

  // Formulario de Registro Histórico Retrospectivo
  const [modoCrearHistorico, setModoCrearHistorico] = useState<boolean>(false);
  const [fechaHistoricaRetrof, setFechaHistoricaRetrof] = useState<string>('');
  const [motivoHistoricoRetrof, setMotivoHistoricoRetrof] = useState<string>('');
  const [diagnosticoHistoricoRetrof, setDiagnosticoHistoricoRetrof] = useState<string>('');
  const [medicamentosRetrof, setMedicamentosRetrof] = useState<ItemMedicamento[]>([{ cantidad: '', medicamento: '', posologia: '' }]);
  const [guardandoHistoricoRetrof, setGuardandoHistoricoRetrof] = useState<boolean>(false);
  const [proximaSesionRetrof, setProximaSesionRetrof] = useState<string>(''); // solo psicología

  const [fechaManual, setFechaManual] = useState<string>('');
  const [horariosManuales, setHorariosManuales] = useState<string[]>([]);
  const [horaManualSeleccionada, setHoraManualSeleccionada] = useState<string>('');
  const [tipoConsultaManual, setTipoConsultaManual] = useState<string>('presencial');
  const [loadingManual, setLoadingManual] = useState<boolean>(false);

  // Citas recurrentes (solo médicos con atención psicológica)
  const [modoAgendamiento, setModoAgendamiento] = useState<'unica' | 'recurrente'>('unica');
  const [recDesde, setRecDesde] = useState<string>('');
  const [recHasta, setRecHasta] = useState<string>('');
  const [recDias, setRecDias] = useState<number[]>([]); // 0=Domingo ... 6=Sábado
  const [recHora, setRecHora] = useState<string>('');
  const [recFechas, setRecFechas] = useState<{ fecha: string; estado: EstadoFechaRecurrente; seleccionada: boolean }[]>([]);
  const [evaluandoRec, setEvaluandoRec] = useState<boolean>(false);

  // Configuración Horarios Multi-Fecha
  const [fechasSeleccionadas, setFechasSeleccionadas] = useState<string[]>([]);
  const [horaInicio, setHoraInicio] = useState<string>('08:00');
  const [horaFin, setHoraFin] = useState<string>('17:00');
  const [duracionMinutos, setDuracionMinutos] = useState<number>(30);
  const [tieneAlmuerzo, setTieneAlmuerzo] = useState<boolean>(true);
  const [horaInicioAlmuerzo, setHoraInicioAlmuerzo] = useState<string>('13:00');
  const [horaFinAlmuerzo, setHoraFinAlmuerzo] = useState<string>('14:00');
  const [guardandoHorario, setGuardandoHorario] = useState<boolean>(false);

  // Reagendamiento Modal
  const [citaEditando, setCitaEditando] = useState<CitaDetalle | null>(null);
  const [nuevaFechaReagendar, setNuevaFechaReagendar] = useState<string>('');
  const [nuevaHoraReagendar, setNuevaHoraReagendar] = useState<string>('');
  const [horariosReagendar, setHorariosReagendar] = useState<string[]>([]);
  const [loadingReagendar, setLoadingReagendar] = useState<boolean>(false);

  // Atención e Historial Inline por Cita ID
  const [citaAtendiendoId, setCitaAtendiendoId] = useState<string | null>(null);
  const [historialVisibleCitaId, setHistorialVisibleCitaId] = useState<string | null>(null);
  
  const [motivoConsultaMap, setMotivoConsultaMap] = useState<{ [key: string]: string }>({});
  const [diagnosticoMap, setDiagnosticoMap] = useState<{ [key: string]: string }>({});
  const [medicamentosMap, setMedicamentosMap] = useState<{ [key: string]: ItemMedicamento[] }>({});
  const [guardandoHistoria, setGuardandoHistoria] = useState<boolean>(false);

  // Atención psicológica: actividades próxima sesión + diagnóstico único
  const [proximaSesionMap, setProximaSesionMap] = useState<{ [key: string]: string }>({});
  const [diagPsicoMap, setDiagPsicoMap] = useState<{ [citaId: string]: DiagnosticoPsico }>({});

  const [historiasPorCita, setHistoriasPorCita] = useState<{ [citaId: string]: any[] }>({});
  const [historiaSeleccionadaDetalle, setHistoriaSeleccionadaDetalle] = useState<{ [citaId: string]: any }>({});
  const [loadingHistorialInline, setLoadingHistorialInline] = useState<boolean>(false);

  // Receta para Imprimir
  const [recetaParaImprimir, setRecetaParaImprimir] = useState<any | null>(null);

  useEffect(() => {
    const hoyDate = new Date();
    const anio = hoyDate.getFullYear();
    const mes = String(hoyDate.getMonth() + 1).padStart(2, '0');
    const dia = String(hoyDate.getDate()).padStart(2, '0');
    const hoyStr = `${anio}-${mes}-${dia}`;

    setFechaFiltro(hoyStr);
    setFechaManual(hoyStr);
    setFechaHistoricaRetrof(hoyStr);
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

      const medicosOperativos = (res.listaMedicos || []).filter((m: any) => m.rol !== 'admin');
      const targetId = res.esAdmin && medicosOperativos.length > 0 
        ? medicosOperativos[0].id 
        : res.perfilUsuario?.id;

      if (res.esAdmin && medicosOperativos.length > 0) {
        setMedicoSeleccionadoAdmin(medicosOperativos[0].id);
      }

      if (res.esAdmin) {
        MedicoService.obtenerEspecialidades()
          .then(setEspecialidades)
          .catch((err) => console.error('No se pudieron cargar las especialidades:', err));
      }

      if (targetId) {
        await cargarAgenda(targetId);
      }
    } catch (err) {
      console.error('Error al inicializar:', err);
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
      setErrorLogin(err.message || 'Credenciales incorrectas.');
    }
    setLoadingLogin(false);
  }

  async function manejarRecuperacionPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoadingRecuperacion(true);
    setErrorLogin('');
    setMensajeExitoRecuperacion('');

    try {
      await MedicoService.enviarCorreoRecuperacion(emailRecuperacion);
      setMensajeExitoRecuperacion('¡Correo enviado! Revisa tu bandeja de entrada para restablecer tu contraseña.');
    } catch (err: any) {
      setErrorLogin(err.message || 'No se pudo enviar el correo de recuperación.');
    } finally {
      setLoadingRecuperacion(false);
    }
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
      setMenuAbiertoId(null);
      const targetId = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
      if (targetId) cargarAgenda(targetId);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  async function buscarPaciente() {
    if (!cedulaBusquedaManual) return;
    setBuscandoPaciente(true);
    setEditandoPacienteManual(false);
    try {
      const pac = await MedicoService.buscarPacientePorCedula(cedulaBusquedaManual);
      if (pac) {
        setPacienteEncontrado(pac);
        setEditNombrePac(pac.nombre || '');
        setEditTelPac(pac.telefono || '');
        setEditEmailPac(pac.email || '');
      } else {
        setPacienteEncontrado({ id: null, cedula: cedulaBusquedaManual });
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setBuscandoPaciente(false);
  }

  async function actualizarDatosPacienteExistente() {
    if (!pacienteEncontrado?.id) return;
    setLoadingEditPac(true);
    try {
      const actualizado = await MedicoService.actualizarPaciente(pacienteEncontrado.id, {
        nombre: editNombrePac,
        cedula: cedulaBusquedaManual,
        telefono: editTelPac,
        email: editEmailPac
      });
      setPacienteEncontrado(actualizado);
      setEditandoPacienteManual(false);
      alert('¡Datos de contacto del paciente actualizados correctamente!');
    } catch (err: any) {
      alert('Error al actualizar paciente: ' + err.message);
    }
    setLoadingEditPac(false);
  }

  function abrirEdicionPaciente() {
    if (!pacienteConsultaLibre) return;
    setEditNombre(pacienteConsultaLibre.nombre || '');
    setEditCedula(pacienteConsultaLibre.cedula || '');
    setEditTelefono(pacienteConsultaLibre.telefono || '');
    setEditEmail(pacienteConsultaLibre.email || '');
    setEditandoPaciente(true);
  }

  async function guardarEdicionPaciente(e: React.FormEvent) {
    e.preventDefault();
    if (!pacienteConsultaLibre?.id) return;
    if (!editNombre.trim()) {
      alert('El nombre del paciente es obligatorio.');
      return;
    }

    setGuardandoEdicion(true);
    try {
      const cedulaLimpia = editCedula.trim() !== '' ? editCedula.trim() : null;

      const actualizado = await MedicoService.actualizarPaciente(pacienteConsultaLibre.id, {
      nombre: editNombre.trim(),
      cedula: cedulaLimpia as string,
      telefono: editTelefono.trim() || '', // <--- Cambiado de undefined a '' (cadena vacía)
      email: editEmail.trim() || '',       // <--- Cambiado de undefined a '' (cadena vacía)
    });

      // Actualizamos el paciente seleccionado en pantalla con los nuevos datos
      setPacienteConsultaLibre(actualizado);
      setCriterioBusquedaLibre(actualizado.nombre);
      setEditandoPaciente(false);
      alert('¡Datos del paciente actualizados correctamente!');
    } catch (err: any) {
      alert('Error al actualizar paciente: ' + err.message);
    }
    setGuardandoEdicion(false);
  }

  // BUSCADOR INTUITIVO EN TIEMPO REAL (AUTOCOMPLETADO)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!criterioBusquedaLibre || criterioBusquedaLibre.trim().length < 2) {
        setSugerenciasPacientes([]);
        return;
      }
      setBuscandoLibre(true);
      try {
        const resultados = await MedicoService.buscarPacientesPorCriterio(criterioBusquedaLibre.trim());
        setSugerenciasPacientes(resultados || []);
      } catch (err) {
        console.error('Error buscando pacientes:', err);
      }
      setBuscandoLibre(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [criterioBusquedaLibre]);

  async function seleccionarPacienteLibre(pac: any) {
    setPacienteConsultaLibre(pac);
    setCriterioBusquedaLibre(pac.nombre);
    setSugerenciasPacientes([]);
    setModoCrearHistorico(false);
    setModoCrearPacienteMigracion(false);
    setEditandoPaciente(false);

    try {
      const historial = await MedicoService.obtenerHistorialPaciente(pac.id, medicoAgendaId);
      setHistorialConsultaLibre(historial);
      if (historial.length > 0) {
        setHistoriaLibreSeleccionada(historial[0]);
      } else {
        setHistoriaLibreSeleccionada(null);
      }
    } catch (err: any) {
      alert('Error al cargar historial: ' + err.message);
    }
  }

  async function registrarPacienteSinCita(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoNombreMigracion.trim()) {
      alert('Por favor ingrese al menos el nombre del paciente.');
      return;
    }

    setLoadingCrearMigracion(true);
    try {
      const cedulaAEnviar = nuevaCedulaMigracion.trim() !== '' ? nuevaCedulaMigracion.trim() : null;

      const nuevoPac = await MedicoService.crearPaciente({
        cedula: cedulaAEnviar as string,
        nombre: nuevoNombreMigracion.trim(),
        telefono: nuevoTelefonoMigracion.trim() || '',
        email: nuevoEmailMigracion.trim() || ''
      });

      alert('¡Paciente registrado con éxito! Ya puede ingresarle su historial retrospectivo.');
      
      seleccionarPacienteLibre(nuevoPac);
      setModoCrearPacienteMigracion(false);
      
      setNuevaCedulaMigracion('');
      setNuevoNombreMigracion('');
      setNuevoTelefonoMigracion('');
      setNuevoEmailMigracion('');
    } catch (err: any) {
      alert('Error al registrar paciente: ' + err.message);
    }
    setLoadingCrearMigracion(false);
  }

  function agregarFilaMedicamentoRetrof() {
    setMedicamentosRetrof([...medicamentosRetrof, { cantidad: '', medicamento: '', posologia: '' }]);
  }

  function actualizarMedicamentoRetrof(index: number, campo: keyof ItemMedicamento, valor: string) {
    const listaActual = [...medicamentosRetrof];
    listaActual[index][campo] = valor;
    setMedicamentosRetrof(listaActual);
  }

  function eliminarFilaMedicamentoRetrof(index: number) {
    setMedicamentosRetrof(medicamentosRetrof.filter((_, i) => i !== index));
  }

  async function guardarHistoricoPsicoRetrospectivo() {
    if (!fechaHistoricaRetrof || !motivoHistoricoRetrof.trim()) {
      alert('Por favor complete la fecha y las actividades realizadas.');
      return;
    }
    const resuelto = resolverDiagnosticoPsico(CLAVE_DIAG_MIGRACION);
    if (!resuelto) return;

    setGuardandoHistoricoRetrof(true);
    try {
      if (resuelto.pendiente) {
        await MedicoService.guardarDiagnosticoPaciente(pacienteConsultaLibre.id, medicoAgendaId, resuelto.diag);
        actualizarDiagPsico(CLAVE_DIAG_MIGRACION, { guardado: resuelto.diag, borrador: resuelto.diag, editando: false });
      }

      await MedicoService.guardarAtencionClinica({
        citaId: null,
        pacienteId: pacienteConsultaLibre.id,
        medicoId: medicoAgendaId,
        motivoConsulta: `[MIGRACIÓN HISTÓRICA] ${motivoHistoricoRetrof.trim()}`, // Actividades realizadas
        diagnostico: resuelto.diag,                                               // Diagnóstico vigente
        tratamiento: proximaSesionRetrof.trim(),                                  // Actividades próxima sesión
        fechaRegistro: fechaHistoricaRetrof
      });

      alert('¡Sesión histórica registrada con éxito en el expediente del paciente!');

      const historialActualizado = await MedicoService.obtenerHistorialPaciente(pacienteConsultaLibre.id, medicoAgendaId);
      setHistorialConsultaLibre(historialActualizado);
      if (historialActualizado.length > 0) {
        setHistoriaLibreSeleccionada(historialActualizado[0]);
      }

      setModoCrearHistorico(false);
      setMotivoHistoricoRetrof('');
      setProximaSesionRetrof('');
    } catch (err: any) {
      alert('Error al guardar el registro histórico: ' + err.message);
    }
    setGuardandoHistoricoRetrof(false);
  }

  async function guardarHistoricoRetrospectivo(e: React.FormEvent) {
    e.preventDefault();
    if (!pacienteConsultaLibre?.id) return;
    if (agendaEsPsicologia) return guardarHistoricoPsicoRetrospectivo();
    if (!fechaHistoricaRetrof || !motivoHistoricoRetrof || !diagnosticoHistoricoRetrof) {
      alert('Por favor complete la fecha, el motivo de consulta y el diagnóstico.');
      return;
    }

    const tratamientoTexto = medicamentosRetrof
      .filter((m) => m.medicamento.trim() !== '')
      .map((m) => `• [Cant: ${m.cantidad}] ${m.medicamento} — Posología: ${m.posologia}`)
      .join('\n');

    setGuardandoHistoricoRetrof(true);
    try {
      const targetMedicoId = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
      
      await MedicoService.guardarAtencionClinica({
        citaId: null,
        pacienteId: pacienteConsultaLibre.id,
        medicoId: targetMedicoId,
        motivoConsulta: `[MIGRACIÓN HISTÓRICA] ${motivoHistoricoRetrof}`,
        diagnostico: diagnosticoHistoricoRetrof,
        tratamiento: tratamientoTexto || 'Ninguno especificado',
        fechaRegistro: fechaHistoricaRetrof
      });

      alert('¡Atención histórica registrada con éxito en el expediente del paciente!');
      
      const historialActualizado = await MedicoService.obtenerHistorialPaciente(pacienteConsultaLibre.id, medicoAgendaId);
      setHistorialConsultaLibre(historialActualizado);
      if (historialActualizado.length > 0) {
        setHistoriaLibreSeleccionada(historialActualizado[0]);
      }

      setModoCrearHistorico(false);
      setMotivoHistoricoRetrof('');
      setDiagnosticoHistoricoRetrof('');
      setMedicamentosRetrof([{ cantidad: '', medicamento: '', posologia: '' }]);
    } catch (err: any) {
      alert('Error al guardar el registro histórico: ' + err.message);
    }
    setGuardandoHistoricoRetrof(false);
  }

  function seleccionarParaEditarMedico(med: any) {
    setMedicoEditandoId(med.id);
    setNuevoNombre(med.nombre || '');
    setNuevaEspecialidadId(med.especialidad_id || '');
    setNuevoEmail(med.email || '');
    setNuevoTelefono(med.telefono || '');
    setTieneHistoriaClinicaFlag(med.tiene_historia_clinica ?? true);
    setNuevoUsuario(med.usuario || '');
    setNuevaPassword('');
  }

  function limpiarFormularioMedico() {
    setMedicoEditandoId(null);
    setNuevoNombre('');
    setNuevaEspecialidadId('');
    setNuevoEmail('');
    setNuevoTelefono('');
    setTieneHistoriaClinicaFlag(true);
    setNuevoUsuario('');
    setNuevaPassword('');
  }

  // ---------- Mantenedor de especialidades ----------
  function limpiarFormularioEspecialidad() {
    setEspEditandoId(null);
    setEspNombre('');
    setEspTipo('medica');
  }

  function seleccionarEspecialidadParaEditar(esp: Especialidad) {
    setEspEditandoId(esp.id);
    setEspNombre(esp.nombre);
    setEspTipo(esp.tipo_atencion);
  }

  // Recarga catálogo y médicos (el nombre de la especialidad se copia en cada médico)
  async function recargarEspecialidadesYMedicos() {
    const [lista, sesion] = await Promise.all([
      MedicoService.obtenerEspecialidades(),
      MedicoService.obtenerSesionYPerfil(),
    ]);
    setEspecialidades(lista);
    setListaMedicos(sesion.listaMedicos);
    if (sesion.perfilUsuario) setPerfilUsuario(sesion.perfilUsuario);
  }

  async function guardarEspecialidad() {
    const nombre = espNombre.trim();
    if (nombre.length < 3) {
      alert('Escribe un nombre de al menos 3 caracteres.');
      return;
    }
    setLoadingEsp(true);
    try {
      await MedicoService.guardarEspecialidad(
        espEditandoId ? { id: espEditandoId, nombre, tipo_atencion: espTipo } : { nombre, tipo_atencion: espTipo }
      );
      limpiarFormularioEspecialidad();
      await recargarEspecialidadesYMedicos();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setLoadingEsp(false);
  }

  async function cambiarEstadoEspecialidad(esp: Especialidad, activo: boolean) {
    if (!activo) {
      const enUso = listaMedicos.filter((m: any) => m.especialidad_id === esp.id).length;
      const aviso = enUso > 0
        ? `\n\n${enUso} médico(s) la tienen asignada: la conservarán, pero ya no se podrá asignar a nuevos médicos.`
        : '';
      if (!confirm(`¿Desactivar la especialidad "${esp.nombre}"?${aviso}`)) return;
    }
    setLoadingEsp(true);
    try {
      await MedicoService.guardarEspecialidad({ id: esp.id, activo });
      if (!activo && espEditandoId === esp.id) limpiarFormularioEspecialidad();
      await recargarEspecialidadesYMedicos();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setLoadingEsp(false);
  }

  async function guardarMedicoAdmin() {
  if (!nuevoNombre.trim()) {
    alert('Completa el nombre.');
    return;
  }
  if (!nuevaEspecialidadId) {
    alert('Selecciona la especialidad del médico.');
    return;
  }
  const usuario = nuevoUsuario.trim().toLowerCase();

  if (!medicoEditandoId && (!usuario || !nuevaPassword)) {
    alert('Para registrar un médico nuevo escribe su usuario y contraseña.');
    return;
  }
  if (nuevaPassword && !usuario) {
    alert('Escribe el usuario.');
    return;
  }

  setLoadingMedico(true);
  try {
    await MedicoService.guardarMedicoAdmin({
      medicoId: medicoEditandoId || undefined,
      nombre: nuevoNombre,
      especialidadId: nuevaEspecialidadId,
      email: nuevoEmail,
      telefono: nuevoTelefono,
      tiene_historia_clinica: tieneHistoriaClinicaFlag,
      usuario,
      password: nuevaPassword
    });
    alert(medicoEditandoId ? '¡Médico actualizado!' : `¡Médico registrado! Usuario: ${usuario}`);
    limpiarFormularioMedico();
    await inicializar();
  } catch (err: any) {
    alert('Error: ' + err.message);
  }
  setLoadingMedico(false);
}

  async function toggleHistorialInline(citaId: string, pacienteId: string) {
    if (historialVisibleCitaId === citaId) {
      setHistorialVisibleCitaId(null);
      return;
    }
    setHistorialVisibleCitaId(citaId);
    if (historiasPorCita[citaId]) return;

    setLoadingHistorialInline(true);
    try {
      const historial = await MedicoService.obtenerHistorialPaciente(pacienteId, medicoAgendaId);
      setHistoriasPorCita(prev => ({ ...prev, [citaId]: historial }));
      if (historial.length > 0) {
        setHistoriaSeleccionadaDetalle(prev => ({ ...prev, [citaId]: historial[0] }));
      }
    } catch (err: any) {
      alert('Error al cargar historial: ' + err.message);
    }
    setLoadingHistorialInline(false);
  }

  function agregarFilaMedicamento(citaId: string) {
    const listaActual = medicamentosMap[citaId] || [{ cantidad: '', medicamento: '', posologia: '' }];
    setMedicamentosMap({
      ...medicamentosMap,
      [citaId]: [...listaActual, { cantidad: '', medicamento: '', posologia: '' }]
    });
  }

  function actualizarMedicamento(citaId: string, index: number, campo: keyof ItemMedicamento, valor: string) {
    const listaActual = [...(medicamentosMap[citaId] || [{ cantidad: '', medicamento: '', posologia: '' }])];
    listaActual[index][campo] = valor;
    setMedicamentosMap({
      ...medicamentosMap,
      [citaId]: listaActual
    });
  }

  function eliminarFilaMedicamento(citaId: string, index: number) {
    const listaActual = medicamentosMap[citaId] || [];
    setMedicamentosMap({
      ...medicamentosMap,
      [citaId]: listaActual.filter((_, i) => i !== index)
    });
  }

  // Médico cuya agenda se está gestionando (el seleccionado por el admin, o el propio médico).
  // Lo usan el formulario de migración y el agendamiento manual.
  const medicoAgendaId: string = (esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id) || '';
  const agendaEsPsicologia = medicoEsPsicologia(medicoAgendaId);

  // Fecha de hoy (Ecuador): no se permite agendar ni reagendar en fechas pasadas
  const hoyAgenda = useHoyEcuador();

  // Enlace público de agenda de un médico: el paciente lo abre y el médico ya viene seleccionado
  async function copiarEnlaceAgenda(medicoId: string, nombre: string) {
    const enlace = `${window.location.origin}/agendar?medicoId=${medicoId}`;
    try {
      await navigator.clipboard.writeText(enlace);
      alert(`Enlace de agenda de ${nombre} copiado:
${enlace}

Compártelo con tus pacientes por WhatsApp, correo o redes sociales.`);
    } catch {
      prompt('Copia este enlace de agenda:', enlace);
    }
  }

  useEffect(() => {
  setHistorialConsultaLibre([]);
  setPacienteConsultaLibre(null);
  setHistoriaLibreSeleccionada(null);
  setHistoriasPorCita({});
  setHistorialVisibleCitaId(null);
}, [medicoAgendaId]);

  // Al abrir el formulario de migración de un psicólogo, cargar el diagnóstico único del paciente
  useEffect(() => {
    if (modoCrearHistorico && agendaEsPsicologia && pacienteConsultaLibre?.id && medicoAgendaId) {
      cargarDiagPsico(CLAVE_DIAG_MIGRACION, pacienteConsultaLibre.id, medicoAgendaId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoCrearHistorico, agendaEsPsicologia, pacienteConsultaLibre?.id, medicoAgendaId]);

  // ---------- Atención psicológica ----------
  // El diagnóstico único se maneja con una "clave": el id de la cita (Citas Activas)
  // o CLAVE_DIAG_MIGRACION (formulario de migración en Buscar Expediente).
  function medicoEsPsicologia(medicoId?: string | null) {
    if (!medicoId) return false;
    const medico =
      medicoId === perfilUsuario?.id
        ? perfilUsuario
        : listaMedicos.find((m: any) => m.id === medicoId);
    return esAtencionPsicologica(medico);
  }

  function citaEsPsicologia(cita: CitaDetalle) {
    return medicoEsPsicologia(cita.medico_id);
  }

  function actualizarDiagPsico(clave: string, cambios: Partial<DiagnosticoPsico>) {
    setDiagPsicoMap((prev) => ({ ...prev, [clave]: { ...prev[clave], ...cambios } }));
  }

  async function cargarDiagPsico(clave: string, pacienteId: string, medicoId: string) {
    setDiagPsicoMap((prev) => ({
      ...prev,
      [clave]: { cargando: true, guardado: null, borrador: '', editando: false, visible: false, guardando: false },
    }));
    try {
      const diag = await MedicoService.obtenerDiagnosticoPaciente(pacienteId, medicoId);
      actualizarDiagPsico(clave, {
        cargando: false,
        guardado: diag?.diagnostico ?? null,
        borrador: diag?.diagnostico ?? '',
      });
    } catch (err: any) {
      actualizarDiagPsico(clave, { cargando: false });
      alert('No se pudo cargar el diagnóstico: ' + err.message);
    }
  }

  async function guardarDiagnosticoEditado(clave: string, pacienteId: string, medicoId: string) {
    const texto = (diagPsicoMap[clave]?.borrador || '').trim();
    if (!texto) {
      alert('El diagnóstico no puede quedar vacío.');
      return;
    }
    actualizarDiagPsico(clave, { guardando: true });
    try {
      const diag = await MedicoService.guardarDiagnosticoPaciente(pacienteId, medicoId, texto);
      actualizarDiagPsico(clave, { guardando: false, editando: false, visible: true, guardado: diag.diagnostico, borrador: diag.diagnostico });
    } catch (err: any) {
      actualizarDiagPsico(clave, { guardando: false });
      alert('No se pudo guardar el diagnóstico: ' + err.message);
    }
  }

  // Devuelve el diagnóstico a usar y si hay que guardarlo (primera vez o edición pendiente).
  // Devuelve null (y avisa) si falta información.
  function resolverDiagnosticoPsico(clave: string): { diag: string; pendiente: boolean } | null {
    const estado = diagPsicoMap[clave];
    if (!estado || estado.cargando) {
      alert('Espera a que cargue el diagnóstico.');
      return null;
    }
    const pendiente = estado.guardado === null || estado.editando;
    const diag = (pendiente ? estado.borrador : estado.guardado || '').trim();
    if (!diag) {
      alert('Por favor registra el diagnóstico del paciente.');
      return null;
    }
    return { diag, pendiente };
  }

  async function abrirAtencion(cita: CitaDetalle) {
    if (citaAtendiendoId === cita.id) {
      setCitaAtendiendoId(null);
      return;
    }
    setCitaAtendiendoId(cita.id);
    if (citaEsPsicologia(cita)) {
      await cargarDiagPsico(cita.id, cita.pacientes.id, cita.medico_id);
    }
  }

  async function guardarYFinalizarSesionPsico(cita: CitaDetalle) {
    const actividades = (motivoConsultaMap[cita.id] || '').trim();
    const proxima = (proximaSesionMap[cita.id] || '').trim();

    if (!actividades) {
      alert('Por favor ingresa las actividades realizadas.');
      return;
    }
    const resuelto = resolverDiagnosticoPsico(cita.id);
    if (!resuelto) return;

    setGuardandoHistoria(true);
    try {
      if (resuelto.pendiente) {
        await MedicoService.guardarDiagnosticoPaciente(cita.pacientes.id, cita.medico_id, resuelto.diag);
      }

      await MedicoService.guardarAtencionClinica({
        citaId: cita.id,
        pacienteId: cita.pacientes.id,
        medicoId: cita.medico_id,
        motivoConsulta: actividades,  // Actividades realizadas
        diagnostico: resuelto.diag,   // Copia del diagnóstico vigente
        tratamiento: proxima          // Actividades próxima sesión
      });

      alert('¡Sesión registrada con éxito!');
      setCitaAtendiendoId(null);

      const targetId = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
      if (targetId) cargarAgenda(targetId);
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    }
    setGuardandoHistoria(false);
  }

  // Selector de fecha/hora del agendamiento manual.
  // Médicos con atención psicológica pueden elegir entre cita única y citas recurrentes.
  function renderSelectorAgendamiento(esPacienteNuevo: boolean) {
    const modo = agendaEsPsicologia ? modoAgendamiento : 'unica';
    const colorBoton = esPacienteNuevo ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700';
    const seleccionadas = recFechas.filter((f) => f.seleccionada).length;
    const etiquetaEstado: Record<EstadoFechaRecurrente, { texto: string; clase: string }> = {
      disponible: { texto: 'Disponible', clase: 'bg-emerald-100 text-emerald-700' },
      fuera_horario: { texto: 'Fuera de horario', clase: 'bg-amber-100 text-amber-700' },
      ocupada: { texto: 'Ocupada', clase: 'bg-rose-100 text-rose-700' },
      pasada: { texto: 'Ya pasó', clase: 'bg-slate-200 text-slate-600' },
    };

    return (
      <div className="space-y-3 pt-2">
        {agendaEsPsicologia && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
            {(['unica', 'recurrente'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModoAgendamiento(m)}
                className={`py-2 text-xs font-bold rounded-lg transition ${modo === m ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {m === 'unica' ? '📅 Cita única' : '🔁 Citas recurrentes'}
              </button>
            ))}
          </div>
        )}

        {modo === 'unica' ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Fecha de Cita</label>
                <input type="date" value={fechaManual} min={hoyAgenda} onChange={(e) => setFechaManual(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs font-semibold" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Modalidad</label>
                <select value={tipoConsultaManual} onChange={(e) => setTipoConsultaManual(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs font-semibold">
                  <option value="presencial">Presencial</option>
                  <option value="telemedicina">Telemedicina</option>
                </select>
              </div>
            </div>

            {fechaManual && (
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-600 uppercase">Horarios Disponibles</label>
                {horariosManuales.length === 0 ? (
                  <p className="text-xs text-rose-500 font-bold py-2">No hay turnos configurados para esta fecha.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto">
                    {horariosManuales.map((h) => (
                      <button key={h} type="button" onClick={() => setHoraManualSeleccionada(h)} className={`p-2 text-xs font-bold rounded-xl border transition ${horaManualSeleccionada === h ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'}`}>{h}</button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button onClick={guardarCitaManual} disabled={loadingManual || !horaManualSeleccionada} className={`w-full ${colorBoton} disabled:opacity-50 text-white text-xs font-bold py-3.5 rounded-xl shadow-sm transition`}>
              {loadingManual
                ? (esPacienteNuevo ? 'Registrando y Agendando...' : 'Agendando y Notificando...')
                : (esPacienteNuevo ? '💾 Registrar Paciente, Agendar y Notificar' : '💾 Confirmar Cita y Enviar Correo')}
            </button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Desde</label>
                <input type="date" value={recDesde} min={hoyAgenda} onChange={(e) => cambiarParametroRecurrencia(() => setRecDesde(e.target.value))} className="w-full p-2.5 border rounded-xl text-xs font-semibold" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Hasta</label>
                <input type="date" value={recHasta} min={recDesde || hoyAgenda} onChange={(e) => cambiarParametroRecurrencia(() => setRecHasta(e.target.value))} className="w-full p-2.5 border rounded-xl text-xs font-semibold" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[11px] font-bold text-slate-600 uppercase">Días de la semana</label>
                <div className="flex gap-2 text-[10px] font-bold">
                  <button type="button" onClick={() => cambiarParametroRecurrencia(() => setRecDias([0, 1, 2, 3, 4, 5, 6]))} className="text-violet-700 hover:underline">Todos</button>
                  <button type="button" onClick={() => cambiarParametroRecurrencia(() => setRecDias([1, 2, 3, 4, 5]))} className="text-violet-700 hover:underline">Lun–Vie</button>
                  <button type="button" onClick={() => cambiarParametroRecurrencia(() => setRecDias([]))} className="text-slate-500 hover:underline">Ninguno</button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const activo = recDias.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => cambiarParametroRecurrencia(() => setRecDias(activo ? recDias.filter((x) => x !== d) : [...recDias, d]))}
                      className={`py-2 text-[11px] font-bold rounded-lg border transition ${activo ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {NOMBRES_DIAS[d]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Hora</label>
                <input type="time" value={recHora} step={300} onChange={(e) => cambiarParametroRecurrencia(() => setRecHora(e.target.value))} className="w-full p-2.5 border rounded-xl text-xs font-semibold" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Modalidad</label>
                <select value={tipoConsultaManual} onChange={(e) => setTipoConsultaManual(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs font-semibold">
                  <option value="presencial">Presencial</option>
                  <option value="telemedicina">Telemedicina</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={previsualizarRecurrencia}
              disabled={evaluandoRec}
              className="w-full bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-xs font-bold py-2.5 rounded-xl transition"
            >
              {evaluandoRec ? 'Revisando disponibilidad...' : '🔍 Revisar fechas'}
            </button>

            {recFechas.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-slate-600 uppercase">{seleccionadas} de {recFechas.length} fechas seleccionadas</span>
                  <span className="flex gap-3 text-[11px] font-bold">
                    <button type="button" className="text-violet-700 hover:underline"
                      onClick={() => setRecFechas((prev) => prev.map((x) => ({ ...x, seleccionada: x.estado !== 'ocupada' && x.estado !== 'pasada' })))}>
                      Marcar todas
                    </button>
                    <button type="button" className="text-slate-500 hover:underline"
                      onClick={() => setRecFechas((prev) => prev.map((x) => ({ ...x, seleccionada: false })))}>
                      Quitar todas
                    </button>
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto border rounded-xl divide-y divide-slate-100 bg-white">
                  {recFechas.map((rf, i) => {
                    const [a, m, d] = rf.fecha.split('-').map(Number);
                    const bloqueada = rf.estado === 'ocupada' || rf.estado === 'pasada';
                    return (
                      <label key={rf.fecha} className={`flex items-center justify-between gap-2 px-3 py-2 text-xs ${bloqueada ? 'opacity-60' : 'cursor-pointer hover:bg-slate-50'}`}>
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={rf.seleccionada}
                            disabled={bloqueada}
                            onChange={(e) => setRecFechas((prev) => prev.map((x, j) => (j === i ? { ...x, seleccionada: e.target.checked } : x)))}
                            className="w-3.5 h-3.5 rounded"
                          />
                          <span className="font-semibold text-slate-800 capitalize">
                            {new Date(a, m - 1, d).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {recHora}
                          </span>
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${etiquetaEstado[rf.estado].clase}`}>
                          {etiquetaEstado[rf.estado].texto}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {recFechas.some((x) => x.estado === 'fuera_horario') && (
                  <p className="text-[11px] text-amber-700">
                    &quot;Fuera de horario&quot;: esa fecha no tiene un turno configurado a esa hora en Configurar Horarios. Se agendará igualmente.
                  </p>
                )}

                <button
                  onClick={guardarCitasRecurrentes}
                  disabled={loadingManual || seleccionadas === 0}
                  className={`w-full ${colorBoton} disabled:opacity-50 text-white text-xs font-bold py-3.5 rounded-xl shadow-sm transition`}
                >
                  {loadingManual
                    ? 'Agendando citas...'
                    : `💾 ${esPacienteNuevo ? 'Registrar Paciente y ' : ''}Agendar ${seleccionadas} cita(s)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Bloque visual del diagnóstico único (se usa en Citas Activas y en Migración)
  function renderDiagnosticoPsico(clave: string, pacienteId: string, medicoId: string) {
    const dp = diagPsicoMap[clave];
    return (
      <div className="p-4 bg-white rounded-xl border border-violet-100 space-y-2">
        {!dp || dp.cargando ? (
          <p className="text-xs text-slate-500 animate-pulse">Cargando diagnóstico...</p>
        ) : dp.guardado === null ? (
          <>
            <label className="block text-[11px] font-bold text-slate-700">
              Diagnóstico <span className="font-medium text-slate-500">(se registra una sola vez; luego podrás verlo y editarlo)</span>
            </label>
            <textarea
              value={dp.borrador}
              onChange={(e) => actualizarDiagPsico(clave, { borrador: e.target.value })}
              placeholder="Ej: Trastorno de ansiedad generalizada..."
              className="w-full p-3 border rounded-xl text-xs font-medium h-20 bg-white"
            />
          </>
        ) : dp.editando ? (
          <>
            <label className="block text-[11px] font-bold text-slate-700">Editar diagnóstico</label>
            <textarea
              value={dp.borrador}
              onChange={(e) => actualizarDiagPsico(clave, { borrador: e.target.value })}
              className="w-full p-3 border rounded-xl text-xs font-medium h-20 bg-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => actualizarDiagPsico(clave, { editando: false, borrador: dp.guardado || '' })}
                className="bg-slate-200 text-[11px] font-bold py-1.5 px-3 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => guardarDiagnosticoEditado(clave, pacienteId, medicoId)}
                disabled={dp.guardando}
                className="bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg"
              >
                {dp.guardando ? 'Guardando...' : 'Guardar diagnóstico'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-700">✅ Diagnóstico registrado</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => actualizarDiagPsico(clave, { visible: !dp.visible })}
                  className="text-[11px] font-bold text-violet-700 bg-violet-50 px-3 py-1 rounded-lg hover:bg-violet-100"
                >
                  {dp.visible ? '🙈 Ocultar' : '👁️ Ver'}
                </button>
                <button
                  type="button"
                  onClick={() => actualizarDiagPsico(clave, { editando: true, visible: true, borrador: dp.guardado || '' })}
                  className="text-[11px] font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg hover:bg-slate-200"
                >
                  ✏️ Editar
                </button>
              </div>
            </div>
            {dp.visible && (
              <div className="whitespace-pre-wrap text-xs font-medium text-slate-800 bg-violet-50/50 p-3 rounded-lg border border-violet-100">
                {dp.guardado}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  async function guardarYFinalizarAtencion(cita: CitaDetalle) {
    if (citaEsPsicologia(cita)) return guardarYFinalizarSesionPsico(cita);

    const motivo = motivoConsultaMap[cita.id] || '';
    const diag = diagnosticoMap[cita.id] || '';
    const meds = medicamentosMap[cita.id] || [{ cantidad: '', medicamento: '', posologia: '' }];

    if (!motivo || !diag) {
      alert('Por favor ingresa el motivo de consulta y el diagnóstico.');
      return;
    }

    const tratamientoTexto = meds
      .filter((m) => m.medicamento.trim() !== '')
      .map((m) => `• [Cant: ${m.cantidad}] ${m.medicamento} — Posología: ${m.posologia}`)
      .join('\n');

    setGuardandoHistoria(true);
    try {
      await MedicoService.guardarAtencionClinica({
        citaId: cita.id,
        pacienteId: cita.pacientes.id,
        medicoId: cita.medico_id,
        motivoConsulta: motivo,
        diagnostico: diag,
        tratamiento: tratamientoTexto
      });

      alert('¡Consulta finalizada y guardada con éxito!');
      
      const recetaObj = {
        paciente: cita.pacientes,
        medico: perfilUsuario,
        fecha: new Date().toLocaleDateString('es-EC'),
        diagnostico: diag,
        medicamentos: meds.filter((m) => m.medicamento.trim() !== '')
      };

      setRecetaParaImprimir(recetaObj);
      setCitaAtendiendoId(null);

      const targetId = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
      if (targetId) cargarAgenda(targetId);
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    }
    setGuardandoHistoria(false);
  }

  function iniciarReagendamiento(cita: CitaDetalle) {
    setMenuAbiertoId(null);
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
    if (esPasado(nuevaFechaReagendar, nuevaHoraReagendar)) {
      alert('No se puede reagendar a una fecha u hora que ya pasó.');
      return;
    }
    setLoadingReagendar(true);
    try {
      await MedicoService.reagendarCita(
        citaEditando.id, 
        citaEditando.medico_id, 
        citaEditando.tipo_consulta, 
        nuevaFechaReagendar, 
        nuevaHoraReagendar
      );
      alert('¡Cita reagendada!');
      setCitaEditando(null);
      const targetId = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
      if (targetId) cargarAgenda(targetId);
    } catch (err: any) {
      alert('Error al reagendar: ' + err.message);
    }
    setLoadingReagendar(false);
  }

  async function guardarHorariosMultiplesFechas() {
    const targetId = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
    if (!targetId || fechasSeleccionadas.length === 0) {
      alert('Selecciona al menos una fecha.');
      return;
    }

    setGuardandoHorario(true);
    try {
      await MedicoService.guardarDisponibilidadMultiplesFechas({
        medico_id: targetId,
        fechas: fechasSeleccionadas,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        duracion_cita_minutos: Number(duracionMinutos),
        hora_inicio_almuerzo: tieneAlmuerzo ? horaInicioAlmuerzo : undefined,
        hora_fin_almuerzo: tieneAlmuerzo ? horaFinAlmuerzo : undefined
      });

      alert(`¡Horarios guardados para las ${fechasSeleccionadas.length} fechas!`);
      setFechasSeleccionadas([]);
      cargarAgenda(targetId);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setGuardandoHorario(false);
  }

  useEffect(() => {
    const targetId = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
    if (fechaManual && targetId) {
      MedicoService.generarHorariosDisponibles(targetId, fechaManual)
        .then((slots) => {
          const hoyDate = new Date();
          const anio = hoyDate.getFullYear();
          const mes = String(hoyDate.getMonth() + 1).padStart(2, '0');
          const dia = String(hoyDate.getDate()).padStart(2, '0');
          const hoyStr = `${anio}-${mes}-${dia}`;

          if (fechaManual === hoyStr) {
            const horaActualMinutos = hoyDate.getHours() * 60 + hoyDate.getMinutes();
            const slotsFuturos = slots.filter((h: string) => {
              const [hh, mm] = h.split(':').map(Number);
              return (hh * 60 + mm) > horaActualMinutos;
            });
            setHorariosManuales(slotsFuturos);
          } else {
            setHorariosManuales(slots);
          }
        });
    } else {
      setHorariosManuales([]);
    }
  }, [fechaManual, medicoSeleccionadoAdmin, perfilUsuario]);

  // Devuelve el paciente seleccionado o lo registra si es nuevo. null = faltan datos (ya se avisó).
  async function obtenerOCrearPacienteManual(): Promise<{ id: string; email?: string; nombre?: string } | null> {
    if (pacienteEncontrado?.id) {
      return { id: pacienteEncontrado.id, email: pacienteEncontrado.email, nombre: pacienteEncontrado.nombre };
    }
    if (!nombreNuevoPac || !telefonoNuevoPac || !emailNuevoPac) {
      alert('Por favor completa nombre, teléfono y correo electrónico del paciente.');
      return null;
    }
    const nuevoPac = await MedicoService.crearPaciente({
      nombre: nombreNuevoPac,
      cedula: cedulaBusquedaManual,
      telefono: telefonoNuevoPac,
      email: emailNuevoPac
    });
    // Si luego falla el agendamiento, el paciente ya queda registrado y seleccionado
    setPacienteEncontrado(nuevoPac);
    return { id: nuevoPac.id, email: emailNuevoPac, nombre: nombreNuevoPac };
  }

  function limpiarAgendamientoManual() {
    setCedulaBusquedaManual('');
    setPacienteEncontrado(null);
    setNombreNuevoPac('');
    setTelefonoNuevoPac('');
    setEmailNuevoPac('');
    setFechaManual('');
    setHoraManualSeleccionada('');
    setModoAgendamiento('unica');
    setRecDesde('');
    setRecHasta('');
    setRecDias([]);
    setRecHora('');
    setRecFechas([]);
  }

  // ---------- Citas recurrentes ----------
  const NOMBRES_DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const MAX_CITAS_SERIE = 60;

  // Cualquier cambio en los parámetros invalida la vista previa
  function cambiarParametroRecurrencia(aplicar: () => void) {
    aplicar();
    setRecFechas([]);
  }

  function generarFechasRecurrentes(): string[] {
    const [a1, m1, d1] = recDesde.split('-').map(Number);
    const [a2, m2, d2] = recHasta.split('-').map(Number);
    const actual = new Date(a1, m1 - 1, d1);
    const fin = new Date(a2, m2 - 1, d2);
    const fechas: string[] = [];
    while (actual <= fin && fechas.length <= MAX_CITAS_SERIE) {
      if (recDias.includes(actual.getDay())) {
        fechas.push(`${actual.getFullYear()}-${String(actual.getMonth() + 1).padStart(2, '0')}-${String(actual.getDate()).padStart(2, '0')}`);
      }
      actual.setDate(actual.getDate() + 1);
    }
    return fechas;
  }

  async function previsualizarRecurrencia() {
    if (!medicoAgendaId) return;
    if (!recDesde || !recHasta || !recHora || recDias.length === 0) {
      alert('Completa fecha desde, fecha hasta, la hora y al menos un día de la semana.');
      return;
    }
    if (recHasta < recDesde) {
      alert('La fecha "hasta" debe ser igual o posterior a la fecha "desde".');
      return;
    }
    const fechas = generarFechasRecurrentes();
    if (fechas.length === 0) {
      alert('No hay fechas que coincidan con los días seleccionados en ese rango.');
      return;
    }
    if (fechas.length > MAX_CITAS_SERIE) {
      alert(`El rango genera más de ${MAX_CITAS_SERIE} citas. Reduce el rango o los días seleccionados.`);
      return;
    }

    setEvaluandoRec(true);
    try {
      const evaluadas = await MedicoService.evaluarFechasRecurrentes(medicoAgendaId, fechas, recHora);
      setRecFechas(evaluadas.map((e) => ({...e, seleccionada: e.estado !== 'ocupada' && e.estado !== 'pasada'})));
    } catch (err: any) {
      alert('No se pudieron revisar las fechas: ' + err.message);
    }
    setEvaluandoRec(false);
  }

  async function guardarCitasRecurrentes() {
    if (!medicoAgendaId) return;
    const fechas = recFechas.filter((f) => f.seleccionada).map((f) => f.fecha);
    if (fechas.length === 0) {
      alert('Selecciona al menos una fecha.');
      return;
    }
    /* const fueraHorario = recFechas.filter((f) => f.seleccionada && f.estado === 'fuera_horario').length;
    if (fueraHorario > 0 && !confirm(`${fueraHorario} fecha(s) están fuera del horario configurado. ¿Agendarlas de todas formas?`)) {
      return;
    }
 */
    setLoadingManual(true);
    try {
      const pac = await obtenerOCrearPacienteManual();
      if (!pac) {
        setLoadingManual(false);
        return;
      }

      const { citas } = await MedicoService.agendarCitasRecurrentes({
        medico_id: medicoAgendaId,
        paciente_id: pac.id,
        fechas,
        hora: recHora,
        tipo_consulta: tipoConsultaManual
      });

      // Las citas recurrentes no se notifican por correo
      alert(`¡Se agendaron ${citas.length} citas recurrentes!`);
      limpiarAgendamientoManual();
      cargarAgenda(medicoAgendaId);
      setTabActiva('citas');
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setLoadingManual(false);
  }

  async function guardarCitaManual() {
    const targetId = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
    if (!targetId || !fechaManual || !horaManualSeleccionada) {
      alert('Selecciona fecha y hora.');
      return;
    }
    if (esPasado(fechaManual, horaManualSeleccionada)) {
      alert('No se puede agendar en una fecha u hora que ya pasó.');
      return;
    }

    setLoadingManual(true);
    try {
      const pac = await obtenerOCrearPacienteManual();
      if (!pac) {
        setLoadingManual(false);
        return;
      }
      const pacId = pac.id;

      const fechaHoraISO = `${fechaManual}T${horaManualSeleccionada}:00`;
      const enlaceJitsi = tipoConsultaManual === 'telemedicina' ? generarEnlaceVideollamada() : null;

      await MedicoService.agendarCitaManual({
        medico_id: targetId,
        paciente_id: pacId,
        fecha_hora: fechaHoraISO,
        tipo_consulta: tipoConsultaManual,
        enlace_videollamada: enlaceJitsi || undefined
      });

      // Correo de confirmación (el servidor valida que el paciente tenga correo registrado)
      const resultadoCorreo = await EmailService.enviarConfirmacionCita({
        medicoId: targetId,
        pacienteId: pacId,
        fechaHora: fechaHoraISO
      });

      alert('¡Cita agendada con éxito!\n' + EmailService.describirResultado(resultadoCorreo));
      limpiarAgendamientoManual();
      cargarAgenda(targetId);
      setTabActiva('citas');
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setLoadingManual(false);
  }

  async function borrarHorario(id: string) {
    if (!confirm('¿Eliminar esta regla?')) return;
    try {
      await MedicoService.eliminarDisponibilidad(id);
      const targetId = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
      if (targetId) cargarAgenda(targetId);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  const citasFiltradas = useMemo(() => {
    return (Array.isArray(citas) ? citas : []).filter((c) => {
      if (c.estado === 'atendida' || c.estado === 'cancelada') return false;

      const coincideBusqueda =
        c.pacientes?.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.pacientes?.cedula?.includes(busqueda) ||
        c.pacientes?.telefono?.includes(busqueda);

      const coincideEstado = filtroEstado === 'todas' ? true : c.estado === filtroEstado;

      // EXTRACCIÓN SEGURA DE LA FECHA LOCAL (Evita desfases de zona horaria UTC)
      let fechaCitaStr = '';
      if (c.fecha_hora) {
        const d = new Date(c.fecha_hora);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        fechaCitaStr = `${year}-${month}-${day}`;
      }

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
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-semibold text-xs text-slate-500">Cargando sistema clínico...</div>;
  }

  // PANTALLA DE LOGIN Y RECUPERACIÓN
  if (!userAuth || !perfilUsuario) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100 space-y-6 transition-all">
          
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white font-black text-xl shadow-lg shadow-blue-600/30 mb-1">
              🩺
            </div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight">Portal Clínico Profesional</h1>
            <p className="text-xs text-slate-500 font-medium">
              {modoRecuperacion ? 'Recuperación de credenciales de acceso' : 'Ingrese sus credenciales institucionales para acceder'}
            </p>
          </div>

          {errorLogin && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 font-bold flex items-center gap-2">
              <span>⚠️</span> <span>{errorLogin}</span>
            </div>
          )}

          {mensajeExitoRecuperacion && (
            <div className="p-3.5 bg-green-50 border border-green-200 rounded-2xl text-xs text-green-700 font-bold flex items-center gap-2">
              <span>✅</span> <span>{mensajeExitoRecuperacion}</span>
            </div>
          )}

          {!modoRecuperacion ? (
            <form onSubmit={ejecutarLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">Usuario o Correo</label>
                <input
                  type="text"
                  value={emailLogin}
                  onChange={(e) => setEmailLogin(e.target.value)}
                  placeholder="dr.perez"
                  autoComplete="username"
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition" 
                  required 
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">Contraseña</label>
                  <button 
                    type="button" 
                    onClick={() => { setModoRecuperacion(true); setErrorLogin(''); setMensajeExitoRecuperacion(''); }}
                    className="text-[11px] font-bold text-blue-600 hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={mostrarPasswordLogin ? 'text' : 'password'}
                    value={passwordLogin}
                    onChange={(e) => setPasswordLogin(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full p-3.5 pr-12 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPasswordLogin((v) => !v)}
                    aria-label={mostrarPasswordLogin ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    title={mostrarPasswordLogin ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute inset-y-0 right-0 px-4 flex items-center text-slate-400 hover:text-blue-600 transition"
                  >
                    {mostrarPasswordLogin ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loadingLogin}
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-70 text-white font-bold py-4 rounded-2xl text-xs shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 mt-2"
              >
                {loadingLogin ? 'Validando credenciales...' : 'Acceder al Sistema'}
              </button>
            </form>
          ) : (
            <form onSubmit={manejarRecuperacionPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">Correo Electrónico Registrado</label>
                <input 
                  type="email" 
                  value={emailRecuperacion} 
                  onChange={(e) => setEmailRecuperacion(e.target.value)} 
                  placeholder="doctor@clinica.com" 
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition" 
                  required 
                />
              </div>

              <button 
                type="submit" 
                disabled={loadingRecuperacion}
                className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-70 text-white font-bold py-4 rounded-2xl text-xs shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2"
              >
                {loadingRecuperacion ? 'Enviando enlace...' : 'Enviar enlace de recuperación'}
              </button>

              <button 
                type="button" 
                onClick={() => { setModoRecuperacion(false); setErrorLogin(''); setMensajeExitoRecuperacion(''); }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl text-xs transition"
              >
                ← Volver al login
              </button>
            </form>
          )}

          <div className="text-center pt-2 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 font-medium">Sistema seguro protegido con cifrado clínico</p>
          </div>

        </div>
      </div>
    );
  }

  const rawNombre = perfilUsuario.nombre || userAuth.email || 'Doctor';
  const nombreDoctor = rawNombre.includes('@') ? rawNombre.split('@')[0] : rawNombre;
  const especialidadDoctor = perfilUsuario.especialidad || 'Medicina General';

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #seccion-receta-impresion, #seccion-receta-impresion * { visibility: visible; }
          #seccion-receta-impresion { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-xl shadow-slate-200/60 p-6 md:p-8 border border-slate-100 space-y-6">
        
        {/* ENCABEZADO */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-800">
              {esAdmin ? '👑 Panel Administrador General' : `Dr(a). ${nombreDoctor}`}
            </h1>
            <span className="inline-block mt-1 text-[11px] px-3 py-1 rounded-full font-extrabold uppercase bg-blue-50 text-blue-700 border border-blue-100 tracking-wider">
              {esAdmin ? 'ADMINISTRADOR' : especialidadDoctor}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
          {!esAdmin && perfilUsuario?.id && (
            <button
              onClick={() => copiarEnlaceAgenda(perfilUsuario.id, perfilUsuario.nombre || 'tu agenda')}
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold py-2.5 px-4 rounded-xl border border-blue-200 transition flex items-center gap-1.5"
              title="Copia el enlace para que tus pacientes agenden directamente contigo"
            >
              🔗 Copiar mi enlace de agenda
            </button>
          )}
          <button 
            onClick={() => MedicoService.cerrarSesion().then(() => window.location.reload())} 
            className="bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-bold py-2.5 px-4 rounded-xl border border-slate-200 transition flex items-center gap-1.5"
          >
            🚪 Cerrar Sesión
          </button>
          </div>
        </div>

        {/* SELECTOR ADMIN */}
        {esAdmin && (
          <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 flex justify-between items-center">
            <label className="text-xs font-bold text-purple-900 uppercase">Gestionando agenda de:</label>
            <select
              value={medicoSeleccionadoAdmin}
              onChange={(e) => setMedicoSeleccionadoAdmin(e.target.value)}
              className="p-2 border rounded-xl bg-white text-sm font-semibold w-80 shadow-sm"
            >
              {listaMedicos.filter((m) => m.rol !== 'admin').map((m) => (
                <option key={m.id} value={m.id}>{m.nombre} — {m.especialidad}</option>
              ))}
            </select>
          </div>
        )}

        {/* NAVEGACIÓN PESTAÑAS */}
        <div className="flex border-b border-slate-100 overflow-x-auto gap-2">
          <button 
            onClick={() => setTabActiva('citas')} 
            className={`py-3 px-5 font-bold text-xs border-b-2 transition flex items-center gap-2 ${
              tabActiva === 'citas' ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            📅 Citas Activas ({citasFiltradas.length})
          </button>
          <button 
            onClick={() => setTabActiva('agendar_asistente')} 
            className={`py-3 px-5 font-bold text-xs border-b-2 transition flex items-center gap-2 ${
              tabActiva === 'agendar_asistente' ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            ➕ Agendar Cita Manual
          </button>
          <button 
            onClick={() => setTabActiva('consultar_expediente')} 
            className={`py-3 px-5 font-bold text-xs border-b-2 transition flex items-center gap-2 ${
              tabActiva === 'consultar_expediente' ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            🔍 Buscar Expediente / Migración
          </button>
          <button 
            onClick={() => setTabActiva('horarios')} 
            className={`py-3 px-5 font-bold text-xs border-b-2 transition flex items-center gap-2 ${
              tabActiva === 'horarios' ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            ⚙️ Configurar Horarios y Fechas
          </button>
          {esAdmin && (
            <button 
              onClick={() => setTabActiva('gestion_medicos')} 
              className={`py-3 px-5 font-bold text-xs border-b-2 transition flex items-center gap-2 ${
                tabActiva === 'gestion_medicos' ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              👥 Gestionar Médicos
            </button>
          )}
          {esAdmin && (
            <button
              onClick={() => setTabActiva('correos')}
              className={`py-3 px-5 font-bold text-xs border-b-2 transition flex items-center gap-2 ${
                tabActiva === 'correos' ? 'border-blue-600 text-blue-600 bg-blue-50/40 rounded-t-xl' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              ✉️ Control de Correos
            </button>
          )}
        </div>

        {/* TAB: CONTROL DE CORREOS (solo admin) */}
        {esAdmin && tabActiva === 'correos' && <ReporteCorreos />}

        {/* TAB 1: CITAS ACTIVAS DEL DÍA */}
        {tabActiva === 'citas' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-3 justify-between bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
              <input
                type="text"
                placeholder="Buscar paciente por nombre o cédula..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="p-3 bg-white border border-slate-200 rounded-xl text-xs w-full md:w-80 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
              />
              <div className="flex gap-2 items-center flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">Fecha:</span>
                  <input
                    type="date"
                    value={fechaFiltro}
                    onChange={(e) => setFechaFiltro(e.target.value)}
                    className="p-2 border rounded-xl text-xs font-semibold text-slate-800"
                  />
                  {fechaFiltro && (
                    <button
                      type="button"
                      onClick={() => setFechaFiltro('')}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Ver todas
                    </button>
                  )}
                </div>
                <select 
                  value={filtroEstado} 
                  onChange={(e) => setFiltroEstado(e.target.value)} 
                  className="bg-white border border-slate-200 text-xs p-2.5 rounded-xl font-semibold text-slate-800"
                >
                  <option value="todas">Todas las activas</option>
                  <option value="confirmada">Confirmadas</option>
                </select>
              </div>
            </div>

            {Object.keys(citasAgrupadasPorDia).length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-500 font-medium">No hay citas pendientes ni activas para la fecha seleccionada.</p>
              </div>
            ) : (
              Object.entries(citasAgrupadasPorDia).map(([fechaHeader, listaCitas]) => (
                <div key={fechaHeader} className="space-y-3">
                  <h3 className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider bg-slate-100 px-3 py-1.5 rounded-lg w-fit">
                    🗓️ {fechaHeader}
                  </h3>
                  {listaCitas.map((c) => (
                    <div key={c.id} className="p-5 rounded-2xl border border-slate-200/80 bg-white flex flex-col gap-4 shadow-sm hover:shadow-md transition">
                      
                      <div className="flex justify-between items-center gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-slate-900">{c.pacientes?.nombre}</h4>
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-200">
                              {c.estado}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium flex-wrap">
                            <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">🪪 {c.pacientes?.cedula || 'Sin cédula'}</span>
                            <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">📱 {c.pacientes?.telefono || 'Sin teléfono'}</span>
                            <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">✉️ {c.pacientes?.email || 'Sin correo'}</span>
                            <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 capitalize">🏥 {c.tipo_consulta}</span>
                          </div>

                          {c.tipo_consulta === 'telemedicina' && c.enlace_videollamada && (
                            <a href={c.enlace_videollamada} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold py-1 px-3 rounded-lg transition">
                              🎥 Videoconsulta Jitsi
                            </a>
                          )}
                        </div>

                        <div className="flex items-center gap-2 relative">
                          <button
                            onClick={() => toggleHistorialInline(c.id, c.pacientes.id)}
                            className={`text-xs font-bold py-2 px-3.5 rounded-xl border transition ${
                              historialVisibleCitaId === c.id
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {historialVisibleCitaId === c.id ? '✕ Ocultar Historial' : '📋 Ver Historial'}
                          </button>

                          <button
                            onClick={() => abrirAtencion(c)}
                            className={`text-xs font-bold py-2 px-4 rounded-xl shadow-sm transition flex items-center gap-1.5 ${
                              citaAtendiendoId === c.id 
                                ? 'bg-slate-800 text-white' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                            }`}
                          >
                            {citaAtendiendoId === c.id ? '✕ Cancelar' : citaEsPsicologia(c) ? '✍️ Atender Sesión' : '✍️ Atender / Recetar'}
                          </button>

                          <div className="relative">
                            <button
                              onClick={() => setMenuAbiertoId(menuAbiertoId === c.id ? null : c.id)}
                              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold transition text-xs"
                            >
                              ⋮
                            </button>

                            {menuAbiertoId === c.id && (
                              <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-100 rounded-2xl shadow-xl z-20 py-1.5">
                                <button
                                  onClick={() => iniciarReagendamiento(c)}
                                  className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  🔄 Reagendar Cita
                                </button>
                                <button
                                  onClick={() => cambiarEstado(c.id, 'cancelada')}
                                  className="w-full text-left px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                >
                                  🚫 Cancelar Cita
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* HISTORIAL CLÍNICO INLINE */}
                      {historialVisibleCitaId === c.id && (
                        <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                          <h4 className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider">
                            📋 Historial Clínico de {c.pacientes.nombre}
                          </h4>

                          {loadingHistorialInline ? (
                            <p className="text-xs text-slate-500 py-3 text-center">Cargando historial...</p>
                          ) : (historiasPorCita[c.id] || []).length === 0 ? (
                            <p className="text-xs text-slate-500 py-2 italic">Este paciente no registra atenciones previas.</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                                {(historiasPorCita[c.id] || []).map((h) => {
                                  const sel = historiaSeleccionadaDetalle[c.id]?.id === h.id;
                                  return (
                                    <button
                                      key={h.id}
                                      onClick={() => setHistoriaSeleccionadaDetalle({ ...historiaSeleccionadaDetalle, [c.id]: h })}
                                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition ${
                                        sel ? 'bg-indigo-600 text-white border-indigo-600 font-bold' : 'bg-white text-slate-800 hover:bg-slate-100'
                                      }`}
                                    >
                                      🗓️ {new Date(h.fecha_registro).toLocaleDateString('es-EC')} — {h.diagnostico || 'Consulta'}
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="md:col-span-2 bg-white p-3.5 rounded-xl border border-indigo-100 text-xs space-y-2">
                                {historiaSeleccionadaDetalle[c.id] ? (
                                  <>
                                    <div className="flex justify-between font-bold text-slate-500 border-b pb-1 text-[11px]">
                                      <span>👨‍⚕️ Dr(a). {historiaSeleccionadaDetalle[c.id].medicos?.nombre}</span>
                                      <span>{historiaSeleccionadaDetalle[c.id].medicos?.especialidad}</span>
                                    </div>
                                    <p><strong>{esAtencionPsicologica(historiaSeleccionadaDetalle[c.id].medicos) ? 'Actividades realizadas:' : 'Motivo:'}</strong> <span className="whitespace-pre-wrap">{historiaSeleccionadaDetalle[c.id].motivo_consulta}</span></p>
                                    <p><strong>Diagnóstico:</strong> {historiaSeleccionadaDetalle[c.id].diagnostico}</p>
                                    <div>
                                      <strong>{esAtencionPsicologica(historiaSeleccionadaDetalle[c.id].medicos) ? 'Actividades próxima sesión:' : 'Tratamiento / Receta:'}</strong>
                                      <div className="whitespace-pre-wrap font-medium text-slate-800 pt-1">
                                        {historiaSeleccionadaDetalle[c.id].tratamiento_prescripcion || 'Ninguno'}
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-slate-400 italic text-center py-6">Selecciona una fecha a la izquierda.</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ATENCIÓN PSICOLÓGICA (sin receta, diagnóstico único) */}
                      {citaAtendiendoId === c.id && citaEsPsicologia(c) && (() => {
                        const dp = diagPsicoMap[c.id];
                        return (
                        <div className="p-5 bg-slate-50 rounded-2xl border border-violet-100 space-y-4">
                          <h4 className="text-xs font-extrabold text-violet-900 uppercase tracking-wider">🧠 Sesión Psicológica — {c.pacientes?.nombre}</h4>

                          {/* Diagnóstico único */}
                          {renderDiagnosticoPsico(c.id, c.pacientes.id, c.medico_id)}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">Actividades Realizadas</label>
                              <textarea
                                value={motivoConsultaMap[c.id] || ''}
                                onChange={(e) => setMotivoConsultaMap({ ...motivoConsultaMap, [c.id]: e.target.value })}
                                placeholder="Ej: Se trabajó técnica de respiración y reestructuración cognitiva..."
                                className="w-full p-3 border rounded-xl text-xs font-medium h-24 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">Actividades Próxima Sesión</label>
                              <textarea
                                value={proximaSesionMap[c.id] || ''}
                                onChange={(e) => setProximaSesionMap({ ...proximaSesionMap, [c.id]: e.target.value })}
                                placeholder="Ej: Revisar registro de pensamientos, iniciar exposición gradual..."
                                className="w-full p-3 border rounded-xl text-xs font-medium h-24 bg-white"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setCitaAtendiendoId(null)} className="bg-slate-200 text-xs font-bold py-2.5 px-4 rounded-xl">Cancelar</button>
                            <button
                              onClick={() => guardarYFinalizarAtencion(c)}
                              disabled={guardandoHistoria || !dp || dp.cargando}
                              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-sm transition"
                            >
                              {guardandoHistoria ? 'Guardando...' : '💾 Finalizar Sesión'}
                            </button>
                          </div>
                        </div>
                        );
                      })()}

                      {/* ATENCIÓN Y RECETA */}
                      {citaAtendiendoId === c.id && !citaEsPsicologia(c) && (
                        <div className="p-5 bg-slate-50 rounded-2xl border border-blue-100 space-y-4">
                          <h4 className="text-xs font-extrabold text-blue-900 uppercase tracking-wider">🩺 Consulta Actual y Receta Médica — {c.pacientes?.nombre}</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">Motivo de Consulta (Sintomatología)</label>
                              <textarea
                                value={motivoConsultaMap[c.id] || ''}
                                onChange={(e) => setMotivoConsultaMap({ ...motivoConsultaMap, [c.id]: e.target.value })}
                                placeholder="Ej: Paciente refiere cuadro de 3 días de evolución caracterizado por dolor abdominal..."
                                className="w-full p-3 border rounded-xl text-xs font-medium h-24 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">Diagnóstico</label>
                              <textarea
                                value={diagnosticoMap[c.id] || ''}
                                onChange={(e) => setDiagnosticoMap({ ...diagnosticoMap, [c.id]: e.target.value })}
                                placeholder="Ej: Gastroenteritis aguda infecciosa..."
                                className="w-full p-3 border rounded-xl text-xs font-medium h-24 bg-white"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <label className="text-[11px] font-extrabold text-slate-700 uppercase">💊 Receta Médica (Tabla de Medicamentos)</label>
                              <button
                                type="button"
                                onClick={() => agregarFilaMedicamento(c.id)}
                                className="text-[11px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg hover:bg-blue-100"
                              >
                                + Agregar Medicamento
                              </button>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                                  <tr>
                                    <th className="p-2.5 w-24">Cantidad</th>
                                    <th className="p-2.5">Medicamento</th>
                                    <th className="p-2.5">Posología / Indicación</th>
                                    <th className="p-2.5 w-10"></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {(medicamentosMap[c.id] || [{ cantidad: '', medicamento: '', posologia: '' }]).map((item, index) => (
                                    <tr key={index}>
                                      <td className="p-2">
                                        <input
                                          type="text"
                                          value={item.cantidad}
                                          onChange={(e) => actualizarMedicamento(c.id, index, 'cantidad', e.target.value)}
                                          placeholder="1 caja"
                                          className="w-full p-2 border rounded-lg text-xs"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <input
                                          type="text"
                                          value={item.medicamento}
                                          onChange={(e) => actualizarMedicamento(c.id, index, 'medicamento', e.target.value)}
                                          placeholder="Paracetamol 500mg"
                                          className="w-full p-2 border rounded-lg text-xs"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <input
                                          type="text"
                                          value={item.posologia}
                                          onChange={(e) => actualizarMedicamento(c.id, index, 'posologia', e.target.value)}
                                          placeholder="1 cada 8 horas"
                                          className="w-full p-2 border rounded-lg text-xs"
                                        />
                                      </td>
                                      <td className="p-2 text-center">
                                        {(medicamentosMap[c.id] || []).length > 1 && (
                                          <button
                                            type="button"
                                            onClick={() => eliminarFilaMedicamento(c.id, index)}
                                            className="text-red-500 font-bold hover:text-red-700 p-1"
                                          >
                                            ✕
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setCitaAtendiendoId(null)} className="bg-slate-200 text-xs font-bold py-2.5 px-4 rounded-xl">Cancelar</button>
                            <button
                              onClick={() => guardarYFinalizarAtencion(c)}
                              disabled={guardandoHistoria}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-sm transition"
                            >
                              {guardandoHistoria ? 'Guardando...' : '💾 Finalizar Consulta y Generar Receta'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: AGENDAR CITA MANUAL */}
        {tabActiva === 'agendar_asistente' && (
          <div className="max-w-xl mx-auto bg-slate-50/70 p-6 rounded-3xl border border-slate-200/80 space-y-4">
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">➕ Agendar Cita Manual</h3>
            
            {/* BUSCADOR INTUITIVO (Por Cédula o Nombres) */}
            <div className="space-y-2 relative">
              <label className="block text-xs font-bold text-slate-700 uppercase">Buscar Paciente (por Cédula o Nombre)</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={cedulaBusquedaManual} 
                  onChange={async (e) => {
                    const val = e.target.value;
                    setCedulaBusquedaManual(val);
                    
                    if (!val.trim()) {
                      setPacienteEncontrado(null);
                      setSugerenciasPacientes([]);
                      return;
                    }

                    try {
                      setBuscandoPaciente(true);
                      const resultados = await MedicoService.buscarPacientesPorCriterio(val.trim());
                      setSugerenciasPacientes(resultados || []);
                    } catch (err) {
                      console.error('Error buscando paciente:', err);
                    } finally {
                      setBuscandoPaciente(false);
                    }
                  }}
                  placeholder="Ej: 0923710594 o Juan Pérez..." 
                  className="w-full p-3 border rounded-xl text-xs bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20" 
                />

                {sugerenciasPacientes.length > 0 && !pacienteEncontrado && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {sugerenciasPacientes.map((pac) => (
                      <button
                        key={pac.id}
                        type="button"
                        onClick={() => {
                          setPacienteEncontrado(pac);
                          setCedulaBusquedaManual(pac.cedula || pac.nombre);
                          setSugerenciasPacientes([]);
                        }}
                        className="w-full text-left p-3 hover:bg-blue-50/80 transition flex justify-between items-center text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{pac.nombre}</p>
                          <p className="text-[11px] text-slate-500">🪪 Cédula: {pac.cedula || 'Sin cédula'} | 📱 Tel: {pac.telefono || 'Sin teléfono'}</p>
                        </div>
                        <span className="bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-lg text-[10px]">Seleccionar ➔</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {pacienteEncontrado && (
              <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-4 animate-fadeIn">
                {pacienteEncontrado.id ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
                      <div>
                        <p className="text-xs text-emerald-900 font-bold">✅ Paciente Seleccionado: {pacienteEncontrado.nombre}</p>
                        <p className="text-[11px] text-emerald-700">🪪 Cédula: {pacienteEncontrado.cedula || 'Sin cédula'} | 📱 {pacienteEncontrado.telefono || 'Sin teléfono'} | ✉️ {pacienteEncontrado.email || 'Sin correo'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPacienteEncontrado(null);
                          setCedulaBusquedaManual('');
                        }}
                        className="text-[11px] font-bold text-rose-600 bg-white px-2.5 py-1.5 rounded-lg border border-rose-200 shadow-sm"
                      >
                        Cambiar
                      </button>
                    </div>

                    {renderSelectorAgendamiento(false)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <p className="text-xs text-amber-800 font-bold">⚠️ La cédula ingresada no está registrada en el sistema.</p>
                      <p className="text-[11px] text-amber-700 mt-0.5">Complete los datos a continuación para registrarlo y agendar su cita:</p>
                    </div>

                    <input type="text" placeholder="Nombre Completo" value={nombreNuevoPac} onChange={(e) => setNombreNuevoPac(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs bg-white font-medium" />
                    <input type="text" placeholder="Teléfono" value={telefonoNuevoPac} onChange={(e) => setTelefonoNuevoPac(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs bg-white font-medium" />
                    <input type="email" placeholder="Correo electrónico (para notificaciones)" value={emailNuevoPac} onChange={(e) => setEmailNuevoPac(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs bg-white font-medium" />

                    {renderSelectorAgendamiento(true)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CONSULTAR EXPEDIENTE / MIGRACIÓN */}
        {tabActiva === 'consultar_expediente' && (
          <div className="max-w-3xl mx-auto bg-slate-50/70 p-6 rounded-3xl border border-slate-200/80 space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div className="space-y-1">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  🔍 Búsqueda de Expediente y Migración de Pacientes
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Escriba el nombre, apellido o cédula para buscar de forma intuitiva, o registre un nuevo paciente sin cita.
                </p>
              </div>

              <button
                onClick={() => {
                  setModoCrearPacienteMigracion(!modoCrearPacienteMigracion);
                  setPacienteConsultaLibre(null);
                  setModoCrearHistorico(false);
                  setEditandoPaciente(false);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition shadow-sm flex items-center gap-1.5"
              >
                {modoCrearPacienteMigracion ? '✕ Cancelar' : '➕ Registrar Paciente'}
              </button>
            </div>

            {modoCrearPacienteMigracion && (
              <form onSubmit={registrarPacienteSinCita} className="p-5 bg-emerald-50/70 rounded-2xl border border-emerald-200 space-y-3 animate-fadeIn">
                <h4 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider">
                  👤 Registro Directo de Paciente (Sin Cita Previa)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Cédula de Identidad (Opcional)</label>
                    <input
                      type="text"
                      value={nuevaCedulaMigracion}
                      onChange={(e) => setNuevaCedulaMigracion(e.target.value)}
                      placeholder="Ej: 0923710594"
                      className="w-full p-2.5 border rounded-xl text-xs bg-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Nombre Completo *</label>
                    <input
                      type="text"
                      value={nuevoNombreMigracion}
                      onChange={(e) => setNuevoNombreMigracion(e.target.value)}
                      placeholder="Ej: Juan Pérez"
                      className="w-full p-2.5 border rounded-xl text-xs bg-white font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Teléfono (Opcional)</label>
                    <input
                      type="text"
                      value={nuevoTelefonoMigracion}
                      onChange={(e) => setNuevoTelefonoMigracion(e.target.value)}
                      placeholder="Ej: 0991234567"
                      className="w-full p-2.5 border rounded-xl text-xs bg-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Correo Electrónico (Opcional)</label>
                    <input
                      type="email"
                      value={nuevoEmailMigracion}
                      onChange={(e) => setNuevoEmailMigracion(e.target.value)}
                      placeholder="Ej: paciente@email.com"
                      className="w-full p-2.5 border rounded-xl text-xs bg-white font-semibold"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={loadingCrearMigracion}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-sm transition"
                  >
                    {loadingCrearMigracion ? 'Registrando...' : '💾 Guardar Paciente en el Sistema'}
                  </button>
                </div>
              </form>
            )}

            <div className="relative">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={criterioBusquedaLibre} 
                  onChange={(e) => {
                    setCriterioBusquedaLibre(e.target.value);
                    if (!e.target.value) setPacienteConsultaLibre(null);
                  }}
                  placeholder="Empiece a escribir el nombre o apellido (ej: Paguay, Marina)..." 
                  className="flex-1 p-3.5 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/20 shadow-sm" 
                />
                {buscandoLibre && (
                  <div className="absolute right-4 top-4 text-xs font-bold text-blue-600 animate-pulse">
                    Buscando...
                  </div>
                )}
              </div>

              {sugerenciasPacientes.length > 0 && !pacienteConsultaLibre && (
                <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {sugerenciasPacientes.map((pac) => (
                    <button
                      key={pac.id}
                      onClick={() => seleccionarPacienteLibre(pac)}
                      className="w-full text-left p-3.5 hover:bg-blue-50/70 transition flex justify-between items-center text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{pac.nombre}</p>
                        <p className="text-[11px] text-slate-500">🪪 Cédula: {pac.cedula || 'Sin registrar'} | 📱 Tel: {pac.telefono || 'Sin teléfono'}</p>
                      </div>
                      <span className="bg-blue-100 text-blue-700 font-bold px-2.5 py-1 rounded-lg text-[10px]">Seleccionar ➔</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {pacienteConsultaLibre && (
              <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-fadeIn">
                <div className="flex justify-between items-center border-b pb-3 flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h4 className="font-bold text-sm text-slate-900">👤 {pacienteConsultaLibre.nombre}</h4>
                      <button
                        type="button"
                        onClick={abrirEdicionPaciente}
                        className="text-[11px] bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold px-2.5 py-1 rounded-lg transition"
                      >
                        ✏️ Editar Datos
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      🪪 Cédula: {pacienteConsultaLibre.cedula || 'Sin registrar'} | 📱 Tel: {pacienteConsultaLibre.telefono || 'Sin teléfono'} | ✉️ {pacienteConsultaLibre.email || 'Sin correo'}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setModoCrearHistorico(!modoCrearHistorico)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3.5 rounded-xl transition shadow-sm flex items-center gap-1.5"
                    >
                      {modoCrearHistorico ? '✕ Cancelar Registro' : '📥 + Agregar Histórico / Migración'}
                    </button>
                  </div>
                </div>

                {/* FORMULARIO DESPLEGABLE PARA EDITAR DATOS DEL PACIENTE */}
                {editandoPaciente && (
                  <form onSubmit={guardarEdicionPaciente} className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3 animate-fadeIn">
                    <div className="flex justify-between items-center border-b border-amber-200 pb-2">
                      <h5 className="text-xs font-extrabold text-amber-900 uppercase tracking-wider">✏️ Actualizar Información del Paciente</h5>
                      <button
                        type="button"
                        onClick={() => setEditandoPaciente(false)}
                        className="text-xs text-slate-500 hover:text-slate-800 font-bold"
                      >
                        ✕ Cerrar
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Nombre Completo *</label>
                        <input
                          type="text"
                          value={editNombre}
                          onChange={(e) => setEditNombre(e.target.value)}
                          className="w-full p-2.5 border rounded-xl text-xs bg-white font-semibold"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Cédula de Identidad</label>
                        <input
                          type="text"
                          value={editCedula}
                          onChange={(e) => setEditCedula(e.target.value)}
                          placeholder="Ej: 0923710594"
                          className="w-full p-2.5 border rounded-xl text-xs bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Teléfono</label>
                        <input
                          type="text"
                          value={editTelefono}
                          onChange={(e) => setEditTelefono(e.target.value)}
                          placeholder="Ej: 0991234567"
                          className="w-full p-2.5 border rounded-xl text-xs bg-white font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Correo Electrónico</label>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="Ej: paciente@email.com"
                          className="w-full p-2.5 border rounded-xl text-xs bg-white font-semibold"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditandoPaciente(false)}
                        className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-xl transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={guardandoEdicion}
                        className="px-5 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-sm transition"
                      >
                        {guardandoEdicion ? 'Guardando...' : '💾 Guardar Cambios'}
                      </button>
                    </div>
                  </form>
                )}

                {modoCrearHistorico && (
                  <form onSubmit={guardarHistoricoRetrospectivo} className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200 space-y-4">
                    <h5 className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider">
                      {agendaEsPsicologia
                        ? '🧠 Carga Retrospectiva de Sesión Psicológica (Paciente Migrado)'
                        : '📝 Carga Retrospectiva de Historia Clínica (Paciente Migrado)'}
                    </h5>

                    {agendaEsPsicologia ? (
                    <>
                    <div className="max-w-xs">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Fecha de la Sesión Pasada</label>
                      <input
                        type="date"
                        value={fechaHistoricaRetrof}
                        onChange={(e) => setFechaHistoricaRetrof(e.target.value)}
                        className="w-full p-2.5 border rounded-xl text-xs bg-white font-semibold"
                        required
                      />
                    </div>

                    {pacienteConsultaLibre?.id && renderDiagnosticoPsico(CLAVE_DIAG_MIGRACION, pacienteConsultaLibre.id, medicoAgendaId)}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Actividades Realizadas</label>
                        <textarea
                          value={motivoHistoricoRetrof}
                          onChange={(e) => setMotivoHistoricoRetrof(e.target.value)}
                          placeholder="Ej: Se trabajó técnica de respiración y reestructuración cognitiva..."
                          className="w-full p-2.5 border rounded-xl text-xs bg-white font-medium h-24"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Actividades Próxima Sesión</label>
                        <textarea
                          value={proximaSesionRetrof}
                          onChange={(e) => setProximaSesionRetrof(e.target.value)}
                          placeholder="Ej: Revisar registro de pensamientos, iniciar exposición gradual..."
                          className="w-full p-2.5 border rounded-xl text-xs bg-white font-medium h-24"
                        />
                      </div>
                    </div>
                    </>
                    ) : (
                    <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Fecha de la Atención Pasada</label>
                        <input
                          type="date"
                          value={fechaHistoricaRetrof}
                          onChange={(e) => setFechaHistoricaRetrof(e.target.value)}
                          className="w-full p-2.5 border rounded-xl text-xs bg-white font-semibold"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Diagnóstico</label>
                        <textarea
                          value={diagnosticoHistoricoRetrof}
                          onChange={(e) => setDiagnosticoHistoricoRetrof(e.target.value)}
                          placeholder="Ej: Hipertensión arterial esencial controlada..."
                          className="w-full p-2.5 border rounded-xl text-xs bg-white font-semibold h-20"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Motivo de Consulta (Sintomatología)</label>
                      <textarea
                        value={motivoHistoricoRetrof}
                        onChange={(e) => setMotivoHistoricoRetrof(e.target.value)}
                        placeholder="Ej: Paciente acude a control periódico refiriendo cefalea..."
                        className="w-full p-2.5 border rounded-xl text-xs bg-white font-medium h-24"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-extrabold text-slate-700 uppercase">💊 Receta Médica (Tabla de Medicamentos)</label>
                        <button
                          type="button"
                          onClick={agregarFilaMedicamentoRetrof}
                          className="text-[11px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg hover:bg-blue-100 transition"
                        >
                          + Agregar Medicamento
                        </button>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                            <tr>
                              <th className="p-2.5 w-24">Cantidad</th>
                              <th className="p-2.5">Medicamento</th>
                              <th className="p-2.5">Posología / Indicación</th>
                              <th className="p-2.5 w-10"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {medicamentosRetrof.map((item, index) => (
                              <tr key={index}>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={item.cantidad}
                                    onChange={(e) => actualizarMedicamentoRetrof(index, 'cantidad', e.target.value)}
                                    placeholder="1 caja"
                                    className="w-full p-2 border rounded-lg text-xs bg-white"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={item.medicamento}
                                    onChange={(e) => actualizarMedicamentoRetrof(index, 'medicamento', e.target.value)}
                                    placeholder="Losartán 50mg"
                                    className="w-full p-2 border rounded-lg text-xs bg-white"
                                  />
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={item.posologia}
                                    onChange={(e) => actualizarMedicamentoRetrof(index, 'posologia', e.target.value)}
                                    placeholder="1 cada 24 horas"
                                    className="w-full p-2 border rounded-lg text-xs bg-white"
                                  />
                                </td>
                                <td className="p-2 text-center">
                                  {medicamentosRetrof.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => eliminarFilaMedicamentoRetrof(index)}
                                      className="text-red-500 font-bold hover:text-red-700 p-1"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    </>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={guardandoHistoricoRetrof}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-sm transition"
                      >
                        {guardandoHistoricoRetrof ? 'Guardando...' : '💾 Guardar Registro Histórico en Expediente'}
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-3">
                  <h5 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">📋 Historial de Atenciones Médicas</h5>
                  
                  {historialConsultaLibre.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4 text-center">Este paciente no registra atenciones previas. Puede agregarlas usando el botón superior.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {historialConsultaLibre.map((h) => {
                          const sel = historiaLibreSeleccionada?.id === h.id;
                          return (
                            <button
                              key={h.id}
                              onClick={() => setHistoriaLibreSeleccionada(h)}
                              className={`w-full text-left p-3 rounded-xl border text-xs transition ${
                                sel ? 'bg-blue-600 text-white border-blue-600 font-bold' : 'bg-slate-50 text-slate-800 hover:bg-slate-100'
                              }`}
                            >
                              🗓️ {new Date(h.fecha_registro).toLocaleDateString('es-EC')} — {h.diagnostico || 'Consulta'}
                            </button>
                          );
                        })}
                      </div>

                      <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2.5">
                        {historiaLibreSeleccionada ? (
                          <>
                            <div className="flex justify-between font-bold text-slate-600 border-b pb-2 text-[11px]">
                              <span>👨‍⚕️ Dr(a). {historiaLibreSeleccionada.medicos?.nombre || 'Médico Institucional'}</span>
                              <span>{historiaLibreSeleccionada.medicos?.especialidad || 'General'}</span>
                            </div>
                            <p><strong>{esAtencionPsicologica(historiaLibreSeleccionada.medicos) ? 'Actividades realizadas:' : 'Motivo de Consulta:'}</strong></p>
                            <div className="whitespace-pre-wrap font-medium text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200">
                              {historiaLibreSeleccionada.motivo_consulta}
                            </div>
                            <p><strong>Diagnóstico:</strong></p>
                            <div className="whitespace-pre-wrap font-medium text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200">
                              {historiaLibreSeleccionada.diagnostico}
                            </div>
                            <div>
                              <strong>{esAtencionPsicologica(historiaLibreSeleccionada.medicos) ? 'Actividades próxima sesión:' : 'Tratamiento / Receta:'}</strong>
                              <div className="whitespace-pre-wrap font-medium text-slate-800 pt-1 bg-white p-2.5 rounded-lg border border-slate-200">
                                {historiaLibreSeleccionada.tratamiento_prescripcion || 'Ninguno'}
                              </div>
                            </div>
                          </>
                        ) : (
                          <p className="text-slate-400 italic text-center py-10">Selecciona una fecha en la lista de la izquierda.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: CONFIGURACIÓN MULTI-FECHA */}
        {tabActiva === 'horarios' && (
          <div className="space-y-6">
            <div className="p-6 bg-slate-50/70 rounded-3xl border border-slate-200/80 space-y-5">
              <div>
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">📅 Calendario de Horarios</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  1. Toca los días que quieres configurar (puedes elegir varios). 2. Define el horario abajo y aplícalo.
                  Toca cualquier día para ver su detalle o eliminar su horario.
                </p>
              </div>

              <CalendarioHorarios
                disponibilidades={disponibilidades}
                citas={citas}
                hoy={hoyAgenda}
                fechasSeleccionadas={fechasSeleccionadas}
                onCambiarSeleccion={setFechasSeleccionadas}
                onBorrarRegla={borrarHorario}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Hora Inicio</label>
                  <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs bg-white font-semibold" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Hora Fin</label>
                  <input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs bg-white font-semibold" />
                </div>
              </div>

              <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="chkAlmuerzo" checked={tieneAlmuerzo} onChange={(e) => setTieneAlmuerzo(e.target.checked)} className="w-4 h-4 text-amber-600 rounded" />
                  <label htmlFor="chkAlmuerzo" className="text-xs font-bold text-amber-900 cursor-pointer">🍱 Excluir Horario de Almuerzo</label>
                </div>
                {tieneAlmuerzo && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900">Inicio Almuerzo</label>
                      <input type="time" value={horaInicioAlmuerzo} onChange={(e) => setHoraInicioAlmuerzo(e.target.value)} className="w-full p-2 border rounded-xl text-xs bg-white" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900">Fin Almuerzo</label>
                      <input type="time" value={horaFinAlmuerzo} onChange={(e) => setHoraFinAlmuerzo(e.target.value)} className="w-full p-2 border rounded-xl text-xs bg-white" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700 uppercase">Duración cita:</label>
                  <select value={duracionMinutos} onChange={(e) => setDuracionMinutos(Number(e.target.value))} className="p-2 border rounded-xl text-xs bg-white font-bold">
                    <option value={15}>15 min</option>
                    <option value={20}>20 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>60 min</option>
                  </select>
                </div>
                <button
                  onClick={guardarHorariosMultiplesFechas}
                  disabled={guardandoHorario || fechasSeleccionadas.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold py-3 px-6 rounded-xl shadow-sm transition"
                >
                  {guardandoHorario ? 'Guardando...' : fechasSeleccionadas.length === 0 ? 'Selecciona días en el calendario' : `💾 Aplicar Horario a ${fechasSeleccionadas.length} día(s)`}
                </button>
              </div>
            </div>

          </div>
        )}

        {/* TAB 5: GESTIÓN DE MÉDICOS (SOLO ADMIN) */}
        {esAdmin && tabActiva === 'gestion_medicos' && (
          <div className="space-y-6">
            {/* CATÁLOGO DE ESPECIALIDADES */}
            <div className="p-6 bg-violet-50/40 rounded-3xl border border-violet-100 space-y-4">
              <div className="flex justify-between items-center border-b border-violet-100 pb-3">
                <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">🏷️ Catálogo de Especialidades</h3>
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={espMostrarInactivas}
                    onChange={(e) => setEspMostrarInactivas(e.target.checked)}
                    className="w-3.5 h-3.5 rounded"
                  />
                  Mostrar inactivas
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-3 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {espEditandoId ? 'Editar nombre' : 'Nueva especialidad'}
                  </label>
                  <input
                    type="text"
                    value={espNombre}
                    onChange={(e) => setEspNombre(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') guardarEspecialidad(); }}
                    className="w-full p-2.5 border rounded-xl text-xs bg-white"
                    placeholder="Ej: Psicología Clínica"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tipo de atención</label>
                  <select
                    value={espTipo}
                    onChange={(e) => setEspTipo(e.target.value as 'medica' | 'psicologica')}
                    className="w-full p-2.5 border rounded-xl text-xs bg-white"
                  >
                    <option value="medica">🩺 Médica (con receta)</option>
                    <option value="psicologica">🧠 Psicológica (sesiones)</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  {espEditandoId && (
                    <button onClick={limpiarFormularioEspecialidad} className="bg-slate-200 text-xs font-bold py-2.5 px-4 rounded-xl">
                      Cancelar
                    </button>
                  )}
                  <button
                    onClick={guardarEspecialidad}
                    disabled={loadingEsp}
                    className="bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition whitespace-nowrap"
                  >
                    {loadingEsp ? 'Guardando...' : espEditandoId ? 'Actualizar' : '+ Agregar'}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                El <strong>tipo de atención</strong> define la pantalla al atender: <em>Médica</em> usa motivo, diagnóstico y receta;
                <em> Psicológica</em> usa actividades realizadas, diagnóstico único y actividades para la próxima sesión.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {especialidades
                  .filter((e) => espMostrarInactivas || e.activo)
                  .map((esp) => {
                    const enUso = listaMedicos.filter((m: any) => m.especialidad_id === esp.id).length;
                    return (
                      <div
                        key={esp.id}
                        className={`p-3 rounded-2xl border flex justify-between items-center gap-2 ${
                          esp.activo ? 'bg-white border-slate-200' : 'bg-slate-100 border-slate-200 opacity-70'
                        } ${espEditandoId === esp.id ? 'ring-2 ring-violet-400' : ''}`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-bold text-xs ${esp.activo ? 'text-slate-800' : 'text-slate-500 line-through'}`}>{esp.nombre}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              esp.tipo_atencion === 'psicologica' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {esp.tipo_atencion === 'psicologica' ? '🧠 Psicológica' : '🩺 Médica'}
                            </span>
                            {!esp.activo && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">Inactiva</span>}
                          </div>
                          <p className="text-[11px] text-slate-500">{enUso} médico(s)</p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {esp.activo ? (
                            <>
                              <button
                                onClick={() => seleccionarEspecialidadParaEditar(esp)}
                                disabled={loadingEsp}
                                className="bg-slate-100 hover:bg-slate-200 text-[11px] font-bold py-1.5 px-3 rounded-xl border"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => cambiarEstadoEspecialidad(esp, false)}
                                disabled={loadingEsp}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-600 text-[11px] font-bold py-1.5 px-3 rounded-xl border border-rose-100"
                              >
                                Desactivar
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => cambiarEstadoEspecialidad(esp, true)}
                              disabled={loadingEsp}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold py-1.5 px-3 rounded-xl border border-emerald-100"
                            >
                              Reactivar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                {especialidades.filter((e) => espMostrarInactivas || e.activo).length === 0 && (
                  <p className="text-xs text-slate-500 italic">No hay especialidades registradas.</p>
                )}
              </div>
            </div>

            <div className="p-6 bg-slate-50/70 rounded-3xl border border-slate-200/80 space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                  {medicoEditandoId ? '✏️ Editar Datos de Médico' : '➕ Registrar Nuevo Médico'}
                </h3>
                {medicoEditandoId && (
                  <button onClick={limpiarFormularioMedico} className="text-xs text-blue-600 font-bold underline">
                    + Cancelar edición
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nombre Completo</label>
                  <input type="text" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs bg-white" placeholder="Dr. Juan Pérez" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Especialidad</label>
                  <select
                    value={nuevaEspecialidadId}
                    onChange={(e) => setNuevaEspecialidadId(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs bg-white"
                  >
                    <option value="">— Selecciona una especialidad —</option>
                    {especialidades
                      .filter((e) => e.activo || e.id === nuevaEspecialidadId)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}{e.tipo_atencion === 'psicologica' ? ' (atención psicológica)' : ''}{!e.activo ? ' — inactiva' : ''}
                        </option>
                      ))}
                  </select>
                  {especialidades.filter((e) => e.activo).length === 0 && (
                    <p className="text-[11px] text-amber-700 mt-1">Primero crea una especialidad en el catálogo de arriba.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Correo Electrónico</label>
                  <input type="email" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs bg-white" placeholder="doctor@clinica.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Teléfono</label>
                  <input type="text" value={nuevoTelefono} onChange={(e) => setNuevoTelefono(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs bg-white" placeholder="0991234567" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Usuario (para iniciar sesión)</label>
                  <input type="text" value={nuevoUsuario}
                    onChange={(e) => setNuevoUsuario(e.target.value.toLowerCase().replace(/\s/g, ''))}
                    className="w-full p-2.5 border rounded-xl text-xs bg-white" placeholder="dr.perez" autoComplete="off" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {medicoEditandoId ? 'Nueva contraseña (vacío = no cambiar)' : 'Contraseña'}
                  </label>
                  <input type="password" value={nuevaPassword}
                    onChange={(e) => setNuevaPassword(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs bg-white" placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
                </div>
              </div>

              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3">
                <input
                  type="checkbox"
                  id="chkHistoriaFlag"
                  checked={tieneHistoriaClinicaFlag}
                  onChange={(e) => setTieneHistoriaClinicaFlag(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label htmlFor="chkHistoriaFlag" className="text-xs font-bold text-indigo-900 cursor-pointer">
                  Habilitar módulo de Historia Clínica y Recetas para este médico
                </label>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={guardarMedicoAdmin}
                  disabled={loadingMedico}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-3 px-6 rounded-xl transition shadow-sm"
                >
                  {loadingMedico ? 'Guardando...' : medicoEditandoId ? 'Actualizar Médico' : 'Guardar y Registrar Médico'}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Lista de Médicos en el Sistema</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {listaMedicos.filter((m) => m.rol !== 'admin').map((med) => (
                  <div key={med.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex justify-between items-center">
                    <div>
                      <h5 className="font-bold text-xs text-slate-800">{med.nombre}</h5>
                      <p className="text-[11px] text-slate-500">
                        {med.especialidad || 'Sin especialidad'}
                        {esAtencionPsicologica(med) && <span className="ml-1 text-violet-600 font-bold">🧠</span>}
                        {!med.especialidad_id && <span className="ml-1 text-amber-600 font-bold">⚠️ sin asignar del catálogo</span>}
                        {' '}| ✉️ {med.email}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => copiarEnlaceAgenda(med.id, med.nombre)} title="Copiar enlace de agenda para pacientes" className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold py-1.5 px-3 rounded-xl border border-blue-200">🔗 Enlace</button>
                      <button onClick={() => seleccionarParaEditarMedico(med)} className="bg-slate-100 hover:bg-slate-200 text-xs font-bold py-1.5 px-3 rounded-xl border">Editar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MODAL REAGENDAR */}
        {citaEditando && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <h3 className="font-bold text-slate-800 text-sm">Reagendar Cita</h3>
              <input type="date" value={nuevaFechaReagendar} min={hoyAgenda} onChange={(e) => setNuevaFechaReagendar(e.target.value)} className="w-full p-3 border rounded-xl text-xs font-semibold" />
              <div className="grid grid-cols-3 gap-2 max-h-45 overflow-y-auto">
                {horariosReagendar.map((h) => (
                  <button key={h} onClick={() => setNuevaHoraReagendar(h)} className={`p-2 text-xs font-bold rounded-xl border ${nuevaHoraReagendar === h ? 'bg-blue-600 text-white' : 'bg-slate-50'}`}>{h}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setCitaEditando(null)} className="w-1/2 bg-slate-100 py-2.5 text-xs font-bold rounded-xl">Cancelar</button>
                <button onClick={confirmarReagendamiento} disabled={loadingReagendar || !nuevaHoraReagendar} className="w-1/2 bg-blue-600 text-white py-2.5 text-xs font-bold rounded-xl">Confirmar</button>
              </div>
            </div>
          </div>
        )}

        {/* RECETA MÉDICA PARA IMPRIMIR O ENVIAR POR CORREO */}
        {recetaParaImprimir && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
              
              <div id="seccion-receta-impresion" className="p-6 border-2 border-slate-200 rounded-2xl bg-white space-y-4">
                <div className="border-b pb-3 text-center">
                  <h2 className="text-base font-black text-slate-800">RECETA MÉDICA</h2>
                  <p className="text-xs font-bold text-slate-600">Dr(a). {recetaParaImprimir.medico?.nombre}</p>
                  <p className="text-[10px] text-slate-400">{recetaParaImprimir.medico?.especialidad} | Fecha: {recetaParaImprimir.fecha}</p>
                </div>

                <div className="text-xs space-y-1 bg-slate-50 p-3 rounded-xl border">
                  <p><strong>Paciente:</strong> {recetaParaImprimir.paciente?.nombre}</p>
                  <p><strong>Cédula:</strong> {recetaParaImprimir.paciente?.cedula || 'Sin registrar'}</p>
                  <p><strong>Correo Electrónico:</strong> {recetaParaImprimir.paciente?.email || 'No registrado'}</p>
                  <p><strong>Diagnóstico:</strong> {recetaParaImprimir.diagnostico}</p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase border-b pb-1">Prescripción Médica:</h4>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b text-slate-600 font-bold text-[10px] uppercase">
                        <th className="p-1.5 w-16">Cant.</th>
                        <th className="p-1.5">Medicamento</th>
                        <th className="p-1.5">Posología</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-800">
                      {recetaParaImprimir.medicamentos.map((med: ItemMedicamento, idx: number) => (
                        <tr key={idx}>
                          <td className="p-1.5 font-semibold">{med.cantidad}</td>
                          <td className="p-1.5 font-bold">{med.medicamento}</td>
                          <td className="p-1.5">{med.posologia}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-16 text-center border-t mt-8">
                  <div className="w-48 border-b border-slate-400 mx-auto mb-1"></div>
                  <p className="text-[10px] text-slate-500 font-bold">Firma y Sello Médico</p>
                </div>
              </div>

              {/* OPCIONES DEL DOCTOR: IMPRIMIR */}
              <div className="flex flex-wrap gap-2 justify-between items-center pt-2 border-t">
                <button
                  onClick={() => setRecetaParaImprimir(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl transition"
                >
                  Cerrar
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-sm transition flex items-center gap-1.5"
                  >
                    🖨️ Imprimir Receta
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}