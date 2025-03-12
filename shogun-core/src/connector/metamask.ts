/**
 * The MetaMaskAuth class provides functionality for connecting, signing up, and logging in using MetaMask.
 */
import { ethers } from "ethers";
import { log, logDebug, logError, logWarning } from "../utils/logger";
import CONFIG from "../config";

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

/**
 * Definizione delle interfacce con tipi standard
 */
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
}

// Definizione di EthereumProvider per TypeScript
interface EthereumProvider {
  request: (args: any) => Promise<any>;
  isMetaMask?: boolean;
}

/**
 * Classe per la connessione a MetaMask
 */
class MetaMask {
  public readonly AUTH_DATA_TABLE: string;
  private static readonly TIMEOUT_MS = 5000;

  /** Provider JSON-RPC personalizzato */
  private customProvider: ethers.JsonRpcProvider | null = null;

  /** Wallet per provider personalizzato */
  private customWallet: ethers.Wallet | null = null;

  /** Messaggio fisso per la firma */
  private MESSAGE_TO_SIGN = "I Love Shogun!";

  private MAX_RETRIES = 3;
  private RETRY_DELAY = 1000;

  constructor() {
    this.AUTH_DATA_TABLE =
      CONFIG.GUN_TABLES.AUTHENTICATIONS || "Authentications";
  }

  /**
   * Verifica che l'indirizzo sia valido
   * @param address Indirizzo da validare
   * @returns Indirizzo normalizzato 
   * @throws Error se l'indirizzo non è valido
   */
  private validateAddress(address: string | null | undefined): string {
    if (!address) {
      throw new Error("Indirizzo non fornito");
    }
    
    // Normalizza l'indirizzo
    const normalizedAddress = String(address).trim().toLowerCase();
    
    try {
      // Verifica se è un indirizzo valido con ethers
      if (!ethers.isAddress(normalizedAddress)) {
        throw new Error("Formato indirizzo non valido");
      }
      
      // Formatta l'indirizzo in modo corretto
      return ethers.getAddress(normalizedAddress);
    } catch (e) {
      throw new Error("Indirizzo Ethereum non valido");
    }
  }

  /**
   * Genera una password sicura dalla firma
   * @param signature Firma da cui generare la password
   * @returns Password generata
   */
  public generateSecurePassword(signature: string): string {
    if (!signature) {
      throw new Error("Firma non valida");
    }
    
    // hash the signature
    const hash = ethers.keccak256(ethers.toUtf8Bytes(signature));
    return hash.slice(2, 66);
  }

  /**
   * Connette a MetaMask
   * @returns Risultato della connessione
   */
  async connectMetaMask(): Promise<ConnectionResult> {
    try {
      // Verifichiamo se MetaMask è disponibile
      if (!MetaMask.isMetaMaskAvailable()) {
        return {
          success: false,
          error: "MetaMask non è disponibile. Installa l'estensione MetaMask.",
        };
      }

      const ethereum = window.ethereum as EthereumProvider;

      try {
        // Richiedi autorizzazione per accedere agli account
        const accounts = await ethereum.request({
          method: "eth_requestAccounts",
        });

        // Verifichiamo se ci sono account disponibili
        if (!accounts || accounts.length === 0) {
          return {
            success: false,
            error: "Nessun account trovato in MetaMask",
          };
        }
        
        // Valida e normalizza l'indirizzo
        const address = this.validateAddress(accounts[0]);
        const metamaskUsername = `mm_${address.toLowerCase()}`;

        return {
          success: true,
          address,
          username: metamaskUsername,
        };
      } catch (error: any) {
        logError("Errore nell'accesso a MetaMask:", error);
        return {
          success: false,
          error: error.message || "Errore durante la connessione a MetaMask",
        };
      }
    } catch (error: any) {
      logError("Errore generale in connectMetaMask:", error);
      return {
        success: false,
        error: error.message || "Errore sconosciuto durante la connessione a MetaMask",
      };
    }
  }

  /**
   * Checks if MetaMask is available in the browser
   * @returns true if MetaMask is available
   */
  public static isMetaMaskAvailable(): boolean {
    const ethereum = window.ethereum as EthereumProvider | undefined;
    return (
      typeof window !== "undefined" &&
      typeof ethereum !== "undefined" &&
      ethereum?.isMetaMask === true
    );
  }

