import { ethers } from "ethers";
import { HDNodeWallet } from "ethers";
declare module "uuid";
import * as uuid from "uuid";
import { GunDB } from "./gun/gun";
import Wallet from "ethereumjs-wallet";

// Importa i moduli
import { Webauthn } from "./webauthn/webauthn";
import { MetaMask } from "./connector/metamask";
import { Stealth } from "./stealth/stealth";
import { EventEmitter as ShogunEventEmitter } from "./utils/eventEmitter";
import { Storage } from "./storage/storage";
import {
  IShogunSDK,
  ShogunSDKConfig,
  WalletInfo,
  AuthResult,
  SignUpResult,
  ShogunEvents,
} from "./types/shogun";
import { IGunInstance } from "gun/types/gun";
import { log } from "./utils/logger";
import { HDWalletManager } from "./wallet/hdWallet";
import { WalletManager } from "./wallet/walletManager";
import { MetaMaskAuth } from "./auth/metamaskAuth";
import { WebAuthnAuth } from "./auth/webauthnAuth";
import { CredentialAuth } from "./auth/credentialAuth";

let gun: any;

/**
 * Shogun SDK - Decentralized Authentication Protocol
 *
 * This SDK implements a 3-layer authentication protocol:
 *
 * 1. Credential Generation Layer
 *    - User/Password: Standard username and password credentials
 *    - MetaMask: Ethereum wallet-based authentication using digital signatures
 *    - WebAuthn: Biometric and hardware security key authentication (FIDO2)
 *
 * 2. Authentication Layer
 *    - GunDB: Decentralized graph database for user authentication
 *    - Hedgehog: Ethereum wallet-based authentication
 *
 * 3. Wallet Management Layer
 *    - HD Wallet: Hierarchical deterministic wallet for Ethereum
 *    - Stealth Addresses: Privacy-enhancing technology for Ethereum
 */
export class ShogunSDK implements IShogunSDK {
  public gun: IGunInstance<any>;
  public gundb: GunDB;
  public hedgehog: any;
  public webauthn?: Webauthn;
  public metamask?: MetaMask;
  public stealth?: Stealth;
  private storage: Storage;
  private eventEmitter: ShogunEventEmitter;
  private hdWalletManager: HDWalletManager;
  private walletManager: WalletManager;
  private metamaskAuth: MetaMaskAuth;
  private webauthnAuth: WebAuthnAuth;
  private credentialAuth: CredentialAuth;

  /**
   * Inizializza l'SDK Shogun
   * @param config - Configurazione dell'SDK
   */
  constructor(config: ShogunSDKConfig) {
    log("Inizializzazione di ShogunSDK");
    
    // Inizializza i moduli
    this.storage = new Storage();
    this.gundb = new GunDB(config.peers);
    this.gun = this.gundb.gun;
    this.hedgehog = this.gundb.hedgehog;
    this.eventEmitter = new ShogunEventEmitter();
    
    // Inizializza i moduli opzionali
    try {
      this.webauthn = new Webauthn();
    } catch (error) {
      log("WebAuthn non supportato:", error);
    }
    
    try {
      this.metamask = new MetaMask();
    } catch (error) {
      log("MetaMask non supportato:", error);
    }
    
    try {
      this.stealth = new Stealth();
    } catch (error) {
      log("Stealth non supportato:", error);
    }
    
    // Inizializza i manager
    this.hdWalletManager = new HDWalletManager(this.gundb, this.gun, this.storage);
    this.walletManager = new WalletManager(this.gundb, this.gun, this.storage);
    
    // Inizializza i moduli di autenticazione
    this.metamaskAuth = new MetaMaskAuth(this.gundb, this.gun, this.storage, this.metamask!);
    this.webauthnAuth = new WebAuthnAuth(this.gundb, this.gun, this.storage, this.webauthn!);
    this.credentialAuth = new CredentialAuth(this.gundb, this.gun, this.storage, this.hedgehog);
  }

