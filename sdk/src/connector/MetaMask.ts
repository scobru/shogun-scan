/**
 * The MetaMaskAuth class provides functionality for connecting, signing up, and logging in using MetaMask.
 */
import { ethers } from 'ethers';
import { GunDB } from '../gun/gun';
import { log } from '../index';

// Estendere l'interfaccia Window per includere ethereum
declare global {
  interface Window {
    ethereum?: any;
    MetaMask?: typeof MetaMask;
  }
}

declare global {
  namespace NodeJS {
    interface Global {
      MetaMask?: typeof MetaMask;
    }
  }
}

interface AuthData {
  nonce: string;
  timestamp: number;
  messageToSign: string;
  username: string;
  address: string;
}

interface ConnectionResult {
  success: boolean;
  address?: string;
  username?: string;
  randomPassword?: string;
  error?: string;
}

interface AuthResult {
  success: boolean;
  username?: string;
  password?: string;
  error?: string;
  nonce?: string;
  timestamp?: number;
  messageToSign?: string;
}

interface MetaMaskCredentials {
  username: string;
  password: string;
  nonce: string;
  timestamp: number;
  messageToSign: string;
}

class MetaMask {
  private gundb: GunDB;
  private hedgehog: any;
  public readonly AUTH_DATA_TABLE: string;
  private static readonly TIMEOUT_MS = 5000;
  private static readonly MESSAGE_TO_SIGN = 'Access with shogun';

  /**
   * Initializes the MetaMaskAuth instance.
   * @param {GunDB} gundb - The GunDB instance for data storage and retrieval.
   * @param {any} hedgehog - The Hedgehog instance for user registration.
   */
  constructor(gundb: GunDB, hedgehog: any) {
    this.gundb = gundb;
    this.hedgehog = hedgehog;
    this.AUTH_DATA_TABLE = "AuthData";
  }

  private validateAddress(address: string): void {
    if (!address || !ethers.isAddress(address)) {
      throw new Error("Indirizzo Ethereum non valido");
    }
  }

  private generateSecurePassword(signature: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(signature)).slice(2);
  }

  private async waitForGunResponse(query: any): Promise<any> {
    return Promise.race([
      new Promise((resolve) => query.once(resolve)),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout")), MetaMask.TIMEOUT_MS)
      )
    ]);
  }

  /**
   * Connects to MetaMask and retrieves the user's Ethereum address.
   * @returns {Promise<ConnectionResult>} A promise that resolves with an object containing connection status, address, username, and a random password.
   */
  async connectMetaMask(): Promise<ConnectionResult> {
    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed");
      }

      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      }) as string[];
      
      if (accounts.length === 0) {
        throw new Error("No MetaMask accounts available");
      }

      return {
        success: true,
        address: accounts[0],
        username: `metamask_${accounts[0].slice(0, 10)}`,
        randomPassword: Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
      };
    } catch (error: unknown) {
      console.error("Error connecting to MetaMask:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error during MetaMask connection"
      };
    }
  }

  async generateCredentials(address: string): Promise<MetaMaskCredentials> {
    try {
      this.validateAddress(address);

      const metamaskUsername = `metamask_${address.slice(0, 10)}`;
      log("Verifica credenziali per:", metamaskUsername);

      // Verifica esistenza utente
      const [gunUser, hedgehogUser] = await Promise.all([
        this.waitForGunResponse(this.gundb.gun.get('Users').get(metamaskUsername)),
        this.waitForGunResponse(this.gundb.gun.get(this.AUTH_DATA_TABLE).get(address))
      ]);

      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const timestamp = Date.now();

      // Richiedi la firma del messaggio
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [MetaMask.MESSAGE_TO_SIGN, address],
      }) as string;

      // Verifica la firma
      const recoveredAddress = ethers.verifyMessage(MetaMask.MESSAGE_TO_SIGN, signature);
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error("Verifica della firma fallita");
      }

      return {
        username: metamaskUsername,
        password: this.generateSecurePassword(signature),
        nonce,
        timestamp,
        messageToSign: MetaMask.MESSAGE_TO_SIGN
      };
    } catch (error) {
      log("Errore nella generazione delle credenziali:", error);
      throw error;
    }
  }

  async login(address: string): Promise<AuthResult> {
    try {
      const credentials = await this.generateCredentials(address);
      
      return {
        success: true,
        username: credentials.username,
        password: credentials.password
      };
    } catch (error) {
      log("Errore nel login con MetaMask:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore durante il login"
      };
    }
  }
}

if (typeof window !== 'undefined') {
  window.MetaMask = MetaMask;
} else if (typeof global !== 'undefined') {
  (global as any).MetaMask = MetaMask;
}


export { MetaMask };