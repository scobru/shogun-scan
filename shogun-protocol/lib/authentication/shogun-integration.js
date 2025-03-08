import { ShogunSDK } from "shogun-sdk";
import { isAuthenticated } from "./isAuthenticated";
import { Subject } from "rxjs";
import SEA from "gun/sea"; // Importa SEA direttamente per backup

// Inizializza ShogunSDK con le stesse configurazioni
export const shogunSDK = new ShogunSDK({
  peers: ["http://localhost:8765/gun"],
  localStorage: false,
  radisk: false
});

// Esporta gun e user da shogunSDK
export const gun = shogunSDK.gun;
export const user = gun.user().recall({ sessionStorage: true });

// Esponi SEA per essere usato in tutto il sistema
export const SEAModule = SEA;

// Crea un soggetto per gli eventi di autenticazione specifico per Shogun
export const shogunIsAuthenticated = new Subject();

// Esporta il riferimento a gun da ShogunSDK per mantenere consistenza
export const shogunGun = shogunSDK.gun;

/**
 * Login con Shogun
 * @param {Object} credentials Credenziali dell'utente
 * @param {Function} callback Funzione di callback
 */
export const shogunLogin = async (credentials = {}, callback = () => {}) => {
  try {
    console.log("⚔️ ShogunSDK:Inizio processo di login...");
    console.log("⚔️ ShogunSDK:Verifica credenziali Hedgehog...");
    console.log("⚔️ ShogunSDK:SEA disponibile:", !!SEAModule);

    const result = await shogunSDK.handleLogin(
      credentials.username,
      credentials.password,
      {
        setUserpub: (pub) => {
          console.log("setUserpub chiamato con", pub);
          // Aggiorna lo stato di autenticazione
          isAuthenticated.next(true);
          shogunIsAuthenticated.next(true);
        },
        setSignedIn: (value) => {
          console.log("setSignedIn chiamato con", value);
          isAuthenticated.next(value);
          shogunIsAuthenticated.next(value);
        },
      }
    );

    if (!result.success) {
      return callback({
        errMessage: result.error || "Errore durante il login",
        errCode: "shogun-auth-error",
      });
    }

    return callback({
      errMessage: undefined,
      errCode: undefined,
      pub: result.pub,
      message: "Autenticazione utente completata con successo.",
    });
  } catch (error) {
    console.error("Errore completo durante shogunLogin:", error);
    return callback({
      errMessage: error.message || "Errore sconosciuto durante il login",
      errCode: "shogun-auth-error",
    });
  }
};

/**
 * Registrazione con Shogun
 * @param {Object} credentials Credenziali dell'utente
 * @param {Function} callback Funzione di callback
 */
export const shogunRegister = async (credentials = {}, callback = () => {}) => {
  try {
    console.log("⚔️ ShogunSDK:Start handleSignUp");

    if (!credentials.username || !credentials.password) {
      return callback({
        errMessage: "Username e password sono richiesti",
        errCode: "invalid-credentials",
      });
    }

    const result = await shogunSDK.handleSignUp(
      credentials.username,
      credentials.password,
      credentials.password,
      {
        setErrorMessage: (msg) => {
          console.log("Messaggio di errore durante signup:", msg);
        },
        setUserpub: (pub) => {
          // Gestisce la chiave pubblica dell'utente
          console.log("Chiave pubblica ottenuta:", pub);
        },
        setSignedIn: (value) => {
          console.log("setSignedIn chiamato con valore:", value);
          isAuthenticated.next(value);
          shogunIsAuthenticated.next(value);
        },
        messages: {
          mismatched: "Le password non corrispondono",
          empty: "I campi non possono essere vuoti",
        },
      }
    );

    if (!result.success) {
      return callback({
        errMessage: result.error || "Errore durante la registrazione",
        errCode: "shogun-register-error",
      });
    }

    return callback({
      errMessage: undefined,
      errCode: undefined,
      pub: result.pub,
      message: "Utente creato con successo.",
    });
  } catch (error) {
    console.error("Errore completo durante shogunRegister:", error);
    return callback({
      errMessage:
        error.message || "Errore sconosciuto durante la registrazione",
      errCode: "shogun-register-error",
    });
  }
};

/**
 * Logout con Shogun
 */
export const shogunLogout = () => {
  shogunSDK.performLogout(shogunSDK.gun.user().is?.pub, () => {
    isAuthenticated.next(false);
  });
};

/**
 * Funzioni per wallet e altre funzionalità di Shogun
 */
export const loadWallets = async () => {
  try {
    return await shogunSDK.getWalletPaths(shogunSDK.gun.user().is?.pub);
  } catch (error) {
    console.error("Errore nel caricamento dei wallet:", error);
    return [];
  }
};

