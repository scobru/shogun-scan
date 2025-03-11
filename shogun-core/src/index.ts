import { GunDB } from "./gun/gun";
import { Webauthn } from "./webauthn/webauthn";
import { MetaMask } from "./connector/metamask";
import { Stealth } from "./stealth/stealth";
import { EventEmitter } from "events";
import { Storage } from "./storage/storage";
import {
  IShogunCore,
  ShogunSDKConfig,
  AuthResult,
  SignUpResult,
  WalletInfo,
} from "./types/shogun";
import { IGunInstance } from "gun/types/gun";
import { log, logError, logWarning } from "./utils/logger";
import { WalletManager } from "./wallet/walletManager";
import CONFIG from "./config";
import { ethers } from "ethers";
import { record, match, pipe } from "ts-minimal";

/**
 * Definizione schemi per i risultati di autenticazione e registrazione
 */
const AuthResultSchema = record<AuthResult>({
  success: Boolean,
  userPub: String,
  wallet: Object,
  username: String,
  error: String,
  credentialId: String,
  password: String
});

const SignUpResultSchema = record<SignUpResult>({
  success: Boolean,
  userPub: String,
  pub: String,
  error: String,
  message: String,
  wallet: Object
});

let gun: any;

export class ShogunCore implements IShogunCore {
  public gun: IGunInstance<any>;
  public gundb: GunDB;
  public webauthn: Webauthn;
  public metamask: MetaMask;
  public stealth: Stealth;
  private storage: Storage;
  private eventEmitter: EventEmitter;
  private walletManager: WalletManager;

  /**
   * Initialize the Shogun SDK
   * @param config - SDK Configuration object
   * @description Creates a new instance of ShogunCore with the provided configuration.
   * Initializes all required components including storage, event emitter, GunDB connection,
   * authentication methods (WebAuthn, MetaMask), and wallet management.
   */
  constructor(config: ShogunSDKConfig) {
    log("Initializing ShogunSDK");

    this.storage = new Storage();
    this.eventEmitter = new EventEmitter();

    const gundbConfig = {
      peers: config.gundb?.peers || config.peers || CONFIG.PEERS,
      websocket: config.websocket,
      localStorage: false,
      radisk: false,
    };

    this.gundb = new GunDB(gundbConfig);
    this.gun = this.gundb.getGun();

    this.webauthn = new Webauthn();
    this.metamask = new MetaMask();
    this.stealth = new Stealth();

    this.walletManager = new WalletManager(this.gundb, this.gun, this.storage);

    log("ShogunSDK initialized!");
  }

  /**
   * Check if user is logged in
   * @returns {boolean} True if user is logged in, false otherwise
   * @description Verifies authentication status by checking GunDB login state
   * and presence of authentication credentials in storage
   */
  isLoggedIn(): boolean {
    return pipe(
      { gunLoggedIn: this.gundb.isLoggedIn(), gunUser: this.gun.user(), storage: this.storage },
      (data) => match(data.gunLoggedIn, {
        when: (loggedIn) => loggedIn === true,
        then: () => true,
        otherwise: (d) => {
          // @ts-ignore - Accessing internal Gun property that is not fully typed
          const hasPair = data.gunUser && data.gunUser._ && data.gunUser._.sea;
          const hasLocalPair = data.storage.getItem("pair");
          return !!hasPair || !!hasLocalPair;
        }
      })
    );
  }

  /**
   * Perform user logout
   * @description Logs out the current user from GunDB and emits logout event.
   * If user is not authenticated, the logout operation is ignored.
   */
  logout(): void {
    try {
      pipe(
        this.isLoggedIn(),
        (isLoggedIn) => match(isLoggedIn, {
          when: (loggedIn) => !loggedIn,
          then: () => {
            log("Logout ignored: user not authenticated");
          },
          otherwise: () => {
            this.gundb.logout();
            this.eventEmitter.emit("auth:logout", {});
            log("Logout completed successfully");
          }
        })
      );
    } catch (error) {
      logError("Error during logout:", error);
      this.eventEmitter.emit("error", {
        action: "logout",
        message: error instanceof Error ? error.message : "Error during logout",
      });
    }
  }

