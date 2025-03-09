import React, { useContext, useState, createContext } from 'react';
import { ethers } from 'ethers';
import { ShogunSDK } from '@shogun/shogun-core';
import '../types'; // Importa il file dei tipi per estendere le definizioni

// Tipi personalizzati per gestire le risposte dell'SDK
interface ExtendedAuthResult {
  success: boolean;
  userPub?: string;
  publicKey?: string;
  wallet?: ethers.Wallet;
  error?: string;
}

// Tipo di contesto per ShogunProvider
type ShogunContextType = {
  sdk: ShogunSDK | null;
  options: {
    appName: string;
    appDescription?: string;
    appUrl?: string;
    appIcon?: string;
    showMetamask?: boolean;
    showWebauthn?: boolean;
    darkMode?: boolean;
  };
  isLoggedIn: boolean;
  userPub: string | null;
  username: string | null;
  wallet: ethers.Wallet | null;
  login: (username: string, password: string) => Promise<any>;
  signUp: (username: string, password: string, confirmPassword: string) => Promise<any>;
  loginWithMetaMask: () => Promise<any>;
  signUpWithMetaMask: () => Promise<any>;
  loginWithWebAuthn: (username: string) => Promise<any>;
  signUpWithWebAuthn: (username: string) => Promise<any>;
  logout: () => void;
};

// Contesto predefinito
const defaultContext: ShogunContextType = {
  sdk: null,
  options: {
    appName: 'Shogun App',
    darkMode: true,
    showMetamask: true,
    showWebauthn: true,
  },
  isLoggedIn: false,
  userPub: null,
  username: null,
  wallet: null,
  login: async () => ({}),
  signUp: async () => ({}),
  loginWithMetaMask: async () => ({}),
  signUpWithMetaMask: async () => ({}),
  loginWithWebAuthn: async () => ({}),
  signUpWithWebAuthn: async () => ({}),
  logout: () => {},
};

// Creazione del contesto
const ShogunContext = createContext<ShogunContextType>(defaultContext);

// Hook per utilizzare il contesto Shogun
export const useShogun = () => useContext(ShogunContext);

// Proprietà del provider
type ShogunButtonProviderProps = {
  children: React.ReactNode;
  sdk: ShogunSDK;
  options: {
    appName: string;
    appDescription?: string;
    appUrl?: string;
    appIcon?: string;
    showMetamask?: boolean;
    showWebauthn?: boolean;
    darkMode?: boolean;
  };
  onLoginSuccess?: (data: {
    userPub: string;
    username: string;
    password?: string;
    wallet?: ethers.Wallet;
    authMethod?: 'standard' | 'metamask_direct' | 'metamask_saved' | 'metamask_signup' | 'standard_signup' | 'webauthn' | 'mnemonic';
  }) => void;
  onSignupSuccess?: (data: {
    userPub: string;
    username: string;
    password?: string;
    wallet?: ethers.Wallet;
    authMethod?: 'standard' | 'metamask_direct' | 'metamask_saved' | 'metamask_signup' | 'standard_signup' | 'webauthn' | 'mnemonic';
  }) => void;
  onError?: (error: string) => void;
};

