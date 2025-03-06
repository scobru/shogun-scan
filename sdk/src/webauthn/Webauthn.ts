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

class Webauthn {
  private rpId: string;

  constructor() {
    this.rpId = this.getRpId();
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
          webAuthnCredentials: updatedCreds
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
  ): Promise<{success: boolean, updatedCredentials?: WebAuthnCredentials}> {
    if (!credentials?.credentials || !credentials.credentials[credentialId]) {
      return { success: false };
    }

    const updatedCreds = { ...credentials };
    delete updatedCreds.credentials[credentialId];

    return { 
      success: true,
      updatedCredentials: updatedCreds
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
}

if (typeof window !== "undefined") {
  window.Webauthn = Webauthn;
} else if (typeof global !== "undefined") {
  (global as any).Webauthn = Webauthn;
}

export { Webauthn, WebAuthnCredentials, DeviceInfo, CredentialResult };
