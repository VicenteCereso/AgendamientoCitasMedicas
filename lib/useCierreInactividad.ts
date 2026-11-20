'use client';

import { useEffect, useRef } from 'react';

// Minutos sin actividad (mouse, teclado, toques, scroll) antes de cerrar la sesión.
export const MINUTOS_INACTIVIDAD = 30;

const EVENTOS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'] as const;

// Llama a `alExpirar` cuando pasan MINUTOS_INACTIVIDAD sin actividad del usuario.
// Usa la hora real (no solo un temporizador) para que también funcione si el equipo
// estuvo suspendido o la pestaña en segundo plano.
export function useCierreInactividad(activo: boolean, alExpirar: () => void) {
  // Ref para no reiniciar el contador cada vez que el componente se vuelve a renderizar.
  const alExpirarRef = useRef(alExpirar);
  useEffect(() => {
    alExpirarRef.current = alExpirar;
  }, [alExpirar]);

  useEffect(() => {
    if (!activo) return;

    const limiteMs = MINUTOS_INACTIVIDAD * 60 * 1000;
    let ultimaActividad = Date.now();
    let expirado = false;

    const registrarActividad = () => {
      ultimaActividad = Date.now();
    };

    const revisar = () => {
      if (expirado) return;
      if (Date.now() - ultimaActividad >= limiteMs) {
        expirado = true;
        alExpirarRef.current();
      }
    };

    EVENTOS.forEach((ev) => window.addEventListener(ev, registrarActividad, { passive: true }));
    document.addEventListener('visibilitychange', revisar);
    const intervalo = window.setInterval(revisar, 30 * 1000);

    return () => {
      EVENTOS.forEach((ev) => window.removeEventListener(ev, registrarActividad));
      document.removeEventListener('visibilitychange', revisar);
      window.clearInterval(intervalo);
    };
  }, [activo]);
}