export const createWallet = async () => {
  try {
    const user = shogunSDK.gun.user().is;
    if (!user || !user.pub) {
      throw new Error("Utente non autenticato");
    }

    const newIndex = await loadWallets().then((wallets) => wallets.length);
    return await shogunSDK.deriveWallet(user.pub, newIndex);
  } catch (error) {
    console.error("Errore nella creazione del wallet:", error);
    throw error;
  }
};

export const signMessage = async (address, message) => {
  try {
    return await shogunSDK.signMessage(address, message);
  } catch (error) {
    console.error("Errore durante la firma:", error);
    throw error;
  }
};

// Export StealthAddress funzionalità
export const stealth = {
  generateStealthAddress: async (senderPublicKey, recipientPublicKey) => {
    try {
      return await shogunSDK.stealth?.generateStealthAddress(
        senderPublicKey,
        recipientPublicKey
      );
    } catch (error) {
      console.error("Errore nella generazione dell'indirizzo stealth:", error);
      throw error;
    }
  },

  openStealthAddress: async (stealthAddress, ephemeralKey) => {
    try {
      return await shogunSDK.stealth?.openStealthAddress(
        stealthAddress,
        ephemeralKey
      );
    } catch (error) {
      console.error("Errore nell'apertura dell'indirizzo stealth:", error);
      throw error;
    }
  },
};

/**
 * Login con Metamask
 * @param {Object} credentials Credenziali dell'utente
 * @param {Function} callback Funzione di callback
 */
export const loginWithMetamask = async (credentials = {}, callback = () => {}) => {
  try {
    console.log("⚔️ ShogunSDK:Inizio processo di login con Metamask...");
    
    const { address, signature, message } = credentials;
    
    if (!address || !signature || !message) {
      return callback({
        errMessage: "Informazioni di autenticazione Metamask incomplete",
        errCode: "metamask-auth-error",
      });
    }
    
    // Verifica la firma
    const recoveredAddress = await shogunSDK.verifyEthereumSignature(message, signature);
    
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return callback({
        errMessage: "Verifica della firma Ethereum fallita",
        errCode: "metamask-signature-error",
      });
    }
    
    // Ottieni o crea l'utente associato a questo indirizzo
    const result = await shogunSDK.handleEthereumLogin(address, {
      setUserpub: (pub) => {
        isAuthenticated.next(true);
        shogunIsAuthenticated.next(true);
      },
      setSignedIn: (value) => {
        isAuthenticated.next(value);
        shogunIsAuthenticated.next(value);
      },
    });

    if (!result.success) {
      return callback({
        errMessage: result.error || "Errore durante il login con Metamask",
        errCode: "metamask-auth-error",
      });
    }

    return callback({
      errMessage: undefined,
      errCode: undefined,
      pub: result.pub,
      message: "Autenticazione con Metamask completata con successo.",
    });
  } catch (error) {
    console.error("Errore completo durante loginWithMetamask:", error);
    return callback({
      errMessage: error.message || "Errore sconosciuto durante il login con Metamask",
      errCode: "metamask-auth-error",
    });
  }
};

/**
 * Registrazione con Metamask
 * @param {Object} credentials Credenziali dell'utente
 * @param {Function} callback Funzione di callback
 */
export const registerWithMetamask = async (credentials = {}, callback = () => {}) => {
  try {
    console.log("⚔️ ShogunSDK:Inizio processo di registrazione con Metamask...");
    
    const { address, signature, message, username } = credentials;
    
    if (!address || !signature || !message) {
      return callback({
        errMessage: "Informazioni di registrazione Metamask incomplete",
        errCode: "metamask-register-error",
      });
    }
    
    // Verifica la firma
    const recoveredAddress = await shogunSDK.verifyEthereumSignature(message, signature);
    
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return callback({
        errMessage: "Verifica della firma Ethereum fallita",
        errCode: "metamask-signature-error",
      });
    }
    
    // Registra l'utente con indirizzo Ethereum
    const result = await shogunSDK.handleEthereumRegistration(address, username, {
      setUserpub: (pub) => {
        isAuthenticated.next(true);
        shogunIsAuthenticated.next(true);
      },
      setSignedIn: (value) => {
        isAuthenticated.next(value);
        shogunIsAuthenticated.next(value);
      },
    });

    if (!result.success) {
      return callback({
        errMessage: result.error || "Errore durante la registrazione con Metamask",
        errCode: "metamask-register-error",
      });
    }

    return callback({
      errMessage: undefined,
      errCode: undefined,
      pub: result.pub,
      message: "Registrazione con Metamask completata con successo.",
    });
  } catch (error) {
    console.error("Errore completo durante registerWithMetamask:", error);
    return callback({
      errMessage: error.message || "Errore sconosciuto durante la registrazione con Metamask",
      errCode: "metamask-register-error",
    });
  }
};

