// Importazioni esistenti
// import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { log, logError, logWarning } from "../utils/logger";

// Costanti
const TIMEOUT_MS = 60000;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 64;

// Estendere l'interfaccia Window per includere WebauthnAuth
declare global {
  interface Window {
    Webauthn?: typeof Webauthn;
  }
}

declare global {
  namespace NodeJS {
    interface Global {
      Webauthn?: typeof Webauthn;
    }
  }
}

interface DeviceInfo {
  deviceId: string;
  timestamp: number;
  name: string;
  platform: string;
}

interface WebAuthnCredentials {
  salt: string;
  timestamp: number;
  credentials: Record<string, DeviceInfo>;
}

interface CredentialResult {
  success: boolean;
  username?: string;
  password?: string;
  credentialId?: string;
  deviceInfo?: DeviceInfo;
  error?: string;
  webAuthnCredentials?: WebAuthnCredentials;
}

// Utility functions
const generateDeviceId = (): string => {
  const platform =
    typeof navigator !== "undefined" ? navigator.platform : "unknown";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return uint8ArrayToHex(
    new TextEncoder().encode(`${platform}-${timestamp}-${random}`)
  );
};

const getPlatformInfo = (): { name: string; platform: string } => {
  if (typeof navigator === "undefined") {
    return { name: "unknown", platform: "unknown" };
  }

  const platform = navigator.platform;
  const userAgent = navigator.userAgent;
  let name = "Unknown Device";

  if (/iPhone|iPad|iPod/.test(platform)) {
    name = "iOS Device";
  } else if (/Android/.test(userAgent)) {
    name = "Android Device";
  } else if (/Win/.test(platform)) {
    name = "Windows Device";
  } else if (/Mac/.test(platform)) {
    name = "Mac Device";
  } else if (/Linux/.test(platform)) {
    name = "Linux Device";
  }

  return { name, platform };
};

