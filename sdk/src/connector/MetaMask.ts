/**
 * The MetaMaskAuth class provides functionality for connecting, signing up, and logging in using MetaMask.
 */
import { ethers } from 'ethers';
import GunDB from '../gun/gun';
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
}

class MetaMask {
  private gundb: GunDB;
  private hedgehog: any;
  private readonly AUTH_DATA_TABLE: string;

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

  /**
   * Signs up a new user with MetaMask.
   * @param {string} address - The Ethereum address of the user.
   * @returns {Promise<AuthResult>} A promise that resolves with an object containing registration status, username, and password.
   */
  async signUp(address: string): Promise<AuthResult> {
    try {
      if (!address) {
        throw new Error("Invalid MetaMask address");
      }

      // Check if the username is already in use
      // Dai log vediamo che il formato è metamask_0x8aa5f726
      const metamaskUsername = `metamask_${address.slice(0, 10)}`;
      console.log("Tentativo di registrazione con username:", metamaskUsername);
      
      const existingUser = await new Promise<any>((resolve) => {
        this.gundb.gun.get('Users').get(metamaskUsername).once((data: any) => {
          resolve(data);
        });
      });
      
      if (existingUser) {
        throw new Error("Account already registered with this MetaMask address");
      }

      // Generate a random nonce
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const timestamp = Date.now();

      // Create the message to sign
      const messageToSign = `Access with shogun`;

      // Request the signature of the message
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [messageToSign, address],
      }) as string;

      // Verify the signature
      const recoveredAddress = ethers.verifyMessage(messageToSign, signature);
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error("Signature verification failed");
      }

      const securePassword = ethers.keccak256(ethers.toUtf8Bytes(signature)).slice(2);

      // Register the account with Hedgehog
      await this.hedgehog.signUp(metamaskUsername, securePassword);

      // Save authentication data
      await this.gundb.writeToGun(this.AUTH_DATA_TABLE, address, {
        nonce,
        timestamp,
        messageToSign,
        username: metamaskUsername,
        address: address.toLowerCase()
      });

      return {
        success: true,
        username: metamaskUsername,
        password: securePassword
      };
    } catch (error: unknown) {
      console.error("Error registering with MetaMask:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error during registration"
      };
    }
  }

  /**
   * Logs in a user with MetaMask.
   * @param {string} address - The Ethereum address of the user.
   * @returns {Promise<AuthResult>} A promise that resolves with an object containing login status, username, and password.
   */
  async login(address: string): Promise<AuthResult> {
    try {
      if (!address) {
        throw new Error("Invalid MetaMask address");
      }

      // Definisci l'username che dovrebbe essere usato
      // Dai log vediamo che il formato è metamask_0x8aa5f726
      const metamaskUsername = `metamask_${address.slice(0, 10)}`;
      console.log("Tentativo di login con username:", metamaskUsername);
      
      // Verifica se l'utente esiste in Gun
      const userExists = await new Promise<boolean>((resolve) => {
        this.gundb.gun.get('Users').get(metamaskUsername).once((data: any) => {
          resolve(!!data);
        });
      });
      
      // Verifica se l'utente esiste in Hedgehog
      let hedgehogUserExists = false;
      try {
        // Verifichiamo se esiste il documento in Hedgehog
        const lookupKey = ethers.keccak256(ethers.toUtf8Bytes(metamaskUsername));
        const existingDoc = await this.gundb.gun.get(this.AUTH_DATA_TABLE).get(address).once();
        hedgehogUserExists = !!existingDoc;
      } catch (error) {
        console.log("Errore nella verifica dell'utente Hedgehog:", error);
      }
      
      if (!userExists && !hedgehogUserExists) {
        console.log("Utente non trovato:", metamaskUsername);
        return {
          success: false,
          error: "Account not registered. Please register first."
        };
      }
      
      // Create the message to sign
      const messageToSign = `Access with shogun`;

      // Request the signature of the message
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [messageToSign, address],
      }) as string;

      // Verify the signature
      const recoveredAddress = ethers.verifyMessage(messageToSign, signature);
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error("Signature verification failed");
      }

      const securePassword = ethers.keccak256(ethers.toUtf8Bytes(signature)).slice(2);

      // Se l'utente esiste in Hedgehog ma non in Gun, dobbiamo crearlo in Gun
      if (hedgehogUserExists && !userExists) {
        console.log("Utente esistente in Hedgehog ma non in Gun, creazione utente Gun...");
        try {
          // Effettuiamo un logout prima di creare l'utente
          this.gundb.gun.user().leave();
          
          // Creiamo l'utente Gun
          await this.gundb.createGunUser(metamaskUsername, securePassword);
          console.log("Utente Gun creato con successo");
        } catch (gunError) {
          if (gunError instanceof Error && gunError.message.includes("User already created")) {
            console.log("Utente Gun già esistente");
          } else {
            console.error("Errore nella creazione dell'utente Gun:", gunError);
            throw gunError;
          }
        }
      }

      return {
        success: true,
        username: metamaskUsername,
        password: securePassword
      };
    } catch (error: unknown) {
      console.error("Error logging in with MetaMask:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Error during login"
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
export default MetaMask;