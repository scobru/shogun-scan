/**
 * Constants for WebAuthn configuration
 */
const TIMEOUT_MS = 60000;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 64;

import { ethers } from "ethers";
import { record, match, pipe } from "ts-minimal";

/**
 * Extends Window interface to include WebauthnAuth
 */
declare global {
  interface Window {
    Webauthn?: typeof Webauthn;
  }
}

/**
 * Extends NodeJS Global interface to include WebauthnAuth
 */
declare global {
  namespace NodeJS {
    interface Global {
      Webauthn?: typeof Webauthn;
    }
  }
}

/**
 * Definizione di schemi per la validazione
 */
const DeviceInfoSchema = record<{
  deviceId: string;
  timestamp: number;
  name: string;
  platform: string;
}>({
  deviceId: String,
  timestamp: Number,
  name: String,
  platform: String
});

type DeviceInfo = Parameters<typeof DeviceInfoSchema>[0];

const WebAuthnCredentialsSchema = record<{
  salt: string;
  timestamp: number;
  credentials: Record<string, DeviceInfo>;
}>({
  salt: String,
  timestamp: Number,
  credentials: Object
});

type WebAuthnCredentials = Parameters<typeof WebAuthnCredentialsSchema>[0];

const CredentialResultSchema = record<{
  success: boolean;
  username?: string;
  password?: string;
  credentialId?: string;
  deviceInfo?: DeviceInfo;
  error?: string;
  webAuthnCredentials?: WebAuthnCredentials;
}>({
  success: Boolean,
  username: String,
  password: String,
  credentialId: String,
  deviceInfo: Object,
  error: String,
  webAuthnCredentials: Object
});

type CredentialResult = Parameters<typeof CredentialResultSchema>[0];

/**
 * Genera un identificatore univoco per dispositivo
 */
const generateDeviceId = (): string => {
  const platform =
    typeof navigator !== "undefined" ? navigator.platform : "unknown";
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return uint8ArrayToHex(
    new TextEncoder().encode(`${platform}-${timestamp}-${random}`)
  );
};

/**
 * Ottiene informazioni sulla piattaforma
 */
const getPlatformInfo = (): { name: string; platform: string } => {
  if (typeof navigator === "undefined") {
    return { name: "unknown", platform: "unknown" };
  }

  const platform = navigator.platform;
  const userAgent = navigator.userAgent;
  
  return pipe(
    { platform, userAgent },
    (data) => match(data, {
      when: () => /iPhone|iPad|iPod/.test(data.platform),
      then: () => ({ name: "iOS Device", platform: data.platform }),
      otherwise: (d) => match(d, {
        when: () => /Android/.test(d.userAgent),
        then: () => ({ name: "Android Device", platform: d.platform }),
        otherwise: (d2) => match(d2, {
          when: () => /Win/.test(d2.platform),
          then: () => ({ name: "Windows Device", platform: d2.platform }),
          otherwise: (d3) => match(d3, {
            when: () => /Mac/.test(d3.platform),
            then: () => ({ name: "Mac Device", platform: d3.platform }),
            otherwise: (d4) => match(d4, {
              when: () => /Linux/.test(d4.platform),
              then: () => ({ name: "Linux Device", platform: d4.platform }),
              otherwise: () => ({ name: "Unknown Device", platform: d4.platform })
            })
          })
        })
      })
    })
  );
};

/**
 * Converte Uint8Array in stringa esadecimale
 */
const uint8ArrayToHex = (arr: Uint8Array): string => {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Ottiene bytes casuali sicuri crittograficamente
 */
const getRandomBytes = (length: number): Uint8Array => {
  return pipe(
    typeof window !== "undefined" && window.crypto,
    (crypto) => match(crypto, {
      when: (c) => !!c,
      then: (c) => c.getRandomValues(new Uint8Array(length)),
      otherwise: () => {
        throw new Error("Nessuna implementazione crittografica disponibile");
      }
    })
  );
};

/**
 * Genera una challenge per operazioni WebAuthn
 */
const generateChallenge = (username: string): Uint8Array => {
  const timestamp = Date.now().toString();
  const randomBytes = getRandomBytes(32);
  const challengeData = `${username}-${timestamp}-${uint8ArrayToHex(
    randomBytes
  )}`;
  return new TextEncoder().encode(challengeData);
};

/**
 * Converte ArrayBuffer in stringa base64 URL-safe
 */
const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const binary = bytes.reduce(
    (str, byte) => str + String.fromCharCode(byte),
    ""
  );
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};

