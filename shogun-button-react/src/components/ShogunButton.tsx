import React, { useContext, useState, createContext } from 'react';
import { ethers } from 'ethers';
import { ShogunCore } from 'shogun-core';
import '../types'; // Import type file to extend definitions

import '../styles/index.css';

// Custom types to handle SDK responses
interface ExtendedAuthResult {
  success: boolean;
  userPub?: string;
  publicKey?: string;
  wallet?: ethers.Wallet;
  error?: string;
}

// Context type for ShogunProvider
type ShogunContextType = {
  sdk: ShogunCore | null;
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
  did: string | null;
  login: (username: string, password: string) => Promise<any>;
  signUp: (username: string, password: string, confirmPassword: string) => Promise<any>;
  loginWithMetaMask: () => Promise<any>;
  signUpWithMetaMask: () => Promise<any>;
  loginWithWebAuthn: (username: string) => Promise<any>;
  signUpWithWebAuthn: (username: string) => Promise<any>;
  logout: () => void;
  // Metodi DID
  getCurrentDID: () => Promise<string | null>;
  resolveDID: (did: string) => Promise<any>;
  authenticateWithDID: (did: string, challenge?: string) => Promise<any>;
  registerDIDOnChain: (did: string, signer?: ethers.Signer) => Promise<any>;
};

// Default context
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
  did: null,
  login: async () => ({}),
  signUp: async () => ({}),
  loginWithMetaMask: async () => ({}),
  signUpWithMetaMask: async () => ({}),
  loginWithWebAuthn: async () => ({}),
  signUpWithWebAuthn: async () => ({}),
  logout: () => {},
  getCurrentDID: async () => null,
  resolveDID: async () => ({}),
  authenticateWithDID: async () => ({}),
  registerDIDOnChain: async () => ({}),
};

// Create context
const ShogunContext = createContext<ShogunContextType>(defaultContext);

// Hook to use Shogun context
export const useShogun = () => useContext(ShogunContext);

// Provider properties
type ShogunButtonProviderProps = {
  children: React.ReactNode;
  sdk: ShogunCore;
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
    did?: string;
    authMethod?: 'standard' | 'metamask_direct' | 'metamask_saved' | 'metamask_signup' | 'standard_signup' | 'webauthn' | 'mnemonic';
  }) => void;
  onSignupSuccess?: (data: {
    userPub: string;
    username: string;
    password?: string;
    wallet?: ethers.Wallet;
    did?: string;
    authMethod?: 'standard' | 'metamask_direct' | 'metamask_saved' | 'metamask_signup' | 'standard_signup' | 'webauthn' | 'mnemonic';
  }) => void;
  onError?: (error: string) => void;
};

