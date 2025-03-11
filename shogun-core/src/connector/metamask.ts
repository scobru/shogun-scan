/**
 * The MetaMaskAuth class provides functionality for connecting, signing up, and logging in using MetaMask.
 */
import { ethers } from "ethers";
import { log, logDebug, logError, logWarning } from "../utils/logger";
import CONFIG from "../config";
import { record, pipe, match } from "ts-minimal";

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
 * Definizione degli schemi con record per validazione tipo concisa
 */
const ConnectionResultSchema = record<{
  success: boolean;
  address?: string;
  username?: string;
  randomPassword?: string;
  error?: string;
}>({
  success: Boolean,
  address: String,
  username: String,
  randomPassword: String,
  error: String
});

type ConnectionResult = Parameters<typeof ConnectionResultSchema>[0];

const AuthResultSchema = record<{
  success: boolean;
  username?: string;
  password?: string;
  error?: string;
  nonce?: string;
  timestamp?: number;
  messageToSign?: string;
}>({
  success: Boolean,
  username: String,
  password: String,
  error: String,
  nonce: String,
  timestamp: Number,
  messageToSign: String
});

type AuthResult = Parameters<typeof AuthResultSchema>[0];

const MetaMaskCredentialsSchema = record<{
  username: string;
  password: string;
}>({
  username: String,
  password: String
});

type MetaMaskCredentials = Parameters<typeof MetaMaskCredentialsSchema>[0];

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
   * @returns Indirizzo normalizzato 
   * @throws Error se l'indirizzo non è valido
   */
  private validateAddress(address: string | null | undefined): string {
    // Utilizziamo match per gestire la validazione dell'indirizzo
    return pipe(
      address,
      (addr) => match(addr, {
        when: (a) => !a,
        then: () => {
          throw new Error("Indirizzo non fornito");
        },
        otherwise: (a) => {
          // Normalizza l'indirizzo
          const normalizedAddress = String(a).trim().toLowerCase();
          
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
      })
    );
  }

  /**
   * Genera una password sicura dalla firma
   * @param signature Firma da cui generare la password
   * @returns Password generata
   */
  public generateSecurePassword(signature: string): string {
    return match(signature, {
      when: (s) => !s,
      then: () => {
        throw new Error("Firma non valida");
      },
      otherwise: (s) => {
        // hash the signature
        const hash = ethers.keccak256(ethers.toUtf8Bytes(s));
        return hash.slice(2, 66);
      }
    });
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
        return match(accounts, {
          when: (accs) => !accs || accs.length === 0,
          then: () => ({
            success: false,
            error: "Nessun account trovato in MetaMask",
          }),
          otherwise: (accs) => {
            // Valida e normalizza l'indirizzo
            const address = this.validateAddress(accs[0]);
            const metamaskUsername = `mm_${address.toLowerCase()}`;

            return {
              success: true,
              address,
              username: metamaskUsername,
            };
          }
        });
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
   * Genera credenziali di autenticazione per un indirizzo Ethereum
   * @param address - Indirizzo Ethereum
   * @returns Credenziali generate
   * @throws {Error} Se il processo di firma fallisce
   */
  public async generateCredentials(
    address: string
  ): Promise<MetaMaskCredentials> {
    try {
      // Prima connetti a MetaMask
      const connection = await this.connectMetaMask();
      
      // Verifichiamo il risultato della connessione
      return pipe(
        connection,
        (conn) => match(conn, {
          when: (c) => !c.success,
          then: (c) => {
            throw new Error(c.error || "Errore di connessione a MetaMask");
          },
          otherwise: async (c) => {
            // Verifica che l'indirizzo connesso corrisponda
            const connectedAddress = this.validateAddress(c.address);
            
            if (connectedAddress.toLowerCase() !== address.toLowerCase()) {
              throw new Error("L'account selezionato non corrisponde all'indirizzo fornito");
            }

            // Il messaggio da firmare
            const messageToSign = this.MESSAGE_TO_SIGN;
            log(`Richiesta firma del messaggio: "${messageToSign}"`);

            const ethereum = window.ethereum as EthereumProvider;
            const signature = await ethereum.request({
              method: "personal_sign",
              params: [messageToSign, connectedAddress],
            });

            // Verifichiamo la firma
            return match(signature, {
              when: (s) => !s,
              then: () => {
                throw new Error("Firma non ottenuta");
              },
              otherwise: async (s) => {
                log("Firma ottenuta, generazione password...");

                // Genera la password usando il metodo dedicato
                const password = await this.generatePassword(s);

                // Usa l'username generato durante la connessione
                const username = c.username || `mm_${connectedAddress.toLowerCase()}`;

                return {
                  username,
                  password
                };
              }
            });
          }
        })
      );
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
    // Utilizziamo match per validare i parametri
    match({ rpcUrl, privateKey }, {
      when: (params) => !params.rpcUrl || typeof params.rpcUrl !== "string",
      then: () => {
        throw new Error("RPC URL non valido");
      },
      otherwise: (params) => match(params, {
        when: (p) => !p.privateKey || typeof p.privateKey !== "string",
        then: () => {
          throw new Error("Chiave privata non valida");
        },
        otherwise: (p) => {
          try {
            this.customProvider = new ethers.JsonRpcProvider(p.rpcUrl);
            this.customWallet = new ethers.Wallet(p.privateKey, this.customProvider);
            logDebug("Provider personalizzato configurato con successo");
          } catch (error: any) {
            throw new Error(
              `Errore nella configurazione del provider: ${error.message || "Errore sconosciuto"}`
            );
          }
        }
      })
    });
  }

  /**
   * Get active signer instance
   * @returns Ethers.js Signer
   * @throws {Error} If no signer available
   */
  public async getSigner(): Promise<ethers.Signer> {
    try {
      return match(this.customWallet, {
        when: (wallet) => !!wallet,
        then: (wallet) => wallet as ethers.Signer,
        otherwise: async () => {
          const signer = await this.getEthereumSigner();
          return match(signer, {
            when: (s) => !s,
            then: () => {
              throw new Error("Nessun signer Ethereum disponibile");
            },
            otherwise: (s) => s
          });
        }
      });
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
    return match(signature, {
      when: (s) => !s,
      then: () => {
        throw new Error("Firma non valida");
      },
      otherwise: (s) => {
        const hash = ethers.keccak256(ethers.toUtf8Bytes(s));
        return hash.slice(2, 66); // Rimuovi 0x e usa i primi 32 bytes
      }
    });
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
    return match({ message, signature }, {
      when: (params) => !params.message || !params.signature,
      then: () => {
        throw new Error("Messaggio o firma non validi");
      },
      otherwise: (params) => {
        try {
          return ethers.verifyMessage(params.message, params.signature);
        } catch (error) {
          throw new Error("Messaggio o firma non validi");
        }
      }
    });
  }

  /**
   * Get browser-based Ethereum signer
   * @returns Browser provider signer
   * @throws {Error} If MetaMask not detected
   */
  public async getEthereumSigner(): Promise<ethers.Signer> {
    return match(MetaMask.isMetaMaskAvailable(), {
      when: (available) => !available,
      then: () => {
        throw new Error(
          "Metamask non trovato. Installa Metamask per continuare."
        );
      },
      otherwise: async () => {
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
    });
  }
}

if (typeof window !== "undefined") {
  window.MetaMask = MetaMask;
} else if (typeof global !== "undefined") {
  (global as any).MetaMask = MetaMask;
}

export { MetaMask };