/**
 * Converte stringa base64 URL-safe in ArrayBuffer
 */
const base64ToBuffer = (base64: string): ArrayBuffer => {
  return pipe(
    base64,
    (b64) => match(b64, {
      when: (s) => !/^[A-Za-z0-9\-_]*$/.test(s),
      then: () => {
        throw new Error("Invalid base64 string");
      },
      otherwise: (s) => {
        const base64Url = s.replace(/-/g, "+").replace(/_/g, "/");
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
      }
    })
  );
};

/**
 * Genera credenziali da username e salt
 */
const generateCredentialsFromSalt = (
  username: string,
  salt: string
): { password: string } => {
  const data = ethers.toUtf8Bytes(username + salt);
  return {
    password: ethers.sha256(data),
  };
};

/**
 * Classe principale WebAuthn per la gestione dell'autenticazione
 */
class Webauthn {
  private rpId: string;
  private gunInstance: any;
  private credential: any;

  /**
   * Crea una nuova istanza WebAuthn
   */
  constructor(gunInstance?: any) {
    this.rpId = window.location.hostname.split(':')[0];
    this.gunInstance = gunInstance;
    this.credential = null;
  }

  /**
   * Valida un username
   */
  validateUsername(username: string): void {
    pipe(
      username,
      (uname) => match(uname, {
        when: (u) => !u || typeof u !== "string",
        then: () => {
          throw new Error("Username must be a non-empty string");
        },
        otherwise: (u) => match(u, {
          when: (u2) => u2.length < MIN_USERNAME_LENGTH || u2.length > MAX_USERNAME_LENGTH,
          then: () => {
            throw new Error(
              `Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters`
            );
          },
          otherwise: (u3) => match(u3, {
            when: (u4) => !/^[a-zA-Z0-9_-]+$/.test(u4),
            then: () => {
              throw new Error(
                "Username can only contain letters, numbers, underscores and hyphens"
              );
            },
            otherwise: () => {} // Username è valido
          })
        })
      })
    );
  }

  /**
   * Crea un nuovo account WebAuthn
   */
  async createAccount(
    username: string,
    credentials: WebAuthnCredentials | null,
    isNewDevice = false
  ): Promise<CredentialResult> {
    const result = await this.generateCredentials(
      username,
      credentials,
      isNewDevice
    );
    
    return match(result.success, {
      when: (success) => !success,
      then: () => {
        throw new Error(
          result.error || "Errore durante la creazione dell'account"
        );
      },
      otherwise: () => result
    });
  }