  /**
   * Verifica se l'utente è autenticato
   * @returns true se l'utente è autenticato, false altrimenti
   */
  isLoggedIn(): boolean {
    try {
      log("Verifica dello stato di autenticazione");
      
      // Verifica se l'utente è autenticato con GunDB
      const gunLoggedIn = this.gun.user().is !== undefined;
      
      // Verifica se l'utente è autenticato con Hedgehog
      const hedgehogLoggedIn = this.hedgehog.isLoggedIn();
      
      log("Stato di autenticazione:", {
        gunLoggedIn,
        hedgehogLoggedIn,
      });
      
      // L'utente è autenticato se è autenticato con GunDB o Hedgehog
      return gunLoggedIn || hedgehogLoggedIn;
    } catch (error) {
      log("Errore durante la verifica dello stato di autenticazione:", error);
      return false;
    }
  }

  /**
   * Effettua il logout
   */
  logout(): void {
    try {
      log("Logout dell'utente");
      
      // Logout da GunDB
      this.gun.user().leave();
      
      // Logout da Hedgehog
      this.hedgehog.logout();
      
      // Emetti l'evento di logout
      this.eventEmitter.emit("auth:logout", {});
    } catch (error) {
      log("Errore durante il logout:", error);
      this.eventEmitter.emit("error", {
        action: "logout",
        message: error instanceof Error ? error.message : "Errore durante il logout",
      });
    }
  }