// Shogun Provider
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
  const [did, setDid] = useState<string | null>(null);

  // Metodi DID
  const getCurrentDID = async (): Promise<string | null> => {
    try {
      if (!sdk) {
        throw new Error("SDK not initialized");
      }
      
      return await sdk.did.getCurrentUserDID();
    } catch (error: any) {
      onError?.(error.message || "Errore nel recupero del DID");
      return null;
    }
  };
  
  const resolveDID = async (did: string) => {
    try {
      if (!sdk) {
        throw new Error("SDK not initialized");
      }
      
      return await sdk.did.resolveDID(did);
    } catch (error: any) {
      onError?.(error.message || "Errore nella risoluzione del DID");
      return { success: false, error: error.message };
    }
  };
  
  const authenticateWithDID = async (did: string, challenge?: string) => {
    try {
      if (!sdk) {
        throw new Error("SDK not initialized");
      }
      
      const result = await sdk.did.authenticateWithDID(did, challenge);
      
      if (result.success) {
        setIsLoggedIn(true);
        setUserPub(result.userPub || "");
        setUsername(result.username || null);
        setDid(did);
        setWallet(sdk.getMainWallet());
        
        onLoginSuccess?.({
          userPub: result.userPub || "",
          username: result.username || "",
          did: did,
          wallet: sdk.getMainWallet(),
          authMethod: "standard"
        });
      }
      
      return result;
    } catch (error: any) {
      onError?.(error.message || "Errore nell'autenticazione con DID");
      return { success: false, error: error.message };
    }
  };
  
  const registerDIDOnChain = async (did: string, signer?: ethers.Signer) => {
    try {
      if (!sdk) {
        throw new Error("SDK not initialized");
      }
      
      return await sdk.did.registerDIDOnChain(did, signer);
    } catch (error: any) {
      onError?.(error.message || "Errore nella registrazione del DID sulla blockchain");
      return { success: false, error: error.message };
    }
  };

  // Standard login
  const login = async (username: string, password: string) => {
    try {
      const result = await sdk.login(username, password);
      if (result.success) {
        setIsLoggedIn(true);
        setUserPub(result.userPub || '');
        setUsername(username);
        setWallet(result.wallet || null);
        
        // Recupera il DID dell'utente dopo il login
        if (result.did) {
          setDid(result.did);
        } else {
          const userDid = await sdk.did.getCurrentUserDID();
          setDid(userDid);
        }
        
        onLoginSuccess?.({
          userPub: result.userPub || '',
          username,
          password,
          wallet: result.wallet,
          did: result.did || did,
          authMethod: 'standard'
        });
        
        return result;
      }
      onError?.(result.error || 'Login failed');
      return result;
    } catch (error: any) {
      onError?.(error.message || 'Error during login');
      return { success: false, error: error.message };
    }
  };

  // Standard registration
  const signUp = async (username: string, password: string, confirmPassword: string) => {
    if (password !== confirmPassword) {
      onError?.('Passwords do not match');
      return { success: false, error: 'Passwords do not match' };
    }
    
    try {
      const result = await sdk.signUp(username, password);
      if (result.success) {
        setIsLoggedIn(true);
        // Explicit cast to access required properties
        const extResult = result as any;
        const publicKey = extResult.publicKey || extResult.userPub || '';
        setUserPub(publicKey);
        setUsername(username);
        setWallet(extResult.wallet || null);
        
        // Imposta il DID se presente nel risultato
        if (extResult.did) {
          setDid(extResult.did);
        }
        
        onSignupSuccess?.({
          userPub: publicKey,
          username,
          password,
          wallet: extResult.wallet,
          did: extResult.did,
          authMethod: 'standard_signup'
        });
        
        return result;
      }
      onError?.(result.error);
      return result;
    } catch (error: any) {
      onError?.(error.message || 'Error during registration');
      return { success: false, error: error.message };
    }
  };

  // MetaMask login function
  const loginWithMetaMask = async () => {
    try {
      if (!sdk) {
        throw new Error("SDK not initialized");
      }

      // Check if MetaMask is available in browser
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        throw new Error("MetaMask is not installed. Install the MetaMask extension to continue.");
      }

      // Request access to accounts
      let accounts;
      try {
        accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      } catch (error) {
        console.error('Error requesting accounts:', error);
        throw new Error("Unable to get MetaMask accounts");
      }

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found in MetaMask');
      }

      const address = accounts[0];
      console.log('MetaMask address:', address);
      
      // Login using SDK
      const result = await sdk.loginWithMetaMask(address);
      
      if (result.success) {
        // Get main wallet from SDK
        const mainWallet = sdk.getMainWallet();
        
        setIsLoggedIn(true);
        setUserPub(result.userPub || "");
        setWallet(mainWallet);
        
        // Recupera il DID dell'utente
        if (result.did) {
          setDid(result.did);
        } else {
          const userDid = await sdk.did.getCurrentUserDID();
          setDid(userDid);
        }
        
        onLoginSuccess && onLoginSuccess({
          userPub: result.userPub || "",
          username: address,
          wallet: mainWallet,
          did: result.did || did,
          authMethod: "metamask_direct"
        });
        
        return result;
      } else {
        throw new Error(result.error || "MetaMask login failed");
      }
    } catch (error: any) {
      console.error('Complete MetaMask error:', error);
      onError && onError(error.message || "Error during MetaMask login");
      throw error;
    }
  };

  // MetaMask registration function
  const signUpWithMetaMask = async () => {
    try {
      if (!sdk) {
        throw new Error("SDK not initialized");
      }

      // Check if MetaMask is available in browser
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        throw new Error("MetaMask is not installed. Install the MetaMask extension to continue.");
      }

      // Request access to accounts
      let accounts;
      try {
        accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      } catch (error) {
        console.error('Error requesting accounts:', error);
        throw new Error("Unable to get MetaMask accounts");
      }

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found in MetaMask');
      }

      const address = accounts[0];
      console.log('MetaMask address for signup:', address);
      
      // Registration using SDK
      const result = await sdk.signUpWithMetaMask(address);
      
      if (result.success) {
        // Get main wallet from SDK
        const mainWallet = sdk.getMainWallet();
        
        setIsLoggedIn(true);
        setUserPub(result.userPub || "");
        setWallet(mainWallet);
        
        // Imposta il DID se presente nel risultato
        if (result.did) {
          setDid(result.did);
        }
        
        onSignupSuccess && onSignupSuccess({
          userPub: result.userPub || "",
          username: address,
          wallet: mainWallet,
          did: result.did,
          authMethod: "metamask_signup"
        });
        
        return result;
      } else {
        throw new Error(result.error );
      }
    } catch (error: any) {
      console.error('Complete MetaMask error:', error);
      onError && onError(error.message);
      throw error;
    }
  };

  // WebAuthn login
  const loginWithWebAuthn = async (username: string) => {
    try {
      if (!sdk) {
        throw new Error("SDK not initialized");
      }

      if (!sdk.isWebAuthnSupported()) {
        throw new Error("WebAuthn is not supported in this browser");
      }

      const result = await sdk.loginWithWebAuthn(username);
      
      if (result.success) {
        const mainWallet = sdk.getMainWallet();
        
        setIsLoggedIn(true);
        setUserPub(result.userPub || "");
        setUsername(username);
        setWallet(mainWallet);
        
        // Recupera il DID dell'utente
        if (result.did) {
          setDid(result.did);
        } else {
          const userDid = await sdk.did.getCurrentUserDID();
          setDid(userDid);
        }
        
        onLoginSuccess && onLoginSuccess({
          userPub: result.userPub || "",
          username,
          wallet: mainWallet,
          did: result.did || did,
          authMethod: "webauthn"
        });
        
        return result;
      } else {
        throw new Error(result.error || "WebAuthn login failed");
      }
    } catch (error: any) {
      onError && onError(error.message || "Error during WebAuthn login");
      throw error;
    }
  };

  // WebAuthn registration
  const signUpWithWebAuthn = async (username: string) => {
    try {
      if (!sdk) {
        throw new Error("SDK not initialized");
      }

      if (!sdk.isWebAuthnSupported()) {
        throw new Error("WebAuthn is not supported in this browser");
      }

      const result = await sdk.signUpWithWebAuthn(username);
      
      if (result.success) {
        const mainWallet = sdk.getMainWallet();
        
        setIsLoggedIn(true);
        setUserPub(result.userPub || "");
        setUsername(username);
        setWallet(mainWallet);
        
        // Imposta il DID se presente nel risultato
        if (result.did) {
          setDid(result.did);
        }
        
        onSignupSuccess && onSignupSuccess({
          userPub: result.userPub || "",
          username,
          wallet: mainWallet,
          did: result.did,
          authMethod: "webauthn"
        });
        
        return result;
      } else {
        throw new Error(result.error || "WebAuthn registration failed");
      }
    } catch (error: any) {
      onError && onError(error.message || "Error during WebAuthn registration");
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
    setDid(null);
  };

  // Context values
  const contextValue: ShogunContextType = {
    sdk,
    options,
    isLoggedIn,
    userPub,
    username,
    wallet,
    did,
    login,
    signUp,
    loginWithMetaMask,
    signUpWithMetaMask,
    loginWithWebAuthn,
    signUpWithWebAuthn,
    logout,
    getCurrentDID,
    resolveDID,
    authenticateWithDID,
    registerDIDOnChain
  };

  return (
    <ShogunContext.Provider value={contextValue}>
      {children}
    </ShogunContext.Provider>
  );
}

