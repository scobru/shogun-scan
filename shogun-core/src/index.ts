import { GunDB } from "./gun/gun";
import { Webauthn } from "./webauthn/webauthn";
import { MetaMask } from "./connector/metamask";
import { Stealth } from "./stealth/stealth";
import { EventEmitter } from "events";
import { Storage } from "./storage/storage";
import { Layer2 } from "./L2/layer2";
import {
  IShogunCore,
  ShogunSDKConfig,
  AuthResult,
  SignUpResult,
  WalletInfo,
} from "./types/shogun";
import { IGunInstance } from "gun/types/gun";
import { log, logError } from "./utils/logger";
import { WalletManager } from "./wallet/walletManager";
import CONFIG from "./config";
import { ethers } from "ethers";

let gun: any;

export class ShogunCore implements IShogunCore {
  public gun: IGunInstance<any>;
  public gundb: GunDB;
  public webauthn: Webauthn;
  public metamask: MetaMask;
  public stealth: Stealth;
  public layer2: Layer2;
  private storage: Storage;
  private eventEmitter: EventEmitter;
  private walletManager: WalletManager;
  private provider?: ethers.Provider;

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

    // Inizializza Layer2 con gli stessi peer di GunDB
    this.layer2 = new Layer2(config.gundb?.peers || config.peers || CONFIG.PEERS);

    // Inizializza il provider Ethereum
    if (config.providerUrl) {
      this.provider = new ethers.JsonRpcProvider(config.providerUrl);
    } else {
      // Provider predefinito (può essere sostituito secondo necessità)
      this.provider = ethers.getDefaultProvider("mainnet");
    }

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
    const gunLoggedIn = this.gundb.isLoggedIn();
    const gunUser = this.gun.user();

    if (gunLoggedIn) {
      return true;
    }

    // @ts-ignore - Accessing internal Gun property that is not fully typed
    const hasPair = gunUser && gunUser._ && gunUser._.sea;
    const hasLocalPair = this.storage.getItem("pair");

