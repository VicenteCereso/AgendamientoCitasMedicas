import { useSyncExternalStore } from 'react';
import { hoyEcuador } from '@/lib/agenda';

const sinSuscripcion = () => () => {};

// Fecha de hoy en Ecuador (YYYY-MM-DD) para componentes de cliente.
// Durante el prerender devuelve '' para no leer la hora en el build
// (Next con cacheComponents no lo permite); en el navegador devuelve la fecha real.
export function useHoyEcuador(): string {
  return useSyncExternalStore(sinSuscripcion, hoyEcuador, () => '');
}
