'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useHoyEcuador } from '@/lib/useHoyEcuador';
import { enmascararCedula } from '@/lib/agenda';

interface Medico {
  id: string;
  nombre: string;
  especialidad: string;
  direccion?: string | null;
  consultorio?: string | null;
}

type ModoPaciente = 'registrado' | 'nuevo';
type MotivoCorreo = 'sin_correo' | 'ya_enviado' | 'limite' | 'no_configurado' | 'error';

interface Reserva {
  cita: { fecha: string; hora: string; tipoConsulta: 'presencial' | 'telemedicina'; enlace: string | null };
  medico: Medico;
  correo: { enviado: boolean; motivo?: MotivoCorreo };
}

const DIRECCION_DEFECTO = 'Av. San Jorge y Calle 10ma, Guayaquil';
const CONSULTORIO_DEFECTO = 'Piso 2, Consultorio 204';

async function llamarApi<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(json.error || `Error ${res.status}`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return json as T;
}

function textoCorreo(correo: Reserva['correo']) {
  if (correo.enviado) return '✉️ Te enviamos la confirmación a tu correo.';
  switch (correo.motivo) {
    case 'sin_correo': return 'No registraste un correo, por eso no se envió confirmación.';
    case 'ya_enviado': return '';
    default: return 'No pudimos enviar el correo de confirmación, pero tu cita quedó registrada.';
  }
}

