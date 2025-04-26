export type Web3StashServices = "PINATA" | "IPFS-CLIENT";

export interface BaseConfig {
  pinataJwt?: string;
  pinataGateway?: string;
}

export interface PinataServiceConfig {
  pinataJwt: string;
  pinataGateway?: string;
}

export interface IpfsServiceConfig {
  url: string;
}

export interface StorageService {
  serviceBaseUrl: string;
  serviceInstance: any;
  get(hash: string): Promise<any>;
  uploadJson(jsonData: Record<string, unknown>, options?: any): Promise<UploadOutput>;
  uploadFile(path: string, options?: any): Promise<UploadOutput>;
  uploadImage(path: string, options?: any): Promise<UploadOutput>;
  uploadVideo(path: string, options?: any): Promise<UploadOutput>;
  unpin(hash: string): Promise<boolean>;
  getMetadata(hash: string): Promise<any>;
  isPinned(hash: string): Promise<boolean>;
}

export interface StorageServiceWithMetadata {
  get(hash: string): Promise<any>;
  uploadJson(jsonData: Record<string, unknown>, options?: any): Promise<UploadOutput>;
  uploadFile(fileData: any, options?: any): Promise<UploadOutput>;
  uploadImage(fileData: any, options?: any): Promise<UploadOutput>;
  unpin(hash: string): Promise<boolean>;
  getMetadata(hash: string): Promise<any>;
  isPinned(hash: string): Promise<boolean>;
}

export type Web3StashConfig = {
  service: Web3StashServices;
  config: PinataServiceConfig | IpfsServiceConfig;
};

export interface UploadOutput {
  id: string;
  url?: string;
  metadata?: Record<string, any>;
}

export interface UploadOptions {
  name?: string;
  type?: string;
  metadata?: Record<string, any>;
}

// Re-export per retrocompatibilità
export type { StorageService as BaseStorageService } from "./services/base-storage";
