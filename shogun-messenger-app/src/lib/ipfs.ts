import { create } from 'ipfs-http-client';
import { log, logError } from './logger';

const IPFS_FALLBACK_GATEWAY = 'https://ipfs.io';
const IPFS_TIMEOUT = 30000;

export class IPFSClient {
  private client: any;
  private fallbackMode: boolean = false;

  constructor() {
    this.initializeClient();
  }

  private async initializeClient() {
    try {
      // Tenta di creare un client IPFS con nodi locali
      this.client = create({
        host: 'localhost',
        port: 5001,
        protocol: 'http',
        timeout: IPFS_TIMEOUT
      });
      
      // Verifica la connessione
      await this.client.version();
      log('Client IPFS inizializzato con nodo locale');
    } catch (error) {
      logError('Errore nella connessione al nodo IPFS locale, uso fallback:', error);
      this.fallbackMode = true;
      
      // Usa gateway pubblico come fallback
      this.client = create({
        url: IPFS_FALLBACK_GATEWAY + '/api/v0',
        timeout: IPFS_TIMEOUT
      });
    }
  }

  async add(data: any): Promise<string> {
    try {
      if (this.fallbackMode) {
        // In modalità fallback, usa il gateway pubblico
        const response = await fetch(IPFS_FALLBACK_GATEWAY + '/api/v0/add', {
          method: 'POST',
          body: data
        });
        const result = await response.json();
        return result.Hash;
      }

      // Usa il client IPFS normale
      const result = await this.client.add(data);
      return result.path;
    } catch (error) {
      logError('Errore nel caricamento su IPFS:', error);
      throw new Error('Impossibile caricare i dati su IPFS');
    }
  }

  async get(cid: string): Promise<any> {
    try {
      if (this.fallbackMode) {
        // In modalità fallback, usa il gateway pubblico
        const response = await fetch(`${IPFS_FALLBACK_GATEWAY}/ipfs/${cid}`);
        return await response.json();
      }

      // Usa il client IPFS normale
      const stream = this.client.cat(cid);
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      logError('Errore nel recupero da IPFS:', error);
      throw new Error('Impossibile recuperare i dati da IPFS');
    }
  }

  getGatewayURL(cid: string): string {
    return `${IPFS_FALLBACK_GATEWAY}/ipfs/${cid}`;
  }
} 