  /**
   * Authenticate user with username and password
   * @param username - Username
   * @param password - User password
   * @returns {Promise<AuthResult>} Promise with authentication result
   * @description Attempts to log in user with provided credentials.
   * Emits login event on success.
   */
  async login(username: string, password: string): Promise<AuthResult> {
    try {
      const result = await this.gundb.login(username, password);

      return pipe(
        result,
        (res) => match(res.success, {
          when: (success) => success,
          then: () => {
            log(`Login successful for user: ${username}`);
            this.eventEmitter.emit("auth:login", {
              userPub: res.userPub || "",
            });
            return res;
          },
          otherwise: () => {
            logError(`Login failed for user: ${username}: ${res.error}`);
            return res;
          }
        })
      );
    } catch (error: any) {
      logError(`Error during login for user: ${username}`, error);
      return {
        success: false,
        error: error.message || "Unknown error during login",
      };
    }
  }

  /**
   * Register a new user with provided credentials
   * @param username - Username
   * @param password - Password
   * @param passwordConfirmation - Password confirmation
   * @returns {Promise<SignUpResult>} Registration result
   * @description Creates a new user account with the provided credentials.
   * Validates password requirements and emits signup event on success.
   */
  async signUp(
    username: string,
    password: string,
    passwordConfirmation?: string
  ): Promise<SignUpResult> {
    try {
      // Validazione input utilizzando match
      return pipe(
        { password, passwordConfirmation },
        (data) => match(data, {
          // Verifica che le password corrispondano se è stata fornita passwordConfirmation
          when: (d) => d.passwordConfirmation !== undefined && d.password !== d.passwordConfirmation,
          then: () => ({
            success: false,
            error: "Passwords do not match",
          }),
          otherwise: (d) => match(d.password, {
            // Verifica lunghezza minima password
            when: (pw) => pw.length < 6,
            then: () => ({
              success: false,
              error: "Password must be at least 6 characters long",
            }),
            otherwise: async () => {
              // Procedi con la registrazione
              const result = await this.gundb.signUp(username, password);
              
              return match(result.success, {
                when: (success) => success,
                then: () => {
                  log(`Registration successful for user: ${username}, pub: ${result.userPub}`);
                  
                  this.eventEmitter.emit("auth:signup", {
                    userPub: result.userPub || "",
                    username,
                  });
                  
                  return {
                    success: true,
                    userPub: result.userPub,
                  };
                },
                otherwise: () => {
                  const errorMsg = result.error || "Unknown error during registration";
                  logError(`Registration failed for user: ${username}: ${errorMsg}`);
                  
                  return {
                    success: false,
                    error: errorMsg,
                  };
                }
              });
            }
          })
        })
      );
    } catch (error: any) {
      const errorMsg = error.message || "Unknown error during registration";
      logError(`Error during registration for user: ${username}`, error);
      
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Check if WebAuthn is supported by the browser
   * @returns {boolean} True if WebAuthn is supported, false otherwise
   * @description Verifies if the current browser environment supports WebAuthn authentication
   */
  isWebAuthnSupported(): boolean {
    return this.webauthn.isSupported();
  }

  /**
   * Perform WebAuthn login
   * @param username - Username
   * @returns {Promise<AuthResult>} Authentication result
   * @description Authenticates user using WebAuthn credentials.
   * Requires browser support for WebAuthn and existing credentials.
   */
  async loginWithWebAuthn(username: string): Promise<AuthResult> {
    try {
      log(`Attempting WebAuthn login for user: ${username}`);

      return pipe(
        { username, isSupported: this.isWebAuthnSupported() },
        (data) => match(data, {
          // Verifica che username sia fornito
          when: (d) => !d.username,
          then: () => {
            throw new Error("Username required for WebAuthn login");
          },
          // Verifica che WebAuthn sia supportato
          otherwise: (d) => match(d.isSupported, {
            when: (supported) => !supported,
            then: () => {
              throw new Error("WebAuthn is not supported by this browser");
            },
            otherwise: async () => {
              // Verifica le credenziali WebAuthn
              const assertionResult = await this.webauthn.generateCredentials(
                username,
                null,
                true
              );
              
              return match(assertionResult.success, {
                when: (success) => !success,
                then: () => {
                  throw new Error(assertionResult.error || "WebAuthn verification failed");
                },
                otherwise: async () => {
                  // Usa l'ID credenziale come password
                  const hashedCredentialId = ethers.keccak256(
                    ethers.toUtf8Bytes(assertionResult.credentialId || "")
                  );
                  
                  // Login con credenziali verificate
                  const result = await this.login(username, hashedCredentialId);
                  
                  return match(result.success, {
                    when: (success) => success === true,
                    then: () => {
                      log(`WebAuthn login completed successfully for user: ${username}`);
                      return {
                        ...result,
                        username,
                        password: hashedCredentialId,
                        credentialId: assertionResult.credentialId,
                      };
                    },
                    otherwise: () => result
                  });
                }
              });
            }
          })
        })
      );
    } catch (error: any) {
      logError(`Error during WebAuthn login: ${error}`);
      return {
        success: false,
        error: error.message || "Error during WebAuthn login",
      };
    }
  }

  /**
   * Register new user with WebAuthn
   * @param username - Username
   * @returns {Promise<AuthResult>} Registration result
   * @description Creates a new user account using WebAuthn credentials.
   * Requires browser support for WebAuthn.
   */
  async signUpWithWebAuthn(username: string): Promise<AuthResult> {
    try {
      log(`Attempting WebAuthn registration for user: ${username}`);

      return pipe(
        { username, isSupported: this.isWebAuthnSupported() },
        (data) => match(data, {
          when: (d) => !d.username,
          then: () => {
            throw new Error("Username required for WebAuthn registration");
          },
          otherwise: (d) => match(d.isSupported, {
            when: (supported) => !supported,
            then: () => {
              throw new Error("WebAuthn is not supported by this browser");
            },
            otherwise: async () => {
              // Generate new WebAuthn credentials
              const attestationResult = await this.webauthn.generateCredentials(
                username,
                null,
                false
              );
              
              return match(attestationResult.success, {
                when: (success) => !success,
                then: () => {
                  throw new Error(
                    attestationResult.error ||
                      "Unable to generate WebAuthn credentials"
                  );
                },
                otherwise: async () => {
                  // Use credential ID as password
                  const hashedCredentialId = ethers.keccak256(
                    ethers.toUtf8Bytes(attestationResult.credentialId || "")
                  );

                  // Perform registration
                  const result = await this.signUp(username, hashedCredentialId);

                  return match(result.success, {
                    when: (success) => success === true,
                    then: () => {
                      log(
                        `WebAuthn registration completed successfully for user: ${username}`
                      );
                      return {
                        ...result,
                        username,
                        password: hashedCredentialId,
                        credentialId: attestationResult.credentialId,
                      };
                    },
                    otherwise: () => result
                  });
                }
              });
            }
          })
        })
      );
    } catch (error: any) {
      logError(`Error during WebAuthn registration: ${error}`);
      return {
        success: false,
        error: error.message || "Error during WebAuthn registration",
      };
    }
  }

  /**
   * Login with MetaMask
   * @param address - Ethereum address
   * @returns {Promise<AuthResult>} Authentication result
   * @description Authenticates user using MetaMask wallet credentials
   */
  async loginWithMetaMask(address: string): Promise<AuthResult> {
    try {
      log(`Attempting MetaMask login for address: ${address}`);

      return pipe(
        address,
        async (addr) => {
          // Generate credentials using MetaMask
          const credentials = await this.metamask.generateCredentials(addr);

          // Login with generated credentials
          const result = await this.login(
            credentials.username || "",
            credentials.password || ""
          );

          return match(result.success, {
            when: (success) => success === true,
            then: () => {
              log(
                `MetaMask login completed successfully for address: ${addr}`
              );
              return {
                ...result,
                username: credentials.username,
                password: credentials.password,
              };
            },
            otherwise: () => {
              logError(`MetaMask login failed for address: ${addr}`);
              return {
                success: false,
                error: result.error || "Error during MetaMask login",
              };
            }
          });
        }
      );
    } catch (error: any) {
      logError(`Error during MetaMask login: ${error}`);
      return {
        success: false,
        error: error.message || "Error during MetaMask login",
      };
    }
  }

  /**
   * Register new user with MetaMask
   * @param address - Ethereum address
   * @returns {Promise<AuthResult>} Registration result
   * @description Creates a new user account using MetaMask wallet credentials
   */
  async signUpWithMetaMask(address: string): Promise<AuthResult> {
    try {
      log(
        `Attempting MetaMask registration for address: ${address}`
      );

      return pipe(
        address,
        async (addr) => {
          // Generate credentials using MetaMask
          const credentials = await this.metamask.generateCredentials(addr);

          // Perform registration with generated credentials
          const result = await this.signUp(
            credentials.username || "",
            credentials.password || ""
          );

          return match(result.success, {
            when: (success) => success === true,
            then: () => {
              log(
                `MetaMask registration completed successfully for address: ${addr}`
              );
              // Add username to returned information
              return {
                ...result,
                username: credentials.username,
                password: credentials.password,
              };
            },
            otherwise: () => result
          });
        }
      );
    } catch (error: any) {
      logError(`Error during MetaMask registration: ${error}`);
      return {
        success: false,
        error: error.message || "Error during MetaMask registration",
      };
    }
  }

  // WALLET MANAGER

  /**
   * Get main wallet
   * @returns {ethers.Wallet | null} Main wallet instance or null if not available
   * @description Retrieves the primary wallet associated with the user
   */
  getMainWallet(): ethers.Wallet | null {
    return this.walletManager.getMainWallet();
  }

  /**
   * Create new wallet
   * @returns {Promise<WalletInfo>} Created wallet information
   * @description Generates a new wallet and associates it with the user
   */
  async createWallet(): Promise<WalletInfo> {
    return this.walletManager.createWallet();
  }

  /**
   * Load wallets
   * @returns {Promise<WalletInfo[]>} Array of wallet information
   * @description Retrieves all wallets associated with the authenticated user
   */
  async loadWallets(): Promise<WalletInfo[]> {
    try {
      return pipe(
        this.isLoggedIn(),
        (loggedIn) => match(loggedIn, {
          when: (isLoggedIn) => !isLoggedIn,
          then: () => {
            log("Cannot load wallets: user not authenticated");
            return [];
          },
          otherwise: async () => {
            return await this.walletManager.loadWallets();
          }
        })
      );
    } catch (error) {
      logError("Error loading wallets:", error);
      return [];
    }
  }

  /**
   * Sign message
   * @param wallet - Wallet for signing
   * @param message - Message to sign
   * @returns {Promise<string>} Message signature
   * @description Signs a message using the provided wallet
   */
  async signMessage(
    wallet: ethers.Wallet,
    message: string | Uint8Array
  ): Promise<string> {
    return this.walletManager.signMessage(wallet, message);
  }

  /**
   * Verify signature
   * @param message - Signed message
   * @param signature - Signature to verify
   * @returns {string} Address that signed the message
   * @description Recovers the address that signed a message from its signature
   */
  verifySignature(message: string | Uint8Array, signature: string): string {
    return this.walletManager.verifySignature(message, signature);
  }

  /**
   * Sign transaction
   * @param wallet - Wallet for signing
   * @param toAddress - Recipient address
   * @param value - Amount to send
   * @returns {Promise<string>} Signed transaction
   * @description Signs a transaction using the provided wallet
   */
  async signTransaction(
    wallet: ethers.Wallet,
    toAddress: string,
    value: string
  ): Promise<string> {
    return this.walletManager.signTransaction(wallet, toAddress, value);
  }

  /**
   * Export user's mnemonic phrase
   * @param password Optional password to encrypt exported data
   * @returns {Promise<string>} Exported mnemonic data
   * @description Exports the mnemonic phrase used to generate user's wallets
   */
  async exportMnemonic(password?: string): Promise<string> {
    return this.walletManager.exportMnemonic(password);
  }

  /**
   * Export private keys of all wallets
   * @param password Optional password to encrypt exported data
   * @returns {Promise<string>} Exported wallet keys
   * @description Exports private keys for all user's wallets
   */
  async exportWalletKeys(password?: string): Promise<string> {
    return this.walletManager.exportWalletKeys(password);
  }

  /**
   * Export user's Gun pair
   * @param password Optional password to encrypt exported data
   * @returns {Promise<string>} Exported Gun pair
   * @description Exports the user's Gun authentication pair
   */
  async exportGunPair(password?: string): Promise<string> {
    return this.walletManager.exportGunPair(password);
  }

  /**
   * Export all user data in a single file
   * @param password Required password to encrypt exported data
   * @returns {Promise<string>} Exported user data
   * @description Exports all user data including mnemonic, wallets and Gun pair
   */
  async exportAllUserData(password: string): Promise<string> {
    return this.walletManager.exportAllUserData(password);
  }

  /**
   * Import mnemonic phrase
   * @param mnemonicData Mnemonic or encrypted JSON to import
   * @param password Optional password to decrypt mnemonic if encrypted
   * @returns {Promise<boolean>} Import success status
   * @description Imports a mnemonic phrase to generate wallets
   */
  async importMnemonic(
    mnemonicData: string,
    password?: string
  ): Promise<boolean> {
    return this.walletManager.importMnemonic(mnemonicData, password);
  }

  /**
   * Import wallet private keys
   * @param walletsData JSON containing wallet data or encrypted JSON
   * @param password Optional password to decrypt data if encrypted
   * @returns {Promise<number>} Number of imported wallets
   * @description Imports wallet private keys from exported data
   */
  async importWalletKeys(
    walletsData: string,
    password?: string
  ): Promise<number> {
    return this.walletManager.importWalletKeys(walletsData, password);
  }

  /**
   * Import Gun pair
   * @param pairData JSON containing Gun pair or encrypted JSON
   * @param password Optional password to decrypt data if encrypted
   * @returns {Promise<boolean>} Import success status
   * @description Imports a Gun authentication pair
   */
  async importGunPair(pairData: string, password?: string): Promise<boolean> {
    return this.walletManager.importGunPair(pairData, password);
  }

  /**
   * Import complete backup
   * @param backupData Encrypted JSON containing all user data
   * @param password Password to decrypt backup
   * @param options Import options (which data to import)
   * @returns {Promise<Object>} Import results for each data type
   * @description Imports a complete user data backup including mnemonic,
   * wallets and Gun pair
   */
  async importAllUserData(
    backupData: string,
    password: string,
    options: {
      importMnemonic?: boolean;
      importWallets?: boolean;
      importGunPair?: boolean;
    } = { importMnemonic: true, importWallets: true, importGunPair: true }
  ): Promise<{
    success: boolean;
    mnemonicImported?: boolean;
    walletsImported?: number;
    gunPairImported?: boolean;
  }> {
    return this.walletManager.importAllUserData(backupData, password, options);
  }

  /**
   * Ottiene gli indirizzi che sarebbero derivati da una mnemonica usando lo standard BIP-44
   * @param mnemonic La frase mnemonica da cui derivare gli indirizzi
   * @param count Il numero di indirizzi da derivare
   * @returns Un array di indirizzi Ethereum
   * @description Questo metodo è utile per verificare la compatibilità con altri wallet
   */
  getStandardBIP44Addresses(mnemonic: string, count: number = 5): string[] {
    return this.walletManager.getStandardBIP44Addresses(mnemonic, count);
  }
}

// Export all types
export * from "./types/shogun";

// Export classes
export { GunDB } from "./gun/gun";
export { MetaMask } from "./connector/metamask";
export {
  Stealth,
  StealthKeyPair,
  StealthAddressResult,
} from "./stealth/stealth";
export { Webauthn } from "./webauthn/webauthn";
export { Storage } from "./storage/storage";
export { ShogunEventEmitter } from "./events";
