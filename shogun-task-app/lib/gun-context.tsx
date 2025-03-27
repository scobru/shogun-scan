"use client";

import { IGunInstance } from "gun";
import { ShogunCore } from "shogun-core";
// Importa ShogunCore solo lato client

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type GunContextType = {
  gun: IGunInstance | null;
  sdk: typeof ShogunCore | null;
  user: any | null;
  isAuthenticated: boolean;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  login: (username: string, password: string) => Promise<boolean>;
  signup: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loginWithWebAuthn: (username: string) => Promise<boolean>;
  signupWithWebAuthn: (username: string) => Promise<boolean>;
  isWebAuthnSupported: () => boolean;
  loginWithMetaMask: (address: string) => Promise<boolean>;
  signUpWithMetaMask: (address: string) => Promise<boolean>;
  createStealthAccount: () => Promise<any>;
  generateStealthAddress: (recipientPublicKey: string) => Promise<any>;
  openStealthAddress: (
    stealthAddress: string,
    ephemeralPublicKey: string
  ) => Promise<any>;
  createWallet: () => Promise<any>;
  loadWallets: () => Promise<any[]>;
  getMainWallet: () => any;
  handleLogin: (
    username: string,
    password: string,
    callbacks: {
      setUserpub: (pub: string) => void;
      setSignedIn: (signedIn: boolean) => void;
    }
  ) => Promise<any>;
  handleSignUp: (
    username: string,
    password: string,
    passwordConfirmation: string,
    callbacks: {
      setErrorMessage: (msg: string) => void;
      setUserpub: (pub: string) => void;
      setSignedIn: (signedIn: boolean) => void;
      messages: {
        mismatched: string;
        empty: string;
        exists: string;
      };
    }
  ) => Promise<any>;
  setUser: (user: any) => void;
};

