/**
 * The MetaMaskAuth class provides functionality for connecting, signing up, and logging in using MetaMask.
 */
import { ethers } from 'ethers';
import { log } from '../utils/logger';

// Extend the Window interface to include ethereum
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
  public readonly AUTH_DATA_TABLE: string;
  private static readonly TIMEOUT_MS = 5000;
  private static readonly MESSAGE_TO_SIGN = 'Access with shogun';

  /**
   * Initialize the MetaMask connector
   */
  constructor() {
    this.AUTH_DATA_TABLE = 'metamask_auth_data';
  }

  private validateAddress(address: string): void {
    if (!address || !ethers.isAddress(address)) {
      throw new Error("Invalid Ethereum address");
    }
  }

  private generateSecurePassword(signature: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(signature)).slice(2);
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
      log("Checking credentials for:", metamaskUsername);

      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const timestamp = Date.now();

      // Request message signature
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [MetaMask.MESSAGE_TO_SIGN, address],
      }) as string;

      // Verify the signature
      const recoveredAddress = ethers.verifyMessage(MetaMask.MESSAGE_TO_SIGN, signature);
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error("Signature verification failed");
      }

      return {
        username: metamaskUsername,
        password: this.generateSecurePassword(signature),
        nonce,
        timestamp,
        messageToSign: MetaMask.MESSAGE_TO_SIGN
      };
    } catch (error) {
      log("Error generating credentials:", error);
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
      log("Error logging in with MetaMask:", error);
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