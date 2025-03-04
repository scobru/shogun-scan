/** @jsxImportSource solid-js */
import { createSignal, createEffect, Component } from 'solid-js';
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

const LoginWithShogunSolid: Component<LoginWithShogunProps> = (props) => {
  const [activeTab, setActiveTab] = createSignal<number>(0);
  const [username, setUsername] = createSignal<string>('');
  const [password, setPassword] = createSignal<string>('');
  const [passwordConfirmation, setPasswordConfirmation] = createSignal<string>('');
  const [loading, setLoading] = createSignal<boolean>(false);
  const [errorMessage, setErrorMessage] = createSignal<string>('');
  const [isMetaMaskConnected, setIsMetaMaskConnected] = createSignal<boolean>(false);
  const [metamaskAddress, setMetamaskAddress] = createSignal<string>('');
  const [isWebAuthnSupported, setIsWebAuthnSupported] = createSignal<boolean>(false);

  // Messaggi predefiniti
  const messages = {
    loginHeader: props.customMessages?.loginHeader || 'Accedi a Shogun',
    signupHeader: props.customMessages?.signupHeader || 'Registrati su Shogun',
    loginButton: props.customMessages?.loginButton || 'Accedi',
    signupButton: props.customMessages?.signupButton || 'Registrati',
    usernameLabel: props.customMessages?.usernameLabel || 'Username',
    passwordLabel: props.customMessages?.passwordLabel || 'Password',
    confirmPasswordLabel: props.customMessages?.confirmPasswordLabel || 'Conferma Password',
    switchToSignup: props.customMessages?.switchToSignup || 'Non hai un account? Registrati',
    switchToLogin: props.customMessages?.switchToLogin || 'Hai già un account? Accedi',
    metamaskConnect: props.customMessages?.metamaskConnect || 'Connetti MetaMask',
    metamaskLogin: props.customMessages?.metamaskLogin || 'Accedi con MetaMask',
    metamaskSignup: props.customMessages?.metamaskSignup || 'Registrati con MetaMask',
    webauthnLogin: props.customMessages?.webauthnLogin || 'Accedi con WebAuthn',
    webauthnSignup: props.customMessages?.webauthnSignup || 'Registrati con WebAuthn',
    mismatched: props.customMessages?.mismatched || 'Le password non corrispondono',
    empty: props.customMessages?.empty || 'Tutti i campi sono obbligatori',
    exists: props.customMessages?.exists || 'Utente già esistente'
  };

  // Logging iniziale per debug
  console.log("Props ricevute:", { sdk: props.sdk, showMetamask: props.showMetamask, showWebauthn: props.showWebauthn });
  console.log("SDK disponibile:", !!props.sdk);

  createEffect(() => {
    if (props.showWebauthn) {
      const supported = props.sdk.isWebAuthnSupported();
      console.log("WebAuthn supportato:", supported);
      setIsWebAuthnSupported(supported);
    }
  });

  const handleLogin = async () => {
    console.log("handleLogin chiamato");
    
    if (!username() || !password()) {
      setErrorMessage(messages.empty);
      if (props.onError) props.onError(messages.empty);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const result = await props.sdk.handleLogin(username(), password(), {});
      console.log("Risultato login standard:", result);

      if (result.success && result.userPub) {
        if (props.onLoginSuccess) {
          props.onLoginSuccess({ 
            userPub: result.userPub,
            username: username(),
            password: password(),
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
      if (props.onError) props.onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    console.log("handleSignUp chiamato");
    
    if (password() !== passwordConfirmation()) {
      setErrorMessage(messages.mismatched);
      if (props.onError) props.onError(messages.mismatched);
      return;
    }

    if (!username() || !password() || !passwordConfirmation()) {
      setErrorMessage(messages.empty);
      if (props.onError) props.onError(messages.empty);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const result = await props.sdk.handleSignUp(username(), password(), passwordConfirmation(), {
        messages
      });
      console.log("Risultato registrazione standard:", result);

      if (result.success && result.userPub) {
        if (props.onSignupSuccess) {
          props.onSignupSuccess({ 
            userPub: result.userPub,
            username: username(),
            password: password(),
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
      if (props.onError) props.onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMaskConnect = async () => {
    if (!props.showMetamask) return;
    
    setLoading(true);
    setErrorMessage('');

    try {
      const result = await props.sdk.metamask?.connectMetaMask();
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
      if (props.onError) props.onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMaskLogin = async () => {
    console.log("handleMetaMaskLogin chiamato");
    console.log("isMetaMaskConnected:", isMetaMaskConnected());
    console.log("metamaskAddress:", metamaskAddress());
    
    if (!isMetaMaskConnected() || !metamaskAddress()) {
      setErrorMessage('Connetti prima MetaMask');
      if (props.onError) props.onError('Connetti prima MetaMask');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const username = `metamask_${metamaskAddress().slice(2, 8)}`;
      
      // Verifica se esiste una password salvata
      const savedPassword = localStorage.getItem(`lonewolf_${username}`);
      
      if (savedPassword) {
        console.log("Password salvata trovata, tentativo di login diretto con LoneWolf...");
        
        if (props.onLoginSuccess) {
          const authResult = {
            userPub: metamaskAddress(),
            username: username,
            password: savedPassword,
            authMethod: 'metamask_saved' as const
          };
          
          props.onLoginSuccess(authResult);
          setLoading(false);
          return;
        }
      }

      console.log("Tentativo di login con MetaMask...");
      const result = await props.sdk.loginWithMetaMask(metamaskAddress());
      console.log("Risultato login con MetaMask:", result);

      if (result.success) {
        if (result.password) {
          localStorage.setItem(`lonewolf_${username}`, result.password);
        }

        if (props.onLoginSuccess) {
          props.onLoginSuccess({ 
            userPub: result.userPub || metamaskAddress(),
            username: username,
            password: result.password,
            wallet: result.wallet,
            authMethod: 'metamask_direct'
          });
        }
      } else {
        throw new Error(result.error || 'Errore durante il login con MetaMask');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Errore nel login con MetaMask';
      console.error("Errore completo:", error);
      setErrorMessage(errorMsg);
      if (props.onError) props.onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMaskSignUp = async () => {
    console.log("handleMetaMaskSignUp chiamato");
    
    if (!isMetaMaskConnected() || !metamaskAddress()) {
      setErrorMessage('Connetti prima MetaMask');
      if (props.onError) props.onError('Connetti prima MetaMask');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const username = `metamask_${metamaskAddress().slice(2, 8)}`;
      console.log("Tentativo di registrazione con MetaMask...");
      
      const result = await props.sdk.signUpWithMetaMask(metamaskAddress());
      console.log("Risultato registrazione con MetaMask:", result);

      if (result.success) {
        console.log("Registrazione con MetaMask riuscita");
        
        if (result.password) {
          localStorage.setItem(`lonewolf_${username}`, result.password);
        }

        if (props.onSignupSuccess) {
          props.onSignupSuccess({ 
            userPub: result.userPub || metamaskAddress(),
            username: username,
            password: result.password,
            wallet: result.wallet,
            authMethod: 'metamask_signup'
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
      if (props.onError) props.onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleWebAuthnLogin = async () => {
    if (!props.showWebauthn || !isWebAuthnSupported()) return;
    
    if (!username()) {
      setErrorMessage(messages.empty);
      if (props.onError) props.onError(messages.empty);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const result = await props.sdk.authenticateWithWebAuthn(username());
      
      if (result.success) {
        if (props.onLoginSuccess) {
          props.onLoginSuccess({ 
            userPub: 'webauthn-user-pub', 
            username: username(), 
            authMethod: 'webauthn'
          });
        }
      } else {
        throw new Error(result.error || 'Errore nell\'autenticazione con WebAuthn');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Errore nell\'autenticazione con WebAuthn';
      setErrorMessage(errorMsg);
      if (props.onError) props.onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleWebAuthnSignUp = async () => {
    if (!props.showWebauthn || !isWebAuthnSupported()) return;
    
    if (!username()) {
      setErrorMessage(messages.empty);
      if (props.onError) props.onError(messages.empty);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const result = await props.sdk.registerWithWebAuthn(username());
      
      if (result.success) {
        if (props.onSignupSuccess) {
          props.onSignupSuccess({ 
            userPub: 'webauthn-user-pub', 
            username: username(), 
            authMethod: 'webauthn'
          });
        }
      } else {
        throw new Error(result.error || 'Errore nella registrazione con WebAuthn');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Errore nella registrazione con WebAuthn';
      setErrorMessage(errorMsg);
      if (props.onError) props.onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="flex flex-col w-auto h-auto p-4 bg-white dark:bg-gray-800 rounded-md shadow-sm space-y-5 max-w-sm">
      <div class="flex w-full mb-4">
        <div 
          class={`flex-1 p-2 text-center cursor-pointer ${activeTab() === 0 ? 'border-b-2 border-blue-600 font-semibold' : ''}`}
          onClick={() => setActiveTab(0)}
        >
          Login
        </div>
        <div 
          class={`flex-1 p-2 text-center cursor-pointer ${activeTab() === 1 ? 'border-b-2 border-blue-600 font-semibold' : ''}`}
          onClick={() => setActiveTab(1)}
        >
          Registrazione
        </div>
      </div>
      
      <h2 class="text-center text-lg text-gray-900 dark:text-white">
        {activeTab() === 0 ? messages.loginHeader : messages.signupHeader}
      </h2>
      
      {activeTab() === 0 ? (
        <div class="space-y-4">
          <input
            class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="text"
            placeholder={messages.usernameLabel}
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
          />
          <input
            class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="password"
            placeholder={messages.passwordLabel}
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
          <button
            class={`w-full px-4 py-2 bg-blue-600 text-white rounded-md ${loading() ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'}`}
            onClick={handleLogin}
            disabled={loading()}
          >
            {loading() ? 'Caricamento...' : messages.loginButton}
          </button>
          
          <div class="text-center">
            <button
              class="text-blue-600 hover:underline"
              onClick={() => setActiveTab(1)}
            >
              {messages.switchToSignup}
            </button>
          </div>
          
          {props.showWebauthn && isWebAuthnSupported() && (
            <button
              class={`w-full px-4 py-2 bg-purple-600 text-white rounded-md ${loading() ? 'opacity-70 cursor-not-allowed' : 'hover:bg-purple-700'}`}
              onClick={handleWebAuthnLogin}
              disabled={loading()}
            >
              {messages.webauthnLogin}
            </button>
          )}
          
          {props.showMetamask && (
            <div class="space-y-2">
              <button
                class={`w-full px-4 py-2 bg-orange-500 text-white rounded-md ${loading() || isMetaMaskConnected() ? 'opacity-70 cursor-not-allowed' : 'hover:bg-orange-600'}`}
                onClick={handleMetaMaskConnect}
                disabled={loading() || isMetaMaskConnected()}
              >
                {isMetaMaskConnected() ? 'MetaMask Connesso' : messages.metamaskConnect}
              </button>
              
              {isMetaMaskConnected() && (
                <div class="p-3 bg-gray-700 rounded-md">
                  <p class="text-sm text-gray-300 mb-2 break-all">
                    Account: {metamaskAddress()}
                  </p>
                  <button
                    class={`w-full px-4 py-2 bg-orange-500 text-white rounded-md ${loading() ? 'opacity-70 cursor-not-allowed' : 'hover:bg-orange-600'}`}
                    onClick={handleMetaMaskLogin}
                    disabled={loading()}
                  >
                    {messages.metamaskLogin}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div class="space-y-4">
          <input
            class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="text"
            placeholder={messages.usernameLabel}
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
          />
          <input
            class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="password"
            placeholder={messages.passwordLabel}
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
          <input
            class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="password"
            placeholder={messages.confirmPasswordLabel}
            value={passwordConfirmation()}
            onInput={(e) => setPasswordConfirmation(e.currentTarget.value)}
          />
          <button
            class={`w-full px-4 py-2 bg-blue-600 text-white rounded-md ${loading() ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'}`}
            onClick={handleSignUp}
            disabled={loading()}
          >
            {loading() ? 'Caricamento...' : messages.signupButton}
          </button>
          
          <div class="text-center">
            <button
              class="text-blue-600 hover:underline"
              onClick={() => setActiveTab(0)}
            >
              {messages.switchToLogin}
            </button>
          </div>
          
          {props.showWebauthn && isWebAuthnSupported() && (
            <button
              class={`w-full px-4 py-2 bg-purple-600 text-white rounded-md ${loading() ? 'opacity-70 cursor-not-allowed' : 'hover:bg-purple-700'}`}
              onClick={handleWebAuthnSignUp}
              disabled={loading()}
            >
              {messages.webauthnSignup}
            </button>
          )}
          
          {props.showMetamask && (
            <div class="space-y-2">
              <button
                class={`w-full px-4 py-2 bg-orange-500 text-white rounded-md ${loading() || isMetaMaskConnected() ? 'opacity-70 cursor-not-allowed' : 'hover:bg-orange-600'}`}
                onClick={handleMetaMaskSignUp}
                disabled={loading() || isMetaMaskConnected()}
              >
                {isMetaMaskConnected() ? 'MetaMask Connesso' : messages.metamaskConnect}
              </button>
              
              {isMetaMaskConnected() && (
                <div class="p-3 bg-gray-700 rounded-md">
                  <p class="text-sm text-gray-300 mb-2 break-all">
                    Account: {metamaskAddress()}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {errorMessage() && (
        <div class="text-center text-red-500">
          {errorMessage()}
        </div>
      )}
    </div>
  );
};

export default LoginWithShogunSolid; 