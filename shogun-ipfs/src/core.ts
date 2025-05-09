import { FileBackupAdapter } from "./adapters/fileBackupAdapter";
import type { ShogunIpfsConfig } from "./types/core";
import type { BackupOptions, BackupResult } from "./types/backup";
import type { VersionInfo, VersionComparison, DetailedComparison } from "./versioning";
import { StorageService } from "./ipfs/services/base-storage";
import { PinataService } from "./ipfs/services/pinata";
import { IpfsService } from "./ipfs/services/ipfs-http-client";
import type { IpfsServiceConfig, PinataServiceConfig } from "./ipfs/types";
import { logger } from "./utils/logger";
import { backupCache } from "./utils/cache";
import path from "path";
import os from "os";
import fs from "fs";

/**
 * ShogunIpfs - Modern Decentralized Backup System
 * @class
 * @description
 * ShogunIpfs is a decentralized backup system.
 * It provides encrypted backup, versioning, and restore capabilities.
 *
 * @example
 * ```typescript
 * const ShogunIpfs = new ShogunIpfs({
 *   storage: {
 *     service: 'PINATA',
 *     config: {
 *       pinataJwt: 'your-jwt-token',
 *       pinataGateway: 'your-gateway'
 *     }
 *   },
 *   features: {
 *     encryption: {
 *       enabled: true,
 *       algorithm: 'aes-256-gcm'
 *     }
 *   }
 * });
 *
 * // Create a backup
 * const backup = await ShogunIpfs.backup('./data');
 *
 * // Restore from backup
 * await ShogunIpfs.restore(backup.hash, './restore');
 *
 * // Compare versions
 * const changes = await ShogunIpfs.compare(backup.hash, './data');
 *
 * // Delete a backup when no longer needed
 * const deleted = await ShogunIpfs.delete(backup.hash);
 * ```
 */
export class ShogunIpfs {
  private config: ShogunIpfsConfig;
  private fileBackup: FileBackupAdapter;
  private storage: StorageService;

  private createStorageService(config: ShogunIpfsConfig): StorageService {
    switch (config.storage.service) {
      case "PINATA": {
        const pinataConfig = config.storage.config as PinataServiceConfig;
        return new PinataService({
          pinataJwt: pinataConfig.pinataJwt,
          pinataGateway: pinataConfig.pinataGateway,
        });
      }
      case "IPFS-CLIENT": {
        const ipfsConfig = config.storage.config as IpfsServiceConfig;
        return new IpfsService({
          url: ipfsConfig.url,
        });
      }
      default:
        throw new Error(`Servizio di storage non supportato: ${config.storage.service}`);
    }
  }

  /**
   * Creates a new instance of ShogunIpfs
   * @param {ShogunIpfsConfig} config - Configuration object
   * @throws {Error} If the configuration is invalid
   */
  constructor(config: ShogunIpfsConfig) {
    // Definisco la configurazione di default completa
    const defaultConfig: Required<ShogunIpfsConfig> = {
      storage: config.storage, // Questo deve essere fornito dall'utente
      features: {
        encryption: {
          enabled: false,
          algorithm: "aes-256-gcm",
        },
        useIPFS: false,
      },
      paths: {
        backup: "./backup",
        restore: "./restore",
        storage: "./storage",
        logs: "./logs",
      },
      performance: {
        chunkSize: 1024 * 1024,
        maxConcurrent: 3,
        cacheEnabled: true,
        cacheSize: 100,
      },
    };

    // Merge della configurazione utente con i default
    this.config = {
      storage: config.storage,
      features: {
        encryption: {
          ...defaultConfig.features.encryption,
          ...(config.features?.encryption || {}),
        },
        useIPFS: config.features?.useIPFS ?? defaultConfig.features.useIPFS,
      },
      paths: {
        ...defaultConfig.paths,
        ...(config.paths || {}),
      },
      performance: {
        ...defaultConfig.performance,
        ...(config.performance || {}),
      },
    };

    this.storage = this.createStorageService(this.config);

    // Ora this.config.features.encryption è garantito avere tutti i campi necessari
    const encryptionConfig = this.config.features.encryption;
    this.fileBackup = new FileBackupAdapter(this.storage, {
      encryption: {
        enabled: encryptionConfig.enabled,
        algorithm: encryptionConfig.algorithm,
        key: "",
      },
    });

    logger.info("ShogunIpfs initialized", { config: this.config });
  }

  /**
   * Compare a local directory with an existing backup
   * @param {string} hash - Hash of the backup to compare
   * @param {string} sourcePath - Path of the local directory
   * @returns {Promise<VersionComparison>} Comparison result
   * @throws {Error} If comparison fails
   */
  public async compare(hash: string, sourcePath: string): Promise<VersionComparison> {
    const operationId = logger.startOperation("compare");
    try {
      const result = await this.fileBackup.compare(hash, sourcePath);
      logger.endOperation(operationId, "compare");
      return result;
    } catch (error) {
      logger.error("Compare failed", error as Error, { operationId });
      throw error;
    }
  }