const uint8ArrayToHex = (arr: Uint8Array): string => {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const getRandomBytes = (length: number): Uint8Array => {
  if (typeof window !== "undefined" && window.crypto) {
    return window.crypto.getRandomValues(new Uint8Array(length));
  }
  throw new Error("Nessuna implementazione crittografica disponibile");
};

const generateChallenge = (username: string): Uint8Array => {
  const timestamp = Date.now().toString();
  const randomBytes = getRandomBytes(32);
  const challengeData = `${username}-${timestamp}-${uint8ArrayToHex(
    randomBytes
  )}`;
  return new TextEncoder().encode(challengeData);
};

const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const binary = bytes.reduce(
    (str, byte) => str + String.fromCharCode(byte),
    ""
  );
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

const base64ToBuffer = (base64: string): ArrayBuffer => {
  if (!/^[A-Za-z0-9\-_]*$/.test(base64)) {
    throw new Error("Invalid base64 string");
  }

  const base64Url = base64.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64Padded = base64Url + padding;

  try {
    const binary = atob(base64Padded);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    return buffer.buffer;
  } catch (error) {
    throw new Error("Failed to decode base64 string");
  }
};

import { ethers } from "ethers";

const generateCredentialsFromSalt = (
  username: string,
  salt: string
): { password: string } => {
  const data = ethers.toUtf8Bytes(username + salt);

  return {
    // use ethers to generate a password
    password: ethers.sha256(data),
  };
};

// Utility functions per la conversione base64url
const base64url = {
  encode: function(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  },
  decode: function(str: string): string {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return atob(str);
  }
};

class Webauthn {
  private rpId: string;
  private gunInstance: any; // Riferimento a Gun
  
  constructor(gunInstance?: any) {
    this.rpId = this.getRpId();
    this.gunInstance = gunInstance;
  }

  private getRpId(): string {
    if (typeof window === "undefined") {
      return "";
    }

    if (window.location.hostname === "localhost") {
      return "localhost";
    }
    return window.location.hostname.split(".").slice(-2).join(".");
  }

  validateUsername(username: string): void {
    if (!username || typeof username !== "string") {
      throw new Error("Username must be a non-empty string");
    }
    if (
      username.length < MIN_USERNAME_LENGTH ||
      username.length > MAX_USERNAME_LENGTH
    ) {
      throw new Error(
        `Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters`
      );
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw new Error(
        "Username can only contain letters, numbers, underscores and hyphens"
      );
    }
  }

  async createAccount(
    username: string,
    credentials: WebAuthnCredentials | null,
    isNewDevice = false,
    deviceName?: string
  ): Promise<CredentialResult> {
    const result = await this.generateCredentials(
      username,
      credentials,
      isNewDevice,
      deviceName
    );
    if (!result.success) {
      throw new Error(
        result.error || "Errore durante la creazione dell'account"
      );
    }
    return result;
  }

  async generateCredentials(
    username: string,
    existingCreds: WebAuthnCredentials | null,
    isNewDevice = false,
    deviceName?: string
  ): Promise<CredentialResult> {
    try {
      this.validateUsername(username);

      if (!this.isSupported()) {
        throw new Error("WebAuthn non è supportato su questo browser");
      }

      if (!this.rpId || this.rpId.includes(":")) {
        throw new Error(
          "Dominio non valido per WebAuthn. Usa HTTPS e un dominio registrato"
        );
      }

      if (existingCreds && !isNewDevice) {
        throw new Error("Username già registrato con WebAuthn");
      }

      if (!existingCreds && isNewDevice) {
        throw new Error(
          "Username non trovato. Registrati prima come nuovo utente"
        );
      }

      const challenge = generateChallenge(username);

      const createCredentialOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: "Shogun Wallet",
          id: this.rpId,
        },
        user: {
          id: new TextEncoder().encode(username),
          name: username,
          displayName: username,
        },
        pubKeyCredParams: [
          {
            type: "public-key",
            alg: -7, // ES256
          },
          {
            type: "public-key",
            alg: -257, // RS256
          },
        ],
        timeout: TIMEOUT_MS,
        attestation: "direct" as AttestationConveyancePreference,
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          requireResidentKey: true,
        },
        extensions: {
          credProps: true,
        },
      };

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS);

      try {
        const credential = (await navigator.credentials.create({
          publicKey: createCredentialOptions,
          signal: abortController.signal,
        })) as PublicKeyCredential;

        const salt = existingCreds?.salt || uint8ArrayToHex(getRandomBytes(32));
        const { password } = generateCredentialsFromSalt(username, salt);
        const { name: defaultDeviceName, platform } = getPlatformInfo();
        const deviceId = generateDeviceId();

        const credentialId = bufferToBase64(credential.rawId);
        const newCredential: DeviceInfo = {
          deviceId,
          timestamp: Date.now(),
          name: deviceName || defaultDeviceName,
          platform,
        };

        const updatedCreds: WebAuthnCredentials = {
          salt,
          timestamp: Date.now(),
          credentials: {
            ...(existingCreds?.credentials || {}),
            [credentialId]: newCredential,
          },
        };

        return {
          success: true,
          username,
          password,
          credentialId,
          deviceInfo: newCredential,
          // Restituisci le credenziali aggiornate per il salvataggio esterno
          webAuthnCredentials: updatedCreds,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: unknown) {
      console.error("Errore generazione credenziali WebAuthn:", error);
      let errorMessage = "Errore sconosciuto";

      if (error instanceof Error && error.name === "SecurityError") {
        errorMessage = `Configurazione di sicurezza non valida: 
          1. Assicurati di usare HTTPS
          2. Il dominio deve essere registrato (no IP/porta)
          3. Sottodomini devono usare il dominio principale`;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async removeDevice(
    username: string,
    credentialId: string,
    credentials: WebAuthnCredentials
  ): Promise<{ success: boolean; updatedCredentials?: WebAuthnCredentials }> {
    if (!credentials?.credentials || !credentials.credentials[credentialId]) {
      return { success: false };
    }

    const updatedCreds = { ...credentials };
    delete updatedCreds.credentials[credentialId];

    return {
      success: true,
      updatedCredentials: updatedCreds,
    };
  }

  async authenticateUser(
    username: string,
    salt: string | null
  ): Promise<CredentialResult> {
    try {
      this.validateUsername(username);

      if (!salt) {
        throw new Error(
          "Nessuna credenziale WebAuthn trovata per questo username"
        );
      }

      const challenge = generateChallenge(username);

      const assertionOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials: [],
        timeout: TIMEOUT_MS,
        userVerification: "required" as UserVerificationRequirement,
        rpId: this.rpId,
      };

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS);

      try {
        const assertion = (await navigator.credentials.get({
          publicKey: assertionOptions,
          signal: abortController.signal,
        })) as PublicKeyCredential;

        if (!assertion) {
          throw new Error("Verifica WebAuthn fallita");
        }

        const { password } = generateCredentialsFromSalt(username, salt);

        return {
          success: true,
          username,
          password,
          credentialId: bufferToBase64(assertion.rawId),
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: unknown) {
      console.error("Errore login WebAuthn:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore sconosciuto",
      };
    }
  }

  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      window.PublicKeyCredential !== undefined &&
      typeof window.PublicKeyCredential === "function" &&
      typeof window.crypto !== "undefined" &&
      typeof window.crypto.subtle !== "undefined"
    );
  }

  /**
   * Ottiene le credenziali WebAuthn per un utente
   * @param username Nome utente
   * @returns Credenziali WebAuthn o null se non trovate
   */
  async getCredentialsForUser(username: string): Promise<any> {
    try {
      log(`Cerco credenziali WebAuthn per l'utente: ${username}`);

      // Implementa la logica per recuperare le credenziali WebAuthn
      // Questo è un esempio minimale, andrà adattato all'implementazione specifica

      // Verifica se l'utente esiste
      const userCredentials = localStorage.getItem(
        `webauthn_credentials_${username}`
      );

      if (!userCredentials) {
        log(`Nessuna credenziale WebAuthn trovata per l'utente: ${username}`);
        return null;
      }

      const credentials = JSON.parse(userCredentials);
      log(`Credenziali WebAuthn trovate per l'utente: ${username}`);

      return credentials;
    } catch (error) {
      logError(
        `Errore durante il recupero delle credenziali WebAuthn per l'utente: ${username}`,
        error
      );
      return null;
    }
  }

  /**
   * Crea una nuova credenziale WebAuthn integrata con GunDB
   * @param username - Username dell'utente
   * @returns Promise con le credenziali create
   */
  async createGunCredential(username: string): Promise<{
    credential: any;
    pub: string;
    authenticator: (data: any) => Promise<any>;
  }> {
    try {
      this.validateUsername(username);
      
      // Crea una nuova credenziale WebAuthn
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: getRandomBytes(16),
          rp: { id: window.location.hostname, name: "Shogun Wallet" },
          user: {
            id: new TextEncoder().encode(username),
            name: username,
            displayName: username
          },
          // Algoritmi compatibili con SEA
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },   // ECDSA, P-256
            { type: "public-key", alg: -25 },  // ECDH, P-256
            { type: "public-key", alg: -257 }  // RS256
          ],
          authenticatorSelection: {
            userVerification: "preferred"
          },
          timeout: 60000,
          attestation: "none"
        }
      });
      
      if (!credential) {
        throw new Error("Impossibile creare la credenziale WebAuthn");
      }
      
      // Estrai la chiave pubblica
      const response: any = credential?.id;
      const publicKey = response.getPublicKey();
      const rawKey = new Uint8Array(publicKey);
      
      // Estrai le coordinate X e Y (32 byte ciascuna)
      const xCoord = rawKey.slice(27, 59);
      const yCoord = rawKey.slice(59, 91);
      
      // Formato della chiave pubblica compatibile con GunDB/SEA
      const pub = `${base64url.encode(xCoord)}.${base64url.encode(yCoord)}`;
      
      // Crea una funzione authenticator per firmare dati
      const authenticator = async (data: any) => {
        const challenge = new TextEncoder().encode(
          typeof data === 'string' ? data : JSON.stringify(data)
        );
        
        const options = {
          publicKey: {
            challenge,
            rpId: window.location.hostname,
            userVerification: "preferred",
            allowCredentials: [{
              type: "public-key",
              id: credential.id
            }],
            timeout: 60000
          }
        };
        
        const assertion = await navigator.credentials.get(options);
        return assertion?.id;
      };
      
      // Salva l'associazione username -> pub in Gun
      if (this.gunInstance) {
        this.gunInstance.get(`webauthn_${username}`).put({ pub });
      }
      
      return { credential, pub, authenticator };
    } catch (error) {
      console.error("Errore nella creazione della credenziale Gun WebAuthn:", error);
      throw error;
    }
  }
  
  /**
   * Autentica un utente con WebAuthn e GunDB
   * @param username - Username dell'utente
   * @returns Credenziali per Gun
   */
  async authenticateWithGun(username: string): Promise<{
    success: boolean;
    authenticator?: (data: any) => Promise<any>;
    pub?: string;
    error?: string;
  }> {
    try {
      this.validateUsername(username);
      
      if (!this.gunInstance) {
        throw new Error("Istanza Gun non disponibile");
      }
      
      // Recupera la chiave pubblica salvata per l'utente
      return new Promise((resolve) => {
        this.gunInstance.get(`webauthn_${username}`).once(async (data: any) => {
          if (!data || !data.pub) {
            resolve({
              success: false,
              error: "Nessuna credenziale WebAuthn trovata per questo utente"
            });
            return;
          }
          
          try {
            const pub = data.pub;
            
            // Chiedi all'utente di autenticarsi con il dispositivo
            const credential = await navigator.credentials.get({
              publicKey: {
                challenge: getRandomBytes(16),
                rpId: window.location.hostname,
                userVerification: "preferred",
                allowCredentials: [{
                  type: "public-key",
                  // Qui avremmo bisogno dell'ID del dispositivo, ma non lo abbiamo salvato
                  // In un'implementazione completa, dovresti salvare anche l'ID
                  id: new Uint8Array([1, 2, 3, 4]) // Placeholder
                }],
                timeout: 60000
              }
            });
            
            if (!credential) {
              resolve({
                success: false,
                error: "Autenticazione fallita: nessuna credenziale restituita"
              });
              return;
            }
            
            // Crea l'authenticator
            const authenticator = async (data: any) => {
              const challenge = new TextEncoder().encode(
                typeof data === 'string' ? data : JSON.stringify(data)
              );
              
              const options = {
                publicKey: {
                  challenge,
                  rpId: window.location.hostname,
                  userVerification: "preferred",
                  allowCredentials: [{
                    type: "public-key",
                    id: credential.rawId
                  }],
                  timeout: 60000
                }
              };
              
              const assertion = await navigator.credentials.get(options);
              return assertion.response;
            };
            
            resolve({
              success: true,
              authenticator,
              pub
            });
          } catch (error) {
            console.error("Errore durante l'autenticazione WebAuthn:", error);
            resolve({
              success: false,
              error: error instanceof Error ? error.message : "Errore sconosciuto"
            });
          }
        });
      });
    } catch (error) {
      console.error("Errore in authenticateWithGun:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore sconosciuto"
      };
    }
  }
  
  /**
   * Firma un dato utilizzando WebAuthn
   * @param data - Dati da firmare
   * @param authenticator - Funzione per autenticare e firmare
   * @returns Promise con la firma
   */
  async signData(data: any, authenticator: (data: any) => Promise<any>): Promise<any> {
    try {
      // Utilizza SEA.sign se disponibile
      if (this.gunInstance && this.gunInstance.SEA) {
        return await this.gunInstance.SEA.sign(data, authenticator);
      } else {
        // Fallback: firma direttamente con l'authenticator
        return await authenticator(data);
      }
    } catch (error) {
      console.error("Errore durante la firma dei dati:", error);
      throw error;
    }
  }
  
  /**
   * Verifica una firma WebAuthn
   * @param signature - Firma da verificare
   * @param pub - Chiave pubblica
   * @returns Promise con i dati verificati o null
   */
  async verifySignature(signature: any, pub: string): Promise<any> {
    try {
      // Utilizza SEA.verify se disponibile
      if (this.gunInstance && this.gunInstance.SEA) {
        return await this.gunInstance.SEA.verify(signature, pub);
      } else {
        throw new Error("SEA non disponibile per la verifica");
      }
    } catch (error) {
      console.error("Errore durante la verifica della firma:", error);
      throw error;
    }
  }
  
  /**
   * Salva dati su GunDB utilizzando l'autenticazione WebAuthn
   * @param path - Percorso Gun
   * @param data - Dati da salvare
   * @param authenticator - Funzione per autenticare
   * @param pub - Chiave pubblica (opzionale, per scrivere nel grafo di un altro utente)
   * @returns Promise che si risolve quando i dati sono salvati
   */
  async putToGun(
    path: string,
    data: any,
    authenticator: (data: any) => Promise<any>,
    pub?: string
  ): Promise<void> {
    try {
      if (!this.gunInstance) {
        throw new Error("Istanza Gun non disponibile");
      }
      
      const options = {
        opt: { authenticator }
      };
      
      if (pub) {
        (options.opt as any).pub = pub;
      }
      
      await new Promise<void>((resolve, reject) => {
        this.gunInstance.get(path).put(data, (ack: any) => {
          if (ack.err) {
            reject(new Error(ack.err));
          } else {
            resolve();
          }
        }, options);
      });
    } catch (error) {
      console.error("Errore durante il salvataggio dei dati:", error);
      throw error;
    }
  }
}

if (typeof window !== "undefined") {
  window.Webauthn = Webauthn;
} else if (typeof global !== "undefined") {
  (global as any).Webauthn = Webauthn;
}

export { Webauthn, WebAuthnCredentials, DeviceInfo, CredentialResult };

// Simulazione delle funzioni per consentire la compilazione
const startRegistration = async (options: any): Promise<any> => {
  console.warn(
    "startRegistration è un mock, installare @simplewebauthn/browser per la funzionalità reale"
  );
  throw new Error(
    "Funzionalità non implementata: installare @simplewebauthn/browser"
  );
};

const startAuthentication = async (options: any): Promise<any> => {
  console.warn(
    "startAuthentication è un mock, installare @simplewebauthn/browser per la funzionalità reale"
  );
  throw new Error(
    "Funzionalità non implementata: installare @simplewebauthn/browser"
  );
};
