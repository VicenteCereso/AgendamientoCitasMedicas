'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Medico {
  id: string;
  nombre: string;
  especialidad: string;
  direccion?: string;
  consultorio?: string;
  rol?: string;
}

interface Disponibilidad {
  id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  duracion_cita_minutos: number;
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
  const [horaSeleccionada, setHoraSeleccionada] = useState<string>('');

  const [tipoConsulta, setTipoConsulta] = useState<'presencial' | 'telemedicina'>('presencial');
  const [nombrePaciente, setNombrePaciente] = useState<string>('');
  const [cedulaPaciente, setCedulaPaciente] = useState<string>('');
  const [telefonoPaciente, setTelefonoPaciente] = useState<string>('');
  const [emailPaciente, setEmailPaciente] = useState<string>('');
  const [metodoNotificacion, setMetodoNotificacion] = useState<'whatsapp' | 'email' | 'ambos'>('whatsapp');

  const [loading, setLoading] = useState<boolean>(false);
  const [exito, setExito] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    cargarMedicos();
  }, []);

  async function cargarMedicos() {
    const { data } = await supabase
      .from('medicos')
      .select('id, nombre, especialidad, direccion, consultorio, rol')
      .neq('rol', 'admin')
      .order('nombre', { ascending: true });

    if (data && data.length > 0) {
      setMedicos(data);
      setMedicosFiltrados(data);

      if (medicoIdParam) {
        const encontrado = data.find((m) => m.id === medicoIdParam);
        if (encontrado) {
          setMedicoSeleccionadoObj(encontrado);
          setBusquedaMedico(`${encontrado.nombre} — ${encontrado.especialidad}`);
          setMedicoFijo(true);
        } else {
          seleccionarMedicoInicial(data[0]);
        }
      } else {
        seleccionarMedicoInicial(data[0]);
      }
    }
  }

  function seleccionarMedicoInicial(med: Medico) {
    setMedicoSeleccionadoObj(med);
    setBusquedaMedico(`${med.nombre} — ${med.especialidad}`);
  }

  function handleBuscar(texto: string) {
    setBusquedaMedico(texto);
    setMostrarDropdown(true);

    const filtrados = medicos.filter(
      (m) =>
        m.nombre.toLowerCase().includes(texto.toLowerCase()) ||
        m.especialidad.toLowerCase().includes(texto.toLowerCase())
    );
    setMedicosFiltrados(filtrados);
  }

  function seleccionarMedico(med: Medico) {
    setMedicoSeleccionadoObj(med);
    setBusquedaMedico(`${med.nombre} — ${med.especialidad}`);
    setMostrarDropdown(false);
    setHoraSeleccionada('');
  }

  useEffect(() => {
    if (medicoSeleccionadoObj?.id && fechaSeleccionada) {
      generarHorariosDisponibles();
    } else {
      setHorariosDisponibles([]);
    }
  }, [medicoSeleccionadoObj, fechaSeleccionada]);

  async function generarHorariosDisponibles() {
    if (!medicoSeleccionadoObj) return;

    const dateObj = new Date(fechaSeleccionada + 'T00:00:00');
    const diaSemanaIndex = dateObj.getDay();

    const { data: disponibilidades } = await supabase
      .from('disponibilidad_medico')
      .select('*')
      .eq('medico_id', medicoSeleccionadoObj.id)
      .eq('dia_semana', diaSemanaIndex);

    if (!disponibilidades || disponibilidades.length === 0) {
      setHorariosDisponibles([]);
      return;
    }

    const { data: citasTomadas } = await supabase
      .from('citas')
      .select('fecha_hora')
      .eq('medico_id', medicoSeleccionadoObj.id)
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

    setHorariosDisponibles(listaHoras);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!medicoSeleccionadoObj) {
      alert('Por favor selecciona un profesional médico.');
      return;
    }
    if (!horaSeleccionada) {
      alert('Por favor selecciona un horario disponible.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    let pacienteId = '';
    const { data: pacienteExistente } = await supabase
      .from('pacientes')
      .select('id')
      .eq('cedula', cedulaPaciente.trim())
      .single();

    if (pacienteExistente) {
      pacienteId = pacienteExistente.id;
    } else {
      const { data: nuevoPaciente, error: errPac } = await supabase
        .from('pacientes')
        .insert([
          {
            nombre: nombrePaciente,
            cedula: cedulaPaciente.trim(),
            telefono: telefonoPaciente,
            email: emailPaciente,
          },
        ])
        .select('id')
        .single();

      if (errPac || !nuevoPaciente) {
        setErrorMsg('Error al registrar datos del paciente.');
        setLoading(false);
        return;
      }
      pacienteId = nuevoPaciente.id;
    }

    const fechaHoraISO = `${fechaSeleccionada}T${horaSeleccionada}:00`;
    let enlaceJitsi = null;

    if (tipoConsulta === 'telemedicina') {
      const salaUnica = `ConsultaMedica-${medicoSeleccionadoObj.id.substring(0, 5)}-${fechaSeleccionada}-${horaSeleccionada.replace(':', '')}`;
      enlaceJitsi = `https://meet.jit.si/${salaUnica}`;
    }

    const { error: errCita } = await supabase.from('citas').insert([
      {
        medico_id: medicoSeleccionadoObj.id,
        paciente_id: pacienteId,
        fecha_hora: fechaHoraISO,
        tipo_consulta: tipoConsulta,
        estado: 'pendiente',
        enlace_videollamada: enlaceJitsi,
      },
    ]);

    setLoading(false);

    if (errCita) {
      setErrorMsg('Error al agendar la cita: ' + errCita.message);
    } else {
      setExito(true);
    }
  }

  // PANTALLA DE ÉXITO DE AGENDAMIENTO CON DIRECCIÓN Y CONSULTORIO DETALLADOS
  if (exito) {
    const salaUnica = `ConsultaMedica-${medicoSeleccionadoObj?.id.substring(0, 5)}-${fechaSeleccionada}-${horaSeleccionada.replace(':', '')}`;
    const enlaceJitsi = `https://meet.jit.si/${salaUnica}`;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center border border-slate-100">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Cita Agendada con Éxito!</h2>
          <p className="text-sm text-slate-600 mb-4">
            Registrada para el día <strong>{fechaSeleccionada}</strong> a las <strong>{horaSeleccionada} hs</strong> con el Dr(a).{' '}
            <strong>{medicoSeleccionadoObj?.nombre}</strong> ({medicoSeleccionadoObj?.especialidad}).
          </p>

          {/* FICHA DE UBICACIÓN Y CONSULTORIO EN EL COMPROBANTE DE RESUMEN */}
          {tipoConsulta === 'presencial' ? (
            <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-2">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wide border-b pb-1">📍 Detalle del Consultorio:</p>
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Dirección de Atención:</span>
                <p className="text-xs text-slate-800 font-bold">{medicoSeleccionadoObj?.direccion || 'Av. San Jorge y Calle 10ma, Guayaquil'}</p>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 uppercase font-semibold block">Piso y N° Consultorio:</span>
                <p className="text-xs text-blue-700 font-extrabold">🏢 {medicoSeleccionadoObj?.consultorio || 'Piso 2, Consultorio 204'}</p>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-purple-50 rounded-xl border border-purple-100 text-left">
              <p className="text-xs font-bold text-purple-900 mb-1">💻 Enlace de Telemedicina:</p>
              <p className="text-xs text-purple-700 break-all mb-3">{enlaceJitsi}</p>
              <a
                href={enlaceJitsi}
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
              setExito(false);
              setHoraSeleccionada('');
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
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
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
          <p className="text-xs text-slate-500 mb-6">Busca al profesional y selecciona el horario de tu preferencia.</p>

          {errorMsg && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">{errorMsg}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* BUSCADOR DE MÉDICOS */}
            <div className="relative">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">1. Selecciona o busca al Médico / Especialidad:</label>
              
              {medicoFijo ? (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{medicoSeleccionadoObj?.nombre}</p>
                    <p className="text-xs text-blue-700 font-semibold">{medicoSeleccionadoObj?.especialidad}</p>
                    <p className="text-xs text-slate-600 mt-1">📍 {medicoSeleccionadoObj?.direccion} | 🏢 <strong>{medicoSeleccionadoObj?.consultorio}</strong></p>
                  </div>
                  <span className="text-xs font-bold bg-blue-200 text-blue-800 px-2.5 py-1 rounded-full">
                    Asignado
                  </span>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    placeholder="🔍 Escribe un nombre o especialidad (ej. Pediatría, Dr. Juan)..."
                    value={busquedaMedico}
                    onChange={(e) => handleBuscar(e.target.value)}
                    onFocus={() => setMostrarDropdown(true)}
                    className="w-full p-3 border rounded-xl text-slate-800 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />

                  {mostrarDropdown && medicosFiltrados.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border rounded-xl shadow-xl mt-1 max-h-60 overflow-y-auto z-50">
                      {medicosFiltrados.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => seleccionarMedico(m)}
                          className="w-full text-left p-3 hover:bg-blue-50 border-b border-slate-100 last:border-0 transition flex flex-col"
                        >
                          <span className="font-bold text-slate-800 text-sm">{m.nombre}</span>
                          <span className="text-xs text-blue-600 font-medium">{m.especialidad}</span>
                          <span className="text-[11px] text-slate-500 mt-0.5">📍 {m.direccion || 'Guayaquil'} | 🏢 {m.consultorio || 'Consultorio N/A'}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* VISTA PREVIA DE UBICACIÓN Y CONSULTORIO */}
                  {medicoSeleccionadoObj && (
                    <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 font-semibold uppercase text-[10px] block">Lugar de Atención Presencial:</span>
                        <p className="font-bold text-slate-800 text-xs">{medicoSeleccionadoObj.direccion || 'Av. San Jorge y Calle 10ma, Guayaquil'}</p>
                        <p className="text-blue-700 font-extrabold mt-0.5">🏢 {medicoSeleccionadoObj.consultorio || 'Piso 2, Consultorio 204'}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* FECHA */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">2. Selecciona la Fecha:</label>
              <input
                type="date"
                value={fechaSeleccionada}
                onChange={(e) => {
                  setFechaSeleccionada(e.target.value);
                  setHoraSeleccionada('');
                }}
                className="w-full p-3 border rounded-xl text-slate-800 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>

            {/* HORARIOS DISPONIBLES */}
            {fechaSeleccionada && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">3. Horarios Disponibles:</label>
                {horariosDisponibles.length === 0 ? (
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
                    placeholder="Ej. 0912345678"
                    value={cedulaPaciente}
                    onChange={(e) => cedulaPaciente.length <= 10 && setCedulaPaciente(e.target.value)}
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
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Correo Electrónico (Opcional)</label>
                  <input
                    type="email"
                    placeholder="ejemplo@correo.com"
                    value={emailPaciente}
                    onChange={(e) => setEmailPaciente(e.target.value)}
                    className="w-full p-2.5 border rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">¿Dónde deseas recibir el enlace/confirmación?</label>
                <select
                  value={metodoNotificacion}
                  onChange={(e) => setMetodoNotificacion(e.target.value as 'whatsapp' | 'email' | 'ambos')}
                  className="w-full p-2.5 border rounded-xl text-xs text-slate-800 font-medium"
                >
                  <option value="whatsapp">📱 WhatsApp</option>
                  <option value="email">✉️ Correo Electrónico</option>
                  <option value="ambos">📲 Ambos (WhatsApp + Correo)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-xl shadow transition text-sm"
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
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-medium">Cargando buscador...</div>}>
      <AgendarContenido />
    </Suspense>
  );
}