  /**
   * Compare a local directory with an existing backup in detail
   * @param {string} hash - Hash of the backup to compare
   * @param {string} sourcePath - Path of the local directory
   * @returns {Promise<DetailedComparison>} Detailed comparison result
   * @throws {Error} If comparison fails
   */
  public async compareDetailed(hash: string, sourcePath: string): Promise<DetailedComparison> {
    const operationId = logger.startOperation("compareDetailed");
    try {
      const result = await this.fileBackup.compareDetailed(hash, sourcePath);
      logger.endOperation(operationId, "compareDetailed");
      return result;
    } catch (error) {
      logger.error("Detailed compare failed", error as Error, { operationId });
      throw error;
    }
  }

  /**
   * Delete an existing backup
   * @param {string} hash - Hash of the backup to delete
   * @returns {Promise<boolean>} true if deletion was successful
   * @throws {Error} If deletion fails
   */
  public async delete(hash: string): Promise<boolean> {
    const operationId = logger.startOperation("delete");
    try {
      const result = await this.fileBackup.delete(hash);
      logger.endOperation(operationId, "delete");
      return result;
    } catch (error) {
      logger.error("Delete failed", error as Error, { operationId });
      throw error;
    }
  }

  /**
   * Create a backup of a directory
   * @param {string} sourcePath - Path of the directory to backup
   * @param {BackupOptions} [options] - Backup options
   * @returns {Promise<BackupResult>} Backup result
   * @throws {Error} If backup fails
   */
  public async backup(sourcePath: string, options?: BackupOptions): Promise<BackupResult> {
    const operationId = logger.startOperation("backup");
    try {
      // Check cache
      const cacheKey = `${sourcePath}:${JSON.stringify(options)}`;
      const cached = await backupCache.get(cacheKey);
      if (cached) {
        logger.info("Using cached backup", { operationId });
        return cached;
      }

      const result = await this.fileBackup.backup(sourcePath, options);
      await backupCache.set(cacheKey, result);

      logger.endOperation(operationId, "backup");
      return result;
    } catch (error) {
      logger.error("Backup failed", error as Error, { operationId });
      throw error;
    }
  }

  /**
   * Restore a backup
   * @param {string} hash - Hash of the backup to restore
   * @param {string} targetPath - Path where to restore
   * @param {BackupOptions} [options] - Restore options
   * @returns {Promise<boolean>} true if restore was successful
   * @throws {Error} If restore fails
   */
  public async restore(hash: string, targetPath: string, options?: BackupOptions): Promise<boolean> {
    const operationId = logger.startOperation("restore");
    try {
      const result = await this.fileBackup.restore(hash, targetPath, options);
      logger.endOperation(operationId, "restore");
      return result;
    } catch (error) {
      logger.error("Restore failed", error as Error, { operationId });
      throw error;
    }
  }

  /**
   * Get the storage service instance
   * @returns {StorageService} The storage service instance
   */
  public getStorage(): StorageService {
    return this.storage;
  }

  /**
   * Upload JSON data directly to storage
   * @param {Record<string, unknown>} jsonData - The JSON data to upload
   * @param {any} options - Upload options
   * @returns {Promise<{ id: string; metadata: Record<string, unknown> }>} Upload result
   */
  public async uploadJson(jsonData: Record<string, unknown>, options?: any) {
    return this.storage.uploadJson(jsonData, options);
  }

  /**
   * Upload a buffer to storage
   * @param {Buffer} buffer - The buffer to upload
   * @param {any} options - Upload options
   * @returns {Promise<{ id: string; metadata: Record<string, unknown> }>} Upload result
   */
  public async uploadBuffer(buffer: Buffer, options?: any) {
    // Crea un file temporaneo
    const tempFilePath = path.join(os.tmpdir(), `temp_${Date.now()}`);
    fs.writeFileSync(tempFilePath, buffer);

    try {
      // Carica il file temporaneo
      const result = await this.storage.uploadFile(tempFilePath, options);
      return result;
    } finally {
      // Rimuovi il file temporaneo
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        /* ignora errori */
      }
    }
  }

  /**
   * Upload a file to storage
   * @param {string} filePath - The path to the file to upload
   * @param {any} options - Upload options
   * @returns {Promise<{ id: string; metadata: Record<string, unknown> }>} Upload result
   */
  public async uploadFile(filePath: string, options?: any) {
    return this.storage.uploadFile(filePath, options);
  }

  /**
   * Get data from storage by hash
   * @param {string} hash - The hash to retrieve
   * @returns {Promise<any>} The retrieved data
   */
  public async getData(hash: string) {
    return this.storage.get(hash);
  }

  /**
   * Get metadata from storage by hash
   * @param {string} hash - The hash to get metadata for
   * @returns {Promise<any>} The metadata
   */
  public async getMetadata(hash: string) {
    return this.storage.getMetadata(hash);
  }

  /**
   * Check if a hash is pinned in storage
   * @param {string} hash - The hash to check
   * @returns {Promise<boolean>} True if pinned, false otherwise
   */
  public async isPinned(hash: string): Promise<boolean> {
    return this.storage.isPinned(hash);
  }

  /**
   * Unpin a hash from storage
   * @param {string} hash - The hash to unpin
   * @returns {Promise<boolean>} - Returns true if the hash was unpinned, false otherwise
   */
  public async unpin(hash: string): Promise<boolean> {
    return this.storage.unpin(hash);
  }

  // Compatibility aliases
  public backupFiles = this.backup;
  public restoreFiles = this.restore;
}
