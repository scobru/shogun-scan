/**
 * Funzioni di utilità generiche
 */
import { IGunChainReference } from "../types/gun";

/**
 * Verifica se un oggetto è un'istanza di Gun
 */
export const isGunInstance = (gun: any): gun is IGunChainReference => {
  return !!gun?.user && !!gun?.constructor?.SEA;
};

/**
 * Verifica se l'applicazione è in esecuzione in un ambiente web
 */
export const isPlatformWeb = (): boolean => {
  return typeof window !== "undefined";
};

/**
 * Crea un timeout che risolve con un valore di passthrough
 */
export function delay<T = any>(ms: number, passthrough?: T): Promise<T> {
  return new Promise<T>((resolve) => {
    setTimeout(() => {
      resolve(passthrough as T);
    }, ms);
  });
}

/**
 * Crea un timeout che rifiuta con un errore
 */
export async function errorAfter<T = void>(
  ms: number,
  error: Error
): Promise<T> {
  return new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(error);
    }, ms);
  });
}
