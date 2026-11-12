'use client';

import { useState, useEffect, useMemo } from 'react';
import { MedicoService } from '@/services/medico.service';
import { EmailService } from '@/services/email.service';

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

export default function PanelMedicoPage() {
  const [tabActiva, setTabActiva] = useState<'citas' | 'agendar_asistente' | 'consultar_expediente' | 'horarios' | 'gestion_medicos'>('citas');

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
  const [errorLogin, setErrorLogin] = useState<string>('');
  const [loadingLogin, setLoadingLogin] = useState<boolean>(false);
  const [modoRecuperacion, setModoRecuperacion] = useState<boolean>(false);
  const [emailRecuperacion, setEmailRecuperacion] = useState<string>('');
  const [mensajeExitoRecuperacion, setMensajeExitoRecuperacion] = useState<string>('');
  const [loadingRecuperacion, setLoadingRecuperacion] = useState<boolean>(false);

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
  const [nuevaEspecialidad, setNuevaEspecialidad] = useState<string>('');
  const [nuevoEmail, setNuevoEmail] = useState<string>('');
  const [nuevoTelefono, setNuevoTelefono] = useState<string>('');
  const [nuevoRol, setNuevoRol] = useState<string>('medico');
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

  const [fechaManual, setFechaManual] = useState<string>('');
  const [horariosManuales, setHorariosManuales] = useState<string[]>([]);
  const [horaManualSeleccionada, setHoraManualSeleccionada] = useState<string>('');
  const [tipoConsultaManual, setTipoConsultaManual] = useState<string>('presencial');
  const [loadingManual, setLoadingManual] = useState<boolean>(false);

  // Configuración Horarios Multi-Fecha
  const [fechaInputActual, setFechaInputActual] = useState<string>('');
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

  const [historiasPorCita, setHistoriasPorCita] = useState<{ [citaId: string]: any[] }>({});
  const [historiaSeleccionadaDetalle, setHistoriaSeleccionadaDetalle] = useState<{ [citaId: string]: any }>({});
  const [loadingHistorialInline, setLoadingHistorialInline] = useState<boolean>(false);

  // Receta para Imprimir
  const [recetaParaImprimir, setRecetaParaImprimir] = useState<any | null>(null);
  const [enviandoCorreoReceta, setEnviandoCorreoReceta] = useState<boolean>(false);

  useEffect(() => {
    const hoyDate = new Date();
    const anio = hoyDate.getFullYear();
    const mes = String(hoyDate.getMonth() + 1).padStart(2, '0');
    const dia = String(hoyDate.getDate()).padStart(2, '0');
    const hoyStr = `${anio}-${mes}-${dia}`;

    setFechaFiltro(hoyStr);
    setFechaInputActual(hoyStr);
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
      const historial = await MedicoService.obtenerHistorialPaciente(pac.id);
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

  async function guardarHistoricoRetrospectivo(e: React.FormEvent) {
    e.preventDefault();
    if (!pacienteConsultaLibre?.id) return;
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
      
      const historialActualizado = await MedicoService.obtenerHistorialPaciente(pacienteConsultaLibre.id);
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
    setNuevaEspecialidad(med.especialidad || '');
    setNuevoEmail(med.email || '');
    setNuevoTelefono(med.telefono || '');
    setNuevoRol(med.rol || 'medico');
    setTieneHistoriaClinicaFlag(med.tiene_historia_clinica ?? true);
  }

  function limpiarFormularioMedico() {
    setMedicoEditandoId(null);
    setNuevoNombre('');
    setNuevaEspecialidad('');
    setNuevoEmail('');
    setNuevoTelefono('');
    setNuevoRol('medico');
    setTieneHistoriaClinicaFlag(true);
  }

  async function guardarMedicoAdmin() {
    if (!nuevoNombre || !nuevoEmail) {
      alert('Completa nombre y correo.');
      return;
    }
    setLoadingMedico(true);
    try {
      if (medicoEditandoId) {
        await MedicoService.actualizarMedico(medicoEditandoId, {
          nombre: nuevoNombre,
          especialidad: nuevaEspecialidad,
          email: nuevoEmail,
          telefono: nuevoTelefono,
          rol: nuevoRol,
          tiene_historia_clinica: tieneHistoriaClinicaFlag
        });
        alert('¡Médico actualizado!');
      } else {
        await MedicoService.crearMedico({
          nombre: nuevoNombre,
          especialidad: nuevaEspecialidad,
          email: nuevoEmail,
          telefono: nuevoTelefono,
          rol: nuevoRol,
          tiene_historia_clinica: tieneHistoriaClinicaFlag
        });
        alert('¡Médico registrado!');
      }
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
      const historial = await MedicoService.obtenerHistorialPaciente(pacienteId);
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

  async function guardarYFinalizarAtencion(cita: CitaDetalle) {
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

  // Enviar receta por correo desde el modal
  async function enviarRecetaPorCorreoModal() {
    if (!recetaParaImprimir || !recetaParaImprimir.paciente?.email) {
      alert('El paciente no tiene un correo electrónico registrado para enviar la receta.');
      return;
    }

    setEnviandoCorreoReceta(true);
    try {
      await EmailService.enviarRecetaMedica({
        emailDestino: recetaParaImprimir.paciente.email,
        nombrePaciente: recetaParaImprimir.paciente.nombre,
        nombreMedico: recetaParaImprimir.medico?.nombre || 'Médico Institucional',
        especialidadMedico: recetaParaImprimir.medico?.especialidad || 'Medicina General',
        diagnostico: recetaParaImprimir.diagnostico,
        medicamentos: recetaParaImprimir.medicamentos
      });

      alert(`¡Receta enviada exitosamente al correo: ${recetaParaImprimir.paciente.email}!`);
      setRecetaParaImprimir(null);
    } catch (err: any) {
      alert('Error al enviar el correo: ' + err.message);
    } finally {
      setEnviandoCorreoReceta(false);
    }
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

  function agregarFechaLista() {
    if (!fechaInputActual) return;
    if (!fechasSeleccionadas.includes(fechaInputActual)) {
      setFechasSeleccionadas([...fechasSeleccionadas, fechaInputActual].sort());
    }
  }

  function quitarFechaLista(fechaRemover: string) {
    setFechasSeleccionadas(fechasSeleccionadas.filter((f) => f !== fechaRemover));
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

  async function guardarCitaManual() {
    const targetId = esAdmin ? medicoSeleccionadoAdmin : perfilUsuario?.id;
    if (!targetId || !fechaManual || !horaManualSeleccionada) {
      alert('Selecciona fecha y hora.');
      return;
    }

    setLoadingManual(true);
    try {
      let pacId = pacienteEncontrado?.id;
      let emailPacObj = pacienteEncontrado?.email;
      let nombrePacObj = pacienteEncontrado?.nombre;

      if (!pacId) {
        if (!nombreNuevoPac || !telefonoNuevoPac || !emailNuevoPac) {
          alert('Por favor completa nombre, teléfono y correo electrónico del paciente.');
          setLoadingManual(false);
          return;
        }
        const nuevoPac = await MedicoService.crearPaciente({
          nombre: nombreNuevoPac,
          cedula: cedulaBusquedaManual,
          telefono: telefonoNuevoPac,
          email: emailNuevoPac
        });
        pacId = nuevoPac.id;
        emailPacObj = emailNuevoPac;
        nombrePacObj = nombreNuevoPac;
      }

      const fechaHoraISO = `${fechaManual}T${horaManualSeleccionada}:00`;
      let enlaceJitsi = null;
      if (tipoConsultaManual === 'telemedicina') {
        const salaUnica = `ConsultaMedica-${targetId.substring(0, 5)}-${fechaManual}-${horaManualSeleccionada.replace(':', '')}`;
        enlaceJitsi = `https://meet.jit.si/${salaUnica}`;
      }

      await MedicoService.agendarCitaManual({
        medico_id: targetId,
        paciente_id: pacId,
        fecha_hora: fechaHoraISO,
        tipo_consulta: tipoConsultaManual,
        enlace_videollamada: enlaceJitsi || undefined
      });

      // DISPARAR CORREO DE CONFIRMACIÓN AUTOMÁTICO
      if (emailPacObj) {
        await EmailService.enviarConfirmacionCita({
          emailDestino: emailPacObj,
          nombrePaciente: nombrePacObj,
          nombreMedico: perfilUsuario?.nombre || 'Médico Tratante',
          fechaHora: fechaHoraISO,
          tipoConsulta: tipoConsultaManual,
          enlaceVideollamada: enlaceJitsi || undefined
        });
      }

      alert('¡Cita agendada y notificación por correo enviada con éxito!');
      setCedulaBusquedaManual('');
      setPacienteEncontrado(null);
      setNombreNuevoPac('');
      setTelefonoNuevoPac('');
      setEmailNuevoPac('');
      setFechaManual('');
      setHoraManualSeleccionada('');
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
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">Correo Electrónico</label>
                <input 
                  type="email" 
                  value={emailLogin} 
                  onChange={(e) => setEmailLogin(e.target.value)} 
                  placeholder="doctor@clinica.com" 
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
                <input 
                  type="password" 
                  value={passwordLogin} 
                  onChange={(e) => setPasswordLogin(e.target.value)} 
                  placeholder="••••••••" 
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition" 
                  required 
                />
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
          <button 
            onClick={() => MedicoService.cerrarSesion().then(() => window.location.reload())} 
            className="bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-bold py-2.5 px-4 rounded-xl border border-slate-200 transition flex items-center gap-1.5"
          >
            🚪 Cerrar Sesión
          </button>
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
        </div>

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
                            onClick={() => setCitaAtendiendoId(citaAtendiendoId === c.id ? null : c.id)}
                            className={`text-xs font-bold py-2 px-4 rounded-xl shadow-sm transition flex items-center gap-1.5 ${
                              citaAtendiendoId === c.id 
                                ? 'bg-slate-800 text-white' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                            }`}
                          >
                            {citaAtendiendoId === c.id ? '✕ Cancelar' : '✍️ Atender / Recetar'}
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
                                    <p><strong>Motivo:</strong> {historiaSeleccionadaDetalle[c.id].motivo_consulta}</p>
                                    <p><strong>Diagnóstico:</strong> {historiaSeleccionadaDetalle[c.id].diagnostico}</p>
                                    <div>
                                      <strong>Tratamiento / Receta:</strong>
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

                      {/* ATENCIÓN Y RECETA */}
                      {citaAtendiendoId === c.id && (
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

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Fecha de Cita</label>
                        <input type="date" value={fechaManual} onChange={(e) => setFechaManual(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs font-semibold" />
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

                    <button onClick={guardarCitaManual} disabled={loadingManual || !horaManualSeleccionada} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold py-3.5 rounded-xl shadow-sm transition">
                      {loadingManual ? 'Agendando y Notificando...' : '💾 Confirmar Cita y Enviar Correo'}
                    </button>
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

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Fecha de Cita</label>
                        <input type="date" value={fechaManual} onChange={(e) => setFechaManual(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs font-semibold" />
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

                    <button onClick={guardarCitaManual} disabled={loadingManual || !horaManualSeleccionada} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold py-3.5 rounded-xl shadow-sm transition">
                      {loadingManual ? 'Registrando y Agendando...' : '💾 Registrar Paciente, Agendar y Notificar'}
                    </button>
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
                      📝 Carga Retrospectiva de Historia Clínica (Paciente Migrado)
                    </h5>
                    
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
                            <p><strong>Motivo de Consulta:</strong></p>
                            <div className="whitespace-pre-wrap font-medium text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200">
                              {historiaLibreSeleccionada.motivo_consulta}
                            </div>
                            <p><strong>Diagnóstico:</strong></p>
                            <div className="whitespace-pre-wrap font-medium text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200">
                              {historiaLibreSeleccionada.diagnostico}
                            </div>
                            <div>
                              <strong>Tratamiento / Receta:</strong>
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
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                📅 Configurar Horarios Seleccionando Uno o Varios Días en el Calendario
              </h3>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  1. Selecciona fecha y agrégala a la lista
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={fechaInputActual}
                    onChange={(e) => setFechaInputActual(e.target.value)}
                    className="p-2.5 border rounded-xl text-xs bg-white font-semibold flex-1 md:w-60"
                  />
                  <button type="button" onClick={agregarFechaLista} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition">
                    ➕ Agregar Fecha
                  </button>
                </div>

                {fechasSeleccionadas.length > 0 && (
                  <div className="pt-2">
                    <p className="text-[11px] font-bold text-slate-500 uppercase mb-2">Fechas seleccionadas ({fechasSeleccionadas.length}):</p>
                    <div className="flex flex-wrap gap-2">
                      {fechasSeleccionadas.map((f) => (
                        <span key={f} className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-bold px-3 py-1 rounded-xl">
                          📅 {f}
                          <button type="button" onClick={() => quitarFechaLista(f)} className="text-indigo-400 hover:text-red-600 font-black ml-1">✕</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

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
                  {guardandoHorario ? 'Guardando...' : `💾 Aplicar Horario a (${fechasSeleccionadas.length}) Fechas`}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Horarios Configurados</h4>
              {disponibilidades.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No hay horarios registrados.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {disponibilidades.map((d) => (
                    <div key={d.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm flex justify-between items-center">
                      <div>
                        <h5 className="font-bold text-xs text-slate-800">
                          {d.fecha_especifica ? `📅 Fecha: ${d.fecha_especifica}` : `Regla general día ${d.dia_semana}`}
                        </h5>
                        <p className="text-xs text-slate-600 mt-0.5">🕒 {d.hora_inicio} a {d.hora_fin} ({d.duracion_cita_minutos} min)</p>
                        {d.hora_inicio_almuerzo && (
                          <p className="text-[11px] text-amber-700 font-bold mt-1">🍱 Almuerzo: {d.hora_inicio_almuerzo} - {d.hora_fin_almuerzo}</p>
                        )}
                      </div>
                      <button onClick={() => borrarHorario(d.id)} className="text-rose-600 hover:bg-rose-50 p-2 rounded-xl text-xs font-bold transition">🗑️</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: GESTIÓN DE MÉDICOS (SOLO ADMIN) */}
        {esAdmin && tabActiva === 'gestion_medicos' && (
          <div className="space-y-6">
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
                  <input type="text" value={nuevaEspecialidad} onChange={(e) => setNuevaEspecialidad(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs bg-white" placeholder="Cardiología" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Correo Electrónico</label>
                  <input type="email" value={nuevoEmail} onChange={(e) => setNuevoEmail(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs bg-white" placeholder="doctor@clinica.com" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Teléfono</label>
                  <input type="text" value={nuevoTelefono} onChange={(e) => setNuevoTelefono(e.target.value)} className="w-full p-2.5 border rounded-xl text-xs bg-white" placeholder="0991234567" />
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
                      <p className="text-[11px] text-slate-500">{med.especialidad} | ✉️ {med.email}</p>
                    </div>
                    <button onClick={() => seleccionarParaEditarMedico(med)} className="bg-slate-100 hover:bg-slate-200 text-xs font-bold py-1.5 px-3 rounded-xl border">Editar</button>
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
              <input type="date" value={nuevaFechaReagendar} onChange={(e) => setNuevaFechaReagendar(e.target.value)} className="w-full p-3 border rounded-xl text-xs font-semibold" />
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

              {/* OPCIONES DEL DOCTOR: IMPRIMIR O ENVIAR POR CORREO */}
              <div className="flex flex-wrap gap-2 justify-between items-center pt-2 border-t">
                <button
                  onClick={() => setRecetaParaImprimir(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-4 rounded-xl transition"
                >
                  Cerrar
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={enviarRecetaPorCorreoModal}
                    disabled={enviandoCorreoReceta || !recetaParaImprimir.paciente?.email}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition flex items-center gap-1.5"
                  >
                    {enviandoCorreoReceta ? 'Enviando...' : '✉️ Enviar Receta por Correo'}
                  </button>

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