/**
 * Login con WebAuthn
 * @param {Object} credentials Credenziali dell'utente
 * @param {Function} callback Funzione di callback
 */
export const loginWithWebAuthn = async (credentials = {}, callback = () => {}) => {
  try {
    console.log("⚔️ ShogunSDK:Inizio processo di login con WebAuthn...");
    
    const { username } = credentials;
    
    if (!username) {
      return callback({
        errMessage: "Username richiesto per l'autenticazione WebAuthn",
        errCode: "webauthn-auth-error",
      });
    }
    
    // Verifica se WebAuthn è supportato
    if (!window.PublicKeyCredential) {
      return callback({
        errMessage: "WebAuthn non è supportato in questo browser",
        errCode: "webauthn-not-supported",
      });
    }
    
    // Verifica se ShogunSDK supporta WebAuthn
    if (!shogunSDK.getWebAuthnAssertion) {
      console.error("ShogunSDK non supporta WebAuthn in questa versione");
      return callback({
        errMessage: "Autenticazione WebAuthn non supportata in questa versione di ShogunSDK",
        errCode: "webauthn-not-implemented",
      });
    }
    
    // Richiedi l'asserzione (autenticazione)
    const assertion = await shogunSDK.getWebAuthnAssertion(username);
    
    if (!assertion) {
      return callback({
        errMessage: "Impossibile ottenere l'asserzione WebAuthn",
        errCode: "webauthn-assertion-error",
      });
    }
    
    // Effettua il login con l'asserzione
    const result = await shogunSDK.handleWebAuthnLogin(username, assertion, {
      setUserpub: (pub) => {
        isAuthenticated.next(true);
        shogunIsAuthenticated.next(true);
      },
      setSignedIn: (value) => {
        isAuthenticated.next(value);
        shogunIsAuthenticated.next(value);
      },
    });

    if (!result.success) {
      return callback({
        errMessage: result.error || "Errore durante il login con WebAuthn",
        errCode: "webauthn-auth-error",
      });
    }

    return callback({
      errMessage: undefined,
      errCode: undefined,
      pub: result.pub,
      message: "Autenticazione con WebAuthn completata con successo.",
    });
  } catch (error) {
    console.error("Errore completo durante loginWithWebAuthn:", error);
    return callback({
      errMessage: error.message || "Errore sconosciuto durante il login con WebAuthn",
      errCode: "webauthn-auth-error",
    });
  }
};

/**
 * Registrazione con WebAuthn
 * @param {Object} credentials Credenziali dell'utente
 * @param {Function} callback Funzione di callback
 */
export const registerWithWebAuthn = async (credentials = {}, callback = () => {}) => {
  try {
    console.log("⚔️ ShogunSDK:Inizio processo di registrazione con WebAuthn...");
    
    const { username } = credentials;
    
    if (!username) {
      return callback({
        errMessage: "Username richiesto per la registrazione WebAuthn",
        errCode: "webauthn-register-error",
      });
    }
    
    // Verifica se WebAuthn è supportato
    if (!window.PublicKeyCredential) {
      return callback({
        errMessage: "WebAuthn non è supportato in questo browser",
        errCode: "webauthn-not-supported",
      });
    }
    
    // Verifica se ShogunSDK supporta WebAuthn
    if (!shogunSDK.createWebAuthnAttestation) {
      console.error("ShogunSDK non supporta WebAuthn in questa versione");
      return callback({
        errMessage: "Registrazione WebAuthn non supportata in questa versione di ShogunSDK",
        errCode: "webauthn-not-implemented",
      });
    }
    
    // Crea una nuova attestazione (registrazione)
    const attestation = await shogunSDK.createWebAuthnAttestation(username);
    
    if (!attestation) {
      return callback({
        errMessage: "Impossibile creare l'attestazione WebAuthn",
        errCode: "webauthn-attestation-error",
      });
    }
    
    // Registra l'utente con l'attestazione
    const result = await shogunSDK.handleWebAuthnRegistration(username, attestation, {
      setUserpub: (pub) => {
        isAuthenticated.next(true);
        shogunIsAuthenticated.next(true);
      },
      setSignedIn: (value) => {
        isAuthenticated.next(value);
        shogunIsAuthenticated.next(value);
      },
    });

    if (!result.success) {
      return callback({
        errMessage: result.error || "Errore durante la registrazione con WebAuthn",
        errCode: "webauthn-register-error",
      });
    }

    return callback({
      errMessage: undefined,
      errCode: undefined,
      pub: result.pub,
      message: "Registrazione con WebAuthn completata con successo.",
    });
  } catch (error) {
    console.error("Errore completo durante registerWithWebAuthn:", error);
    return callback({
      errMessage: error.message || "Errore sconosciuto durante la registrazione con WebAuthn",
      errCode: "webauthn-register-error",
    });
  }
};
