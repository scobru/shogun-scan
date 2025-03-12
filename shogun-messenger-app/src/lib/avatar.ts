import { createAvatar } from '@dicebear/core';
import { identicon } from '@dicebear/collection';
import { log, logError } from './logger';

const AVATAR_CACHE = new Map<string, string>();
const DEFAULT_STYLE = 'identicon';

export class AvatarService {
  /**
   * Genera un avatar per un utente
   * @param seed Stringa univoca per generare l'avatar
   * @returns URL dell'avatar
   */
  static async getAvatar(seed: string): Promise<string> {
    try {
      // Controlla la cache
      if (AVATAR_CACHE.has(seed)) {
        return AVATAR_CACHE.get(seed)!;
      }

      // Genera localmente l'avatar
      const avatar = createAvatar(identicon, {
        seed,
        size: 128,
        backgroundColor: ['b6e3f4','c0aede','d1d4f9','ffd5dc','ffdfbf']
      });

      // Converti in SVG
      const svg = await avatar.toDataUri();
      
      // Salva in cache
      AVATAR_CACHE.set(seed, svg);
      
      return svg;
    } catch (error) {
      logError('Errore nella generazione avatar:', error);
      
      // Fallback: genera un colore casuale come background
      const color = Math.floor(Math.random()*16777215).toString(16);
      const fallbackSvg = `
        <svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#${color}"/>
          <text x="50%" y="50%" text-anchor="middle" fill="white" font-size="40px">
            ${seed.substring(0,2).toUpperCase()}
          </text>
        </svg>
      `;
      
      const fallbackUrl = `data:image/svg+xml;base64,${btoa(fallbackSvg)}`;
      AVATAR_CACHE.set(seed, fallbackUrl);
      
      return fallbackUrl;
    }
  }

  /**
   * Pulisce la cache degli avatar
   */
  static clearCache(): void {
    AVATAR_CACHE.clear();
  }
} 