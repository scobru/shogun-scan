/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { StorageService } from "./base-storage";
import type { UploadOutput, IpfsServiceConfig } from "../types";
import { BackupData } from "../../types/core";
import { create as ipfsHttpClient } from "ipfs-http-client";
import fs from "fs";
import path from "path";

export class IpfsService extends StorageService {
  public serviceBaseUrl = "ipfs://";
  public readonly serviceInstance: any;

  constructor(config: IpfsServiceConfig) {
    super();
    if (!config.url) {
      throw new Error("URL IPFS richiesto");
    }
    this.serviceInstance = ipfsHttpClient({
      url: config.url,
    });
  }

  public async get(hash: string): Promise<BackupData> {
    const chunks = [];
    for await (const chunk of this.serviceInstance.cat(hash)) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks).toString();
    return JSON.parse(content);
  }

  public async uploadJson(jsonData: Record<string, unknown>): Promise<UploadOutput> {
    const content = JSON.stringify(jsonData);
    const result = await this.serviceInstance.add(content);
    return {
      id: result.path,
      metadata: {
        size: result.size,
        type: "json",
      },
    };
  }

  /**
   * Carica un file su IPFS
   * @param filePath - Percorso del file da caricare
   * @param options - Opzioni aggiuntive (nome, metadati, ecc.)
   * @returns UploadOutput con l'ID del file caricato e i metadati
   */
  public async uploadFile(filePath: string, options?: any): Promise<UploadOutput> {
    // Verifica che il file esista
    if (!fs.existsSync(filePath)) {
      throw new Error(`Il file non esiste: ${filePath}`);
    }

    // Leggi il file
    const fileContent = fs.readFileSync(filePath);
    const fileName = options?.name || path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;

    // Determina il tipo MIME
    const mimeType = options?.metadata?.type || this.getMimeType(filePath);

    // Carica il file su IPFS
    const result = await this.serviceInstance.add(fileContent, {
      pin: true,
      progress: (prog: number) => {
        if (options?.onProgress && typeof options.onProgress === "function") {
          options.onProgress(prog);
        }
      },
    });

    // Restituisci il risultato
    return {
      id: result.path,
      metadata: {
        size: fileSize,
        type: mimeType,
        name: fileName,
        ...options?.metadata,
      },
    };
  }

  /**
   * Determina il tipo MIME in base all'estensione del file
   * @param filePath - Percorso del file
   * @returns Il tipo MIME o application/octet-stream se non determinabile
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".pdf": "application/pdf",
      ".txt": "text/plain",
      ".json": "application/json",
      ".mp3": "audio/mpeg",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".zip": "application/zip",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    return mimeTypes[ext] || "application/octet-stream";
  }

  public async unpin(hash: string): Promise<boolean> {
    try {
      await this.serviceInstance.pin.rm(hash);
      return true;
    } catch {
      return false;
    }
  }

  public async getMetadata(hash: string): Promise<any> {
    const stat = await this.serviceInstance.files.stat(`/ipfs/${hash}`);
    return stat;
  }

  public async isPinned(hash: string): Promise<boolean> {
    try {
      const pins = await this.serviceInstance.pin.ls({ paths: [hash] });
      return pins.length > 0;
    } catch {
      return false;
    }
  }
}