function AgendarContenido() {
  const searchParams = useSearchParams();
  const medicoIdParam = searchParams.get('medicoId');

  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [medicosFiltrados, setMedicosFiltrados] = useState<Medico[]>([]);
  const [busquedaMedico, setBusquedaMedico] = useState<string>('');
  const [mostrarDropdown, setMostrarDropdown] = useState<boolean>(false);

  const [medicoSeleccionadoObj, setMedicoSeleccionadoObj] = useState<Medico | null>(null);
  const [medicoFijo, setMedicoFijo] = useState<boolean>(false);

  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('');
  const [horariosDisponibles, setHorariosDisponibles] = useState<string[]>([]);
  const [cargandoHorarios, setCargandoHorarios] = useState<boolean>(false);
  const [horaSeleccionada, setHoraSeleccionada] = useState<string>('');

  const [tipoConsulta, setTipoConsulta] = useState<'presencial' | 'telemedicina'>('presencial');

  // PACIENTE: registrado (se identifica solo con su cédula) o nuevo (llena el formulario)
  const [modoPaciente, setModoPaciente] = useState<ModoPaciente>('registrado');
  const [cedulaBusqueda, setCedulaBusqueda] = useState<string>('');
  const [verificando, setVerificando] = useState<boolean>(false);
  const [pacienteVerificado, setPacienteVerificado] = useState<{ cedula: string; nombre: string } | null>(null);
  const [cedulaNoEncontrada, setCedulaNoEncontrada] = useState<boolean>(false);

  const [nombrePaciente, setNombrePaciente] = useState<string>('');
  const [cedulaPaciente, setCedulaPaciente] = useState<string>('');
  const [telefonoPaciente, setTelefonoPaciente] = useState<string>('');
  const [emailPaciente, setEmailPaciente] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const hoy = useHoyEcuador();

  async function cargarMedicos() {
    const { data } = await supabase
      .from('medicos')
      .select('id, nombre, especialidad, direccion, consultorio')
      .neq('rol', 'admin')
      .order('nombre', { ascending: true });

    if (!data || data.length === 0) return;
    setMedicos(data);
    setMedicosFiltrados(data);

    // Enlace directo del médico (/agendar?medicoId=...): queda fijo, sin buscador
    const delEnlace = medicoIdParam ? data.find((m) => m.id === medicoIdParam) : null;
    if (delEnlace) {
      setMedicoSeleccionadoObj(delEnlace);
      setBusquedaMedico(`${delEnlace.nombre} — ${delEnlace.especialidad}`);
      setMedicoFijo(true);
    } else {
      setMedicoFijo(false);
      setMedicoSeleccionadoObj(data[0]);
      setBusquedaMedico(`${data[0].nombre} — ${data[0].especialidad}`);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarMedicos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicoIdParam]);

  function handleBuscarMedico(texto: string) {
    setBusquedaMedico(texto);
    setMostrarDropdown(true);
    const t = texto.toLowerCase();
    setMedicosFiltrados(medicos.filter((m) => m.nombre.toLowerCase().includes(t) || m.especialidad.toLowerCase().includes(t)));
  }

  function seleccionarMedico(med: Medico) {
    setMedicoSeleccionadoObj(med);
    setBusquedaMedico(`${med.nombre} — ${med.especialidad}`);
    setMostrarDropdown(false);
    setHoraSeleccionada('');
  }

  // HORARIOS: los calcula el servidor (solo turnos libres y futuros; las citas canceladas liberan su horario)
  async function cargarHorarios(medicoId: string, fecha: string) {
    setCargandoHorarios(true);
    try {
      const { horarios } = await llamarApi<{ horarios: string[] }>(
        `/api/agenda/horarios?medicoId=${encodeURIComponent(medicoId)}&fecha=${encodeURIComponent(fecha)}`
      );
      setHorariosDisponibles(horarios);
    } catch {
      setHorariosDisponibles([]);
    }
    setCargandoHorarios(false);
  }

  useEffect(() => {
    if (medicoSeleccionadoObj?.id && fechaSeleccionada && fechaSeleccionada >= hoy) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarHorarios(medicoSeleccionadoObj.id, fechaSeleccionada);
    } else {
      setHorariosDisponibles([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medicoSeleccionadoObj, fechaSeleccionada]);

  // PACIENTE REGISTRADO: se confirma por cédula; solo se muestra el nombre parcialmente oculto
  async function verificarCedula() {
    const cedula = cedulaBusqueda.trim();
    setErrorMsg('');
    setPacienteVerificado(null);
    setCedulaNoEncontrada(false);
    if (!cedula) return;

    setVerificando(true);
    try {
      const r = await llamarApi<{ existe: boolean; nombre?: string }>('/api/agenda/paciente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula }),
      });
      if (r.existe) setPacienteVerificado({ cedula, nombre: r.nombre || '' });
      else setCedulaNoEncontrada(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo verificar la cédula.');
    }
    setVerificando(false);
  }

  function irANuevoPaciente() {
    setModoPaciente('nuevo');
    setErrorMsg('');
    setPacienteVerificado(null);
    setCedulaNoEncontrada(false);
    // Si ya escribió su cédula en la búsqueda, se aprovecha
    if (cedulaBusqueda.trim() && !cedulaPaciente) setCedulaPaciente(cedulaBusqueda.trim());
  }

  function irARegistrado() {
    setModoPaciente('registrado');
    setErrorMsg('');
    if (cedulaPaciente.trim() && !cedulaBusqueda) setCedulaBusqueda(cedulaPaciente.trim());
  }

  function limpiarPaciente() {
    setModoPaciente('registrado');
    setCedulaBusqueda('');
    setPacienteVerificado(null);
    setCedulaNoEncontrada(false);
    setNombrePaciente('');
    setCedulaPaciente('');
    setTelefonoPaciente('');
    setEmailPaciente('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    if (!medicoSeleccionadoObj) return setErrorMsg('Por favor selecciona un profesional médico.');
    if (!horaSeleccionada) return setErrorMsg('Por favor selecciona un horario disponible.');
    if (modoPaciente === 'registrado' && !pacienteVerificado) {
      return setErrorMsg('Busca tu cédula para confirmar que ya eres paciente, o elige "Soy Nuevo Paciente".');
    }

    const paciente = modoPaciente === 'registrado'
      ? { modo: 'registrado', cedula: pacienteVerificado!.cedula }
      : { modo: 'nuevo', cedula: cedulaPaciente, nombre: nombrePaciente, telefono: telefonoPaciente, email: emailPaciente };

    setLoading(true);
    try {
      const r = await llamarApi<Reserva>('/api/agenda/citas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicoId: medicoSeleccionadoObj.id,
          fecha: fechaSeleccionada,
          hora: horaSeleccionada,
          tipoConsulta,
          paciente,
        }),
      });
      setReserva(r);
    } catch (err) {
      const e2 = err as Error & { status?: number };
      setErrorMsg(e2.message || 'No se pudo agendar la cita.');
      // El turno se ocupó mientras llenaba el formulario: refrescar horarios
      if (e2.status === 409 && medicoSeleccionadoObj) {
        setHoraSeleccionada('');
        cargarHorarios(medicoSeleccionadoObj.id, fechaSeleccionada);
      }
    }
    setLoading(false);
  }

  if (reserva) {
    const { cita, medico, correo } = reserva;
    const [a, m, d] = cita.fecha.split('-').map(Number);
    const fechaLegible = new Date(a, m - 1, d).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const mensajeCorreo = textoCorreo(correo);

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center border border-slate-100">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Cita Agendada con Éxito!</h2>
          <p className="text-sm text-slate-600 mb-4">
            Registrada para el <strong className="capitalize">{fechaLegible}</strong> a las <strong>{cita.hora} hs</strong> con el Dr(a).{' '}
            <strong>{medico.nombre}</strong> ({medico.especialidad}).
            {mensajeCorreo && (
              <span className={`block mt-1 text-xs ${correo.enviado ? 'text-blue-600' : 'text-amber-700'}`}>{mensajeCorreo}</span>
            )}
          </p>

          {cita.tipoConsulta === 'presencial' ? (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-2">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide border-b pb-1">📍 Detalle del Consultorio:</p>
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Dirección de Atención:</span>
                <p className="text-xs text-slate-800 font-bold">{medico.direccion || DIRECCION_DEFECTO}</p>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Piso y N° Consultorio:</span>
                <p className="text-xs text-blue-700 font-extrabold">🏢 {medico.consultorio || CONSULTORIO_DEFECTO}</p>
              </div>
            </div>
          ) : cita.enlace && (
            <div className="mb-6 p-4 bg-purple-50 rounded-xl border border-purple-100 text-left">
              <p className="text-xs font-bold text-purple-900 mb-1">💻 Enlace de Telemedicina:</p>
              <p className="text-xs text-purple-700 break-all mb-3">{cita.enlace}</p>
              <a
                href={cita.enlace}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2.5 px-4 rounded-lg transition shadow"
              >
                🎥 Unirse a la Sala Jitsi
              </a>
            </div>
          )}

          <button
            onClick={() => {
              setReserva(null);
              setHoraSeleccionada('');
              limpiarPaciente();
              if (medicoSeleccionadoObj && fechaSeleccionada) cargarHorarios(medicoSeleccionadoObj.id, fechaSeleccionada);
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl transition text-sm shadow"
          >
            Agendar otra cita
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-3xl">🩺</span>
            <span className="text-xl font-bold text-slate-800">
              AgendaMédica <span className="text-blue-600">EC</span>
            </span>
          </Link>
          <Link href="/consultar" className="text-sm font-semibold text-blue-600 hover:underline">
            🔎 Consultar mis Citas
          </Link>
        </div>
      </header>

      <main className="flex-1 py-10 px-6 max-w-2xl mx-auto w-full">
        <div className="bg-white rounded-2xl shadow-md p-8 border border-slate-100">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">🗓️ Reserva tu Cita Médica</h1>
          <p className="text-xs text-slate-500 mb-6">
            {medicoFijo ? 'Selecciona el horario de tu preferencia.' : 'Busca al profesional y selecciona el horario de tu preferencia.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* MÉDICO */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                {medicoFijo ? '1. Profesional:' : '1. Selecciona o busca al Médico / Especialidad:'}
              </label>

              {medicoFijo ? (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="font-bold text-slate-800 text-sm">{medicoSeleccionadoObj?.nombre}</p>
                  <p className="text-xs text-blue-700 font-semibold">{medicoSeleccionadoObj?.especialidad}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    📍 {medicoSeleccionadoObj?.direccion || DIRECCION_DEFECTO} | 🏢 <strong>{medicoSeleccionadoObj?.consultorio || CONSULTORIO_DEFECTO}</strong>
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🔍 Escribe un nombre o especialidad (ej. Pediatría, Dr. Juan)..."
                    value={busquedaMedico}
                    onChange={(e) => handleBuscarMedico(e.target.value)}
                    onFocus={() => { if (busquedaMedico.trim() !== '') setMostrarDropdown(true); }}
                    className="w-full p-3 border rounded-xl text-slate-800 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />

                  {mostrarDropdown && busquedaMedico.trim() !== '' && medicosFiltrados.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl mt-1 max-h-60 overflow-y-auto z-50">
                      {medicosFiltrados.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => seleccionarMedico(m)}
                          className="w-full text-left p-3 hover:bg-blue-50 border-b border-slate-100 last:border-0 transition flex flex-col"
                        >
                          <span className="font-bold text-slate-800 text-sm">{m.nombre}</span>
                          <span className="text-xs text-blue-600 font-medium">{m.especialidad}</span>
                          <span className="text-[11px] text-slate-500 mt-0.5">
                            📍 {m.direccion || 'Guayaquil'} | 🏢 {m.consultorio || 'Consultorio N/A'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {medicoSeleccionadoObj && (
                    <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <span className="text-slate-400 font-semibold uppercase text-[10px] block">Lugar de Atención Presencial:</span>
                      <p className="font-bold text-slate-800 text-xs">{medicoSeleccionadoObj.direccion || DIRECCION_DEFECTO}</p>
                      <p className="text-blue-700 font-extrabold mt-0.5">🏢 {medicoSeleccionadoObj.consultorio || CONSULTORIO_DEFECTO}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* FECHA (no se permiten fechas pasadas) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">2. Selecciona la Fecha:</label>
              <input
                type="date"
                value={fechaSeleccionada}
                min={hoy}
                onChange={(e) => {
                  setFechaSeleccionada(e.target.value);
                  setHoraSeleccionada('');
                }}
                className="w-full p-3 border rounded-xl text-slate-800 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
              {fechaSeleccionada && fechaSeleccionada < hoy && (
                <p className="text-xs text-rose-600 font-semibold mt-1">No se puede agendar en una fecha pasada.</p>
              )}
            </div>

            {/* HORARIOS DISPONIBLES */}
            {fechaSeleccionada && fechaSeleccionada >= hoy && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">3. Horarios Disponibles:</label>
                {cargandoHorarios ? (
                  <p className="text-xs text-slate-500 p-3">Buscando horarios...</p>
                ) : horariosDisponibles.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                    No hay turnos disponibles para esta fecha. Intenta con otro día.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {horariosDisponibles.map((hora) => (
                      <button
                        key={hora}
                        type="button"
                        onClick={() => setHoraSeleccionada(hora)}
                        className={`p-2.5 text-xs font-bold rounded-xl border transition ${
                          horaSeleccionada === hora
                            ? 'bg-blue-600 text-white border-blue-600 shadow'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
                        }`}
                      >
                        {hora} hs
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* DATOS DEL PACIENTE */}
            <div className="border-t pt-6 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase">4. Datos del Paciente:</h3>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Modalidad de Atención</label>
                <select
                  value={tipoConsulta}
                  onChange={(e) => setTipoConsulta(e.target.value as 'presencial' | 'telemedicina')}
                  className="w-full p-3 border rounded-xl text-slate-800 text-sm font-semibold"
                >
                  <option value="presencial">🏥 Consulta Presencial en Consultorio</option>
                  <option value="telemedicina">💻 Videoconsulta / Telemedicina</option>
                </select>
              </div>

              {modoPaciente === 'registrado' ? (
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-600">¿Ya eres paciente? Ingresa tu número de cédula</label>

                  {pacienteVerificado ? (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
                      <div className="text-xs">
                        <p className="font-bold text-emerald-800">✅ Paciente encontrado: {pacienteVerificado.nombre}</p>
                        <p className="text-emerald-700">🪪 Cédula {enmascararCedula(pacienteVerificado.cedula)}</p>
                      </div>
                      <button type="button" onClick={limpiarPaciente} className="text-xs text-rose-600 font-bold hover:underline whitespace-nowrap">
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="🔍 Ej. 0912345678"
                        value={cedulaBusqueda}
                        maxLength={15}
                        onChange={(e) => {
                          setCedulaBusqueda(e.target.value.trim());
                          setCedulaNoEncontrada(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            verificarCedula();
                          }
                        }}
                        className="flex-1 p-3 border rounded-xl text-xs text-slate-800 font-semibold bg-white"
                      />
                      <button
                        type="button"
                        onClick={verificarCedula}
                        disabled={verificando || !cedulaBusqueda.trim()}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold px-4 rounded-xl transition"
                      >
                        {verificando ? 'Buscando...' : 'Buscar'}
                      </button>
                    </div>
                  )}

                  {cedulaNoEncontrada && (
                    <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                      No encontramos un paciente con esa cédula. Si es tu primera cita, regístrate como nuevo paciente.
                    </p>
                  )}

                  {!pacienteVerificado && (
                    <button
                      type="button"
                      onClick={irANuevoPaciente}
                      className="w-full border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 text-blue-700 text-xs font-bold py-3 rounded-xl transition"
                    >
                      🆕 Soy Nuevo Paciente
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-blue-700">🆕 Registro de Nuevo Paciente</span>
                    <button type="button" onClick={irARegistrado} className="text-xs text-slate-500 font-bold hover:underline">
                      ← Ya soy paciente
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Nombre Completo</label>
                      <input
                        type="text"
                        placeholder="Ej. María López"
                        value={nombrePaciente}
                        onChange={(e) => setNombrePaciente(e.target.value)}
                        className="w-full p-2.5 border rounded-xl text-xs text-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Cédula de Identidad</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Ej. 0912345678"
                        value={cedulaPaciente}
                        maxLength={15}
                        onChange={(e) => setCedulaPaciente(e.target.value.trim())}
                        className="w-full p-2.5 border rounded-xl text-xs text-slate-800"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Teléfono / WhatsApp</label>
                      <input
                        type="tel"
                        placeholder="Ej. 0991234567"
                        value={telefonoPaciente}
                        onChange={(e) => setTelefonoPaciente(e.target.value)}
                        className="w-full p-2.5 border rounded-xl text-xs text-slate-800"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Correo Electrónico</label>
                      <input
                        type="email"
                        placeholder="ejemplo@correo.com"
                        value={emailPaciente}
                        onChange={(e) => setEmailPaciente(e.target.value)}
                        className="w-full p-2.5 border rounded-xl text-xs text-slate-800"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Te enviaremos aquí la confirmación de tu cita.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {errorMsg && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">{errorMsg}</div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold py-3 px-4 rounded-xl shadow transition text-sm"
            >
              {loading ? 'Procesando reserva...' : '✅ Confirmar y Reservar Cita'}
            </button>
          </form>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        © 2026 AgendaMédica EC — Guayaquil, Ecuador.
      </footer>
    </div>
  );
}

export default function AgendarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-medium">Cargando...</div>}>
      <AgendarContenido />
    </Suspense>
  );
}
