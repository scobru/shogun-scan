import { createSignal, Show } from 'solid-js';
import LoneWolfLogo from '../assets/LoneWolfLogo';

const LoginWithShogun = (props) => {
  const [activeTab, setActiveTab] = createSignal(0);
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [passwordConfirmation, setPasswordConfirmation] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal('');
  const [isMetaMaskConnected, setIsMetaMaskConnected] = createSignal(false);
  const [metamaskAddress, setMetamaskAddress] = createSignal('');
  const [isWebAuthnSupported, setIsWebAuthnSupported] = createSignal(false);

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

  // All'inizio del componente
  console.log("Props ricevute:", props);
  console.log("SDK disponibile:", !!props.sdk);
  console.log("showMetamask:", props.showMetamask);
  console.log("showWebauthn:", props.showWebauthn);

  // Verifica se WebAuthn è supportato
  if (props.showWebauthn) {
    const supported = props.sdk.isWebAuthnSupported();
    console.log("WebAuthn supportato:", supported);
    setIsWebAuthnSupported(supported);
  }

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
    } catch (error) {
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
    } catch (error) {
      const errorMsg = error.message || 'Errore durante la registrazione';
      console.error("Errore completo:", error);
      setErrorMessage(errorMsg);
      if (props.onError) props.onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMaskConnect = async () => {
    setLoading(true);
    try {
      const result = await props.sdk.metamask.connectMetaMask();
      if (result.success) {
        setIsMetaMaskConnected(true);
        setMetamaskAddress(result.address);
      } else {
        throw new Error(result.error || "Errore durante la connessione a MetaMask");
      }
    } catch (error) {
      const errorMsg = error.message || "Errore durante la connessione a MetaMask";
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
      setErrorMessage("MetaMask non connesso");
      return;
    }
    
    setLoading(true);
    setErrorMessage('');
    
    try {
      const username = `metamask_${metamaskAddress().slice(2, 8)}`;
      
      // Prima controlla se abbiamo una password salvata
      const savedPassword = localStorage.getItem(`lonewolf_${username}`);
      
      // Se abbiamo una password salvata, prova a usarla direttamente con LoneWolf
      if (savedPassword) {
        console.log("Password salvata trovata, tentativo di login diretto con LoneWolf...");
        
        // Notifica il componente di autenticazione che vogliamo usare la password salvata
        if (props.onLoginSuccess) {
          const authResult = {
            userPub: metamaskAddress(), 
            username: username,
            password: savedPassword,
            authMethod: 'metamask_saved'
          };
          
          props.onLoginSuccess(authResult);
          setLoading(false);
          return;
        }
      }
      
      // Se non abbiamo una password salvata o il login diretto fallisce, procedi con MetaMask
      console.log("Tentativo di login con MetaMask...");
      const result = await props.sdk.loginWithMetaMask(metamaskAddress());

      console.log("Risultato login con MetaMask:", result);
      
      if (result.success) {
        // Salva la password generata in localStorage per uso futuro
        if (result.password) {
          localStorage.setItem(`lonewolf_${username}`, result.password);
        }
        
        if (props.onLoginSuccess) {
          const authResult = {
            userPub: result.userPub || metamaskAddress(), 
            username: username,
            password: result.password,
            wallet: result.wallet,
            authMethod: 'metamask_direct'
          };
          
          props.onLoginSuccess(authResult);
        }
      } else {
        throw new Error(result.error || "Errore durante il login con MetaMask");
      }
    } catch (error) {
      const errorMsg = error.message || "Errore durante il login con MetaMask";
      setErrorMessage(errorMsg);
      if (props.onError) props.onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMaskSignUp = async () => {
    if (!isMetaMaskConnected() || !metamaskAddress()) {
      setErrorMessage("MetaMask non connesso");
      return;
    }
    
    setLoading(true);
    setErrorMessage('');
    
    try {
      const username = `metamask_${metamaskAddress().slice(2, 8)}`;
      
      // Tenta la registrazione con MetaMask
      console.log("Tentativo di registrazione con MetaMask...");
      const result = await props.sdk.signUpWithMetaMask(metamaskAddress());
      
      if (result.success) {
        console.log("Registrazione con MetaMask riuscita");
        
        // Salva la password generata in localStorage
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
        // Se la registrazione fallisce con "User already created", prova il login
        if (result.error && result.error.includes("User already created")) {
          console.log("Utente già esistente, tentativo di login...");
          const loginResult = await props.sdk.loginWithMetaMask(metamaskAddress());
          
          if (loginResult.success) {
            console.log("Login con MetaMask riuscito");
            
            // Salva la password in localStorage
            if (loginResult.password) {
              localStorage.setItem(`lonewolf_${username}`, loginResult.password);
            }
            
            if (props.onLoginSuccess) {
              props.onLoginSuccess({ 
                userPub: loginResult.userPub || metamaskAddress(), 
                username: username,
                password: loginResult.password,
                wallet: loginResult.wallet,
                authMethod: 'metamask_direct'
              });
            }
            return;
          }
        }
        throw new Error(result.error || "Errore durante la registrazione con MetaMask");
      }
    } catch (error) {
      const errorMsg = error.message || "Errore durante la registrazione con MetaMask";
      console.error("Errore completo:", error);
      setErrorMessage(errorMsg);
      if (props.onError) props.onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleWebAuthnLogin = async () => {
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
            userPub: result.credentialId || 'webauthn-user-pub', 
            username: username(),
            password: `WebAuthn_${username()}_${Date.now()}`,
            authMethod: 'webauthn'
          });
        }
      } else {
        throw new Error(result.error || "Errore durante l'autenticazione WebAuthn");
      }
    } catch (error) {
      const errorMsg = error.message || "Errore durante l'autenticazione WebAuthn";
      console.error("Errore WebAuthn:", errorMsg);
      setErrorMessage(errorMsg);
      if (props.onError) props.onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleWebAuthnSignUp = async () => {
    if (!username()) {
      setErrorMessage(messages.empty);
      if (props.onError) props.onError(messages.empty);
      return;
    }

    setLoading(true);
    setErrorMessage('');
    
    try {
      const securePassword = `WebAuthn_${username()}_${Date.now()}`;
      
      const result = await props.sdk.registerWithWebAuthn(username());
      console.log("Risultato registrazione WebAuthn:", result);
      
      if (result.success) {
        if (props.onSignupSuccess) {
          props.onSignupSuccess({ 
            userPub: result.credentialId || 'webauthn-user-pub', 
            username: username(),
            password: securePassword,
            authMethod: 'webauthn'
          });
        }
      } else {
        throw new Error(result.error || "Errore durante la registrazione WebAuthn");
      }
    } catch (error) {
      const errorMsg = error.message || "Errore durante la registrazione WebAuthn";
      console.error("Errore WebAuthn:", errorMsg);
      setErrorMessage(errorMsg);
      if (props.onError) props.onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="flex flex-col w-auto h-auto p-4 bg-white dark:bg-gray-800 rounded-md shadow-sm space-y-5 max-w-sm">
      <div class="flex justify-center items-center w-full h-auto">
        <LoneWolfLogo />
      </div>
      
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
      
      <div class="flex justify-center w-full h-auto text-gray-900 dark:text-white text-lg">
        {activeTab() === 0 ? messages.loginHeader : messages.signupHeader}
      </div>
      
      <Show when={errorMessage()}>
        <div class="flex justify-center items-center text-center text-red-500">
          {errorMessage()}
        </div>
      </Show>
      
      <Show when={activeTab() === 0}>
        <div class="flex flex-col w-full h-auto space-y-2">
          <input
            type="text"
            placeholder={messages.usernameLabel}
            value={username()}
            onInput={(e) => setUsername(e.target.value)}
            class="w-full h-auto p-3 bg-gray-200 dark:bg-gray-700 rounded-md text-gray-900 dark:text-white outline-none"
          />
          <input
            type="password"
            placeholder={messages.passwordLabel}
            value={password()}
            onInput={(e) => setPassword(e.target.value)}
            class="w-full h-auto p-3 bg-gray-200 dark:bg-gray-700 rounded-md text-gray-900 dark:text-white outline-none"
          />
          
          <div class="flex flex-col justify-center items-center w-full h-auto space-y-2">
            <button
              class={`flex w-auto h-auto px-4 py-2 bg-blue-600 rounded-md cursor-pointer text-white ${loading() ? 'opacity-70 cursor-not-allowed' : ''}`}
              onClick={handleLogin}
              disabled={loading()}
            >
              {loading() ? 'Caricamento...' : messages.loginButton}
            </button>
            
            <div class="flex w-full justify-center text-center text-gray-900 dark:text-white space-x-2">
              <div>Non hai un account?</div>
              <div
                class="cursor-pointer text-blue-600"
                onClick={() => setActiveTab(1)}
              >
                {messages.switchToSignup}
              </div>
            </div>
            
            <Show when={props.showWebauthn && isWebAuthnSupported()}>
              <button
                class={`flex justify-center w-full h-auto px-4 py-2 bg-purple-600 rounded-md cursor-pointer text-white ${loading() ? 'opacity-70 cursor-not-allowed' : ''}`}
                onClick={handleWebAuthnLogin}
                disabled={loading()}
              >
                {messages.webauthnLogin}
              </button>
            </Show>
            
            <Show when={props.showMetamask}>
              <button
                class={`flex justify-center w-full h-auto px-4 py-2 bg-orange-500 rounded-md cursor-pointer text-white ${loading() ? 'opacity-70 cursor-not-allowed' : ''}`}
                onClick={handleMetaMaskConnect}
                disabled={loading() || isMetaMaskConnected()}
              >
                {isMetaMaskConnected() ? 'MetaMask Connesso' : messages.metamaskConnect}
              </button>
              
              <Show when={isMetaMaskConnected()}>
                <div class="w-full p-3 bg-gray-700 rounded-md mt-2">
                  <p class="text-sm text-gray-300 mb-2 break-all">
                    Account: {metamaskAddress()}
                  </p>
                  <button
                    class={`flex justify-center w-full h-auto px-4 py-2 bg-orange-500 rounded-md cursor-pointer text-white ${loading() ? 'opacity-70 cursor-not-allowed' : ''}`}
                    onClick={handleMetaMaskLogin}
                    disabled={loading()}
                  >
                    {messages.metamaskLogin}
                  </button>
                </div>
              </Show>
            </Show>
          </div>
        </div>
      </Show>
      
      <Show when={activeTab() === 1}>
        <div class="flex flex-col w-full h-auto space-y-2">
          <input
            type="text"
            placeholder={messages.usernameLabel}
            value={username()}
            onInput={(e) => setUsername(e.target.value)}
            class="w-full h-auto p-3 bg-gray-200 dark:bg-gray-700 rounded-md text-gray-900 dark:text-white outline-none"
          />
          <input
            type="password"
            placeholder={messages.passwordLabel}
            value={password()}
            onInput={(e) => setPassword(e.target.value)}
            class="w-full h-auto p-3 bg-gray-200 dark:bg-gray-700 rounded-md text-gray-900 dark:text-white outline-none"
          />
          <input
            type="password"
            placeholder={messages.confirmPasswordLabel}
            value={passwordConfirmation()}
            onInput={(e) => setPasswordConfirmation(e.target.value)}
            class="w-full h-auto p-3 bg-gray-200 dark:bg-gray-700 rounded-md text-gray-900 dark:text-white outline-none"
          />
          
          <div class="flex flex-col justify-center items-center w-full h-auto space-y-2">
            <button
              class={`flex w-auto h-auto px-4 py-2 bg-blue-600 rounded-md cursor-pointer text-white ${loading() ? 'opacity-70 cursor-not-allowed' : ''}`}
              onClick={handleSignUp}
              disabled={loading()}
            >
              {loading() ? 'Caricamento...' : messages.signupButton}
            </button>
            
            <div class="flex w-full justify-center text-center text-gray-900 dark:text-white space-x-2">
              <div>Hai già un account?</div>
              <div
                class="cursor-pointer text-blue-600"
                onClick={() => setActiveTab(0)}
              >
                {messages.switchToLogin}
              </div>
            </div>
            
            <Show when={props.showWebauthn && isWebAuthnSupported()}>
              <button
                class={`flex justify-center w-full h-auto px-4 py-2 bg-purple-600 rounded-md cursor-pointer text-white ${loading() ? 'opacity-70 cursor-not-allowed' : ''}`}
                onClick={handleWebAuthnSignUp}
                disabled={loading()}
              >
                {messages.webauthnSignup}
              </button>
            </Show>
            
            <Show when={props.showMetamask}>
              <button
                class={`flex justify-center w-full h-auto px-4 py-2 bg-orange-500 rounded-md cursor-pointer text-white ${loading() ? 'opacity-70 cursor-not-allowed' : ''}`}
                onClick={handleMetaMaskConnect}
                disabled={loading() || isMetaMaskConnected()}
              >
                {isMetaMaskConnected() ? 'MetaMask Connesso' : messages.metamaskConnect}
              </button>
              
              <Show when={isMetaMaskConnected()}>
                <div class="w-full p-3 bg-gray-700 rounded-md mt-2">
                  <p class="text-sm text-gray-300 mb-2 break-all">
                    Account: {metamaskAddress()}
                  </p>
                  <button
                    class={`flex justify-center w-full h-auto px-4 py-2 bg-orange-500 rounded-md cursor-pointer text-white ${loading() ? 'opacity-70 cursor-not-allowed' : ''}`}
                    onClick={handleMetaMaskSignUp}
                    disabled={loading()}
                  >
                    {messages.metamaskSignup}
                  </button>
                </div>
              </Show>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default LoginWithShogun; 