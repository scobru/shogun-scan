import React, { useEffect } from 'react';
import './App.css';
import { AppProvider, useApp } from './contexts/AppContext';
import Player from './components/Player';
import TrackList from './components/TrackList';
import PlaylistManager from './components/PlaylistManager';
import FavoritesView from './components/FavoritesView';
import AdminPanel from './components/AdminPanel';
import { ShogunButtonProvider, ShogunButton, ShogunConnectorResult } from 'shogun-button-react';
import { sdk, options } from './services/ShogunConnector';
import testAPIConnection from './utils/apiTester';

// Loading indicator component
const LoadingIndicator: React.FC = () => (
  <div className="loading-indicator">
    <div className="spinner"></div>
    <p>Caricamento in corso...</p>
  </div>
);

// Error message component
const ErrorMessage: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="error-message">
    <i className="fas fa-exclamation-triangle"></i>
    <h3>Si è verificato un errore</h3>
    <p>{message}</p>
    <button className="retry-button" onClick={onRetry}>
      <i className="fas fa-sync-alt"></i> Riprova
    </button>
  </div>
);

// Status banner component
const StatusBanner: React.FC<{ serverStatus: boolean | null; onRetry: () => void }> = ({ serverStatus, onRetry }) => {
  if (serverStatus === true) return null;
  
  return (
    <div className={`status-banner ${serverStatus === false ? 'error' : 'warning'}`}>
      <i className={`fas ${serverStatus === false ? 'fa-times-circle' : 'fa-exclamation-circle'}`}></i>
      <span>
        {serverStatus === false 
          ? 'Impossibile connettersi al server. Utilizzando dati locali.' 
          : 'Stato del server sconosciuto. Alcune funzionalità potrebbero non essere disponibili.'}
      </span>
      <button className="retry-button" onClick={onRetry}>
        <i className="fas fa-sync-alt"></i> Riconnetti
      </button>
    </div>
  );
};

// Definizione dell'interfaccia per i dati di login/signup
interface AuthData {
  userPub: string;
  username: string;
  password?: string;
  wallet?: any; // Consider using the actual ethers.Wallet type if needed downstream
  did?: string;
  authMethod?: 'standard' | 'metamask_direct' | 'metamask_saved' | 'metamask_signup' | 'standard_signup' | 'webauthn' | 'mnemonic';
}

// Login component
const Login: React.FC = () => {
  const [error, setError] = React.useState<string | null>(null);

  const handleLoginSuccess = async (data: AuthData) => {
    try {
      console.log('Login success:', data);
      // Il contesto AppProvider gestirà il caricamento dei dati
    } catch (err) {
      setError('Error processing login data');
      console.error('Login processing error:', err);
    }
  };

  const handleSignupSuccess = async (data: AuthData) => {
    try {
      console.log('Signup success:', data);
      // Il contesto AppProvider gestirà il caricamento dei dati
    } catch (err) {
      setError('Error processing signup data');
      console.error('Signup processing error:', err);
    }
  };

  const handleError = (error: string) => {
    setError(error);
    console.error('Auth error:', error);
  };

  if (!sdk) {
    return (
      <div className="error-container">
        <p className="error-message">Errore di inizializzazione SDK</p>
        <p className="error-details">Verificare la configurazione e la connessione al provider</p>
        <button 
          className="retry-button"
          onClick={() => {
            setError(null);
            window.location.reload();
          }}
        >
          <i className="fas fa-sync-alt"></i> Riprova
        </button>
      </div>
    );
  }

  return (
    <div className="login-container">
      <h1>Shogun Music</h1>
      {error && (
        <div className="error-banner">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
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

// MainContent component
const MainContent: React.FC = () => {
  const { state, setActiveTab, retryConnection, refreshData } = useApp();
  const [tracks, setTracks] = React.useState([]);

  // Add API connection test to the window object for debugging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      (window as any).testAPIConnection = testAPIConnection;
      console.log('API tester initialized. Run testAPIConnection() in console to test the API.');
    }
  }, []);

  // Handle retry button click
  const handleRetry = async () => {
    await retryConnection();
  };

  // Render loading state
  if (state.isLoading) {
    return <LoadingIndicator />;
  }

  // Render error state
  if (state.error) {
    return (
      <div className="error-container">
        <p className="error-message">{state.error}</p>
        {state.serverStatus === false && (
          <p className="info-message">
            Il server non è disponibile. Verranno utilizzati i dati locali.
          </p>
        )}
      </div>
    );
  }

  // Render content based on active tab
  switch (state.activeTab) {
    case 'songs':
      return (
        <div className="content-container">
          <TrackList tracks={tracks} />
          <Player />
        </div>
      );
    case 'favorites':
      return (
        <div className="content-container">
          <FavoritesView />
          <Player />
        </div>
      );
    case 'playlists':
      return (
        <div className="content-container">
          <PlaylistManager />
          <Player />
        </div>
      );
    case 'admin':
      return (
        <div className="content-container">
          <AdminPanel />
        </div>
      );
    default:
      return null;
  }
};

// App component that provides the context
const App: React.FC = () => {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
};

export default App;