  /**
   * Genera le credenziali per l'autenticazione con MetaMask
   */
  async generateCredentials(address: string): Promise<{ username: string; password: string }> {
    try {
      if (!address) {
        throw new Error("Indirizzo Ethereum richiesto");
      }

      log("Richiesta firma del messaggio: " + this.MESSAGE_TO_SIGN);

      let signature = null;
      let retries = 0;

      while (!signature && retries < this.MAX_RETRIES) {
        try {
          // Richiedi la firma con timeout
          signature = await this.requestSignatureWithTimeout(address, this.MESSAGE_TO_SIGN);
        } catch (error) {
          retries++;
          if (retries < this.MAX_RETRIES) {
            log(`Tentativo ${retries + 1} di ${this.MAX_RETRIES}...`);
            await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
          } else {
            throw error;
          }
        }
      }

      if (!signature) {
        throw new Error("Impossibile ottenere la firma dopo i tentativi");
      }

      log("Firma ottenuta, generazione password...");

      // Genera username e password deterministici
      const username = `mm_${address.toLowerCase()}`;
      const password = ethers.keccak256(
        ethers.toUtf8Bytes(`${signature}:${address.toLowerCase()}`)
      );

      return {
        username,
        password
      };
    } catch (error: any) {
      logError("Errore nella generazione delle credenziali MetaMask:", error);
      throw new Error(`Errore MetaMask: ${error.message}`);
    }
  }

  /**
   * Richiede la firma con timeout
   */
  private async requestSignatureWithTimeout(
    address: string,
    message: string,
    timeout: number = 30000
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Timeout nella richiesta della firma"));
      }, timeout);

      try {
        if (!window.ethereum) {
          throw new Error("MetaMask non trovato");
        }

        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        
        // Verifica che l'indirizzo corrisponda
        const signerAddress = await signer.getAddress();
        if (signerAddress.toLowerCase() !== address.toLowerCase()) {
          throw new Error("L'indirizzo del signer non corrisponde");
        }

        const signature = await signer.signMessage(message);
        clearTimeout(timeoutId);
        resolve(signature);
      } catch (error: any) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Verifica se MetaMask è disponibile
   */
  isAvailable(): boolean {
    return typeof window !== "undefined" && !!window.ethereum;
  }

  /**
   * Configure custom JSON-RPC provider
   * @param rpcUrl - RPC endpoint URL
   * @param privateKey - Wallet private key
   * @throws {Error} For invalid parameters
   */
  public setCustomProvider(rpcUrl: string, privateKey: string): void {
    if (!rpcUrl || typeof rpcUrl !== "string") {
      throw new Error("RPC URL non valido");
    }
    
    if (!privateKey || typeof privateKey !== "string") {
      throw new Error("Chiave privata non valida");
    }
    
    try {
      this.customProvider = new ethers.JsonRpcProvider(rpcUrl);
      this.customWallet = new ethers.Wallet(privateKey, this.customProvider);
      logDebug("Provider personalizzato configurato con successo");
    } catch (error: any) {
      throw new Error(
        `Errore nella configurazione del provider: ${error.message || "Errore sconosciuto"}`
      );
    }
  }

  /**
   * Get active signer instance
   * @returns Ethers.js Signer
   * @throws {Error} If no signer available
   */
  public async getSigner(): Promise<ethers.Signer> {
    try {
      if (this.customWallet) {
        return this.customWallet as ethers.Signer;
      }
      
      const signer = await this.getEthereumSigner();
      if (!signer) {
        throw new Error("Nessun signer Ethereum disponibile");
      }
      
      return signer;
    } catch (error: any) {
      throw new Error(
        `Impossibile ottenere il signer Ethereum: ${error.message || "Errore sconosciuto"}`
      );
    }
  }

  /**
   * Generate deterministic password from signature
   * @param signature - Cryptographic signature
   * @returns 64-character hex string
   * @throws {Error} For invalid signature
   */
  public async generatePassword(signature: string): Promise<string> {
    if (!signature) {
      throw new Error("Firma non valida");
    }
    
    const hash = ethers.keccak256(ethers.toUtf8Bytes(signature));
    return hash.slice(2, 66); // Rimuovi 0x e usa i primi 32 bytes
  }

  /**
   * Verify message signature
   * @param message - Original signed message
   * @param signature - Cryptographic signature
   * @returns Recovered Ethereum address
   * @throws {Error} For invalid inputs
   */
  public async verifySignature(
    message: string,
    signature: string
  ): Promise<string> {
    if (!message || !signature) {
      throw new Error("Messaggio o firma non validi");
    }
    
    try {
      return ethers.verifyMessage(message, signature);
    } catch (error) {
      throw new Error("Messaggio o firma non validi");
    }
  }

  /**
   * Get browser-based Ethereum signer
   * @returns Browser provider signer
   * @throws {Error} If MetaMask not detected
   */
  public async getEthereumSigner(): Promise<ethers.Signer> {
    if (!MetaMask.isMetaMaskAvailable()) {
      throw new Error(
        "Metamask non trovato. Installa Metamask per continuare."
      );
    }
    
    try {
      const ethereum = window.ethereum as EthereumProvider;
      await ethereum.request({
        method: "eth_requestAccounts",
      });

      const provider = new ethers.BrowserProvider(ethereum);
      return provider.getSigner();
    } catch (error: any) {
      throw new Error(
        `Errore nell'accesso a MetaMask: ${error.message || "Errore sconosciuto"}`
      );
    }
  }
}

if (typeof window !== "undefined") {
  window.MetaMask = MetaMask;
} else if (typeof global !== "undefined") {
  (global as any).MetaMask = MetaMask;
}

export { MetaMask };
