import React, { useState, useEffect } from 'react';
import { sdk } from '../App';
import { AuthMethod, AuthResult, AutoLoginResult } from '../types';
import { ethers } from 'ethers';

enum FormMode {
  LOGIN = 'login',
  SIGNUP = 'signup'
}

interface LoginData {
  userPub: string;
  username: string;
  password?: string;
  authMethod?: AuthMethod;
}

interface SignupData {
  userPub: string;
  username: string;
  password?: string;
  wallet?: ethers.Wallet;
  authMethod?: AuthMethod;
}

interface ShogunLoginModalProps {
  onLoginSuccess?: (data: LoginData) => void;
  onSignupSuccess?: (data: SignupData) => void;
}

const ShogunLoginModal: React.FC<ShogunLoginModalProps> = ({ onLoginSuccess, onSignupSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<FormMode>(FormMode.LOGIN);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [sdkReady, setSdkReady] = useState<boolean>(!!sdk);

  useEffect(() => {
    if (!sdk) {
      console.error("SDK non disponibile nel componente di login");
      setError("SDK non inizializzato. Ricarica la pagina.");
      setSdkReady(false);
    } else {
      setSdkReady(true);
    }
  }, []);

  const isWebAuthnSupported = sdk?.isWebAuthnSupported?.() || false;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!sdk) {
        throw new Error("SDK non inizializzato");
      }

      if (mode === FormMode.SIGNUP) {
        console.log(`Tentativo di registrazione per ${username}`);
        
        const result = await sdk.signUp(username, password) as AutoLoginResult;
        
        if (result && result.success) {
          onSignupSuccess && onSignupSuccess({
            userPub: result.userPub || "",
            username,
            password,
            authMethod: "standard_signup"
          });
        } else {
          setError((result && result.error) || "Errore durante la registrazione");
          console.error("Errore di registrazione:", result && result.error);
        }
      } else {
        console.log(`Tentativo di login per ${username}`);
        const result = await sdk.login(username, password);
        
        if (result && result.success) {
          onLoginSuccess && onLoginSuccess({
            userPub: result.userPub || "",
            username,
            password,
            authMethod: "standard"
          });
        } else {
          setError((result && result.error) || "Credenziali non valide");
        }
      }
    } catch (error: any) {
      console.error("Errore durante l'autenticazione:", error);
      setError(error.message || "Si è verificato un errore durante l'autenticazione");
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMask = async () => {
    setError('');
    setLoading(true);
    setDebugInfo('');

    try {
      if (mode === FormMode.LOGIN) {
        console.log("Tentativo di login con MetaMask");
        const result = await sdk.loginWithMetaMask();
        
        if (result.success) {
          console.log("Login con MetaMask completato con successo:", result);
          onLoginSuccess && onLoginSuccess({
            userPub: result.userPub || "",
            username: result.username || "",
            authMethod: "metamask_direct"
          });
        } else {
          setError(result.error || 'Login con MetaMask fallito');
          setDebugInfo(JSON.stringify(result, null, 2));
        }
      } else {
        console.log("Tentativo di registrazione con MetaMask");
        const result = await sdk.signUpWithMetaMask();
        
        if (result.success) {
          console.log("Registrazione con MetaMask completata con successo:", result);
          onSignupSuccess && onSignupSuccess({
            userPub: result.userPub || "",
            username: result.username || "",
            authMethod: "metamask_signup"
          });
        } else {
          setError(result.error || 'Registrazione con MetaMask fallita');
          setDebugInfo(JSON.stringify(result, null, 2));
        }
      }
    } catch (err: any) {
      console.error("Errore durante l'autenticazione con MetaMask:", err);
      setError(err.message || 'Si è verificato un errore con MetaMask');
      setDebugInfo(err.stack || JSON.stringify(err, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const handleWebAuthn = async () => {
    if (!isWebAuthnSupported) {
      setError('WebAuthn non è supportato dal tuo browser');
      return;
    }

    setError('');
    setLoading(true);
    setDebugInfo('');

    try {
      if (mode === FormMode.LOGIN) {
        if (!username) {
          setError('Username richiesto per WebAuthn');
          setLoading(false);
          return;
        }
        
        console.log("Tentativo di login con WebAuthn per", username);
        const result = await sdk.loginWithWebAuthn(username);
        if (result.success) {
          console.log("Login con WebAuthn completato con successo:", result);
          onLoginSuccess && onLoginSuccess({
            userPub: result.userPub || "",
            username,
            authMethod: "webauthn"
          });
        } else {
          setError(result.error || 'Login con WebAuthn fallito');
          setDebugInfo(JSON.stringify(result, null, 2));
        }
      } else {
        if (!username) {
          setError('Username richiesto per WebAuthn');
          setLoading(false);
          return;
        }
        
        console.log("Tentativo di registrazione con WebAuthn per", username);
        const result = await sdk.signUpWithWebAuthn(username);
        if (result.success) {
          console.log("Registrazione con WebAuthn completata con successo:", result);
          onSignupSuccess && onSignupSuccess({
            userPub: result.userPub || "",
            username,
            authMethod: "webauthn"
          });
        } else {
          if (result.error === 'User already exists') {
            setError('Questo username è già registrato. Se sei tu, per favore utilizza il login invece della registrazione.');
            setDebugInfo('Utente già esistente nel sistema. Prova ad effettuare il login invece della registrazione.');
          } 
          else if (result.error && result.error.includes('Utente già esistente, login effettuato con successo')) {
            console.log("Login automatico effettuato per utente esistente:", username);
            onLoginSuccess && onLoginSuccess({
              userPub: result.userPub || "",
              username,
              authMethod: "webauthn"
            });
          }
          else {
            setError(result.error || 'Registrazione con WebAuthn fallita');
            setDebugInfo(JSON.stringify(result, null, 2));
          }
        }
      }
    } catch (err: any) {
      console.error("Errore durante l'autenticazione con WebAuthn:", err);
      setError(err.message || 'Si è verificato un errore con WebAuthn');
      setDebugInfo(err.stack || JSON.stringify(err, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === FormMode.LOGIN ? FormMode.SIGNUP : FormMode.LOGIN);
    setError('');
    setDebugInfo('');
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">
        {mode === FormMode.LOGIN ? 'Accedi al tuo wallet' : 'Crea un nuovo wallet'}
      </h2>

      {error && (
        <div className="bg-red-600 text-white p-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
            required
          />
        </div>

        {mode === FormMode.SIGNUP && (
          <div>
            <label className="block text-sm font-medium mb-1">Conferma Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
              required
            />
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none transition duration-300"
          disabled={loading}
        >
          {loading ? 'Caricamento...' : mode === FormMode.LOGIN ? 'Accedi' : 'Registrati'}
        </button>
      </form>

      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={handleMetaMask}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded focus:outline-none transition duration-300"
          disabled={loading}
        >
          {mode === FormMode.LOGIN ? 'Accedi con MetaMask' : 'Registrati con MetaMask'}
        </button>

        {isWebAuthnSupported && (
          <button
            onClick={handleWebAuthn}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none transition duration-300"
            disabled={loading}
          >
            {mode === FormMode.LOGIN ? 'Accedi con WebAuthn' : 'Registrati con WebAuthn'}
          </button>
        )}
      </div>

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={toggleMode}
          className="text-blue-400 hover:text-blue-300 focus:outline-none"
        >
          {mode === FormMode.LOGIN
            ? 'Non hai un account? Registrati'
            : 'Hai già un account? Accedi'}
        </button>
      </div>

      {debugInfo && (
        <div className="mt-4 p-3 bg-gray-700 rounded text-xs font-mono overflow-auto max-h-40">
          <p className="text-gray-400 mb-1">Informazioni di debug:</p>
          <pre className="text-gray-300">{debugInfo}</pre>
        </div>
      )}
    </div>
  );
};

export default ShogunLoginModal; 