// Type for custom component
interface CustomButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
}

// Definition of ShogunButton component type with Custom properties
interface ShogunButtonComponent extends React.FC {
  Custom: React.FC<CustomButtonProps>;
}

// Component for Shogun login button
export const ShogunButton: ShogunButtonComponent = (() => {
  const Button: React.FC = () => {
    const { 
      isLoggedIn, 
      username, 
      did,
      logout, 
      login, 
      signUp, 
      loginWithMetaMask, 
      signUpWithMetaMask, 
      loginWithWebAuthn, 
      signUpWithWebAuthn,
      registerDIDOnChain,
      sdk,
      options
    } = useShogun();
    
    // Form states
    const [showModal, setShowModal] = useState(false);
    const [formUsername, setFormUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [formMode, setFormMode] = useState<'login' | 'signup'>('login');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showDid, setShowDid] = useState(false);
    
    const handleRegisterDID = async () => {
      if (!did) return;
      
      setLoading(true);
      setError('');
      
      try {
        const result = await registerDIDOnChain(did);
        if (result.success) {
          alert(`DID registrato con successo! TX: ${result.txHash}`);
        } else {
          setError(result.error || 'Errore nella registrazione del DID');
        }
      } catch (err: any) {
        setError(err.message || 'Errore nella registrazione del DID');
      } finally {
        setLoading(false);
      }
    };

    // If already logged in, show only logout button
    if (isLoggedIn && username) {
      return (
        <div className="shogun-logged-in-container">
          <button 
            onClick={() => setShowDid(!showDid)}
            className="shogun-button shogun-logged-in"
          >
            {username.substring(0, 6)}...{username.substring(username.length - 4)}
          </button>
          
          {showDid && did && (
            <div className="shogun-did-container">
              <p className="shogun-did-text">{did}</p>
              <button 
                onClick={handleRegisterDID}
                className="shogun-register-did-button"
                disabled={loading}
              >
                {loading ? 'Registrazione...' : 'Registra DID on-chain'}
              </button>
              {error && <p className="shogun-error-message">{error}</p>}
            </div>
          )}
          
          <button 
            onClick={logout}
            className="shogun-logout-button"
          >
            Logout
          </button>
        </div>
      );
    }

    // Event handlers
    const handleStandardAuth = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);
      
      try {
        if (formMode === 'login') {
          const result = await login(formUsername, password);
          if (!result.success) {
            throw new Error(result.error || "Authentication failed");
          }
        } else {
          if (password !== confirmPassword) {
            throw new Error("Passwords do not match");
          }
          const result = await signUp(formUsername, password, confirmPassword);
          if (!result.success) {
            throw new Error(result.error);
          }
        }
        
        // Close modal after success
        setShowModal(false);
        resetForm();
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    };
    
    const handleMetaMaskAuth = async () => {
      setError('');
      setLoading(true);
      
      try {
        const result = formMode === 'login' 
          ? await loginWithMetaMask()
          : await signUpWithMetaMask();
          
        if (!result.success) {
          throw new Error(result.error || "MetaMask authentication failed");
        }
        
        // Close modal after success
        setShowModal(false);
        resetForm();
      } catch (err: any) {
        setError(err.message || "An error occurred with MetaMask");
      } finally {
        setLoading(false);
      }
    };
    
    const handleWebAuthnAuth = async () => {
      if (!sdk?.isWebAuthnSupported()) {
        setError('WebAuthn is not supported in your browser');
        return;
      }
      
      if (!formUsername) {
        setError('Username required for WebAuthn');
        return;
      }
      
      setError('');
      setLoading(true);
      
      try {
        const result = formMode === 'login'
          ? await loginWithWebAuthn(formUsername)
          : await signUpWithWebAuthn(formUsername);
          
        if (!result.success) {
          throw new Error(result.error || "WebAuthn authentication failed");
        }
        
        // Close modal after success
        setShowModal(false);
        resetForm();
      } catch (err: any) {
        setError(err.message || "An error occurred with WebAuthn");
      } finally {
        setLoading(false);
      }
    };
    
    const resetForm = () => {
      setFormUsername('');
      setPassword('');
      setConfirmPassword('');
      setError('');
      setLoading(false);
    };
    
    const toggleFormMode = () => {
      setFormMode(prevMode => prevMode === 'login' ? 'signup' : 'login');
      resetForm();
    };

    // This is the modal that will open when clicking the button
    const renderModal = () => {
      if (!showModal) return null;
      
      return (
        <div className="shogun-modal-overlay">
          <div className="shogun-modal">
            <div className="shogun-modal-header">
              <h2>{formMode === 'login' ? 'Sign in' : 'Sign up'} with Shogun</h2>
              <button className="shogun-close-button" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="shogun-modal-content">
              {error && <div className="shogun-error-message">{error}</div>}
              
              <form onSubmit={handleStandardAuth}>
                <div className="shogun-form-group">
                  <label htmlFor="username">Username</label>
                  <input
                    type="text"
                    id="username"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                
                <div className="shogun-form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
                
                {formMode === 'signup' && (
                  <div className="shogun-form-group">
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <input
                      type="password"
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      required
                    />
                  </div>
                )}
                
                <button 
                  type="submit" 
                  className="shogun-submit-button"
                  disabled={loading}
                >
                  {loading ? 'Loading...' : formMode === 'login' ? 'Sign in' : 'Sign up'}
                </button>
              </form>
              
              <div className="shogun-divider">or</div>
              
              {options.showMetamask && (
                <button
                  className="shogun-metamask-button"
                  onClick={handleMetaMaskAuth}
                  disabled={loading}
                >
                  {formMode === 'login' ? 'Sign in' : 'Sign up'} with Web3
                </button>
              )}
              
              {options.showWebauthn && (
                <button
                  className="shogun-webauthn-button"
                  onClick={handleWebAuthnAuth}
                  disabled={loading}
                >
                  {formMode === 'login' ? 'Sign in' : 'Sign up'} with WebAuthn
                </button>
              )}
              
              <div className="shogun-form-footer">
                <p>
                  {formMode === 'login' ? "Don't have an account?" : "Already have an account?"}
                  <button
                    type="button"
                    className="shogun-toggle-mode"
                    onClick={toggleFormMode}
                    disabled={loading}
                  >
                    {formMode === 'login' ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    };

    // Main button that opens the modal
    return (
      <>
        <button 
          onClick={() => setShowModal(true)}
          className="shogun-button"
        >
          Access with Shogun
        </button>
        {renderModal()}
      </>
    );
  };

  // Add Custom property to Button component
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