  /**
   * Effettua il login
   * @param username - Nome utente
   * @param password - Password
   * @returns Risultato del login
   */
  async login(username: string, password: string): Promise<AuthResult> {
    try {
      log("Login dell'utente:", username);
      
      // Effettua il login con credenziali
      const result = await this.credentialAuth.loginWithCredentials(username, password);
      
      if (result.success) {
        // Emetti l'evento di login
        this.eventEmitter.emit("auth:login", {
          username,
          userPub: result.userPub || "",
        });
      } else {
        // Emetti l'evento di errore
        this.eventEmitter.emit("error", {
          action: "login",
          message: result.error || "Errore durante il login",
        });
      }
      
      return result;
    } catch (error) {
      log("Errore durante il login:", error);
      this.eventEmitter.emit("error", {
        action: "login",
        message: error instanceof Error ? error.message : "Errore durante il login",
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore durante il login",
      };
    }
  }

  /**
   * Effettua la registrazione
   * @param username - Nome utente
   * @param password - Password
   * @returns Risultato della registrazione
   */
  async signUp(username: string, password: string): Promise<SignUpResult> {
    try {
      log("Registrazione dell'utente:", username);
      
      // Crea un utente GUN
      await this.gundb.createGunUser(username, password);
      
      // Autentica l'utente con GunDB
      await this.gundb.authenticateGunUser(username, password);
      
      // Crea un utente Hedgehog
      await this.hedgehog.create(username, password);
      
      const userPub = this.gun.user().is?.pub;
      
      // Emetti l'evento di registrazione
      this.eventEmitter.emit("auth:signup", {
        username,
        userPub: userPub || "",
      });
      
      return {
        success: true,
        pub: userPub,
      };
    } catch (error) {
      log("Errore durante la registrazione:", error);
      this.eventEmitter.emit("error", {
        action: "signup",
        message: error instanceof Error ? error.message : "Errore durante la registrazione",
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore durante la registrazione",
      };
    }
  }

  /**
   * Gestisce il login
   * @param username - Nome utente
   * @param password - Password
   * @param options - Opzioni aggiuntive
   * @returns Risultato del login
   */
  async handleLogin(
    username: string,
    password: string,
    options: {
      setUserpub?: (pub: string) => void;
      setSignedIn?: (signedIn: boolean) => void;
    } = {}
  ): Promise<AuthResult> {
    return this.credentialAuth.handleLogin(username, password, options);
  }

  /**
   * Gestisce la registrazione
   * @param username - Nome utente
   * @param password - Password
   * @param passwordConfirmation - Conferma della password
   * @param options - Opzioni aggiuntive
   * @returns Risultato della registrazione
   */
  async handleSignUp(
    username: string,
    password: string,
    passwordConfirmation: string,
    options: {
      setErrorMessage?: (message: string) => void;
      setUserpub?: (pub: string) => void;
      setSignedIn?: (signedIn: boolean) => void;
      messages?: { [key: string]: string };
    } = {}
  ): Promise<AuthResult> {
    return this.credentialAuth.handleSignUp(username, password, passwordConfirmation, options);
  }

  /**
   * Verifica se WebAuthn è supportato
   * @returns true se WebAuthn è supportato, false altrimenti
   */
  isWebAuthnSupported(): boolean {
    return this.webauthnAuth.isWebAuthnSupported();
  }

  /**
   * Effettua il login con WebAuthn
   * @param username - Nome utente
   * @returns Risultato del login
   */
  async loginWithWebAuthn(username: string): Promise<AuthResult> {
    return this.webauthnAuth.loginWithWebAuthn(username);
  }

  /**
   * Registra un nuovo utente con WebAuthn
   * @param username - Nome utente
   * @returns Risultato della registrazione
   */
  async registerWithWebAuthn(username: string): Promise<AuthResult> {
    return this.webauthnAuth.registerWithWebAuthn(username);
  }

  /**
   * Effettua il login con MetaMask
   * @param address - Indirizzo Ethereum
   * @returns Risultato del login
   */
  async loginWithMetaMask(address: string): Promise<AuthResult> {
    return this.metamaskAuth.loginWithMetaMask(address);
  }

  /**
   * Registra un nuovo utente con MetaMask
   * @param address - Indirizzo Ethereum
   * @returns Risultato della registrazione
   */
  async signUpWithMetaMask(address: string): Promise<AuthResult> {
    return this.metamaskAuth.signUpWithMetaMask(address);
  }

  /**
   * Ottiene il wallet principale
   * @returns Wallet principale
   */
  getMainWallet(): HDNodeWallet | null {
    return this.walletManager.getMainWallet();
  }

  /**
   * Crea un nuovo wallet
   * @returns Wallet creato
   */
  async createWallet(): Promise<HDNodeWallet> {
    return this.walletManager.createWallet();
  }

  /**
   * Carica i wallet
   * @returns Wallet caricati
   */
  async loadWallets(): Promise<HDNodeWallet[]> {
    return this.walletManager.loadWallets();
  }

  /**
   * Deriva un wallet
   * @param userPub - Chiave pubblica dell'utente
   * @param index - Indice del wallet
   * @returns Wallet derivato
   */
  async deriveWallet(userPub: string, index: number): Promise<HDNodeWallet> {
    return this.walletManager.deriveWallet(userPub, index);
  }

  /**
   * Firma un messaggio
   * @param wallet - Wallet per la firma
   * @param message - Messaggio da firmare
   * @returns Firma del messaggio
   */
  async signMessage(wallet: HDNodeWallet, message: string | Uint8Array): Promise<string> {
    return this.hdWalletManager.signMessage(wallet, message);
  }

  /**
   * Verifica una firma
   * @param message - Messaggio firmato
   * @param signature - Firma da verificare
   * @returns Indirizzo che ha firmato il messaggio
   */
  verifySignature(message: string | Uint8Array, signature: string): string {
    return this.hdWalletManager.verifySignature(message, signature);
  }

  /**
   * Crea un wallet HD
   * @param username - Nome utente
   * @param password - Password
   * @returns Wallet HD creato
   */
  async createHDWallet(username: string, password: string): Promise<{
    wallet: HDNodeWallet;
    mnemonic?: string;
    address: string;
    privateKey: string;
  }> {
    return this.hdWalletManager.createHDWallet(username, password);
  }

  /**
   * Deriva un wallet figlio
   * @param hdWallet - Wallet HD padre
   * @param index - Indice del wallet figlio
   * @returns Wallet figlio derivato
   */
  deriveChildWallet(hdWallet: HDNodeWallet, index: number): HDNodeWallet {
    return this.hdWalletManager.deriveChildWallet(hdWallet, index);
  }

  /**
   * Cripta un wallet
   * @param wallet - Wallet da criptare
   * @param password - Password per la crittografia
   * @returns JSON del wallet criptato
   */
  async encryptWallet(wallet: HDNodeWallet, password: string): Promise<string> {
    return this.hdWalletManager.encryptWallet(wallet, password);
  }

  /**
   * Decripta un wallet
   * @param json - JSON del wallet criptato
   * @param password - Password per la decrittografia
   * @returns Wallet decriptato
   */
  async decryptWallet(json: string, password: string): Promise<HDNodeWallet> {
    return this.hdWalletManager.decryptWallet(json, password);
  }

  /**
   * Firma una transazione
   * @param wallet - Wallet per la firma
   * @param toAddress - Indirizzo destinatario
   * @param value - Valore da inviare
   * @returns Transazione firmata
   */
  async signTransaction(wallet: HDNodeWallet, toAddress: string, value: string): Promise<string> {
    return this.hdWalletManager.signTransaction(wallet, toAddress, value);
  }

  /**
   * Genera un wallet con mnemonic
   * @returns Wallet e mnemonic generati
   */
  generateMnemonicWallet(): { wallet: HDNodeWallet; mnemonic: string } {
    return this.hdWalletManager.generateMnemonicWallet();
  }

  /**
   * Ripristina un wallet da un mnemonic
   * @param mnemonic - Mnemonic da cui ripristinare il wallet
   * @returns Wallet ripristinato
   */
  restoreFromMnemonic(mnemonic: string): HDNodeWallet {
    return this.hdWalletManager.restoreFromMnemonic(mnemonic);
  }

  /**
   * Salva un mnemonic in GunDB
   * @param userPub - Chiave pubblica dell'utente
   * @param mnemonic - Mnemonic da salvare
   */
  async saveMnemonicToGun(userPub: string, mnemonic: string): Promise<void> {
    return this.hdWalletManager.saveMnemonicToGun(userPub, mnemonic);
  }

  /**
   * Recupera un mnemonic da GunDB
   * @param userPub - Chiave pubblica dell'utente
   * @returns Mnemonic recuperato o null se non trovato
   */
  async getMnemonicFromGun(userPub: string): Promise<string | null> {
    return this.hdWalletManager.getMnemonicFromGun(userPub);
  }

  /**
   * Salva un mnemonic in localStorage
   * @param mnemonic - Mnemonic da salvare
   */
  saveMnemonicToLocalStorage(mnemonic: string): void {
    this.hdWalletManager.saveMnemonicToLocalStorage(mnemonic);
  }

  /**
   * Recupera un mnemonic da localStorage
   * @returns Mnemonic recuperato o null se non trovato
   */
  getMnemonicFromLocalStorage(): string | null {
    return this.hdWalletManager.getMnemonicFromLocalStorage();
  }

  /**
   * Migra a ethers v6
   * @returns true se la migrazione è riuscita, false altrimenti
   */
  async migrateToEthersV6(): Promise<boolean> {
    try {
      log("Migrazione a ethers v6...");
      
      // Pulisci l'entropia non valida
      this.hdWalletManager.cleanInvalidEntropy();
      
      // Verifica se l'utente è autenticato
      if (!this.isLoggedIn()) {
        log("Utente non autenticato, impossibile migrare");
        return false;
      }
      
      // Recupera la chiave pubblica dell'utente
      const userPub = this.gun.user()?.is?.pub;
      
      if (!userPub) {
        throw new Error("Chiave pubblica dell'utente non disponibile");
      }
      
      // Migrazione completata con successo
      log("Migrazione completata con successo");
      return true;
    } catch (error) {
      log("Errore durante la migrazione a ethers v6:", error);
      return false;
    }
  }

  /**
   * Accede a un wallet HD
   * @param username - Nome utente
   * @param password - Password
   * @returns Wallet HD e informazioni correlate
   */
  async accessHDWallet(username: string, password: string): Promise<{
    wallet: HDNodeWallet;
    mnemonic?: string;
    isNew: boolean;
  }> {
    return this.hdWalletManager.accessHDWallet(username, password);
  }

  /**
   * Accede a un wallet HD con fallback
   * @param username - Nome utente
   * @param password - Password
   * @returns Wallet HD e informazioni correlate
   */
  async accessHDWalletWithFallback(username: string, password: string): Promise<{
    wallet: HDNodeWallet;
    mnemonic?: string;
    isNew: boolean;
  }> {
    return this.walletManager.accessHDWalletWithFallback(username, password);
  }
}

// Esporta la classe principale
export default ShogunSDK;
