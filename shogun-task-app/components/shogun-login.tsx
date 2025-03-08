import React, { useState, useEffect } from 'react';
import { ShogunSDK } from '@shogun/sdk';
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";

// Estendo l'interfaccia ShogunSDK per includere i metodi che stiamo utilizzando


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

// Definizione dell'interfaccia AuthResult
interface AuthResult {
  success: boolean;
  userPub?: string;
  password?: string;
  error?: string;
  wallet?: any;
  username?: string;
}

interface LoginWithShogunReactProps {
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

const LoginWithShogunReact: React.FC<LoginWithShogunReactProps> = ({
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
    metamaskSignup: customMessages?.metamaskSignup || 'Registrati con MetaMask',
    webauthnLogin: customMessages?.webauthnLogin || 'Accedi con WebAuthn',
    webauthnSignup: customMessages?.webauthnSignup || 'Registrati con WebAuthn',
    mismatched: customMessages?.mismatched || 'Le password non corrispondono',
    empty: customMessages?.empty || 'Tutti i campi sono obbligatori',
    exists: customMessages?.exists || 'Utente già esistente'
  };

  // Verifica se WebAuthn è supportato
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
            authMethod: 'standard'
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
            authMethod: 'standard_signup'
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
      console.log("Tentativo di connessione a MetaMask...");
      
      // Verifica se metamask è disponibile nell'SDK
      if (!sdk.metamask) {
        throw new Error('MetaMask non è supportato in questa versione dell\'SDK');
      }
      
      const result = await sdk.metamask.connectMetaMask();
      console.log("Risultato connessione MetaMask:", result);
      
      if (result?.success) {
        setMetamaskAddress(result.address || '');
        setIsMetaMaskConnected(true);
        // Usa lo stesso formato di username dell'SDK
        const username = `metamask_${result.address?.slice(0, 10)}`;
        setUsername(username);
        console.log("Connessione a MetaMask riuscita, indirizzo:", result.address);
      } else {
        throw new Error(result?.error || 'Errore nella connessione a MetaMask');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Errore nella connessione a MetaMask';
      console.error("Errore completo:", error);
      setErrorMessage(errorMsg);
      if (onError) onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMaskLogin = async () => {
    console.log("handleMetaMaskLogin chiamato");
    
    if (!isMetaMaskConnected || !metamaskAddress) {
      setErrorMessage('Connetti prima MetaMask');
      if (onError) onError('Connetti prima MetaMask');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // Usa lo stesso formato di username dell'SDK
      const username = `metamask_${metamaskAddress.slice(0, 10)}`;
      console.log("Tentativo di login con MetaMask...", { username, address: metamaskAddress });
      
      if (!sdk.loginWithMetaMask) {
        throw new Error('Login con MetaMask non è supportato in questa versione dell\'SDK');
      }
      
      const result = await sdk.loginWithMetaMask(metamaskAddress);
      console.log("Risultato login con MetaMask:", result);

      if (result.success) {
        if (onLoginSuccess) {
          const userPub = result.userPub;
          if (!userPub) {
            throw new Error("UserPub non definito");
          }

          // Usa la password generata dall'SDK invece di crearne una nuova
          onLoginSuccess({ 
            userPub,
            username: username,
            wallet: result.wallet,
            password: result.password, // Usa la password generata dall'SDK
            authMethod: 'metamask_direct'
          });
        }
      } else {
        // Se il login fallisce, proviamo a registrare l'utente
        if (result.error && (
            result.error.includes("Account not registered") || 
            result.error.includes("Account not found") ||
            result.error.includes("missing data") ||
            result.error.includes("Document not found")
          )) {
          console.log("Account non registrato o dati mancanti, tentativo di registrazione...");
          await handleMetaMaskSignUp();
          return;
        }
        
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
      // Usa lo stesso formato di username dell'SDK
      const username = `metamask_${metamaskAddress.slice(0, 10)}`;
      console.log("Tentativo di registrazione con MetaMask...", { username, address: metamaskAddress });
      
      if (!sdk.signUpWithMetaMask) {
        throw new Error('Registrazione con MetaMask non è supportata in questa versione dell\'SDK');
      }
      
      const result = await sdk.signUpWithMetaMask(metamaskAddress) as AuthResult;
      console.log("Risultato registrazione con MetaMask:", result);

      if (result.success) {
        console.log("Registrazione con MetaMask riuscita");

        if (onSignupSuccess) {
          onSignupSuccess({ 
            userPub: result.userPub || metamaskAddress,
            username: username,
            wallet: result.wallet,
            password: result.password, // Usa la password generata dall'SDK
            authMethod: 'metamask_signup'
          });
        }
      } else {
        if (result.error?.includes('User already created') || result.error?.includes('already exists')) {
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
      console.log("Tentativo di login con WebAuthn...");
      
      if (!sdk.loginWithWebAuthn) {
        throw new Error('Login WebAuthn non è supportato in questa versione dell\'SDK');
      }
      
      const result = await sdk.loginWithWebAuthn(username);
      console.log("Risultato login WebAuthn:", result);
      
      if (result.success) {
        if (onLoginSuccess) {
          const sessionKey = result.password || `webauthn_${Date.now()}`;
          onLoginSuccess({ 
            userPub: result.userPub || result.credentialId || 'webauthn-user-pub', 
            username: username,
            password: sessionKey,
            authMethod: 'webauthn'
          });
        }
      } else {
        throw new Error(result.error || "Errore durante il login WebAuthn");
      }
    } catch (error: any) {
      const errorMsg = error.message || "Errore durante il login WebAuthn";
      console.error("Errore WebAuthn:", errorMsg);
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
      console.log("Tentativo di registrazione con WebAuthn...");
      
      if (!sdk.registerWithWebAuthn) {
        throw new Error('Registrazione WebAuthn non è supportata in questa versione dell\'SDK');
      }
      
      const result = await sdk.registerWithWebAuthn(username);
      console.log("Risultato registrazione WebAuthn:", result);
      
      if (result.success) {
        if (onSignupSuccess) {
          const sessionKey = result.password || `webauthn_${Date.now()}`;
          onSignupSuccess({ 
            userPub: result.userPub || result.credentialId || 'webauthn-user-pub', 
            username: username,
            password: sessionKey,
            authMethod: 'webauthn'
          });
        }
      } else {
        throw new Error(result.error || "Errore durante la registrazione WebAuthn");
      }
    } catch (error: any) {
      const errorMsg = error.message || "Errore durante la registrazione WebAuthn";
      console.error("Errore WebAuthn:", errorMsg);
      setErrorMessage(errorMsg);
      if (onError) onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card p-8 rounded-xl w-full max-w-[380px] shadow-2xl border border-white/5">
      <div className="flex justify-center items-center w-full h-auto">
        <h1 className="text-2xl font-semibold text-center mb-6">
          Shogun Wallet
        </h1>
      </div>

      <div className="flex w-full mb-4">
        <div 
          className={`flex-1 p-2 text-center cursor-pointer ${activeTab === 0 ? 'border-b-2 border-primary font-semibold' : ''}`}
          onClick={() => setActiveTab(0)}
        >
          Login
        </div>
        <div 
          className={`flex-1 p-2 text-center cursor-pointer ${activeTab === 1 ? 'border-b-2 border-primary font-semibold' : ''}`}
          onClick={() => setActiveTab(1)}
        >
          Registrazione
        </div>
      </div>

      <div className="text-center text-lg mb-4">
        {activeTab === 0 ? messages.loginHeader : messages.signupHeader}
      </div>

      {activeTab === 0 ? (
        <div className="flex flex-col gap-3">
          <input
            className="w-full p-3.5 bg-white/3 border border-border rounded-lg text-white placeholder-gray-500 focus:border-primary outline-none"
            placeholder={messages.usernameLabel}
            onChange={(e) => setUsername(e.target.value)}
            value={username}
          />
          <input
            className="w-full p-3.5 bg-white/3 border border-border rounded-lg text-white placeholder-gray-500 focus:border-primary outline-none"
            placeholder={messages.passwordLabel}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
          <Button
            onClick={handleLogin}
            className="w-full"
            loading={loading}
          >
            {messages.loginButton}
          </Button>

          <Link
            onClick={() => setActiveTab(1)}
            text={messages.switchToSignup}
          />

          {showWebauthn && isWebAuthnSupported && (
            <Button
              onClick={handleWebAuthnLogin}
              className="w-full"
            >
              {messages.webauthnLogin}
            </Button>
          )}

          {showMetamask && (
            <>
              <Button
                onClick={handleMetaMaskConnect}
                className="w-full"
              >
                {isMetaMaskConnected ? 'MetaMask Connesso' : messages.metamaskConnect}
              </Button>
              
              {isMetaMaskConnected && (
                <div className="bg-white/5 p-3 rounded-lg">
                  <p className="text-sm text-gray-400 mb-2 break-all">
                    Account: {metamaskAddress}
                  </p>
                  <Button
                    onClick={handleMetaMaskLogin}
                    className="w-full"
                  >
                    {messages.metamaskLogin}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <input
            className="w-full p-3.5 bg-white/3 border border-border rounded-lg text-white placeholder-gray-500 focus:border-primary outline-none"
            placeholder={messages.usernameLabel}
            onChange={(e) => setUsername(e.target.value)}
            value={username}
          />
          <input
            className="w-full p-3.5 bg-white/3 border border-border rounded-lg text-white placeholder-gray-500 focus:border-primary outline-none"
            placeholder={messages.passwordLabel}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
          <input
            className="w-full p-3.5 bg-white/3 border border-border rounded-lg text-white placeholder-gray-500 focus:border-primary outline-none"
            placeholder={messages.confirmPasswordLabel}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            type="password"
          />
          <Button
            onClick={handleSignUp}
            className="w-full"
            loading={loading}
          >
            {messages.signupButton}
          </Button>

          <Link
            onClick={() => setActiveTab(0)}
            text={messages.switchToLogin}
          />

          {showWebauthn && isWebAuthnSupported && (
            <Button
              onClick={handleWebAuthnSignUp}
              className="w-full"
            >
              {messages.webauthnSignup}
            </Button>
          )}

          {showMetamask && (
            <>
              <Button
                onClick={handleMetaMaskConnect}
                className="w-full"
              >
                {isMetaMaskConnected ? 'MetaMask Connesso' : messages.metamaskConnect}
              </Button>
              
              {isMetaMaskConnected && (
                <div className="bg-white/5 p-3 rounded-lg">
                  <p className="text-sm text-gray-400 mb-2 break-all">
                    Account: {metamaskAddress}
                  </p>
                  <Button
                    onClick={handleMetaMaskSignUp}
                    className="w-full"
                  >
                    {messages.metamaskSignup}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {errorMessage && (
        <div className="mt-3 bg-error/10 border border-error/20 text-error text-sm rounded-lg p-3 text-center">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default LoginWithShogunReact; 