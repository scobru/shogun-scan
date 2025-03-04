import React, { useState, useEffect } from 'react';
import ShogunSDK from '../index';

// Stili CSS inline per il componente
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '380px',
    margin: '0 auto',
    padding: '20px',
    borderRadius: '12px',
    backgroundColor: '#1a1a1a',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
    color: 'white',
    fontFamily: 'sans-serif'
  },
  header: {
    textAlign: 'center',
    marginBottom: '20px',
    fontSize: '24px',
    fontWeight: '600'
  },
  input: {
    width: '100%',
    padding: '12px',
    marginBottom: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: 'white',
    outline: 'none',
    fontSize: '16px',
    boxSizing: 'border-box'
  },
  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#6366f1',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    marginBottom: '12px'
  },
  buttonDisabled: {
    opacity: '0.7',
    cursor: 'not-allowed'
  },
  link: {
    color: '#6366f1',
    textAlign: 'center',
    display: 'block',
    marginTop: '12px',
    cursor: 'pointer',
    textDecoration: 'none',
    fontSize: '14px'
  },
  error: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
    padding: '10px',
    borderRadius: '8px',
    fontSize: '14px',
    textAlign: 'center',
    marginTop: '12px'
  },
  tabs: {
    display: 'flex',
    marginBottom: '20px'
  },
  tab: {
    flex: 1,
    padding: '10px',
    textAlign: 'center',
    cursor: 'pointer',
    borderBottom: '2px solid transparent'
  },
  activeTab: {
    borderBottom: '2px solid #6366f1',
    fontWeight: '600'
  },
  metamaskContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: '12px',
    borderRadius: '8px',
    marginTop: '12px'
  },
  metamaskAddress: {
    fontSize: '14px',
    color: '#9ca3af',
    marginBottom: '8px',
    wordBreak: 'break-all'
  }
};

interface CustomMessages {
  loginHeader?: string;
  signupHeader?: string;
  loginButton?: string;
  signupButton?: string;
  usernameLabel?: string;
  passwordLabel?: string;
  confirmPasswordLabel?: string;
  switchToSignup?: string;
  switchToLogin?: string;
  metamaskConnect?: string;
  metamaskLogin?: string;
  webauthnLogin?: string;
  webauthnSignup?: string;
  mismatched?: string;
  empty?: string;
  exists?: string;
}

interface LoginWithShogunProps {
  sdk: ShogunSDK;
  onLoginSuccess?: (data: { 
    userPub: string; 
    username: string; 
    password?: string;
    wallet?: any;
    authMethod?: 'standard' | 'metamask_direct' | 'metamask_saved' | 'metamask_signup' | 'standard_signup' | 'webauthn';
  }) => void;
  onSignupSuccess?: (data: { 
    userPub: string; 
    username: string;
    password?: string;
    wallet?: any;
    authMethod?: 'standard' | 'metamask_direct' | 'metamask_saved' | 'metamask_signup' | 'standard_signup' | 'webauthn';
  }) => void;
  onError?: (error: string) => void;
  customMessages?: CustomMessages;
  darkMode?: boolean;
  showMetamask?: boolean;
  showWebauthn?: boolean;
}

