export const cacheSentinel: string;
export const manifiestoSentinel: string;
export function comprobarSentinel(): string;
export function verificarCache(directorio: string, manifiesto: string): string;
export function prepararCache(repositorio: string, directorio: string, manifiesto: string): string;
export function prepararSentinel(repositorio?: string): string;
export function copiarCacheVerificada(origen: string, destino: string, manifiesto: string): string;
