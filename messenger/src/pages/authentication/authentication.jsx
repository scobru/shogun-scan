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
          console.error("Errore durante il login con LoneWolf:", errMessage);
          
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
          
          // Forza l'aggiornamento dello stato di autenticazione
          setTimeout(() => {
            console.log("Tentativo di forzare l'autenticazione dopo login...");
            
            // Verifico se l'oggetto è un Subject RxJS (ha il metodo next)
            if (typeof authentication.isAuthenticated === 'object' && 
                typeof authentication.isAuthenticated.next === 'function') {
              console.log("Rilevato Subject RxJS, utilizzo il metodo next()...");
              authentication.isAuthenticated.next(true);
              
              // Verifica se è stato impostato correttamente
              setTimeout(() => {
                console.log("Verifica stato attuale dopo login:", authentication.isAuthenticated);
                if (authentication.checkAuth) {
                  console.log("Risultato checkAuth dopo login:", authentication.checkAuth());
                }
                
                // Reindirizza alla home page se sembra tutto ok
                setTimeout(() => {
                  console.log("Reindirizzamento alla home dopo login riuscito...");
                  window.location.href = '/';
                }, 200);
              }, 100);
            } else if (typeof authentication.checkAuth === 'function') {
              // Prova ad usare checkAuth per verificare/forzare l'autenticazione
              console.log("Tentativo di utilizzo del metodo checkAuth...");
              const isAuth = authentication.checkAuth();
              console.log("Risultato checkAuth:", isAuth);
              
              if (isAuth) {
                // Reindirizza alla home page
                console.log("Autenticazione verificata, reindirizzamento alla home...");
                setTimeout(() => {
                  window.location.href = '/';
                }, 200);
              } else {
                console.log("checkAuth ha restituito false, tentativo di reload...");
                setTimeout(() => {
                  window.location.reload();
                }, 300);
              }
            } else {
              console.log("Nessun metodo disponibile per verificare l'autenticazione");
              
              // Prova comunque a reindirizzare alla home
              console.log("Tentativo di reindirizzamento diretto alla home...");
              setTimeout(() => {
                window.location.href = '/';
              }, 300);
            }
          }, 300);
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
                  
                  // Forza l'aggiornamento dello stato di autenticazione
                  setTimeout(() => {
                    console.log("Tentativo di forzare l'autenticazione...");
                    
                    // Verifico se l'oggetto è un Subject RxJS (ha il metodo next)
                    if (typeof authentication.isAuthenticated === 'object' && 
                        typeof authentication.isAuthenticated.next === 'function') {
                      console.log("Rilevato Subject RxJS, utilizzo il metodo next()...");
                      
                      // Salva le credenziali di questo utente per uso futuro nel localStorage
                      // In questo modo il valore può essere recuperato anche dopo un refresh
                      try {
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
                        localStorage.setItem("current_user", username);
                        localStorage.setItem("is_authenticated", "true");
                        console.log("Credenziali salvate nel localStorage");
                      } catch (e) {
                        console.error("Errore nel salvataggio delle credenziali:", e);
                      }
                      
                      // Imposta il flag di autenticazione
                      authentication.isAuthenticated.next(true);
                      
                      // Prova a leggere il valore attuale dal Subject RxJS
                      let currentValue;
                      try {
                        // Alcuni Subject RxJS hanno una proprietà value accessibile
                        if (authentication.isAuthenticated.hasOwnProperty('value')) {
                          currentValue = authentication.isAuthenticated.value;
                          console.log("Valore attuale del Subject (tramite .value):", currentValue);
                        }
                      } catch (e) {
                        console.log("Impossibile leggere il valore direttamente:", e);
                      }
                      
                      console.log("Reindirizzamento alla home...");
                      // Reindirizzo comunque alla home page dopo un breve ritardo
                      setTimeout(() => {
                        window.location.href = '/';
                      }, 1000);
                    } else if (typeof authentication.checkAuth === 'function') {
                      // Prova ad usare checkAuth per verificare/forzare l'autenticazione
                      console.log("Tentativo di utilizzo del metodo checkAuth...");
                      try {
                        const checkResult = authentication.checkAuth();
                        console.log("Risultato checkAuth:", checkResult);
                        
                        // Salva comunque le credenziali nel localStorage
                        localStorage.setItem(`lonewolf_${username}`, password);
                        localStorage.setItem("current_user", username);
                        localStorage.setItem("is_authenticated", "true");
                        
                        console.log("Reindirizzamento alla home dopo checkAuth...");
                        setTimeout(() => {
                          window.location.href = '/';
                        }, 1000);
                      } catch (e) {
                        console.error("Errore durante checkAuth:", e);
                        // Prova comunque a reindirizzare
                        setTimeout(() => {
                          window.location.href = '/';
                        }, 1000);
                      }
                    } else {
                      console.log("Non è stato possibile forzare lo stato di autenticazione");
                      console.log("Tipo di isAuthenticated:", typeof authentication.isAuthenticated);
                      
                      // Salva comunque le credenziali nel localStorage
                      localStorage.setItem(`lonewolf_${username}`, password);
                      localStorage.setItem("current_user", username);
                      localStorage.setItem("is_authenticated", "true");
                      
                      console.log("Tentativo di richiamo di loginUser direttamente...");
                      authentication.loginUser({ username, password }, ({ success }) => {
                        console.log("Risultato login diretto forzato:", success);
                        
                        // Forza reindirizzamento alla homepage
                        console.log("Reindirizzamento forzato alla home...");
                        setTimeout(() => {
                          window.location.href = '/';
                        }, 1000);
                      });
                    }
                  }, 500);
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