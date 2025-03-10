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
 * Risultato della connessione a MetaMask
 */
interface ConnectionResult {
  success: boolean;
  address?: string;
  username?: string;
  randomPassword?: string;
  error?: string;
}

/**
 * Risultato dell'autenticazione
 */
interface AuthResult {
  success: boolean;
  username?: string;
  password?: string;
  error?: string;
  nonce?: string;
  timestamp?: number;
  messageToSign?: string;
}

/**
 * Credenziali MetaMask
 */
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

  constructor() {
    this.AUTH_DATA_TABLE =
      CONFIG.GUN_TABLES.AUTHENTICATIONS || "Authentications";
  }

  /**
   * Verifica che l'indirizzo sia valido
   * @param address Indirizzo da validare
   * @throws Error se l'indirizzo non è valido
   */
  private validateAddress(address: string): void {
    // Normalizza l'indirizzo: assicurati che sia una stringa, rimuovi spazi, converti a minuscolo
    let normalizedAddress = String(address || "").trim().toLowerCase();
    
    // Aggiungi il prefisso 0x se mancante
    if (!normalizedAddress.startsWith("0x")) {
      normalizedAddress = "0x" + normalizedAddress;
    }
    
    // Verifica lunghezza e formato
    if (!normalizedAddress || normalizedAddress.length !== 42) {
      // Prova a verificare se è un indirizzo valido con ethers
      try {
        const isValid = ethers.isAddress(normalizedAddress);
        if (!isValid) {
          throw new Error("Indirizzo Ethereum non valido");
        }
      } catch (e) {
        throw new Error("Indirizzo Ethereum non valido");
      }
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

        if (!accounts || accounts.length === 0) {
          return {
            success: false,
            error: "Nessun account trovato in MetaMask",
          };
        }

        const address = accounts[0];
        this.validateAddress(address);

        // Normalizza l'indirizzo
        const metamaskUsername = address.toLowerCase();

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
        error:
          error.message ||
          "Errore sconosciuto durante la connessione a MetaMask",
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
   * Genera credenziali di autenticazione per un indirizzo Ethereum
   * @param address - Indirizzo Ethereum
   * @returns Credenziali generate
   * @throws {Error} Se il processo di firma fallisce
   */
  public async generateCredentials(
    address: string
  ): Promise<MetaMaskCredentials> {
    try {
      this.validateAddress(address);

      // Il messaggio da firmare dovrebbe includere l'indirizzo per sicurezza
      const messageToSign = this.MESSAGE_TO_SIGN;

      log(`Richiesta firma per autenticazione: ${address}`);

      // Ottieni il provider Ethereum
      if (!MetaMask.isMetaMaskAvailable()) {
        throw new Error("MetaMask non disponibile");
      }

      const ethereum = window.ethereum as EthereumProvider;
      const accounts = await ethereum.request({
        method: "eth_requestAccounts",
      });

      if (
        !accounts ||
        accounts.length === 0 ||
        accounts[0].toLowerCase() !== address.toLowerCase()
      ) {
        throw new Error(
          "L'account selezionato non corrisponde all'indirizzo fornito"
        );
      }

      // Richiedi la firma del messaggio
      log(`Richiesta firma del messaggio: "${messageToSign}"`);
      const signature = await ethereum.request({
        method: "personal_sign",
        params: [messageToSign, address],
      });

      if (!signature) {
        throw new Error("Firma non ottenuta");
      }

      log("Firma ottenuta, generazione password...");

      // Genera la password usando il metodo dedicato
      const password = await this.generatePassword(signature);

      // Crea il nome utente deterministico
      const username = address.toLowerCase();

      return {
        username,
        password
      };
    } catch (error: any) {
      logError("Errore nella generazione delle credenziali:", error);
      throw new Error(
        `Errore nella generazione delle credenziali: ${error.message || "Errore sconosciuto"}`
      );
    }
  }

  /**
   * Configure custom JSON-RPC provider
   * @param rpcUrl - RPC endpoint URL
   * @param privateKey - Wallet private key
   * @throws {Error} For invalid parameters
   */
  public setCustomProvider(rpcUrl: string, privateKey: string): void {
    try {
      if (!rpcUrl || typeof rpcUrl !== "string") {
        throw new Error("RPC URL non valido");
      }
      if (!privateKey || typeof privateKey !== "string") {
        throw new Error("Chiave privata non valida");
      }

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
        return this.customWallet;
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
    try {
      if (!message || !signature) {
        throw new Error("Messaggio o firma non validi");
      }
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
