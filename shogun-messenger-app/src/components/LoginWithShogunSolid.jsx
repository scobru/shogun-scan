import { createSignal, Show } from 'solid-js';


const LoginWithShogunSolid = (props) => {
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
    confirmPasswordLabel:
      props.customMessages?.confirmPasswordLabel || 'Conferma Password',
    switchToSignup:
      props.customMessages?.switchToSignup || 'Non hai un account? Registrati',
    switchToLogin:
      props.customMessages?.switchToLogin || 'Hai già un account? Accedi',
    metamaskConnect:
      props.customMessages?.metamaskConnect || 'Connetti MetaMask',
    metamaskLogin: props.customMessages?.metamaskLogin || 'Accedi con MetaMask',
    metamaskSignup:
      props.customMessages?.metamaskSignup || 'Registrati con MetaMask',
    webauthnLogin: props.customMessages?.webauthnLogin || 'Accedi con WebAuthn',
    webauthnSignup:
      props.customMessages?.webauthnSignup || 'Registrati con WebAuthn',
    mismatched:
      props.customMessages?.mismatched || 'Le password non corrispondono',
    empty: props.customMessages?.empty || 'Tutti i campi sono obbligatori',
    exists: props.customMessages?.exists || 'Utente già esistente',
  };

  // All'inizio del componente
  console.log('Props ricevute:', props);
  console.log('SDK disponibile:', !!props.sdk);
  console.log('showMetamask:', props.showMetamask);
  console.log('showWebauthn:', props.showWebauthn);

  // Verifica se WebAuthn è supportato
  if (props.showWebauthn) {
    const supported = props.sdk.isWebAuthnSupported();
    console.log('WebAuthn supportato:', supported);
    setIsWebAuthnSupported(supported);
  }

  const handleLogin = async () => {
    console.log('handleLogin chiamato');

    if (!username() || !password()) {
      setErrorMessage(messages.empty);
      if (props.onError) props.onError(messages.empty);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    console.log('username:', username());
    console.log('password:', password());

    try {
      const result = await props.sdk.handleLogin(username(), password(), {});
      console.log('Risultato login standard:', result);

      if (result.success && result.userPub) {
        if (props.onLoginSuccess) {
          props.onLoginSuccess({
            userPub: result.userPub,
            username: username(),
            password: password(),
            authMethod: 'standard',
          });
        }
      } else {
        throw new Error(result.error || 'Errore durante il login');
      }
    } catch (error) {
      const errorMsg = error.message || 'Errore durante il login';
      console.error('Errore completo:', error);
      setErrorMessage(errorMsg);
      if (props.onError) props.onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    console.log('handleSignUp chiamato');

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
      const result = await props.sdk.handleSignUp(
        username(),
        password(),
        passwordConfirmation(),
        {
          messages,
        }
      );
      console.log('Risultato registrazione standard:', result);

      if (result.success && result.userPub) {
        if (props.onSignupSuccess) {
          props.onSignupSuccess({
            userPub: result.userPub,
            username: username(),
            password: password(),
            authMethod: 'standard_signup',
          });
        }
      } else {
        throw new Error(result.error || 'Errore durante la registrazione');
      }
    } catch (error) {
      const errorMsg = error.message || 'Errore durante la registrazione';
      console.error('Errore completo:', error);
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
        throw new Error(
          result.error || 'Errore durante la connessione a MetaMask'
        );
      }
    } catch (error) {
      const errorMsg =
        error.message || 'Errore durante la connessione a MetaMask';
      setErrorMessage(errorMsg);
      if (props.onError) props.onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMaskLogin = async () => {
    if (!isMetaMaskConnected() || !metamaskAddress()) {
      setErrorMessage('MetaMask non connesso');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // Importante: l'username deve essere generato nello stesso modo in cui viene fatto nel backend
      // Dai log vediamo che il formato è metamask_0x8aa5f726
      const username = `metamask_${metamaskAddress().slice(0, 10)}`;

      console.log('Tentativo di login con username:', username);

      // Prima controlla se abbiamo una password salvata
      const savedPassword = localStorage.getItem(`lonewolf_${username}`);

      // Se abbiamo una password salvata, prova a usarla direttamente con LoneWolf
      if (savedPassword) {
        console.log(
          'Password salvata trovata, tentativo di login diretto con LoneWolf...'
        );

        // Notifica il componente di autenticazione che vogliamo usare la password salvata
        if (props.onLoginSuccess) {
          const authResult = {
            userPub: metamaskAddress(),
            username: username,
            password: savedPassword,
            authMethod: 'metamask_saved',
          };

          props.onLoginSuccess(authResult);
          setLoading(false);
          return;
        }
      }

      // Se non abbiamo una password salvata o il login diretto fallisce, procedi con MetaMask
      console.log('Tentativo di login con MetaMask...');
      const result = await props.sdk.loginWithMetaMask(metamaskAddress());

      if (result.success) {
        console.log('Login con MetaMask riuscito');

        // Salva la password generata in localStorage
        if (result.password) {
          localStorage.setItem(`lonewolf_${username}`, result.password);
        }

        if (props.onLoginSuccess) {
          props.onLoginSuccess({
            userPub: result.userPub || metamaskAddress(),
            username: result.username || username,
            password: result.password,
            wallet: result.wallet,
            authMethod: 'metamask_direct',
          });
        }
      } else {
        // Se il login fallisce, proviamo a registrare l'utente
        if (
          result.error &&
          (result.error.includes('Account not registered') ||
            result.error.includes('Account not found') ||
            result.error.includes('missing data'))
        ) {
          console.log(
            'Account non registrato o dati mancanti, tentativo di registrazione...'
          );
          await handleMetaMaskSignUp();
          return;
        }

        throw new Error(result.error || 'Errore durante il login con MetaMask');
      }
    } catch (error) {
      const errorMsg = error.message || 'Errore durante il login con MetaMask';
      setErrorMessage(errorMsg);
      if (props.onError) props.onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMaskSignUp = async () => {
    if (!isMetaMaskConnected() || !metamaskAddress()) {
      setErrorMessage('MetaMask non connesso');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      // Importante: l'username deve essere generato nello stesso modo in cui viene fatto nel backend
      // Dai log vediamo che il formato è metamask_0x8aa5f726
      const username = `metamask_${metamaskAddress().slice(0, 10)}`;

      console.log('Tentativo di registrazione con username:', username);

      // Tenta la registrazione con MetaMask
      console.log('Tentativo di registrazione con MetaMask...');
      const result = await props.sdk.signUpWithMetaMask(metamaskAddress());

      if (result.success) {
        console.log('Registrazione con MetaMask riuscita');

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
            authMethod: 'metamask_signup',
          });
        }
      } else {
        // Se la registrazione fallisce con "User already created", prova il login
        if (result.error && result.error.includes('User already created')) {
          console.log('Utente già esistente, tentativo di login...');
          const loginResult = await props.sdk.loginWithMetaMask(
            metamaskAddress()
          );

          if (loginResult.success) {
            console.log('Login con MetaMask riuscito');

            // Salva la password in localStorage
            if (loginResult.password) {
              localStorage.setItem(
                `lonewolf_${username}`,
                loginResult.password
              );
            }

            if (props.onLoginSuccess) {
              props.onLoginSuccess({
                userPub: loginResult.userPub || metamaskAddress(),
                username: username,
                password: loginResult.password,
                wallet: loginResult.wallet,
                authMethod: 'metamask_direct',
              });
            }
            return;
          }
        }
        throw new Error(
          result.error || 'Errore durante la registrazione con MetaMask'
        );
      }
    } catch (error) {
      const errorMsg =
        error.message || 'Errore durante la registrazione con MetaMask';
      console.error('Errore completo:', error);
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
      console.log('Tentativo di login con WebAuthn...');
      const result = await props.sdk.authenticateWithWebAuthn(username());
      console.log('Risultato login WebAuthn:', result);

      if (result.success) {
        if (props.onLoginSuccess) {
          props.onLoginSuccess({
            userPub:
              result.userPub || result.credentialId || 'webauthn-user-pub',
            username: username(),
            password: result.password || `WebAuthn_${username()}_${Date.now()}`,
            authMethod: 'webauthn',
          });
        }
      } else {
        throw new Error(
          result.error || "Errore durante l'autenticazione WebAuthn"
        );
      }
    } catch (error) {
      const errorMsg =
        error.message || "Errore durante l'autenticazione WebAuthn";
      console.error('Errore WebAuthn:', errorMsg);
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
      console.log('Tentativo di registrazione con WebAuthn...');
      const result = await props.sdk.registerWithWebAuthn(username());
      console.log('Risultato registrazione WebAuthn:', result);

      if (result.success) {
        if (props.onSignupSuccess) {
          props.onSignupSuccess({
            userPub:
              result.userPub || result.credentialId || 'webauthn-user-pub',
            username: username(),
            password: result.password || `WebAuthn_${username()}_${Date.now()}`,
            authMethod: 'webauthn',
          });
        }
      } else {
        throw new Error(
          result.error || 'Errore durante la registrazione WebAuthn'
        );
      }
    } catch (error) {
      const errorMsg =
        error.message || 'Errore durante la registrazione WebAuthn';
      console.error('Errore WebAuthn:', errorMsg);
      setErrorMessage(errorMsg);
      if (props.onError) props.onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="bg-[#121212] p-8 rounded-2xl w-full max-w-[380px]">
      <div class="flex justify-center items-center w-full mb-6">
        <h1 class="text-2xl font-normal text-white">
          Shogun Messenger
        </h1>
      </div>

      <div class="flex w-full mb-4">
        <div 
          class={`flex-1 pb-2 text-center cursor-pointer text-gray-400 ${
            activeTab() === 0 ? 'border-b-2 border-[#6C5DD3] text-white' : ''
          }`}
          onClick={() => setActiveTab(0)}
        >
          Login
        </div>
        <div 
          class={`flex-1 pb-2 text-center cursor-pointer text-gray-400 ${
            activeTab() === 1 ? 'border-b-2 border-[#6C5DD3] text-white' : ''
          }`}
          onClick={() => setActiveTab(1)}
        >
          Registrazione
        </div>
      </div>

      <div class="text-center text-white text-lg mb-6">
        Accedi a Shogun
      </div>

      <Show when={activeTab() === 0}>
        <div class="flex flex-col gap-4">
          <input
            class="w-full p-3 bg-[#1E1E1E] rounded-lg text-white placeholder-gray-500 outline-none"
            placeholder="Username"
            onInput={(e) => setUsername(e.target.value)}
            value={username()}
          />
          <input
            class="w-full p-3 bg-[#1E1E1E] rounded-lg text-white placeholder-gray-500 outline-none"
            placeholder="Password"
            onInput={(e) => setPassword(e.target.value)}
            type="password"
          />
          <button
            class={`w-full bg-[#6C5DD3] text-white font-normal py-3 rounded-lg transition-opacity ${
              loading() ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'
            }`}
            onClick={handleLogin}
            disabled={loading()}
          >
            {loading() ? 'Caricamento...' : 'Accedi'}
          </button>

          <button
            class="text-sm text-[#6C5DD3] hover:text-[#8677DD] cursor-pointer w-full text-center"
            onClick={() => setActiveTab(1)}
          >
            Non hai un account? Registrati
          </button>

          <Show when={props.showWebauthn && isWebAuthnSupported()}>
            <button
              class="w-full bg-[#6C5DD3] text-white font-normal py-3 rounded-lg hover:opacity-90 transition-opacity"
              onClick={handleWebAuthnLogin}
            >
              Accedi con WebAuthn
            </button>
          </Show>

          <Show when={props.showMetamask}>
            <button
              class="w-full bg-[#6C5DD3] text-white font-normal py-3 rounded-lg hover:opacity-90 transition-opacity"
              onClick={handleMetaMaskConnect}
              disabled={isMetaMaskConnected()}
            >
              {isMetaMaskConnected() ? 'MetaMask Connesso' : 'Connetti MetaMask'}
            </button>
            
            <Show when={isMetaMaskConnected()}>
              <div class="bg-[#1E1E1E] p-3 rounded-lg">
                <p class="text-sm text-gray-400 mb-2 break-all">
                  Account: {metamaskAddress()}
                </p>
                <button
                  class="w-full bg-[#6C5DD3] text-white font-normal py-3 rounded-lg hover:opacity-90 transition-opacity"
                  onClick={handleMetaMaskLogin}
                >
                  Accedi con MetaMask
                </button>
              </div>
            </Show>
          </Show>
        </div>
      </Show>

      <Show when={activeTab() === 1}>
        <div class="flex flex-col gap-4">
          <input
            class="w-full p-3 bg-[#1E1E1E] rounded-lg text-white placeholder-gray-500 outline-none"
            placeholder="Username"
            onInput={(e) => setUsername(e.target.value)}
            value={username()}
          />
          <input
            class="w-full p-3 bg-[#1E1E1E] rounded-lg text-white placeholder-gray-500 outline-none"
            placeholder="Password"
            onInput={(e) => setPassword(e.target.value)}
            type="password"
          />
          <input
            class="w-full p-3 bg-[#1E1E1E] rounded-lg text-white placeholder-gray-500 outline-none"
            placeholder="Conferma Password"
            onInput={(e) => setPasswordConfirmation(e.target.value)}
            type="password"
          />
          <button
            class={`w-full bg-[#6C5DD3] text-white font-normal py-3 rounded-lg transition-opacity ${
              loading() ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'
            }`}
            onClick={handleSignUp}
            disabled={loading()}
          >
            {loading() ? 'Caricamento...' : 'Registrati'}
          </button>

          <button
            class="text-sm text-[#6C5DD3] hover:text-[#8677DD] cursor-pointer w-full text-center"
            onClick={() => setActiveTab(0)}
          >
            Hai già un account? Accedi
          </button>

          <Show when={props.showWebauthn && isWebAuthnSupported()}>
            <button
              class="w-full bg-[#6C5DD3] text-white font-normal py-3 rounded-lg hover:opacity-90 transition-opacity"
              onClick={handleWebAuthnSignUp}
            >
              Registrati con WebAuthn
            </button>
          </Show>

          <Show when={props.showMetamask}>
            <button
              class="w-full bg-[#6C5DD3] text-white font-normal py-3 rounded-lg hover:opacity-90 transition-opacity"
              onClick={handleMetaMaskConnect}
              disabled={isMetaMaskConnected()}
            >
              {isMetaMaskConnected() ? 'MetaMask Connesso' : 'Connetti MetaMask'}
            </button>
            
            <Show when={isMetaMaskConnected()}>
              <div class="bg-[#1E1E1E] p-3 rounded-lg">
                <p class="text-sm text-gray-400 mb-2 break-all">
                  Account: {metamaskAddress()}
                </p>
                <button
                  class="w-full bg-[#6C5DD3] text-white font-normal py-3 rounded-lg hover:opacity-90 transition-opacity"
                  onClick={handleMetaMaskSignUp}
                >
                  Registrati con MetaMask
                </button>
              </div>
            </Show>
          </Show>
        </div>
      </Show>

      <Show when={errorMessage()}>
        <div class="mt-4 text-red-400 text-sm text-center">
          {errorMessage()}
        </div>
      </Show>

      <div class="mt-6 text-center text-xs text-gray-600">
        Protetto da crittografia end-to-end
      </div>
    </div>
  );
};

export default LoginWithShogunSolid;