// Provider Shogun
export function ShogunButtonProvider({
  children,
  sdk,
  options,
  onLoginSuccess,
  onSignupSuccess,
  onError,
}: ShogunButtonProviderProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(sdk?.isLoggedIn() || false);
  const [userPub, setUserPub] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [wallet, setWallet] = useState<ethers.Wallet | null>(null);

  // Login standard
  const login = async (username: string, password: string) => {
    try {
      const result = await sdk.login(username, password);
      if (result.success) {
        setIsLoggedIn(true);
        setUserPub(result.userPub || '');
        setUsername(username);
        setWallet(result.wallet || null);
        
        onLoginSuccess?.({
          userPub: result.userPub || '',
          username,
          password,
          wallet: result.wallet,
          authMethod: 'standard'
        });
        
        return result;
      }
      onError?.(result.error || 'Login fallito');
      return result;
    } catch (error: any) {
      onError?.(error.message || 'Errore durante il login');
      return { success: false, error: error.message };
    }
  };

  // Registrazione standard
  const signUp = async (username: string, password: string, confirmPassword: string) => {
    if (password !== confirmPassword) {
      onError?.('Le password non corrispondono');
      return { success: false, error: 'Le password non corrispondono' };
    }
    
    try {
      const result = await sdk.signUp(username, password );
      if (result.success) {
        setIsLoggedIn(true);
        // Cast esplicito per accedere alle proprietà necessarie
        const extResult = result as any;
        const publicKey = extResult.publicKey || extResult.userPub || '';
        setUserPub(publicKey);
        setUsername(username);
        setWallet(extResult.wallet || null);
        
        onSignupSuccess?.({
          userPub: publicKey,
          username,
          password,
          wallet: extResult.wallet,
          authMethod: 'standard_signup'
        });
        
        return result;
      }
      onError?.(result.error || 'Registrazione fallita');
      return result;
    } catch (error: any) {
      onError?.(error.message || 'Errore durante la registrazione');
      return { success: false, error: error.message };
    }
  };

  // Funzione per il login con MetaMask
  const loginWithMetaMask = async () => {
    try {
      if (!sdk) {
        throw new Error("SDK non inizializzato");
      }

      // Verifica se MetaMask è disponibile nel browser
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        throw new Error("MetaMask non è installato. Installa l'estensione MetaMask per continuare.");
      }

      // Richiedi l'accesso agli account
      let accounts;
      try {
        accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      } catch (error) {
        console.error('Errore nella richiesta degli account:', error);
        throw new Error("Impossibile ottenere account MetaMask");
      }

      if (!accounts || accounts.length === 0) {
        throw new Error('Nessun account trovato in MetaMask');
      }

      const address = accounts[0];
      console.log('MetaMask address:', address);
      
      // Login usando l'SDK
      const result = await sdk.loginWithMetaMask(address);
      
      if (result.success) {
        // Ottieni il wallet principale dall'SDK
        const mainWallet = sdk.getMainWallet();
        
        setIsLoggedIn(true);
        setUserPub(result.userPub || "");
        setWallet(mainWallet);
        
        onLoginSuccess && onLoginSuccess({
          userPub: result.userPub || "",
          username: address,
          wallet: mainWallet,
          authMethod: "metamask_direct"
        });
        
        return result;
      } else {
        throw new Error(result.error || "Login con MetaMask fallito");
      }
    } catch (error: any) {
      console.error('Errore completo MetaMask:', error);
      onError && onError(error.message || "Errore durante il login con MetaMask");
      throw error;
    }
  };

  // Funzione per la registrazione con MetaMask
  const signUpWithMetaMask = async () => {
    try {
      if (!sdk) {
        throw new Error("SDK non inizializzato");
      }

      // Verifica se MetaMask è disponibile nel browser
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        throw new Error("MetaMask non è installato. Installa l'estensione MetaMask per continuare.");
      }

      // Richiedi l'accesso agli account
      let accounts;
      try {
        accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      } catch (error) {
        console.error('Errore nella richiesta degli account:', error);
        throw new Error("Impossibile ottenere account MetaMask");
      }

      if (!accounts || accounts.length === 0) {
        throw new Error('Nessun account trovato in MetaMask');
      }

      const address = accounts[0];
      console.log('MetaMask address for signup:', address);
      
      // Registrazione usando l'SDK
      const result = await sdk.signUpWithMetaMask(address);
      
      if (result.success) {
        // Ottieni il wallet principale dall'SDK
        const mainWallet = sdk.getMainWallet();
        
        setIsLoggedIn(true);
        setUserPub(result.userPub || "");
        setWallet(mainWallet);
        
        onSignupSuccess && onSignupSuccess({
          userPub: result.userPub || "",
          username: address,
          wallet: mainWallet,
          authMethod: "metamask_signup"
        });
        
        return result;
      } else {
        throw new Error(result.error || "Registrazione con MetaMask fallita");
      }
    } catch (error: any) {
      console.error('Errore completo MetaMask:', error);
      onError && onError(error.message || "Errore durante la registrazione con MetaMask");
      throw error;
    }
  };

  // Login con WebAuthn
  const loginWithWebAuthn = async (username: string) => {
    try {
      if (!sdk) {
        throw new Error("SDK non inizializzato");
      }

      if (!sdk.isWebAuthnSupported()) {
        throw new Error("WebAuthn non è supportato in questo browser");
      }

      const result = await sdk.loginWithWebAuthn(username);
      
      if (result.success) {
        const mainWallet = sdk.getMainWallet();
        
        setIsLoggedIn(true);
        setUserPub(result.userPub || "");
        setUsername(username);
        setWallet(mainWallet);
        
        onLoginSuccess && onLoginSuccess({
          userPub: result.userPub || "",
          username,
          wallet: mainWallet,
          authMethod: "webauthn"
        });
        
        return result;
      } else {
        throw new Error(result.error || "Login con WebAuthn fallito");
      }
    } catch (error: any) {
      onError && onError(error.message || "Errore durante il login con WebAuthn");
      throw error;
    }
  };

  // Registrazione con WebAuthn
  const signUpWithWebAuthn = async (username: string) => {
    try {
      if (!sdk) {
        throw new Error("SDK non inizializzato");
      }

      if (!sdk.isWebAuthnSupported()) {
        throw new Error("WebAuthn non è supportato in questo browser");
      }

      const result = await sdk.signUpWithWebAuthn(username);
      
      if (result.success) {
        const mainWallet = sdk.getMainWallet();
        
        setIsLoggedIn(true);
        setUserPub(result.userPub || "");
        setUsername(username);
        setWallet(mainWallet);
        
        onSignupSuccess && onSignupSuccess({
          userPub: result.userPub || "",
          username,
          wallet: mainWallet,
          authMethod: "webauthn"
        });
        
        return result;
      } else {
        throw new Error(result.error || "Registrazione con WebAuthn fallita");
      }
    } catch (error: any) {
      onError && onError(error.message || "Errore durante la registrazione con WebAuthn");
      throw error;
    }
  };

  // Logout
  const logout = () => {
    sdk.logout();
    setIsLoggedIn(false);
    setUserPub(null);
    setUsername(null);
    setWallet(null);
  };

  // Valori del contesto
  const contextValue: ShogunContextType = {
    sdk,
    options,
    isLoggedIn,
    userPub,
    username,
    wallet,
    login,
    signUp,
    loginWithMetaMask,
    signUpWithMetaMask,
    loginWithWebAuthn,
    signUpWithWebAuthn,
    logout
  };

  return (
    <ShogunContext.Provider value={contextValue}>
      {children}
    </ShogunContext.Provider>
  );
}

