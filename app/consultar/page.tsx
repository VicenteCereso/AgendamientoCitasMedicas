'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';

interface CitaPaciente {
  id: string;
  fecha_hora: string;
  estado: string;
  tipo_consulta: string;
  enlace_videollamada?: string;
  medicos: {
    nombre: string;
    especialidad: string;
    direccion?: string;
    consultorio?: string;
  };
}

export default function ConsultarPage() {
  const [cedula, setCedula] = useState<string>('');
  const [citas, setCitas] = useState<CitaPaciente[]>([]);
  const [buscado, setBuscado] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  async function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    if (!cedula.trim()) return;

    setLoading(true);
    setBuscado(true);

    const { data: paciente } = await supabase
      .from('pacientes')
      .select('id')
      .eq('cedula', cedula.trim())
      .single();

    if (!paciente) {
      setCitas([]);
      setLoading(false);
      return;
    }

    // Obtenemos la fecha y hora actual en formato ISO para el filtro
    const fechaHoraActual = new Date().toISOString();

    const { data: citasData } = await supabase
      .from('citas')
      .select(`
        id,
        fecha_hora,
        estado,
        tipo_consulta,
        enlace_videollamada,
        medicos ( nombre, especialidad, direccion, consultorio )
      `)
      .eq('paciente_id', paciente.id)
      .gte('fecha_hora', fechaHoraActual) // <--- FILTRA DESDE LA FECHA Y HORA ACTUAL EN ADELANTE
      .order('fecha_hora', { ascending: true }); // <--- ORDENA DE LA MÁS PRÓXIMA A LA MÁS LEJANA

    if (citasData) {
      setCitas(citasData as unknown as CitaPaciente[]);
    }
    setLoading(false);
  }

  async function cancelarCita(id: string) {
    if (!confirm('¿Estás seguro de que deseas cancelar esta cita?')) return;

    const { error } = await supabase
      .from('citas')
      .update({ estado: 'cancelada' })
      .eq('id', id);

    if (!error) {
      setCitas(citas.map((c) => (c.id === id ? { ...c, estado: 'cancelada' } : c)));
    } else {
      alert('Error al cancelar la cita: ' + error.message);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-3xl">🩺</span>
            <span className="text-xl font-bold text-slate-800">
              AgendaMédica <span className="text-blue-600">EC</span>
            </span>
          </Link>
          <Link href="/agendar" className="text-sm font-semibold text-blue-600 hover:underline">
            ➕ Agendar Nueva Cita
          </Link>
        </div>
      </header>

      <main className="flex-1 py-10 px-6 max-w-xl mx-auto w-full">
        <div className="bg-white rounded-2xl shadow-md p-8 border border-slate-100">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">🔎 Consultar Mis Citas</h1>
          <p className="text-xs text-slate-500 mb-6">Ingresa tu número de cédula para ver tus próximas citas registradas.</p>

          <form onSubmit={handleBuscar} className="flex gap-2 mb-8">
            <input
              type="text"
              placeholder="Número de Cédula (ej. 0912345678)"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              className="flex-1 p-3 border rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-5 rounded-xl shadow transition text-sm"
            >
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </form>

          {buscado && (
            <div>
              {citas.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center text-sm text-slate-500 border">
                  No se encontraron citas futuras asociadas al número de cédula ingresado.
                </div>
              ) : (
                <div className="space-y-4">
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
                        className={`p-4 border rounded-xl space-y-2 transition ${
                          c.estado === 'cancelada'
                            ? 'bg-red-50 border-red-200 opacity-60'
                            : 'bg-white border-slate-200 shadow-sm'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-slate-800 text-base">
                              Dr(a). {c.medicos?.nombre}
                            </h3>
                            <p className="text-xs text-blue-600 font-semibold">{c.medicos?.especialidad}</p>
                          </div>
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                              c.estado === 'confirmada'
                                ? 'bg-green-100 text-green-800'
                                : c.estado === 'cancelada'
                                ? 'bg-red-100 text-red-800'
                                : c.estado === 'atendida'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {c.estado}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600">
                          📅 <strong>{fechaFormatted}</strong> a las <strong>{horaFormatted} hs</strong>
                        </p>

                        {/* UBICACIÓN Y CONSULTORIO PARA EL PACIENTE */}
                        {c.tipo_consulta === 'presencial' ? (
                          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                            <span className="text-slate-400 font-semibold uppercase text-[10px] block">Lugar de Atención:</span>
                            <p className="font-bold text-slate-800">{c.medicos?.direccion || 'Av. San Jorge y Calle 10ma, Guayaquil'}</p>
                            <p className="text-blue-700 font-bold mt-0.5">🏢 {c.medicos?.consultorio || 'Piso 2, Consultorio 204'}</p>
                          </div>
                        ) : (
                          c.enlace_videollamada && (
                            <div className="pt-2 border-t border-slate-100">
                              <a
                                href={c.enlace_videollamada}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-1.5 px-3 rounded-md transition shadow"
                              >
                                🎥 Entrar a Videoconsulta (Jitsi)
                              </a>
                            </div>
                          )
                        )}

                        {c.estado !== 'cancelada' && c.estado !== 'atendida' && (
                          <div className="pt-2 flex justify-end">
                            <button
                              onClick={() => cancelarCita(c.id)}
                              className="text-xs text-red-600 hover:text-red-800 font-semibold underline"
                            >
                              Cancelar esta Cita
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        © 2026 AgendaMédica EC — Guayaquil, Ecuador.
      </footer>
    </div>
  );
}