    return !!hasPair || !!hasLocalPair;
  }

  /**
   * Perform user logout
   * @description Logs out the current user from GunDB and emits logout event.
   * If user is not authenticated, the logout operation is ignored.
   */
  logout(): void {
    try {
      if (!this.isLoggedIn()) {
        log("Logout ignored: user not authenticated");
        return;
      }

      this.gundb.logout();
      this.eventEmitter.emit("auth:logout", {});
      log("Logout completed successfully");
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
      log(`Tentativo di login per utente: ${username}`);

      // Verifica parametri
      if (!username || !password) {
        return {
          success: false,
          error: "Username e password sono richiesti",
        };
      }

      // Imposta un timeout per evitare blocchi infiniti
      const loginPromise = new Promise<AuthResult>((resolve) => {
        this.gundb.gun.user().auth(username, password, (ack: any) => {
          if (ack.err) {
            log(`Errore login: ${ack.err}`);
            resolve({
              success: false,
              error: ack.err,
            });
          } else {
            const user = this.gundb.gun.user();
            if (!user.is) {
              resolve({
                success: false,
                error: "Login fallito: utente non autenticato",
              });
            } else {
              log("Login completato con successo");
              const userPub = user.is?.pub || "";
              resolve({
                success: true,
                userPub,
                username,
              });
            }
          }
        });
      });

      // Timeout dopo 10 secondi
      const timeoutPromise = new Promise<AuthResult>((resolve) => {
        setTimeout(() => {
          resolve({
            success: false,
            error: "Timeout durante il login",
          });
        }, 10000);
      });

      // Usa Promise.race per gestire il timeout
      const result = await Promise.race([loginPromise, timeoutPromise]);

      if (result.success) {
        this.eventEmitter.emit("auth:login", {
          userPub: result.userPub || "",
        });
      }

      return result;
    } catch (error: any) {
      logError(`Errore durante il login per utente ${username}:`, error);
      return {
        success: false,
        error: error.message || "Errore sconosciuto durante il login",
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
      // Validazione input
      if (!username || !password) {
        return {
          success: false,
          error: "Username e password sono richiesti",
        };
      }

      // Valida passwords match se confirmation fornita
      if (
        passwordConfirmation !== undefined &&
        password !== passwordConfirmation
      ) {
        return {
          success: false,
          error: "Le password non corrispondono",
        };
      }

      // Valida lunghezza password
      if (password.length < 6) {
        return {
          success: false,
          error: "La password deve essere di almeno 6 caratteri",
        };
      }

      // Imposta timeout per la registrazione
      const signupPromise = new Promise<SignUpResult>((resolve) => {
        this.gundb.gun.user().create(username, password, (ack: any) => {
          if (ack.err) {
            resolve({
              success: false,
              error: ack.err,
            });
          } else {
            // Auto-login dopo la registrazione
            this.gundb.gun.user().auth(username, password, (loginAck: any) => {
              if (loginAck.err) {
                resolve({
                  success: false,
                  error: "Registrazione completata ma login fallito",
                });
              } else {
                const user = this.gundb.gun.user();
                if (!user.is) {
                  resolve({
                    success: false,
                    error: "Registrazione completata ma utente non autenticato",
                  });
                } else {
                  resolve({
                    success: true,
                    userPub: user.is?.pub || "",
                    username: username || "",
                  });
                }
              }
            });
          }
        });
      });

      // Timeout dopo 15 secondi
      const timeoutPromise = new Promise<SignUpResult>((resolve) => {
        setTimeout(() => {
          resolve({
            success: false,
            error: "Timeout durante la registrazione",
          });
        }, 15000);
      });

      // Usa Promise.race per gestire il timeout
      const result = await Promise.race([signupPromise, timeoutPromise]);

      if (result.success) {
        this.eventEmitter.emit("auth:signup", {
          userPub: result.userPub || "",
          username,
        });
      }

      return result;
    } catch (error: any) {
      logError(
        `Errore durante la registrazione per utente ${username}:`,
        error
      );
      return {
        success: false,
        error: error.message || "Errore sconosciuto durante la registrazione",
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

      if (!username) {
        throw new Error("Username required for WebAuthn login");
      }

      if (!this.isWebAuthnSupported()) {
        throw new Error("WebAuthn is not supported by this browser");
      }

      // Verify WebAuthn credentials
      const assertionResult = await this.webauthn.generateCredentials(
        username,
        null,
        true
      );

      if (!assertionResult.success) {
        throw new Error(
          assertionResult.error || "WebAuthn verification failed"
        );
      }

      // Use the credential ID as the password
      const hashedCredentialId = ethers.keccak256(
        ethers.toUtf8Bytes(assertionResult.credentialId || "")
      );

      // Login with verified credentials
      const result = await this.login(username, hashedCredentialId);

      if (result.success) {
        log(`WebAuthn login completed successfully for user: ${username}`);
        return {
          ...result,
          username,
          password: hashedCredentialId,
          credentialId: assertionResult.credentialId,
        };
      } else {
        return result;
      }
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

      if (!username) {
        throw new Error("Username required for WebAuthn registration");
      }

      if (!this.isWebAuthnSupported()) {
        throw new Error("WebAuthn is not supported by this browser");
      }

      // Generate new WebAuthn credentials
      const attestationResult = await this.webauthn.generateCredentials(
        username,
        null,
        false
      );

      if (!attestationResult.success) {
        throw new Error(
          attestationResult.error || "Unable to generate WebAuthn credentials"
        );
      }

      // Use credential ID as password
      const hashedCredentialId = ethers.keccak256(
        ethers.toUtf8Bytes(attestationResult.credentialId || "")
      );

      // Perform registration
      const result = await this.signUp(username, hashedCredentialId);

      if (result.success) {
        log(
          `WebAuthn registration completed successfully for user: ${username}`
        );
        return {
          ...result,
          username,
          password: hashedCredentialId,
          credentialId: attestationResult.credentialId,
        };
      } else {
        return result;
      }
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
      log(`Tentativo di login MetaMask per indirizzo: ${address}`);

      if (!address) {
        throw new Error("Indirizzo Ethereum richiesto per il login MetaMask");
      }

      // Verifica che MetaMask sia disponibile
      if (!this.metamask.isAvailable()) {
        throw new Error("MetaMask non è disponibile nel browser");
      }

      // Genera le credenziali usando MetaMask
      const credentials = await this.metamask.generateCredentials(address);
      if (!credentials.username || !credentials.password) {
        throw new Error("Credenziali MetaMask non generate correttamente");
      }

      // Tenta il login con le credenziali generate
      const loginPromise = this.login(
        credentials.username,
        credentials.password
      );
      const timeoutPromise = new Promise<AuthResult>((_, reject) => {
        setTimeout(() => reject(new Error("Timeout durante il login")), 30000);
      });

      // Usa race per gestire il timeout
      const result = await Promise.race([loginPromise, timeoutPromise]);

      if (result.success) {
        log(`Login MetaMask completato con successo per indirizzo: ${address}`);
        return {
          ...result,
          username: credentials.username,
          password: credentials.password,
        };
      } else {
        logError(`Login MetaMask fallito per indirizzo: ${address}`);
        return {
          success: false,
          error: result.error || "Errore durante il login MetaMask",
        };
      }
    } catch (error: any) {
      logError(`Errore durante il login MetaMask: ${error}`);
      return {
        success: false,
        error: error.message || "Errore sconosciuto durante il login MetaMask",
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
      log(`Tentativo di registrazione MetaMask per indirizzo: ${address}`);

      if (!address) {
        throw new Error(
          "Indirizzo Ethereum richiesto per la registrazione MetaMask"
        );
      }

      // Verifica che MetaMask sia disponibile
      if (!this.metamask.isAvailable()) {
        throw new Error("MetaMask non è disponibile nel browser");
      }

      // Genera le credenziali usando MetaMask
      const credentials = await this.metamask.generateCredentials(address);
      if (!credentials.username || !credentials.password) {
        throw new Error("Credenziali MetaMask non generate correttamente");
      }

      // Tenta la registrazione con le credenziali generate
      const signupPromise = this.signUp(
        credentials.username,
        credentials.password
      );
      const timeoutPromise = new Promise<SignUpResult>((_, reject) => {
        setTimeout(
          () => reject(new Error("Timeout durante la registrazione")),
          30000
        );
      });

      // Usa race per gestire il timeout
      const result = await Promise.race([signupPromise, timeoutPromise]);

      if (result.success) {
        log(
          `Registrazione MetaMask completata con successo per indirizzo: ${address}`
        );
        return {
          ...result,
          username: credentials.username,
          password: credentials.password,
        };
      } else {
        logError(`Registrazione MetaMask fallita per indirizzo: ${address}`);
        return {
          success: false,
          error: result.error || "Errore durante la registrazione MetaMask",
        };
      }
    } catch (error: any) {
      logError(`Errore durante la registrazione MetaMask: ${error}`);
      return {
        success: false,
        error:
          error.message ||
          "Errore sconosciuto durante la registrazione MetaMask",
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
      if (!this.isLoggedIn()) {
        log("Cannot load wallets: user not authenticated");
        return [];
      }

      return await this.walletManager.loadWallets();
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

  /**
   * Generate a new BIP-39 mnemonic phrase
   * @returns {string} A new random mnemonic phrase
   * @description Generates a cryptographically secure random mnemonic phrase
   * that can be used to derive HD wallets
   */
  generateNewMnemonic(): string {
    try {
      // Genera una nuova frase mnemonica usando ethers.js
      const mnemonic = ethers.Wallet.createRandom().mnemonic;
      if (!mnemonic || !mnemonic.phrase) {
        throw new Error("Failed to generate mnemonic phrase");
      }
      return mnemonic.phrase;
    } catch (error) {
      logError("Error generating mnemonic:", error);
      throw new Error("Failed to generate mnemonic phrase");
    }
  }

  // Layer2 Methods
  
  /**
   * Send GunTokens (GT) from one user to another
   * @param sender Sender's address
   * @param receiver Receiver's address
   * @param amount Amount of GT to send
   * @param privateKey Sender's private key for transaction signature
   * @returns Promise resolving when transaction is complete
   */
  async sendGT(sender: string, receiver: string, amount: number, privateKey: string): Promise<void> {
    return this.layer2.sendGT(sender, receiver, amount, privateKey);
  }

  /**
   * Get GT balance of a user
   * @param user User's address
   * @returns Promise resolving with the user's balance
   */
  async getGTBalance(user: string): Promise<number> {
    return this.layer2.getBalance(user);
  }

  /**
   * Request withdrawal of tokens (interacts with smart contract)
   * @param amount Amount to withdraw in ETH
   * @param userAddress User's Ethereum address
   * @param privateKey User's private key
   * @param contractAddress Address of the smart contract
   * @param contractABI ABI of the smart contract
   * @returns Promise resolving when withdrawal request is sent
   */
  async requestWithdrawGT(
    amount: number,
    userAddress: string,
    privateKey: string,
    contractAddress: string,
    contractABI: string | any[]
  ): Promise<void> {
    if (!this.provider) {
      throw new Error("Ethereum provider not initialized");
    }
    
    // Get provider URL from the initialized provider
    const providerUrl = (this.provider as any).connection?.url || "http://localhost:8545";
    
    return this.layer2.requestWithdrawGT(
      amount,
      userAddress,
      privateKey,
      providerUrl,
      contractAddress,
      contractABI
    );
  }

  /**
   * Get transaction history for a user
   * @param userAddress User's address
   * @returns Promise resolving with user's transactions
   */
  async getGTTransactionHistory(userAddress: string): Promise<any[]> {
    return this.layer2.getTransactionHistory(userAddress);
  }

  /**
   * Update GT balance for a user - sync on-chain and off-chain balances
   * @param userAddress User's address
   * @param newBalance New balance to set or amount to add
   * @param isIncrement If true, adds the amount to current balance; if false, sets balance to newBalance
   * @returns Promise resolving with the updated balance
   */
  async updateGTBalance(userAddress: string, newBalance: number, isIncrement: boolean = false): Promise<number> {
    return this.layer2.updateBalance(userAddress, newBalance, isIncrement);
  }

  /**
   * Synchronize GT balance with blockchain (using FROZEN SPACE)
   * @param userAddress User's address to synchronize
   * @param contractAddress GunL2 contract address
   * @returns Promise resolving with the synchronized balance
   * @description Queries the blockchain for the current GT balance and updates the 
   * FROZEN SPACE in GunDB to ensure data integrity between on-chain and off-chain storage.
   */
  async syncGTBalanceWithChain(
    userAddress: string,
    contractAddress: string
  ): Promise<number> {
    if (!this.provider) {
      throw new Error("Ethereum provider not initialized");
    }
    
    return this.layer2.syncBalanceWithChain(
      userAddress,
      this.provider as ethers.JsonRpcProvider,
      contractAddress
    );
  }

  /**
   * Get balance sync status from FROZEN SPACE
   * @param userAddress User's Ethereum address
   * @returns Promise resolving with sync status including last sync time and block
   * @description Returns information about when the GT balance was last synchronized 
   * with the blockchain, helping to verify data freshness and integrity.
   */
  async getGTBalanceSyncStatus(userAddress: string): Promise<{
    balance: number;
    lastSyncTime?: number;
    blockNumber?: number;
    syncType?: string;
  }> {
    return this.layer2.getBalanceSyncStatus(userAddress);
  }

  /**
   * Get GT balance sync history for a user
   * @param userAddress User's Ethereum address
   * @param limit Maximum number of sync events to retrieve
   * @returns Promise resolving with sync history
   * @description Retrieves a history of balance synchronization events, showing
   * when and how the user's GT balance has been updated in FROZEN SPACE.
   */
  async getGTSyncHistory(userAddress: string, limit: number = 10): Promise<any[]> {
    return this.layer2.getSyncHistory(userAddress, limit);
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
export { Layer2 } from "./L2/layer2";
