import { authentication } from 'lonewolf-protocol';
import { createSignal, onMount } from 'solid-js';
import { ShogunSDK } from 'shogun-sdk';
import LoginWithShogun from '../../components/LoginWithShogun';

let AuthenticationPage = () => {
  let [shogunSDK, setShogunSDK] = createSignal(null);
  
  // Inizializza l'SDK di Shogun
  onMount(() => {
    console.log("Inizializzazione SDK...");
    const sdk = new ShogunSDK({
      peers: ["http://localhost:8765/gun"],
      localStorage: false,
      radisk: false
    });
    console.log("SDK inizializzato:", sdk);
    
    // Verifica che le funzioni necessarie siano disponibili
    console.log("connectMetaMask disponibile:", typeof sdk.connectMetaMask === 'function');
    console.log("loginWithMetaMask disponibile:", typeof sdk.loginWithMetaMask === 'function');
    console.log("isWebAuthnSupported disponibile:", typeof sdk.isWebAuthnSupported === 'function');
    console.log("authenticateWithWebAuthn disponibile:", typeof sdk.authenticateWithWebAuthn === 'function');
    console.log("registerWithWebAuthn disponibile:", typeof sdk.registerWithWebAuthn === 'function');
    
    setShogunSDK(sdk);
  });
  
  // Funzione chiamata quando il login ha successo
  const handleLoginSuccess = ({ userPub, username, password }) => {
    console.log('Login effettuato con successo!');
    console.log('Chiave pubblica:', userPub);
    console.log('Username:', username);
    
    // Controlla se abbiamo una password salvata per questo utente
    const savedPassword = localStorage.getItem(`lonewolf_${username}`);
    const finalPassword = password || savedPassword;
    
    if (!finalPassword) {
      console.error("Nessuna password disponibile per l'autenticazione LoneWolf");
      return;
    }
    
    // Usa l'API di autenticazione di LoneWolf per effettuare il login
    authentication.loginUser(
      { username, password: finalPassword },
      ({ errMessage, success }) => {
        if (errMessage) {
          console.error(errMessage);
          
          // Se l'utente non esiste in LoneWolf, registralo
          if (errMessage === "Wrong user or password.") {
            console.log("Tentativo di login con password salvata...");
            
            // Prova tutte le password salvate per questo utente
            const allPasswords = getAllSavedPasswords(username);
            if (allPasswords.length > 0) {
              tryLoginWithPasswords(username, allPasswords, 0);
            } else {
              console.log("Utente non trovato in LoneWolf, tentativo di registrazione...");
              handleRegistrationWithLoneWolf(username, finalPassword);
            }
          }
        } else {
          console.log("Autenticazione LoneWolf completata:", success);
        }
      }
    );
  };
  
  // Funzione per ottenere tutte le password salvate per un utente
  const getAllSavedPasswords = (username) => {
    const passwords = [];
    
    // Controlla la password corrente
    const currentPassword = localStorage.getItem(`lonewolf_${username}`);
    if (currentPassword) passwords.push(currentPassword);
    
    // Controlla le password precedenti
    for (let i = 1; i <= 5; i++) {
      const oldPassword = localStorage.getItem(`lonewolf_${username}_${i}`);
      if (oldPassword) passwords.push(oldPassword);
    }
    
    return passwords;
  };
  
  // Funzione per provare il login con diverse password
  const tryLoginWithPasswords = (username, passwords, index) => {
    if (index >= passwords.length) {
      console.log("Nessuna password valida trovata, tentativo di registrazione...");
      handleRegistrationWithLoneWolf(username, passwords[0]);
      return;
    }
    
    authentication.loginUser(
      { username, password: passwords[index] },
      ({ errMessage, success }) => {
        if (errMessage) {
          console.log(`Tentativo ${index+1} fallito, provo con la prossima password...`);
          tryLoginWithPasswords(username, passwords, index + 1);
        } else {
          console.log("Autenticazione LoneWolf completata con password salvata:", success);
        }
      }
    );
  };
  
  // Funzione per registrare l'utente in LoneWolf
  const handleRegistrationWithLoneWolf = (username, password) => {
    authentication.registerUser(
      { username, password },
      async ({ errMessage, success }) => {
        if (errMessage) {
          console.error("Errore durante la registrazione con LoneWolf:", errMessage);
          
          // Se l'utente esiste già, prova a effettuare il login direttamente
          if (errMessage === "Username in use.") {
            console.log("Username già in uso, tentativo di login diretto...");
            await authentication.loginUser(
              { username, password },
              ({ errMessage, success }) => {
                if (errMessage) {
                  console.error("Errore durante il login diretto:", errMessage);
                } else {
                  console.log("Login diretto riuscito:", success);
                }
              }
            );
          }
        } else {
          console.log("Registrazione LoneWolf completata:", success);
          // Ora effettua il login
          await authentication.loginUser(
            { username, password },
            ({ errMessage, success }) => {
              if (errMessage) {
                console.error("Errore durante il login con LoneWolf dopo la registrazione:", errMessage);
              } else {
                console.log("Autenticazione LoneWolf completata dopo registrazione:", success);
              }
            }
          );
        }
      }
    );
  };
  
  // Funzione chiamata quando la registrazione ha successo
  const handleSignupSuccess = ({ userPub, username, password }) => {
    console.log('Registrazione effettuata con successo!');
    console.log('Chiave pubblica:', userPub);
    console.log('Username:', username);
    
    // Salva le credenziali per uso futuro
    // Salva anche le vecchie password
    const oldPassword = localStorage.getItem(`lonewolf_${username}`);
    if (oldPassword && oldPassword !== password) {
      // Sposta la vecchia password in uno slot di backup
      for (let i = 5; i > 1; i--) {
        const prevPassword = localStorage.getItem(`lonewolf_${username}_${i-1}`);
        if (prevPassword) {
          localStorage.setItem(`lonewolf_${username}_${i}`, prevPassword);
        }
      }
      localStorage.setItem(`lonewolf_${username}_1`, oldPassword);
    }
    
    localStorage.setItem(`lonewolf_${username}`, password);
    
    // Registra l'utente anche in LoneWolf
    handleRegistrationWithLoneWolf(username, password);
  };
  
  // Funzione per gestire gli errori
  const handleError = (error) => {
    console.error('Errore:', error);
  };
  
  return (
    <div class="flex flex-col justify-center items-center w-full h-full bg-gray-200 dark:bg-gray-900">
      {shogunSDK() && (
        <LoginWithShogun
          sdk={shogunSDK()}
          onLoginSuccess={handleLoginSuccess}
          onSignupSuccess={handleSignupSuccess}
          onError={handleError}
          showMetamask={true}
          showWebauthn={true}
          customMessages={{
            loginHeader: 'Accedi a LoneWolf',
            signupHeader: 'Registrati su LoneWolf'
          }}
        />
      )}
    </div>
  );
};

export default AuthenticationPage;