  /**
   * Verifica se WebAuthn è supportato
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 
           window.PublicKeyCredential !== undefined;
  }

  /**
   * Crea una nuova credenziale
   */
  private async createCredential(username: string): Promise<any> {
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = new TextEncoder().encode(username);

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: "Shogun Wallet",
          ...(this.rpId !== 'localhost' && { id: this.rpId })
        },
        user: {
          id: userId,
          name: username,
          displayName: username
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }
        ],
        timeout: 60000,
        attestation: "none",
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "preferred",
          requireResidentKey: false
        }
      };

      console.log("Tentativo di creazione credenziali con opzioni:", publicKeyCredentialCreationOptions);

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      });

      return pipe(
        credential,
        (cred) => match(cred, {
          when: (c) => !c,
          then: () => {
            throw new Error("Creazione credenziali fallita");
          },
          otherwise: (c) => {
            console.log("Credenziali create con successo:", c);
            this.credential = c;
            return c;
          }
        })
      );
    } catch (error: any) {
      console.error("Errore dettagliato nella creazione delle credenziali:", error);
      throw new Error(`Errore nella creazione delle credenziali: ${error.message}`);
    }
  }

  /**
   * Genera o verifica credenziali
   */
  async generateCredentials(username: string, existingCredential?: any, isLogin = false): Promise<any> {
    try {
      return pipe(
        isLogin,
        (login) => match(login, {
          when: (l) => l,
          then: () => this.verifyCredential(username),
          otherwise: async () => {
            const credential = await this.createCredential(username);
            const credentialId = (credential as PublicKeyCredential).id;
            
            let publicKey = null;
            if (credential && (credential as any).response?.getPublicKey) {
              publicKey = (credential as any).response.getPublicKey();
            }

            return {
              success: true,
              credentialId,
              publicKey
            };
          }
        })
      );
    } catch (error: any) {
      console.error("Errore in generateCredentials:", error);
      return {
        success: false,
        error: error.message || "Errore durante l'operazione WebAuthn"
      };
    }
  }

  /**
   * Verifica una credenziale esistente
   */
  private async verifyCredential(username: string): Promise<any> {
    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const options: PublicKeyCredentialRequestOptions = {
        challenge,
        timeout: 60000,
        userVerification: "preferred",
        ...(this.rpId !== 'localhost' && { rpId: this.rpId })
      };

      if (this.credential?.rawId) {
        options.allowCredentials = [{
          id: this.credential.rawId,
          type: 'public-key'
        }];
      }

      const assertion = await navigator.credentials.get({
        publicKey: options
      });

      return pipe(
        assertion,
        (assert) => match(assert, {
          when: (a) => !a,
          then: () => ({
            success: false,
            error: "Verifica delle credenziali fallita"
          }),
          otherwise: (a) => ({
            success: true,
            credentialId: (a as PublicKeyCredential).id
          })
        })
      );
    } catch (error: any) {
      console.error("Errore nella verifica delle credenziali:", error);
      return {
        success: false,
        error: error.message || "Errore nella verifica delle credenziali"
      };
    }
  }

  /**
   * Salva la credenziale nel database Gun
   */
  private async saveToGun(username: string, credential: any): Promise<void> {
    pipe(
      this.gunInstance,
      (gun) => match(gun, {
        when: (g) => !!g,
        then: async (g) => {
          try {
            await g.get(`webauthn_${username}`).put({
              credentialId: credential.id,
              type: credential.type,
              timestamp: Date.now()
            });
          } catch (error: any) {
            console.error("Errore nel salvataggio delle credenziali su Gun:", error);
          }
        },
        otherwise: () => {} // Nessuna azione se gunInstance non è disponibile
      })
    );
  }

  /**
   * Rimuove le credenziali di un dispositivo
   */
  async removeDevice(
    username: string,
    credentialId: string,
    credentials: WebAuthnCredentials
  ): Promise<{ success: boolean; updatedCredentials?: WebAuthnCredentials }> {
    return pipe(
      credentials,
      (creds) => match(creds, {
        when: (c) => !c || !c.credentials || !c.credentials[credentialId],
        then: () => ({ success: false }),
        otherwise: (c) => {
          const updatedCreds = { ...c };
          // Assicuriamoci che credentials esista prima di modificarlo
          if (updatedCreds.credentials) {
            delete updatedCreds.credentials[credentialId];
          }

          return {
            success: true,
            updatedCredentials: updatedCreds,
          };
        }
      })
    );
  }

  /**
   * Autentica un utente
   */
  async authenticateUser(
    username: string,
    salt: string | null
  ): Promise<CredentialResult> {
    try {
      this.validateUsername(username);

      return pipe(
        salt,
        (s) => match(s, {
          when: (salt) => !salt,
          then: () => {
            throw new Error(
              "Nessuna credenziale WebAuthn trovata per questo username"
            );
          },
          otherwise: async (salt) => {
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

              return pipe(
                assertion,
                (assert) => match(assert, {
                  when: (a) => !a,
                  then: () => {
                    throw new Error("Verifica WebAuthn fallita");
                  },
                  otherwise: (a) => {
                    const { password } = generateCredentialsFromSalt(username, salt);

                    return {
                      success: true,
                      username,
                      password,
                      credentialId: bufferToBase64(a.rawId),
                    };
                  }
                })
              );
            } finally {
              clearTimeout(timeoutId);
            }
          }
        })
      );
    } catch (error: unknown) {
      console.error("Errore login WebAuthn:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Errore sconosciuto",
      };
    }
  }

  /**
   * Firma dati usando WebAuthn
   */
  async sign(data: any) {
    const signature = await navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array(16),
        rpId: this.rpId,
      },
    });
    return signature;
  }
}

// Add to global scope if available
if (typeof window !== "undefined") {
  window.Webauthn = Webauthn;
} else if (typeof global !== "undefined") {
  (global as any).Webauthn = Webauthn;
}

export { Webauthn, WebAuthnCredentials, DeviceInfo, CredentialResult };
