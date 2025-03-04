import React, { useState, useEffect } from 'react';
import type { FC, ReactElement, ChangeEvent } from 'react';
import ShogunSDK from '../../index';

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
  metamaskSignup?: string;
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

const LoginWithShogunReact: FC<LoginWithShogunProps> = ({
  sdk,
  onLoginSuccess,
  onSignupSuccess,
  onError,
  customMessages = {},
  darkMode = true,
  showMetamask = true,
  showWebauthn = true
}): ReactElement => {
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
    metamaskSignup: customMessages?.metamaskSignup || 'Registrati con MetaMask',
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

  const handleUsernameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  const handlePasswordConfirmationChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPasswordConfirmation(e.target.value);
  };

  return (
    <div className="flex flex-col w-auto h-auto p-4 bg-white dark:bg-gray-800 rounded-md shadow-sm space-y-5 max-w-sm">
      <div className="flex w-full mb-4">
        <div 
          className={`flex-1 p-2 text-center cursor-pointer ${activeTab === 0 ? 'border-b-2 border-blue-600 font-semibold' : ''}`}
          onClick={() => setActiveTab(0)}
        >
          Login
        </div>
        <div 
          className={`flex-1 p-2 text-center cursor-pointer ${activeTab === 1 ? 'border-b-2 border-blue-600 font-semibold' : ''}`}
          onClick={() => setActiveTab(1)}
        >
          Registrazione
        </div>
      </div>
      
      <h2 className="text-center text-lg text-gray-900 dark:text-white">
        {activeTab === 0 ? messages.loginHeader : messages.signupHeader}
      </h2>
      
      {activeTab === 0 ? (
        <div className="space-y-4">
          <input
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="text"
            placeholder={messages.usernameLabel}
            value={username}
            onChange={handleUsernameChange}
          />
          <input
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="password"
            placeholder={messages.passwordLabel}
            value={password}
            onChange={handlePasswordChange}
          />
          <button
            className={`w-full px-4 py-2 bg-blue-600 text-white rounded-md ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'}`}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? 'Caricamento...' : messages.loginButton}
          </button>
          
          <div className="text-center">
            <button
              className="text-blue-600 hover:underline"
              onClick={() => setActiveTab(1)}
            >
              {messages.switchToSignup}
            </button>
          </div>
          
          {showWebauthn && isWebAuthnSupported && (
            <button
              className={`w-full px-4 py-2 bg-purple-600 text-white rounded-md ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-purple-700'}`}
              onClick={handleWebAuthnLogin}
              disabled={loading}
            >
              {messages.webauthnLogin}
            </button>
          )}
          
          {showMetamask && (
            <div className="space-y-2">
              <button
                className={`w-full px-4 py-2 bg-orange-500 text-white rounded-md ${loading || isMetaMaskConnected ? 'opacity-70 cursor-not-allowed' : 'hover:bg-orange-600'}`}
                onClick={handleMetaMaskConnect}
                disabled={loading || isMetaMaskConnected}
              >
                {isMetaMaskConnected ? 'MetaMask Connesso' : messages.metamaskConnect}
              </button>
              
              {isMetaMaskConnected && (
                <div className="p-3 bg-gray-700 rounded-md">
                  <p className="text-sm text-gray-300 mb-2 break-all">
                    Account: {metamaskAddress}
                  </p>
                  <button
                    className={`w-full px-4 py-2 bg-orange-500 text-white rounded-md ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-orange-600'}`}
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
        <div className="space-y-4">
          <input
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="text"
            placeholder={messages.usernameLabel}
            value={username}
            onChange={handleUsernameChange}
          />
          <input
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="password"
            placeholder={messages.passwordLabel}
            value={password}
            onChange={handlePasswordChange}
          />
          <input
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="password"
            placeholder={messages.confirmPasswordLabel}
            value={passwordConfirmation}
            onChange={handlePasswordConfirmationChange}
          />
          <button
            className={`w-full px-4 py-2 bg-blue-600 text-white rounded-md ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'}`}
            onClick={handleSignUp}
            disabled={loading}
          >
            {loading ? 'Caricamento...' : messages.signupButton}
          </button>
          
          <div className="text-center">
            <button
              className="text-blue-600 hover:underline"
              onClick={() => setActiveTab(0)}
            >
              {messages.switchToLogin}
            </button>
          </div>
          
          {showWebauthn && isWebAuthnSupported && (
            <button
              className={`w-full px-4 py-2 bg-purple-600 text-white rounded-md ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-purple-700'}`}
              onClick={handleWebAuthnSignUp}
              disabled={loading}
            >
              {messages.webauthnSignup}
            </button>
          )}
          
          {showMetamask && (
            <div className="space-y-2">
              <button
                className={`w-full px-4 py-2 bg-orange-500 text-white rounded-md ${loading || isMetaMaskConnected ? 'opacity-70 cursor-not-allowed' : 'hover:bg-orange-600'}`}
                onClick={handleMetaMaskSignUp}
                disabled={loading || isMetaMaskConnected}
              >
                {isMetaMaskConnected ? 'MetaMask Connesso' : messages.metamaskConnect}
              </button>
              
              {isMetaMaskConnected && (
                <div className="p-3 bg-gray-700 rounded-md">
                  <p className="text-sm text-gray-300 mb-2 break-all">
                    Account: {metamaskAddress}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {errorMessage && (
        <div className="text-center text-red-500">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default LoginWithShogunReact; 