export function GunProvider({ children }: { children: ReactNode }) {
  const [gun, setGun] = useState<IGunInstance | null>(null);
  const [sdk, setSdk] = useState<ShogunCore | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [wallets, setWallets] = useState<any[]>([]);

  useEffect(() => {
    // Inizializza Gun con ShogunSDK
    try {
      const shogunSDK = new ShogunCore({
        peers: ["http://gun-relay.scobrudot.dev/gun"],
      }) as ShogunCore;

      // Verifica che l'SDK sia stato inizializzato correttamente
      if (!shogunSDK.gundb || !shogunSDK.gun) {
        console.error(
          "Errore nell'inizializzazione dell'SDK: GunDB o Gun non disponibili"
        );
        return;
      }

      setSdk(shogunSDK);

      const gunInstance = shogunSDK.gundb.gun as IGunInstance;
      setGun(gunInstance);

      // Verifica se l'utente è già autenticato
      const savedUser = localStorage.getItem("gunUser");
      if (savedUser && shogunSDK.isLoggedIn()) {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
        setIsAuthenticated(true);

        // Carica i wallet dell'utente
        shogunSDK
          .loadWallets()
          .then((walletList) => {
            setWallets(walletList);
          })
          .catch((err) => {
            console.error("Errore nel caricamento dei wallet:", err);
          });
      }
    } catch (error) {
      console.error("Errore nell'inizializzazione di ShogunSDK:", error);
    }

    return () => {
      // Pulizia
      if (sdk) {
        sdk.logout();
      }
    };
  }, []);

  const login = async (
    username: string,
    password: string
  ): Promise<boolean> => {
    if (!sdk) {
      console.error("SDK non inizializzato");
      return false;
    }

    try {
      console.log("Tentativo di login con:", { username });

      const result = await sdk.handleLogin(username, password, {
        setUserpub: (pub: string) => {
          console.log("Login riuscito, pub:", pub);
          // Aggiorniamo il context con il pub dell'utente
          const userData = { pub };
          setUser(userData);
        },
        setSignedIn: (signedIn: boolean) => {
          console.log("Login stato:", signedIn);
          setIsAuthenticated(signedIn);
        },
      });

      console.log("Risultato login:", result);

      if (result.success) {
        // Salva l'utente anche se non c'è il wallet (caso MetaMask)
        if (result.wallet || result.userPub) {
          const userData = result.wallet || { pub: result.userPub };
          setUser(userData);
          setIsAuthenticated(true);
          // Salva l'utente nel localStorage
          localStorage.setItem(
            "gunUser",
            JSON.stringify({
              ...userData,
              username,
              password, // Salviamo la password per i login futuri
            })
          );
          return true;
        }
      } else if (result.error) {
        console.error("Errore durante il login:", result.error);
        throw new Error(result.error);
      }

      return false;
    } catch (error: any) {
      console.error("Errore durante il login:", error);
      // Se il documento non esiste, proviamo a crearlo
      if (
        error.message?.includes("Document not found") ||
        error.message?.includes("not found")
      ) {
        try {
          console.log(
            "Utente non trovato, tentativo di registrazione automatica"
          );
          // Tentiamo di registrare l'utente
          const signupResult = await signup(username, password);
          if (signupResult) {
            console.log(
              "Registrazione automatica riuscita, tentativo di login"
            );
            return login(username, password);
          }
        } catch (signupError) {
          console.error(
            "Errore durante il tentativo di registrazione:",
            signupError
          );
        }
      }
      return false;
    }
  };

  const signup = async (
    username: string,
    password: string
  ): Promise<boolean> => {
    if (!sdk) {
      console.error("SDK non inizializzato");
      return false;
    }

    try {
      console.log("Tentativo di registrazione con:", { username });

      const result = await sdk.handleSignUp(username, password, password, {
        setErrorMessage: (msg: string) => {
          console.error("Errore durante la registrazione:", msg);
        },
        setUserpub: (pub: string) => {
          console.log("Registrazione riuscita, pub:", pub);
          // Aggiorniamo il context con il pub dell'utente
          const userData = { pub };
          setUser(userData);
        },
        setSignedIn: (signedIn: boolean) => {
          console.log("Registrazione stato:", signedIn);
          setIsAuthenticated(signedIn);
        },
        messages: {
          mismatched: "Le password non corrispondono",
          empty: "Tutti i campi sono obbligatori",
          exists: "Utente già esistente",
        },
      });

      console.log("Risultato registrazione:", result);

      if (result.success) {
        // Salva l'utente anche se non c'è il wallet (caso MetaMask)
        if (result.wallet || result.userPub) {
          const userData = result.wallet || { pub: result.userPub };
          setUser(userData);
          setIsAuthenticated(true);
          // Salva l'utente nel localStorage
          localStorage.setItem(
            "gunUser",
            JSON.stringify({
              ...userData,
              username,
              password, // Salviamo la password per i login futuri
            })
          );
          return true;
        }
      } else if (result.error) {
        console.error("Errore durante la registrazione:", result.error);
        throw new Error(result.error);
      }

      return false;
    } catch (error) {
      console.error("Errore durante la registrazione:", error);
      return false;
    }
  };

  const logout = () => {
    if (!sdk) {
      console.error("SDK non inizializzato");
      return;
    }

    try {
      console.log("Logout in corso...");
      sdk.logout();
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem("gunUser");
      console.log("Logout completato");
    } catch (error) {
      console.error("Errore durante il logout:", error);
    }
  };

  const loginWithWebAuthn = async (username: string): Promise<boolean> => {
    if (!sdk) {
      console.error("SDK non inizializzato");
      return false;
    }

    try {
      console.log("Tentativo di login con WebAuthn:", { username });

      const result = await sdk.loginWithWebAuthn(username);
      console.log("Risultato login WebAuthn:", result);

      if (result.success) {
        const userData = {
          pub: result.userPub || result.credentialId,
          username,
          authMethod: "webauthn",
          password: result.password, // Salviamo la password generata dall'SDK
        };
        console.log("Login WebAuthn riuscito, dati utente:", userData);
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem("gunUser", JSON.stringify(userData));
        return true;
      } else if (result.error) {
        console.error("Errore durante il login WebAuthn:", result.error);
        throw new Error(result.error);
      }

      return false;
    } catch (error: any) {
      console.error("Errore durante il login con WebAuthn:", error);
      return false;
    }
  };

  const signupWithWebAuthn = async (username: string): Promise<boolean> => {
    if (!sdk) {
      console.error("SDK non inizializzato");
      return false;
    }

    try {
      console.log("Tentativo di registrazione con WebAuthn:", { username });

      const result = await sdk.registerWithWebAuthn(username);
      console.log("Risultato registrazione WebAuthn:", result);

      if (result.success) {
        const userData = {
          pub: result.userPub || result.credentialId,
          username,
          authMethod: "webauthn",
          password: result.password, // Salviamo la password generata dall'SDK
        };
        console.log("Registrazione WebAuthn riuscita, dati utente:", userData);
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem("gunUser", JSON.stringify(userData));
        return true;
      } else if (result.error) {
        console.error(
          "Errore durante la registrazione WebAuthn:",
          result.error
        );
        throw new Error(result.error);
      }

      return false;
    } catch (error: any) {
      console.error("Errore durante la registrazione con WebAuthn:", error);
      return false;
    }
  };

  const isWebAuthnSupported = (): boolean => {
    if (!sdk) {
      console.error("SDK non inizializzato");
      return false;
    }

    try {
      return sdk.isWebAuthnSupported();
    } catch (error) {
      console.error("Errore nel controllo del supporto WebAuthn:", error);
      return false;
    }
  };

  const loginWithMetaMask = async (address: string): Promise<boolean> => {
    if (!sdk) {
      console.error("SDK non inizializzato");
      return false;
    }

    try {
      console.log("Tentativo di login con MetaMask:", { address });

      if (!sdk.metamask) {
        console.error("MetaMask non è inizializzato nell'SDK");
        return false;
      }

      // Verifica se MetaMask è disponibile nel browser
      if (typeof window !== "undefined" && !window.ethereum) {
        console.error("MetaMask non è installato nel browser");
        return false;
      }

      const result = await sdk.loginWithMetaMask(address);
      console.log("Risultato login MetaMask:", result);

      if (result.success) {
        // Formato username coerente con l'SDK
        const username = `metamask_${address.slice(0, 10)}`;

        const userData = {
          pub: result.userPub,
          username: username,
          authMethod: "metamask",
          password: result.password,
          wallet: result.wallet,
        };

        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem("gunUser", JSON.stringify(userData));
        return true;
      } else if (result.error) {
        console.error("Errore durante il login con MetaMask:", result.error);

        // Se l'utente non esiste, prova a registrarlo
        if (
          result.error.includes("not found") ||
          result.error.includes("not registered")
        ) {
          console.log("Utente non trovato, tentativo di registrazione...");
          return signUpWithMetaMask(address);
        }
      }

      return false;
    } catch (error: any) {
      console.error("Errore durante il login con MetaMask:", error);
      return false;
    }
  };

  const signUpWithMetaMask = async (address: string): Promise<boolean> => {
    if (!sdk) {
      console.error("SDK non inizializzato");
      return false;
    }

    try {
      console.log("Tentativo di registrazione con MetaMask:", { address });

      if (!sdk.metamask) {
        console.error("MetaMask non è inizializzato nell'SDK");
        return false;
      }

      // Verifica se MetaMask è disponibile nel browser
      if (typeof window !== "undefined" && !window.ethereum) {
        console.error("MetaMask non è installato nel browser");
        return false;
      }

      const result = await sdk.signUpWithMetaMask(address);
      console.log("Risultato registrazione MetaMask:", result);

      if (result.success) {
        // Formato username coerente con l'SDK
        const username = `metamask_${address.slice(0, 10)}`;

        const userData = {
          pub: result.userPub,
          username: username,
          authMethod: "metamask",
          password: result.password,
          wallet: result.wallet,
        };

        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem("gunUser", JSON.stringify(userData));
        return true;
      } else if (result.error) {
        console.error(
          "Errore durante la registrazione con MetaMask:",
          result.error
        );

        // Se l'utente esiste già, prova a fare login
        if (
          result.error.includes("already exists") ||
          result.error.includes("already created")
        ) {
          console.log("Utente già esistente, tentativo di login...");
          return loginWithMetaMask(address);
        }
      }

      return false;
    } catch (error: any) {
      console.error("Errore durante la registrazione con MetaMask:", error);
      return false;
    }
  };

  const createStealthAccount = async (): Promise<any> => {
    if (!sdk) {
      console.error("SDK non inizializzato");
      return null;
    }

    try {
      const stealthAccount = await sdk.createStealthAccount();
      return stealthAccount;
    } catch (error: any) {
      console.error("Errore nella creazione dell'account stealth:", error);
      throw error;
    }
  };

  const generateStealthAddress = async (
    recipientPublicKey: string
  ): Promise<any> => {
    if (!sdk || !sdk.stealth) {
      console.error("SDK o modulo stealth non inizializzato");
      return null;
    }

    try {
      const stealthAddress =
        await sdk.generateStealthAddress(recipientPublicKey);
      return stealthAddress;
    } catch (error: any) {
      console.error("Errore nella generazione dell'indirizzo stealth:", error);
      throw error;
    }
  };

  const openStealthAddress = async (
    stealthAddress: string,
    ephemeralPublicKey: string
  ): Promise<any> => {
    if (!sdk || !sdk.stealth) {
      console.error("SDK o modulo stealth non inizializzato");
      return null;
    }

    try {
      const wallet = await sdk.openStealthAddress(
        stealthAddress,
        ephemeralPublicKey
      );
      return wallet;
    } catch (error: any) {
      console.error("Errore nell'apertura dell'indirizzo stealth:", error);
      throw error;
    }
  };

  const createWallet = async (): Promise<any> => {
    if (!sdk) {
      console.error("SDK non inizializzato");
      return null;
    }

    try {
      const newWallet = await sdk.createWallet();
      setWallets((prev) => [...prev, newWallet]);
      return newWallet;
    } catch (error: any) {
      console.error("Errore nella creazione del wallet:", error);
      throw error;
    }
  };

  const loadWallets = async (): Promise<any[]> => {
    if (!sdk) {
      console.error("SDK non inizializzato");
      return [];
    }

    try {
      const walletList = await sdk.loadWallets();
      setWallets(walletList);
      return walletList;
    } catch (error: any) {
      console.error("Errore nel caricamento dei wallet:", error);
      throw error;
    }
  };

  const getMainWallet = (): any => {
    if (!sdk) {
      console.error("SDK non inizializzato");
      return null;
    }

    try {
      return sdk.getMainWallet();
    } catch (error: any) {
      console.error("Errore nel recupero del wallet principale:", error);
      throw error;
    }
  };

  const handleLogin = async (
    username: string,
    password: string,
    callbacks: {
      setUserpub: (pub: string) => void;
      setSignedIn: (signedIn: boolean) => void;
    }
  ): Promise<any> => {
    if (!sdk) {
      console.error("SDK non inizializzato");
      return { success: false, error: "SDK non inizializzato" };
    }

    try {
      const result = await sdk.login(username, password);

      if (result.success && result.userPub) {
        callbacks.setUserpub(result.userPub);
        callbacks.setSignedIn(true);
      }

      return result;
    } catch (error: any) {
      console.error("Errore di login:", error);
      return {
        success: false,
        error: error.message || "Errore durante il login",
      };
    }
  };

  const handleSignUp = async (
    username: string,
    password: string,
    passwordConfirmation: string,
    callbacks: {
      setErrorMessage: (msg: string) => void;
      setUserpub: (pub: string) => void;
      setSignedIn: (signedIn: boolean) => void;
      messages: {
        mismatched: string;
        empty: string;
        exists: string;
      };
    }
  ): Promise<any> => {
    if (!sdk) {
      console.error("SDK non inizializzato");
      return { success: false, error: "SDK non inizializzato" };
    }

    // Validazione base
    if (!username || !password || !passwordConfirmation) {
      callbacks.setErrorMessage(callbacks.messages.empty);
      return { success: false, error: callbacks.messages.empty };
    }

    if (password !== passwordConfirmation) {
      callbacks.setErrorMessage(callbacks.messages.mismatched);
      return { success: false, error: callbacks.messages.mismatched };
    }

    try {
      const result = await sdk.signUp(username, password, passwordConfirmation);

      if (result.success && result.userPub) {
        callbacks.setUserpub(result.userPub);
        callbacks.setSignedIn(true);
      }

      return result;
    } catch (error: any) {
      console.error("Errore di registrazione:", error);
      return {
        success: false,
        error: error.message || "Errore durante la registrazione",
      };
    }
  };

  return (
    <GunContext.Provider
      value={{
        gun,
        sdk,
        user,
        isAuthenticated,
        setIsAuthenticated,
        login,
        signup,
        logout,
        loginWithWebAuthn,
        signupWithWebAuthn,
        isWebAuthnSupported,
        loginWithMetaMask,
        signUpWithMetaMask,
        createStealthAccount,
        generateStealthAddress,
        openStealthAddress,
        createWallet,
        loadWallets,
        getMainWallet,
        handleLogin,
        handleSignUp,
        setUser,
      }}
    >
      {children}
    </GunContext.Provider>
  );
}

const GunContext = createContext<GunContextType>({
  gun: null,
  sdk: null,
  user: null,
  isAuthenticated: false,
  setIsAuthenticated: () => {},
  login: async () => false,
  signup: async () => false,
  logout: () => {},
  loginWithWebAuthn: async () => false,
  signupWithWebAuthn: async () => false,
  isWebAuthnSupported: () => false,
  loginWithMetaMask: async () => false,
  signUpWithMetaMask: async () => false,
  createStealthAccount: async () => null,
  generateStealthAddress: async () => null,
  openStealthAddress: async () => null,
  createWallet: async () => null,
  loadWallets: async () => [],
  getMainWallet: () => null,
  handleLogin: async () => ({ success: false, error: "SDK non inizializzato" }),
  handleSignUp: async () => ({
    success: false,
    error: "SDK non inizializzato",
  }),
  setUser: () => {},
});

export const useGun = () => useContext(GunContext);