const LoginWithShogun: React.FC<LoginWithShogunProps> = ({
  sdk,
  onLoginSuccess,
  onSignupSuccess,
  onError,
  customMessages = {},
  darkMode = true,
  showMetamask = true,
  showWebauthn = true
}) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [passwordConfirmation, setPasswordConfirmation] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isMetaMaskConnected, setIsMetaMaskConnected] = useState<boolean>(false);
  const [metamaskAddress, setMetamaskAddress] = useState<string>('');
  const [isWebAuthnSupported, setIsWebAuthnSupported] = useState<boolean>(false);

  // Messaggi predefiniti
  const messages = {
    loginHeader: customMessages?.loginHeader || 'Accedi a Shogun',
    signupHeader: customMessages?.signupHeader || 'Registrati su Shogun',
    loginButton: customMessages?.loginButton || 'Accedi',
    signupButton: customMessages?.signupButton || 'Registrati',
    usernameLabel: customMessages?.usernameLabel || 'Username',
    passwordLabel: customMessages?.passwordLabel || 'Password',
    confirmPasswordLabel: customMessages?.confirmPasswordLabel || 'Conferma Password',
    switchToSignup: customMessages?.switchToSignup || 'Non hai un account? Registrati',
    switchToLogin: customMessages?.switchToLogin || 'Hai già un account? Accedi',
    metamaskConnect: customMessages?.metamaskConnect || 'Connetti MetaMask',
    metamaskLogin: customMessages?.metamaskLogin || 'Accedi con MetaMask',
    webauthnLogin: customMessages?.webauthnLogin || 'Accedi con WebAuthn',
    webauthnSignup: customMessages?.webauthnSignup || 'Registrati con WebAuthn',
    mismatched: customMessages?.mismatched || 'Le password non corrispondono',
    empty: customMessages?.empty || 'Tutti i campi sono obbligatori',
    exists: customMessages?.exists || 'Utente già esistente'
  };

  // Logging iniziale per debug
  console.log("Props ricevute:", { sdk, showMetamask, showWebauthn });
  console.log("SDK disponibile:", !!sdk);

  useEffect(() => {
    if (showWebauthn) {
      const supported = sdk.isWebAuthnSupported();
      console.log("WebAuthn supportato:", supported);
      setIsWebAuthnSupported(supported);
    }
  }, [sdk, showWebauthn]);

  const handleLogin = async () => {
    console.log("handleLogin chiamato");
    
    if (!username || !password) {
      setErrorMessage(messages.empty);
      if (onError) onError(messages.empty);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const result = await sdk.handleLogin(username, password, {});
      console.log("Risultato login standard:", result);

      if (result.success && result.userPub) {
        if (onLoginSuccess) {
          onLoginSuccess({ 
            userPub: result.userPub,
            username: username,
            password: password,
            authMethod: 'standard' as const
          });
        }
      } else {
        throw new Error(result.error || 'Errore durante il login');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Errore durante il login';
      console.error("Errore completo:", error);
      setErrorMessage(errorMsg);
      if (onError) onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    console.log("handleSignUp chiamato");
    
    if (password !== passwordConfirmation) {
      setErrorMessage(messages.mismatched);
      if (onError) onError(messages.mismatched);
      return;
    }

    if (!username || !password || !passwordConfirmation) {
      setErrorMessage(messages.empty);
      if (onError) onError(messages.empty);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const result = await sdk.handleSignUp(username, password, passwordConfirmation, {
        messages
      });
      console.log("Risultato registrazione standard:", result);

      if (result.success && result.userPub) {
        if (onSignupSuccess) {
          onSignupSuccess({ 
            userPub: result.userPub,
            username: username,
            password: password,
            authMethod: 'standard_signup' as const
          });
        }
      } else {
        throw new Error(result.error || 'Errore durante la registrazione');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Errore durante la registrazione';
      console.error("Errore completo:", error);
      setErrorMessage(errorMsg);
      if (onError) onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMaskConnect = async () => {
    if (!showMetamask) return;
    
    setLoading(true);
    setErrorMessage('');

    try {
      const result = await sdk.metamask?.connectMetaMask();
      if (result?.success) {
        setMetamaskAddress(result.address || '');
        setIsMetaMaskConnected(true);
        setUsername(result.username || '');
      } else {
        throw new Error(result?.error || 'Errore nella connessione a MetaMask');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Errore nella connessione a MetaMask';
      setErrorMessage(errorMsg);
      if (onError) onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMaskLogin = async () => {
    console.log("handleMetaMaskLogin chiamato");
    console.log("isMetaMaskConnected:", isMetaMaskConnected);
    console.log("metamaskAddress:", metamaskAddress);
    
    if (!isMetaMaskConnected || !metamaskAddress) {
      setErrorMessage('Connetti prima MetaMask');
      if (onError) onError('Connetti prima MetaMask');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const username = `metamask_${metamaskAddress.slice(2, 8)}`;
      
      // Verifica se esiste una password salvata
      const savedPassword = localStorage.getItem(`lonewolf_${username}`);
      
      if (savedPassword) {
        console.log("Password salvata trovata, tentativo di login diretto con LoneWolf...");
        
        if (onLoginSuccess) {
          const authResult = {
            userPub: metamaskAddress,
            username: username,
            password: savedPassword,
            authMethod: 'metamask_saved' as const
          };
          
          onLoginSuccess(authResult);
          setLoading(false);
          return;
        }
      }

      console.log("Tentativo di login con MetaMask...");
      const result = await sdk.loginWithMetaMask(metamaskAddress);
      console.log("Risultato login con MetaMask:", result);

      if (result.success) {
        if (result.password) {
          localStorage.setItem(`lonewolf_${username}`, result.password);
        }

        if (onLoginSuccess) {
          onLoginSuccess({ 
            userPub: result.userPub || metamaskAddress,
            username: username,
            password: result.password,
            wallet: result.wallet,
            authMethod: 'metamask_direct' as const
          });
        }
      } else {
        throw new Error(result.error || 'Errore durante il login con MetaMask');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Errore nel login con MetaMask';
      console.error("Errore completo:", error);
      setErrorMessage(errorMsg);
      if (onError) onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMaskSignUp = async () => {
    console.log("handleMetaMaskSignUp chiamato");
    
    if (!isMetaMaskConnected || !metamaskAddress) {
      setErrorMessage('Connetti prima MetaMask');
      if (onError) onError('Connetti prima MetaMask');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const username = `metamask_${metamaskAddress.slice(2, 8)}`;
      console.log("Tentativo di registrazione con MetaMask...");
      
      const result = await sdk.signUpWithMetaMask(metamaskAddress);
      console.log("Risultato registrazione con MetaMask:", result);

      if (result.success) {
        console.log("Registrazione con MetaMask riuscita");
        
        if (result.password) {
          localStorage.setItem(`lonewolf_${username}`, result.password);
        }

        if (onSignupSuccess) {
          onSignupSuccess({ 
            userPub: result.userPub || metamaskAddress,
            username: username,
            password: result.password,
            wallet: result.wallet,
            authMethod: 'metamask_signup' as const
          });
        }
      } else {
        if (result.error?.includes('User already created')) {
          console.log('Utente già esistente, tentativo di login...');
          return handleMetaMaskLogin();
        }
        throw new Error(result.error || 'Errore durante la registrazione con MetaMask');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Errore nella registrazione con MetaMask';
      console.error("Errore completo:", error);
      setErrorMessage(errorMsg);
      if (onError) onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleWebAuthnLogin = async () => {
    if (!showWebauthn || !isWebAuthnSupported) return;
    
    if (!username) {
      setErrorMessage(messages.empty);
      if (onError) onError(messages.empty);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // Implementazione semplificata - in una versione reale dovrebbe essere completata
      const result = await sdk.authenticateWithWebAuthn(username);
      
      if (result.success) {
        // Qui dovremmo avere un modo per ottenere l'userPub dopo l'autenticazione
        if (onLoginSuccess) {
          onLoginSuccess({ 
            userPub: 'webauthn-user-pub', 
            username, 
            authMethod: 'webauthn' as const 
          });
        }
      } else {
        throw new Error(result.error || 'Errore nell\'autenticazione con WebAuthn');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Errore nell\'autenticazione con WebAuthn';
      setErrorMessage(errorMsg);
      if (onError) onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleWebAuthnSignUp = async () => {
    if (!showWebauthn || !isWebAuthnSupported) return;
    
    if (!username) {
      setErrorMessage(messages.empty);
      if (onError) onError(messages.empty);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // Implementazione semplificata - in una versione reale dovrebbe essere completata
      const result = await sdk.registerWithWebAuthn(username);
      
      if (result.success) {
        // Qui dovremmo avere un modo per ottenere l'userPub dopo la registrazione
        if (onSignupSuccess) {
          onSignupSuccess({ 
            userPub: 'webauthn-user-pub', 
            username, 
            authMethod: 'webauthn' as const 
          });
        }
      } else {
        throw new Error(result.error || 'Errore nella registrazione con WebAuthn');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Errore nella registrazione con WebAuthn';
      setErrorMessage(errorMsg);
      if (onError) onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.tabs}>
        <div 
          style={{...styles.tab, ...(activeTab === 0 ? styles.activeTab : {})}}
          onClick={() => setActiveTab(0)}
        >
          Login
        </div>
        <div 
          style={{...styles.tab, ...(activeTab === 1 ? styles.activeTab : {})}}
          onClick={() => setActiveTab(1)}
        >
          Registrazione
        </div>
      </div>
      
      <h2 style={styles.header}>
        {activeTab === 0 ? messages.loginHeader : messages.signupHeader}
      </h2>
      
      {activeTab === 0 ? (
        // Login Form
        <div>
          <input
            style={styles.input}
            type="text"
            placeholder={messages.usernameLabel}
            value={username}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
          />
          <input
            style={styles.input}
            type="password"
            placeholder={messages.passwordLabel}
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          />
          <button
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {})
            }}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Caricamento...' : messages.loginButton}
          </button>
          
          <a style={styles.link} onClick={() => setActiveTab(1)}>
            {messages.switchToSignup}
          </a>
          
          {showWebauthn && isWebAuthnSupported && (
            <button
              style={{
                ...styles.button,
                ...(loading ? styles.buttonDisabled : {}),
                backgroundColor: '#4f46e5'
              }}
              onClick={handleWebAuthnLogin}
              disabled={loading}
            >
              {messages.webauthnLogin}
            </button>
          )}
          
          {showMetamask && (
            <div>
              <button
                style={{
                  ...styles.button,
                  ...(loading ? styles.buttonDisabled : {}),
                  backgroundColor: '#f59e0b'
                }}
                onClick={handleMetaMaskConnect}
                disabled={loading || isMetaMaskConnected}
              >
                {isMetaMaskConnected ? 'MetaMask Connesso' : messages.metamaskConnect}
              </button>
              
              {isMetaMaskConnected && (
                <div style={styles.metamaskContainer}>
                  <p style={styles.metamaskAddress}>
                    Account: {metamaskAddress}
                  </p>
                  <button
                    style={{
                      ...styles.button,
                      ...(loading ? styles.buttonDisabled : {}),
                      backgroundColor: '#f59e0b'
                    }}
                    onClick={handleMetaMaskLogin}
                    disabled={loading}
                  >
                    {messages.metamaskLogin}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        // Signup Form
        <div>
          <input
            style={styles.input}
            type="text"
            placeholder={messages.usernameLabel}
            value={username}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
          />
          <input
            style={styles.input}
            type="password"
            placeholder={messages.passwordLabel}
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          />
          <input
            style={styles.input}
            type="password"
            placeholder={messages.confirmPasswordLabel}
            value={passwordConfirmation}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasswordConfirmation(e.target.value)}
          />
          <button
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {})
            }}
            onClick={handleSignUp}
            disabled={loading}
          >
            {loading ? 'Caricamento...' : messages.signupButton}
          </button>
          
          <a style={styles.link} onClick={() => setActiveTab(0)}>
            {messages.switchToLogin}
          </a>
          
          {showWebauthn && isWebAuthnSupported && (
            <button
              style={{
                ...styles.button,
                ...(loading ? styles.buttonDisabled : {}),
                backgroundColor: '#4f46e5'
              }}
              onClick={handleWebAuthnSignUp}
              disabled={loading}
            >
              {messages.webauthnSignup}
            </button>
          )}
          
          {showMetamask && (
            <button
              style={{
                ...styles.button,
                ...(loading ? styles.buttonDisabled : {}),
                backgroundColor: '#f59e0b'
              }}
              onClick={handleMetaMaskSignUp}
              disabled={loading || isMetaMaskConnected}
            >
              {isMetaMaskConnected ? 'MetaMask Connesso' : messages.metamaskConnect}
            </button>
          )}
          
          {showMetamask && isMetaMaskConnected && (
            <div style={styles.metamaskContainer}>
              <p style={styles.metamaskAddress}>
                Account: {metamaskAddress}
              </p>
            </div>
          )}
        </div>
      )}
      
      {errorMessage && (
        <div style={styles.error}>
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default LoginWithShogun; 