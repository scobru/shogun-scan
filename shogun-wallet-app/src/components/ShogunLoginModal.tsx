import React, { useState, useEffect } from 'react';
import { sdk } from '../App';
import { AuthMethod, AuthResult } from '../types';
import { log, logError } from '../utils/logger';

enum FormMode {
  LOGIN = 'login',
  SIGNUP = 'signup'
}

interface LoginData {
  userPub: string;
  username: string;
  authMethod: AuthMethod;
}

const ShogunLoginModal: React.FC<{
  onLoginSuccess?: (data: LoginData) => void;
  onSignupSuccess?: (data: LoginData) => void;
  onError?: (error: string) => void;
}> = ({ 
  onLoginSuccess, 
  onSignupSuccess,
  onError
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<FormMode>(FormMode.LOGIN);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Verifica la disponibilità dell'SDK
  const sdkInstance = sdk;
  if (!sdkInstance) {
    return (
      <div className="bg-red-600 text-white p-4 rounded">
        SDK non inizializzato. Ricarica la pagina.
      </div>
    );
  }

  const handleStandardAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === FormMode.SIGNUP && password !== confirmPassword) {
        throw new Error('Le password non coincidono');
      }

      console.log(`Tentativo di ${mode === FormMode.LOGIN ? 'login' : 'registrazione'} per: ${username}`);

      const result = mode === FormMode.LOGIN 
        ? await sdkInstance.login(username, password)
        : await sdkInstance.signUp(username, password);

      if (!result.success) {
        throw new Error(result.error || 'Autenticazione fallita');
      }

      console.log("Autenticazione completata con successo");

      const authData: LoginData = {
        userPub: result.userPub || '',
            username,
        authMethod: mode === FormMode.LOGIN ? 'standard' : 'standard_signup'
      };

      // Verifica che l'utente sia effettivamente autenticato
      if (!sdkInstance.isLoggedIn()) {
        throw new Error('Autenticazione non riuscita: sessione non valida');
      }

      if (mode === FormMode.LOGIN) {
        onLoginSuccess?.(authData);
        } else {
        onSignupSuccess?.(authData);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Si è verificato un errore';
      console.error("Errore di autenticazione:", errorMessage);
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMask = async () => {
    setError('');
    setLoading(true);

    try {
      // Prima connetti MetaMask
      const metamaskResult = await sdkInstance.metamask.connectMetaMask();
      if (!metamaskResult.success || !metamaskResult.address) {
        throw new Error(metamaskResult.error || 'Errore nella connessione a MetaMask');
      }

      // Usa l'indirizzo ottenuto dalla connessione
      const result = mode === FormMode.LOGIN 
        ? await sdkInstance.loginWithMetaMask(metamaskResult.address)
        : await sdkInstance.signUpWithMetaMask(metamaskResult.address);

      if (!result.success) {
        throw new Error(result.error || 'Autenticazione con MetaMask fallita');
      }

      const authData: LoginData = {
        userPub: result.userPub || '',
        username: metamaskResult.username || `mm_${metamaskResult.address.toLowerCase()}`,
        authMethod: mode === FormMode.LOGIN ? 'metamask_direct' : 'metamask_signup'
      };

      if (mode === FormMode.LOGIN) {
        onLoginSuccess?.(authData);
        } else {
        onSignupSuccess?.(authData);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore con MetaMask';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleWebAuthn = async () => {
    if (!sdkInstance.isWebAuthnSupported?.()) {
      setError('WebAuthn non è supportato dal tuo browser');
      return;
    }

        if (!username) {
          setError('Username richiesto per WebAuthn');
          return;
        }
        
    setError('');
    setLoading(true);

    try {
      const result = mode === FormMode.LOGIN 
        ? await sdkInstance.loginWithWebAuthn(username)
        : await sdkInstance.signUpWithWebAuthn(username);

      if (!result.success) {
        throw new Error(result.error || 'Autenticazione WebAuthn fallita');
      }

      const authData: LoginData = {
        userPub: result.userPub || '',
        username: result.username || username,
        authMethod: 'webauthn'
      };

      if (mode === FormMode.LOGIN) {
        onLoginSuccess?.(authData);
        } else {
        onSignupSuccess?.(authData);
        setError('Registrazione completata con successo');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore con WebAuthn';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
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

      <form onSubmit={handleStandardAuth} className="space-y-4">
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

        {sdkInstance.isWebAuthnSupported?.() && (
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
          onClick={() => {
            setMode(mode === FormMode.LOGIN ? FormMode.SIGNUP : FormMode.LOGIN);
            setError('');
          }}
          className="text-blue-400 hover:text-blue-300 focus:outline-none"
        >
          {mode === FormMode.LOGIN
            ? 'Non hai un account? Registrati'
            : 'Hai già un account? Accedi'}
        </button>
      </div>
    </div>
  );
};

export default ShogunLoginModal; 