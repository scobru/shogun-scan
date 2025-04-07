import React, { useState, useEffect } from 'react';
import {
  shogunConnector,
  ShogunButtonProvider,
  ShogunButton,
} from "shogun-button-react";
import ShogunCore from './components/common/ShogunCore';
import './App.css';

// Configurazione del connettore Shogun
const connectorConfig = {
  appName: "Shogun Music",
  appDescription: "Un'applicazione per la gestione e condivisione di musica basata su GunDB",
  appUrl: "http://localhost:3000",
  providerUrl: "https://eth-mainnet.g.alchemy.com/v2/your-api-key", // Sostituisci con il tuo API key
  peers: ["https://gun-relay.scobrudot.dev/gun"], // Peer GunDB
};

// Inizializzazione dell'SDK Shogun
export const initShogunSDK = () => {
  try {
    const connector = shogunConnector(connectorConfig);
    console.log("SDK inizializzato con successo");
    return connector;
  } catch (error) {
    console.error("Errore nell'inizializzazione dell'SDK Shogun:", error);
    return {
      sdk: null,
      options: {},
    };
  }
};

export const { sdk, options } = initShogunSDK();
export const gun = sdk ? sdk.gun : null;

/**
 * Main App component (versione temporanea semplificata)
 * @returns {JSX.Element} App component
 */
function App() {
  // Stati per gestire l'autenticazione
  const [signedIn, setSignedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [userPub, setUserPub] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sdkInitialized, setSdkInitialized] = useState(!!sdk);
  const [playlists, setPlaylists] = useState([]);

  // Verifica inizializzazione dell'SDK
  useEffect(() => {
    if (!sdk || !gun) {
      console.error("SDK non inizializzato correttamente");
      setErrorMessage("Errore di inizializzazione SDK. Ricarica la pagina.");
      setSdkInitialized(false);
    } else {
      setSdkInitialized(true);
    }
  }, []);

  // Gestire il successo del login
  const handleLoginSuccess = async (data) => {
    console.log("Login success:", data);
    setSignedIn(true);
    setUserPub(data.userPub);
    setUsername(data.username);
    
    // Qui puoi caricare i dati dell'utente dopo il login
    await loadUserData();
  };

  // Gestire il successo della registrazione
  const handleSignupSuccess = async (data) => {
    console.log("Signup success:", data);
    setSignedIn(true);
    setUserPub(data.userPub);
    setUsername(data.username);
    
    // Inizializza i dati dell'utente dopo la registrazione
    await initializeUserData();
  };

  // Gestire gli errori di autenticazione
  const handleAuthError = (error) => {
    console.error("Errore di autenticazione:", error);
    setErrorMessage(error);
  };

  // Funzione per caricare i dati dell'utente
  const loadUserData = async () => {
    if (!sdk || !gun) {
      setErrorMessage("SDK non inizializzato");
      return;
    }

    try {
      setLoading(true);
      
      // Esempio: caricamento delle playlist dell'utente da GunDB
      gun.user().get('playlists').once((data) => {
        if (data) {
          const playlistArray = [];
          
          // Converti i dati GunDB in un array
          Object.keys(data).forEach(key => {
            if (key !== '_' && data[key]) {
              playlistArray.push({
                id: key,
                ...data[key]
              });
            }
          });
          
          setPlaylists(playlistArray);
        }
      });
      
      setLoading(false);
    } catch (error) {
      console.error("Errore nel caricamento dei dati utente:", error);
      setErrorMessage("Errore nel caricamento dei dati utente: " + error.message);
      setLoading(false);
    }
  };

  // Funzione per inizializzare i dati utente
  const initializeUserData = async () => {
    if (!sdk || !gun) {
      setErrorMessage("SDK non inizializzato");
      return;
    }

    try {
      setLoading(true);
      
      // Esempio: inizializzazione delle playlist predefinite
      const defaultPlaylist = {
        name: "La mia prima playlist",
        description: "Playlist creata automaticamente",
        tracks: [],
        createdAt: new Date().toISOString()
      };
      
      // Salva la playlist predefinita in GunDB
      gun.user().get('playlists').set(defaultPlaylist);
      
      setLoading(false);
      await loadUserData(); // Ricarica i dati appena creati
    } catch (error) {
      console.error("Errore nell'inizializzazione dei dati utente:", error);
      setErrorMessage("Errore nell'inizializzazione dei dati utente: " + error.message);
      setLoading(false);
    }
  };

  // Funzione di logout
  const logout = () => {
    if (gun) {
      gun.user().leave();
    }
    
    setSignedIn(false);
    setUsername("");
    setUserPub("");
    setPlaylists([]);
  };

  // Contenuto dell'app quando utente è autenticato
  const authenticatedContent = () => (
    <div className="app-container">
      <header className="app-header">
        <h1>Shogun Music</h1>
        <div className="user-info">
          <span>Benvenuto, {username}</span>
          <button onClick={logout} className="logout-button">Logout</button>
        </div>
      </header>
      
      <main className="app-content">
        {loading ? (
          <div className="loading">Caricamento in corso...</div>
        ) : (
          <>
            <div className="playlists-container">
              <h2>Le tue playlist</h2>
              {playlists.length > 0 ? (
                <ul className="playlist-list">
                  {playlists.map(playlist => (
                    <li key={playlist.id} className="playlist-item">
                      <h3>{playlist.name}</h3>
                      <p>{playlist.description}</p>
                      <p>Brani: {playlist.tracks ? playlist.tracks.length : 0}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Non hai ancora playlist. Creane una!</p>
              )}
              
              <button 
                className="create-playlist-button"
                onClick={() => {
                  const name = prompt("Nome della playlist:");
                  if (name) {
                    const newPlaylist = {
                      name,
                      description: "Nuova playlist",
                      tracks: [],
                      createdAt: new Date().toISOString()
                    };
                    gun.user().get('playlists').set(newPlaylist);
                    loadUserData(); // Ricarica per aggiornare la lista
                  }
                }}
              >
                Crea Nuova Playlist
              </button>
            </div>
            
            <ShogunCore />
          </>
        )}
      </main>
    </div>
  );

  // Contenuto dell'app quando utente non è autenticato
  const unauthenticatedContent = () => (
    <div className="login-container">
      <h1>Shogun Music</h1>
      <p>Accedi o registrati per gestire la tua musica</p>
      
      {errorMessage && <div className="error-message">{errorMessage}</div>}
      
      {sdkInitialized ? (
        <ShogunButtonProvider
          sdk={sdk}
          options={{
            appName: "Shogun Music",
            appDescription: "Gestisci e condividi la tua musica",
            showMetamask: true,
            showWebauthn: true,
            darkMode: true,
          }}
          onLoginSuccess={handleLoginSuccess}
          onSignupSuccess={handleSignupSuccess}
          onError={handleAuthError}
        >
          <ShogunButton />
        </ShogunButtonProvider>
      ) : (
        <div className="error-message">
          SDK non inizializzato. Ricarica la pagina.
        </div>
      )}
    </div>
  );

  return (
    <div className="App">
      {signedIn ? authenticatedContent() : unauthenticatedContent()}
    </div>
  );
}

export default App; 