// Tipo per il componente personalizzato
interface CustomButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
}

// Definizione del tipo per il componente ShogunButton con proprietà Custom
interface ShogunButtonComponent extends React.FC {
  Custom: React.FC<CustomButtonProps>;
}

// Componente per il pulsante di login Shogun
export const ShogunButton: ShogunButtonComponent = (() => {
  const Button: React.FC = () => {
    const { isLoggedIn, username, logout } = useShogun();

    if (isLoggedIn && username) {
      return (
        <button 
          onClick={logout}
          className="shogun-button shogun-logged-in"
        >
          {username.substring(0, 6)}...{username.substring(username.length - 4)}
        </button>
      );
    }

    return (
      <button 
        onClick={() => {
          // Apri il modale di login/registrazione
          // Questo è solo un placeholder, dovresti implementare una UI o utilizzare un sistema modale
          alert('Implementa un modale di login/registrazione qui');
        }}
        className="shogun-button"
      >
        Login con Shogun
      </button>
    );
  };

  // Aggiungi la proprietà Custom al componente Button
  (Button as ShogunButtonComponent).Custom = ({ children, onClick }: CustomButtonProps) => {
    const { isLoggedIn, logout } = useShogun();
    
    const handleClick = () => {
      if (isLoggedIn) {
        logout();
      }
      
      onClick?.();
    };
    
    return (
      <div onClick={handleClick} className="shogun-button-custom">
        {children}
      </div>
    );
  };

  return Button as ShogunButtonComponent;
})(); 