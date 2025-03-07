import React, { useState, useEffect } from 'react';
import { ShogunSDK } from 'shogun-sdk';
import Button from './Button';
import Link from './Link';

// Estendo l'interfaccia ShogunSDK per includere i metodi che stiamo utilizzando
interface ExtendedShogunSDK extends ShogunSDK {
  // Non è più necessario estendere l'interfaccia poiché tutti i metodi sono già definiti nel nuovo SDK
}

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

interface LoginWithShogunReactProps {
  sdk: ShogunSDK;
  onLoginSuccess?: (data: { 
    userPub: string; 
    username: string;
    password?: string;
    wallet?: any;
    authMethod?: 'standard' | 'metamask_direct' | 'metamask_saved' | 'metamask_signup' | 'standard_signup' | 'webauthn' | 'mnemonic';
  }) => void;
  onSignupSuccess?: (data: { 
    userPub: string; 
    username: string;
    password?: string;
    wallet?: any;
    authMethod?: 'standard' | 'metamask_direct' | 'metamask_saved' | 'metamask_signup' | 'standard_signup' | 'webauthn' | 'mnemonic';
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
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [metamaskConnected, setMetamaskConnected] = useState<boolean>(false);
  const [metamaskAddress, setMetamaskAddress] = useState<string>('');
  const [showMnemonicInput, setShowMnemonicInput] = useState(false);
  const [mnemonicPhrase, setMnemonicPhrase] = useState("");

  // Verifica se WebAuthn è supportato
  const isWebAuthnSupported = (): boolean => {
    return sdk.isWebAuthnSupported();
  };

  // Gestione del login standard
  const handleLogin = async () => {
    if (!username || !password) {
      setError(customMessages.empty || 'Tutti i campi sono obbligatori');
      onError && onError(customMessages.empty || 'Tutti i campi sono obbligatori');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await sdk.handleLogin(username, password, {
        setUserpub: (pub: string) => {
          console.log('Login success, pub:', pub);
        },
        setSignedIn: (signedIn: boolean) => {
          console.log('Login state:', signedIn);
        }
      });

      if (result.success) {
        onLoginSuccess && onLoginSuccess({
          userPub: result.userPub || '',
          username,
          password,
          wallet: result.wallet,
          authMethod: 'standard'
        });
      } else if (result.error) {
        setError(result.error);
        onError && onError(result.error);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'Errore durante il login');
      onError && onError(error.message || 'Errore durante il login');
    } finally {
      setLoading(false);
    }
  };

  // Gestione della registrazione standard
  const handleSignUp = async () => {
    if (!username || !password || !confirmPassword) {
      setError(customMessages.empty || 'Tutti i campi sono obbligatori');
      onError && onError(customMessages.empty || 'Tutti i campi sono obbligatori');
      return;
    }

    if (password !== confirmPassword) {
      setError(customMessages.mismatched || 'Le password non corrispondono');
      onError && onError(customMessages.mismatched || 'Le password non corrispondono');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await sdk.handleSignUp(username, password, confirmPassword, {
        setUserpub: (pub: string) => {
          console.log('Signup success, pub:', pub);
        },
        setSignedIn: (signedIn: boolean) => {
          console.log('Signup state:', signedIn);
        },
        setErrorMessage: (msg: string) => {
          console.error('Signup error message:', msg);
          setError(msg);
          onError && onError(msg);
        },
        messages: {
          userExists: customMessages.exists || 'Utente già esistente'
        }
      });

      if (result.success) {
        onSignupSuccess && onSignupSuccess({
          userPub: result.userPub || '',
          username,
          password,
          wallet: result.wallet,
          authMethod: 'standard_signup'
        });
      } else if (result.error) {
        setError(result.error);
        onError && onError(result.error);
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      setError(error.message || 'Errore durante la registrazione');
      onError && onError(error.message || 'Errore durante la registrazione');
    } finally {
      setLoading(false);
    }
  };

  // Gestione della connessione a MetaMask
  const handleMetaMaskConnect = async () => {
    setLoading(true);
    setError('');

    try {
      // Verifica se MetaMask è disponibile
      if (!window.ethereum) {
        throw new Error('MetaMask non è installato');
      }

      // Richiedi l'accesso agli account
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts && accounts.length > 0) {
        setMetamaskConnected(true);
        setMetamaskAddress(accounts[0]);
      } else {
        throw new Error('Nessun account MetaMask disponibile');
      }
    } catch (error: any) {
      console.error('MetaMask connect error:', error);
      setError(error.message || 'Errore durante la connessione a MetaMask');
      onError && onError(error.message || 'Errore durante la connessione a MetaMask');
    } finally {
      setLoading(false);
    }
  };

  // Gestione del login con MetaMask
  const handleMetaMaskLogin = async () => {
    if (!metamaskConnected || !metamaskAddress) {
      await handleMetaMaskConnect();
      if (!metamaskConnected || !metamaskAddress) {
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      // Verifica se MetaMask è disponibile
      if (!window.ethereum) {
        throw new Error('MetaMask non è installato');
      }

      // Assicurati che l'indirizzo sia aggiornato
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('Nessun account MetaMask disponibile');
      }
      
      const currentAddress = accounts[0];
      setMetamaskAddress(currentAddress);

      // Effettua il login con MetaMask
      const result = await sdk.loginWithMetaMask(currentAddress);

      if (result.success) {
        onLoginSuccess && onLoginSuccess({
          userPub: result.userPub || '',
          username: result.username || `metamask_${currentAddress.slice(0, 10)}`,
          wallet: result.wallet,
          authMethod: 'metamask_direct'
        });
      } else if (result.error) {
        // Se l'utente non esiste, prova a registrarlo
        if (result.error.includes('Utente non trovato')) {
          console.log('Utente non trovato, tentativo di registrazione...');
          await handleMetaMaskSignUp();
        } else {
          setError(result.error);
          onError && onError(result.error);
        }
      }
    } catch (error: any) {
      console.error('MetaMask login error:', error);
      setError(error.message || 'Errore durante il login con MetaMask');
      onError && onError(error.message || 'Errore durante il login con MetaMask');
    } finally {
      setLoading(false);
    }
  };

  // Gestione della registrazione con MetaMask
  const handleMetaMaskSignUp = async () => {
    if (!metamaskConnected || !metamaskAddress) {
      await handleMetaMaskConnect();
      if (!metamaskConnected || !metamaskAddress) {
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      // Verifica se MetaMask è disponibile
      if (!window.ethereum) {
        throw new Error('MetaMask non è installato');
      }

      // Assicurati che l'indirizzo sia aggiornato
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) {
        throw new Error('Nessun account MetaMask disponibile');
      }
      
      const currentAddress = accounts[0];
      setMetamaskAddress(currentAddress);

      // Effettua la registrazione con MetaMask
      const result = await sdk.signUpWithMetaMask(currentAddress);

      if (result.success) {
        onSignupSuccess && onSignupSuccess({
          userPub: result.userPub || '',
          username: result.username || `metamask_${currentAddress.slice(0, 10)}`,
          wallet: result.wallet,
          authMethod: 'metamask_signup'
        });
      } else if (result.error) {
        // Se l'utente esiste già, prova a fare il login
        if (result.error.includes('already exists') || result.error.includes('già esistente')) {
          console.log('User already exists, trying to login...');
          await handleMetaMaskLogin();
        } else {
          setError(result.error);
          onError && onError(result.error);
        }
      }
    } catch (error: any) {
      console.error('MetaMask signup error:', error);
      setError(error.message || 'Errore durante la registrazione con MetaMask');
      onError && onError(error.message || 'Errore durante la registrazione con MetaMask');
    } finally {
      setLoading(false);
    }
  };

  // Gestione del login con WebAuthn
  const handleWebAuthnLogin = async () => {
    if (!username) {
      setError(customMessages.empty || 'Il nome utente è obbligatorio');
      onError && onError(customMessages.empty || 'Il nome utente è obbligatorio');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await sdk.loginWithWebAuthn(username);

      if (result.success) {
        onLoginSuccess && onLoginSuccess({
          userPub: result.userPub || '',
          username,
          password: result.password,
          authMethod: 'webauthn'
        });
      } else if (result.error) {
        setError(result.error);
        onError && onError(result.error);
      }
    } catch (error: any) {
      console.error('WebAuthn login error:', error);
      setError(error.message || 'Errore durante il login con WebAuthn');
      onError && onError(error.message || 'Errore durante il login con WebAuthn');
    } finally {
      setLoading(false);
    }
  };

  // Gestione della registrazione con WebAuthn
  const handleWebAuthnSignUp = async () => {
    if (!username) {
      setError(customMessages.empty || 'Il nome utente è obbligatorio');
      onError && onError(customMessages.empty || 'Il nome utente è obbligatorio');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await sdk.registerWithWebAuthn(username);

      if (result.success) {
        onSignupSuccess && onSignupSuccess({
          userPub: result.userPub || '',
          username,
          password: result.password,
          authMethod: 'webauthn'
        });
      } else if (result.error) {
        setError(result.error);
        onError && onError(result.error);
      }
    } catch (error: any) {
      console.error('WebAuthn signup error:', error);
      setError(error.message || 'Errore durante la registrazione con WebAuthn');
      onError && onError(error.message || 'Errore durante la registrazione con WebAuthn');
    } finally {
      setLoading(false);
    }
  };

  const handleMnemonicLogin = async () => {
    try {
      setLoading(true);
      setError("");
      
      if (!mnemonicPhrase.trim()) {
        setError("Inserisci una frase mnemonica valida");
        return;
      }
      
      // Verifica se la mnemonic phrase è valida
      try {
        // Ripristina il wallet dalla mnemonic phrase
        const wallet = sdk.restoreFromMnemonic(mnemonicPhrase);
        
        // Salva la mnemonic phrase in localStorage
        sdk.saveMnemonicToLocalStorage(mnemonicPhrase);
        
        // Se l'utente ha inserito username e password, prova ad autenticarsi in GunDB
        if (username && password) {
          try {
            // Usa il metodo handleLogin per autenticarsi
            const loginResult = await sdk.handleLogin(username, password, {});
            
            if (loginResult.success) {
              // Se l'autenticazione ha successo, salva la mnemonic in GunDB
              const user = sdk.gun.user();
              const userpub = user?.is?.pub;
              
              if (userpub) {
                await sdk.saveMnemonicToGun(userpub, mnemonicPhrase);
              }
            } else {
              console.warn("Autenticazione non riuscita:", loginResult.error);
            }
          } catch (authError) {
            console.error("Errore durante l'autenticazione in GunDB:", authError);
            // Continua comunque, poiché abbiamo il wallet
          }
        }
        
        // Notifica il successo
        if (onLoginSuccess) {
          onLoginSuccess({
            userPub: sdk.gun.user()?.is?.pub || '',
            username: username || wallet.address,
            wallet: wallet,
            authMethod: 'mnemonic'
          });
        }
      } catch (error: any) {
        console.error("Errore durante il ripristino del wallet:", error);
        setError(error.message || "Frase mnemonica non valida");
        onError && onError(error.message || "Frase mnemonica non valida");
      }
    } catch (error: any) {
      console.error("Errore durante il login con mnemonic:", error);
      setError(error.message || "Errore durante il login con mnemonic");
      onError && onError(error.message || "Errore durante il login con mnemonic");
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
        {activeTab === 0 ? customMessages.loginHeader || 'Accedi a Shogun' : customMessages.signupHeader || 'Registrati su Shogun'}
      </div>

      {activeTab === 0 ? (
        <div className="flex flex-col gap-3">
          {!showMnemonicInput ? (
            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
              <input
                className="w-full p-3.5 bg-white/3 border border-border rounded-lg text-white placeholder-gray-500 focus:border-primary outline-none"
                placeholder={customMessages.usernameLabel || 'Username'}
                onChange={(e) => setUsername(e.target.value)}
                value={username}
              />
              <input
                className="w-full p-3.5 bg-white/3 border border-border rounded-lg text-white placeholder-gray-500 focus:border-primary outline-none"
                placeholder={customMessages.passwordLabel || 'Password'}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
              />
              <Button
                onClick={handleLogin}
                fullWidth
                loading={loading}
                text={customMessages.loginButton || 'Accedi'}
              />

              <Link
                onClick={() => setActiveTab(1)}
                text={customMessages.switchToSignup || 'Non hai un account? Registrati'}
              />

              {showWebauthn && isWebAuthnSupported() && (
                <Button
                  onClick={handleWebAuthnLogin}
                  fullWidth
                  text={customMessages.webauthnLogin || 'Accedi con WebAuthn'}
                />
              )}

              {showMetamask && (
                <>
                  <Button
                    onClick={handleMetaMaskConnect}
                    fullWidth
                    text={metamaskConnected ? 'MetaMask Connesso' : customMessages.metamaskConnect || 'Connetti MetaMask'}
                  />
                  
                  {metamaskConnected && (
                    <div className="bg-white/5 p-3 rounded-lg">
                      <p className="text-sm text-gray-400 mb-2 break-all">
                        Account: {metamaskAddress}
                      </p>
                      <Button
                        onClick={handleMetaMaskLogin}
                        fullWidth
                        text={customMessages.metamaskLogin || 'Accedi con MetaMask'}
                      />
                    </div>
                  )}
                </>
              )}

              <div className="mt-4">
                <button
                  type="button"
                  className="text-primary hover:text-primary-light text-sm w-full text-center"
                  onClick={() => setShowMnemonicInput(true)}
                >
                  Accedi con frase mnemonica
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); handleMnemonicLogin(); }}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Frase Mnemonica
                </label>
                <textarea
                  className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-primary outline-none resize-y"
                  placeholder="Inserisci la tua frase mnemonica di 12 parole..."
                  value={mnemonicPhrase}
                  onChange={(e) => setMnemonicPhrase(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Username (opzionale)
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-primary outline-none"
                  placeholder="Username per GunDB (opzionale)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Password (opzionale)
                </label>
                <input
                  type="password"
                  className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-primary outline-none"
                  placeholder="Password per GunDB (opzionale)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              
              <Button
                onClick={handleMnemonicLogin}
                text="Accedi con Mnemonic"
                loading={loading}
                fullWidth
              />
              
              <div className="mt-4">
                <button
                  type="button"
                  className="text-primary hover:text-primary-light text-sm w-full text-center"
                  onClick={() => setShowMnemonicInput(false)}
                >
                  Torna al login standard
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <input
            className="w-full p-3.5 bg-white/3 border border-border rounded-lg text-white placeholder-gray-500 focus:border-primary outline-none"
            placeholder={customMessages.usernameLabel || 'Username'}
            onChange={(e) => setUsername(e.target.value)}
            value={username}
          />
          <input
            className="w-full p-3.5 bg-white/3 border border-border rounded-lg text-white placeholder-gray-500 focus:border-primary outline-none"
            placeholder={customMessages.passwordLabel || 'Password'}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
          <input
            className="w-full p-3.5 bg-white/3 border border-border rounded-lg text-white placeholder-gray-500 focus:border-primary outline-none"
            placeholder={customMessages.confirmPasswordLabel || 'Conferma Password'}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type="password"
          />
          <Button
            onClick={handleSignUp}
            fullWidth
            loading={loading}
            text={customMessages.signupButton || 'Registrati'}
          />

          <Link
            onClick={() => setActiveTab(0)}
            text={customMessages.switchToLogin || 'Hai già un account? Accedi'}
          />

          {showWebauthn && isWebAuthnSupported() && (
            <Button
              onClick={handleWebAuthnSignUp}
              fullWidth
              text={customMessages.webauthnSignup || 'Registrati con WebAuthn'}
            />
          )}

          {showMetamask && (
            <>
              <Button
                onClick={handleMetaMaskConnect}
                fullWidth
                text={metamaskConnected ? 'MetaMask Connesso' : customMessages.metamaskConnect || 'Connetti MetaMask'}
              />
              
              {metamaskConnected && (
                <div className="bg-white/5 p-3 rounded-lg">
                  <p className="text-sm text-gray-400 mb-2 break-all">
                    Account: {metamaskAddress}
                  </p>
                  <Button
                    onClick={handleMetaMaskSignUp}
                    fullWidth
                    text={customMessages.metamaskSignup || 'Registrati con MetaMask'}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mt-3 bg-error/10 border border-error/20 text-error text-sm rounded-lg p-3 text-center">
          {error}
        </div>
      )}
    </div>
  );
};

export default LoginWithShogunReact; 