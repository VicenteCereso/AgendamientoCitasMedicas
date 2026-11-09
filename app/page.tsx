'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LandingPage() {
  const [anioActual, setAnioActual] = useState<number>(2026);

  useEffect(() => {
    setAnioActual(new Date().getFullYear());
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col justify-between text-slate-800">
      
      {/* 1. HEADER / NAVEGACIÓN */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="bg-blue-600 text-white p-2 rounded-xl shadow-md">
              <span className="text-xl">🩺</span>
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              AgendaMédica <span className="text-blue-600">EC</span>
            </span>
          </div>

          <nav className="flex items-center gap-4">
            <Link
              href="/consultar"
              className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition hidden sm:inline-block"
            >
              🔎 Consultar Cita
            </Link>
            <Link
              href="/agendar"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm transition"
            >
              Agendar Cita
            </Link>
            <Link
              href="/medico"
              className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold py-2.5 px-4 rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <span>🔐</span>
              <span className="hidden md:inline">Acceso Médico</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-16 text-center">
        <div className="inline-block bg-blue-50 text-blue-700 font-bold text-xs uppercase tracking-wider px-3.5 py-1.5 rounded-full mb-6 border border-blue-100">
          Consultores Médicos Independientes — Guayaquil, Ecuador
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          Reserva tu Cita Médica <br />
          <span className="text-blue-600">en Segundos y Sin Filas</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          Selecciona a tu profesional de salud de confianza, elige el horario disponible que mejor se adapte a tu día y confirma tu consulta presencial o por telemedicina al instante.
        </p>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-20">
          <Link
            href="/agendar"
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-blue-600/20 transition text-base flex items-center justify-center gap-2"
          >
            <span>📅</span>
            <span>Reservar Cita Ahora</span>
          </Link>
          <Link
            href="/consultar"
            className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold py-4 px-8 rounded-2xl transition text-base shadow-sm"
          >
            Consultar o Cancelar Cita
          </Link>
        </div>

        {/* 3. CARACTERÍSTICAS / TARJETAS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-xl font-bold mb-4">
              ⚡
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Disponibilidad en Tiempo Real</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Visualiza los turnos libres actualizados al instante sin llamadas telefónicas ni esperas.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-xl font-bold mb-4">
              💻
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Telemedicina Integrada</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Videoconsultas seguras generadas automáticamente mediante salas Jitsi Meet para citas virtuales.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition">
            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center text-xl font-bold mb-4">
              🏥
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Presencial y Virtual</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Escoge la modalidad de atención que prefieras con especialistas independientes en Guayaquil.
            </p>
          </div>
        </div>
      </main>

      {/* 4. FOOTER */}
      <footer className="bg-white border-t border-slate-100 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {anioActual} AgendaMédica EC — Guayaquil, Ecuador.</p>
          <Link href="/medico" className="text-slate-400 hover:text-slate-700 transition font-medium">
            🔒 Acceso Exclusivo para Personal Médico y Administradores
          </Link>
        </div>
      </footer>

    </div>
  );
}