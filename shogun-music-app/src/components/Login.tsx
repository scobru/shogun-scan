import React from 'react';
import { ShogunButtonProvider, ShogunButton } from 'shogun-button-react';
import { sdk, options } from '../services/ShogunConnector';

interface LoginProps {
  onLoginSuccess?: (data: any) => void;
  onSignupSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export const Login: React.FC<LoginProps> = ({
  onLoginSuccess,
  onSignupSuccess,
  onError
}) => {
  const handleLoginSuccess = async (data: any) => {
    console.log('Login success:', data);
    if (onLoginSuccess) {
      onLoginSuccess(data);
    }
  };

  const handleSignupSuccess = async (data: any) => {
    console.log('Signup success:', data);
    if (onSignupSuccess) {
      onSignupSuccess(data);
    }
  };

  const handleError = (error: string) => {
    console.error('Auth error:', error);
    if (onError) {
      onError(error);
    }
  };

  if (!sdk) {
    return (
      <div className="error-container">
        <p className="error-message">Errore di inizializzazione SDK</p>
        <button onClick={() => window.location.reload()}>Riprova</button>
      </div>
    );
  }

  return (
    <div className="login-container">
      <h1>Shogun Music</h1>
      <ShogunButtonProvider
        sdk={sdk}
        options={{
          ...options,
          appName: "Shogun Music",
          appDescription: "Un'app musicale decentralizzata",
          showMetamask: true,
          showWebauthn: true,
          darkMode: true,
        }}
        onLoginSuccess={handleLoginSuccess}
        onSignupSuccess={handleSignupSuccess}
        onError={handleError}
      >
        <ShogunButton />
      </ShogunButtonProvider>
    </div>
  );
}; 