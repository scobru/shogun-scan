import React, { useState, useEffect } from "react";
import Button from "./components/Button";
import Sidebar from "./components/Sidebar";
import { ShogunButton, ShogunButtonProvider, shogunConnector } from "@shogun/shogun-button";
import "@shogun/shogun-button/styles.css";
import ShogunLoginModal from "./components/ShogunLoginModal"; 
import { messages, rpcOptions } from "./constants";
import { WalletInfo, AuthMethod, AuthResult, StealthKeyPair } from "./types";
import "./App.css";
import { ethers } from "ethers";

// Creazione del connettore Shogun per il pulsante
export const { sdk, options } = shogunConnector({
  appName: "Shogun Wallet",
  appDescription: "Wallet per criptovalute basato su Shogun",
  appUrl: "http://localhost:3000",
  showMetamask: true,
  showWebauthn: true,
  darkMode: true,
  websocketSecure: false // Usa WebSocket non sicuro
});

export const gun =  sdk.gun;

const App: React.FC = () => {
  // Stati per l'autenticazione
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [userpub, setUserpub] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);

  // Stati per i wallet
  const [derivedWallets, setDerivedWallets] = useState<WalletInfo[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [messageToSign, setMessageToSign] = useState<string>("");
  const [signedMessage, setSignedMessage] = useState<string>("");
  const [isMetaMaskConnected, setIsMetaMaskConnected] =
    useState<boolean>(false);
  const [metamaskAddress, setMetamaskAddress] = useState<string>("");
  const [isWebAuthnSupported, setIsWebAuthnSupported] =
    useState<boolean>(false);
  const [webauthnDevices, setWebauthnDevices] = useState<any[]>([]);

  // Stati per stealth
  const [stealthAddress, setStealthAddress] = useState<string>("");
  const [ephemeralPublicKey, setEphemeralPublicKey] = useState<string>("");
  const [recipientPublicKey, setRecipientPublicKey] = useState<string>("");
  const [stealthWallet, setStealthWallet] = useState<any>(null);
  const [stealthGenerating, setStealthGenerating] = useState<boolean>(false);

  // Altri stati
  const [gunPublicKey, setGunPublicKey] = useState<string>("");
  const [selectedRpc, setSelectedRpc] = useState<string>("mainnet");
  const [provider, setProvider] = useState<any>(null);
  const [showSendForm, setShowSendForm] = useState<boolean>(false);
  const [senderBalance, setSenderBalance] = useState<string>("");
  const [recipientAddress, setRecipientAddress] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [showSignBox, setShowSignBox] = useState<boolean>(false);
  const [showStealthBox, setShowStealthBox] = useState<boolean>(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>("wallet");

  // Aggiungi questi stati aggiuntivi per stealth
  const [showStealthOpener, setShowStealthOpener] = useState<boolean>(false);
  const [stealthToOpen, setStealthToOpen] = useState<string>("");
  const [ephemeralKeyToOpen, setEphemeralKeyToOpen] = useState<string>("");
  const [openedStealthWallet, setOpenedStealthWallet] = useState<any>(null);
  const [openingStealthAddress, setOpeningStealthAddress] =
    useState<boolean>(false);

  // Stato per l'autenticazione
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showMnemonicModal, setShowMnemonicModal] = useState(false);
  const [mnemonicPhrase, setMnemonicPhrase] = useState("");

  // Stato per l'interfaccia utente
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [balance, setBalance] = useState("0");

  // Funzione per salvare i wallet nel localStorage
  const saveWalletsToLocalStorage = (wallets: any[]) => {
    try {
      // Prepara i dati da salvare (senza le funzioni e oggetti complessi)
      const walletsToSave = wallets.map(wallet => ({
        address: wallet.address,
        path: wallet.path,
        // Salva la chiave privata solo se disponibile e l'utente ha dato il consenso
        privateKey: wallet.wallet?.privateKey && localStorage.getItem('save_private_keys') === 'true' 
          ? wallet.wallet.privateKey 
          : undefined
      }));
      
      localStorage.setItem('shogun_wallets', JSON.stringify(walletsToSave));
      console.log("Wallet salvati nel localStorage");
    } catch (error) {
      console.error("Errore nel salvataggio dei wallet:", error);
    }
  };

  // Funzione per aggiornare il saldo
  const updateBalance = async (
    address: string,
    providerToUse: any = provider
  ) => {
    try {
      if (!providerToUse) return;
      
      const balance = await providerToUse.getBalance(address);
      const formattedBalance = ethers.formatEther(balance);
      setSenderBalance(formattedBalance);
    } catch (error: any) {
      console.error("Errore durante l'aggiornamento del saldo:", error);
      setErrorMessage(error.message);
    }
  };

  // Funzione per caricare i wallet
  const loadWallets = async () => {
    try {
      setLoading(true);
      
      // Utilizziamo il nuovo metodo loadWallets dell'SDK
      const wallets = await sdk.loadWallets();
      
      if (wallets && wallets.length > 0) {
        const walletInfos = wallets.map((walletInfo, index) => ({
          wallet: walletInfo.wallet,
          path: `m/44'/60'/0'/0/${index}`,
          address: walletInfo.wallet.address,
          getAddressString: () => walletInfo.wallet.address
        }));
        
        setDerivedWallets(walletInfos);
        
        if (walletInfos.length > 0) {
          setSelectedAddress(walletInfos[0].address);
          updateBalance(walletInfos[0].address);
        } else {
          // Se non ci sono wallet, ne crea uno nuovo
          await createNewWallet();
        }
      }
      
      setLoading(false);
    } catch (error: any) {
      console.error("Errore durante il caricamento dei wallet:", error);
      setErrorMessage(error.message);
      setLoading(false);
    }
  };

  // Funzione per creare un nuovo wallet
  const createNewWallet = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      
      // Verifica se l'utente è autenticato
      if (!sdk.isLoggedIn()) {
        throw new Error("Utente non autenticato. Effettua il login per creare un wallet.");
      }
      
      // Utilizziamo il nuovo metodo createWallet dell'SDK
      const newWalletInfo = await sdk.createWallet();
      
      // Crea un oggetto wallet compatibile con l'app
      const walletInfo: WalletInfo = {
        wallet: newWalletInfo.wallet,
        path: newWalletInfo.path,
        address: newWalletInfo.wallet.address,
        getAddressString: () => newWalletInfo.wallet.address
      };
      
      // Aggiorna la lista dei wallet
      const updatedWallets = [...derivedWallets, walletInfo];
      setDerivedWallets(updatedWallets);
      
      // Se è il primo wallet, selezionalo
      if (derivedWallets.length === 0) {
        setSelectedAddress(walletInfo.address);
        await updateBalance(walletInfo.address);
      }
      
      setLoading(false);
      return walletInfo;
    } catch (error: any) {
      console.error("Errore durante la creazione del wallet:", error);
      setErrorMessage("Errore durante la creazione del wallet: " + error.message);
      setLoading(false);
      return null;
    }
  };

  const handleLoginSuccess = async (data: {
    userPub: string;
    username: string;
    password?: string;
    authMethod?: AuthMethod;
  }) => {
    console.log("Login success:", data);
    setSignedIn(true);
    setUserpub(data.userPub);
    setUsername(data.username);
    
    if (data.password) {
      setPassword(data.password);
    }

    // Carica i wallet dopo il login
    await loadWallets();
  };

  // Funzione per gestire il successo della registrazione
  const handleSignupSuccess = async (data: {
    userPub: string;
    username: string;
    password?: string;
    wallet?: ethers.Wallet;
    authMethod?: AuthMethod;
  }) => {
    console.log("Registrazione completata con successo");
    
    try {
      // Verifico se l'utente è autenticato
      if (!sdk.isLoggedIn()) {
        console.log("Utente non autenticato, tentativo di ripristino sessione...");
        
        // Tenta di riautenticare con le credenziali fornite
        if (data.password) {
          console.log("Tentativo manuale di riautenticazione...");
          
          // Riautenticazione manuale
          const loginResult = await sdk.login(data.username, data.password);
          
          if (!loginResult.success) {
            throw new Error("Impossibile riautenticare l'utente dopo la registrazione");
          }
        } else {
          throw new Error("Password non disponibile per riautenticazione");
        }
      }
      
      // Ora che l'utente è autenticato, possiamo creare un wallet
      setUserpub(data.userPub);
      setUsername(data.username);
      setSignedIn(true);
      
      // Aggiorna lo stato dell'applicazione
      setShowLoginModal(false);
    } catch (error) {
      console.error("Errore durante la riautenticazione:", error);
      throw new Error("Errore durante la riautenticazione dopo la registrazione");
    }
  };

  // Funzione per gestire gli errori di autenticazione
  const handleAuthError = (error: string) => {
    console.error("Errore di autenticazione:", error);
    setErrorMessage(error);
  };

  // Funzione di logout
  const logout = () => {
    // Utilizziamo il metodo logout dell'SDK
    sdk.logout();
    
    // Resetta lo stato dell'applicazione
    const resetState = () => {
      setSignedIn(false);
      setUserpub("");
      setUsername("");
      setPassword("");
      setDerivedWallets([]);
      setSelectedAddress(null);
      setMessageToSign("");
      setSignedMessage("");
      setSenderBalance("");
      setErrorMessage("");
      setStealthAddress("");
      setEphemeralPublicKey("");
      setRecipientPublicKey("");
      setStealthWallet(null);
    };
    
    resetState();
  };

  const handleRpcChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRpc(event.target.value);

    // Inizializza il provider in base all'RPC selezionato
    try {
      const rpcUrl = rpcOptions.find(
        (opt) => opt.value === event.target.value
      )?.url;
      const newProvider = new ethers.JsonRpcProvider(rpcUrl);
      setProvider(newProvider);

      // Aggiorna il saldo se un indirizzo è selezionato
      if (selectedAddress) {
        updateBalance(selectedAddress, newProvider);
      }
    } catch (error) {
      console.error("Errore nell'impostazione del provider RPC:", error);
    }
  };

  const selectAddress = async (address: string) => {
    setSelectedAddress(address === selectedAddress ? null : address);
    setActiveAction(null);

    if (address !== selectedAddress) {
      updateBalance(address);
    }
  };

  // Inizializza il provider all'avvio
  useEffect(() => {
    // Provider predefinito (mainnet)
    try {
      const defaultRpcUrl = rpcOptions.find(
        (opt) => opt.value === selectedRpc
      )?.url;
      const defaultProvider = new ethers.JsonRpcProvider(defaultRpcUrl);
      setProvider(defaultProvider);
    } catch (error) {
      console.error("Errore nell'inizializzazione del provider:", error);
    }
  }, []);

  // Aggiorna il saldo quando cambiano provider o indirizzo selezionato
  useEffect(() => {
    if (selectedAddress && provider) {
      updateBalance(selectedAddress);
    }
  }, [selectedAddress, provider]);

  const signMessage = async () => {
    try {
      if (!selectedAddress || !messageToSign) {
        setErrorMessage("Seleziona un indirizzo e inserisci un messaggio da firmare");
        return;
      }

      // Trova il wallet corrispondente all'indirizzo selezionato
      const selectedWallet = derivedWallets.find(
        (w) => w.address === selectedAddress
      );

      if (!selectedWallet) {
        setErrorMessage("Wallet non trovato");
        return;
      }

      // Utilizza il metodo signMessage dell'SDK
      const signature = await sdk.signMessage(
        selectedWallet.wallet,
        messageToSign
      );

      setSignedMessage(signature);
      setErrorMessage("");
    } catch (error: any) {
      console.error("Errore durante la firma del messaggio:", error);
      setErrorMessage(error.message);
    }
  };

  // Funzioni per l'interfaccia
  const handleSend = () => {
    if (!selectedAddress) {
      setErrorMessage("Seleziona prima un indirizzo");
      return;
    }

    if (activeAction === "send") {
      setActiveAction(null);
    } else {
      setActiveAction("send");
    }
  };

  const handleReceive = () => {
    if (!selectedAddress) {
      setErrorMessage("Seleziona prima un indirizzo");
      return;
    }

    try {
      navigator.clipboard.writeText(selectedAddress);
      setErrorMessage("Indirizzo copiato negli appunti!");

      setTimeout(() => {
        setErrorMessage("");
      }, 2000);
    } catch (error: any) {
      console.error("Errore durante la copia dell'indirizzo:", error);
      setErrorMessage(error.message);
    }
  };

  // Funzione per verificare lo stato di login
  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        // Utilizziamo recall con sessionStorage per recuperare la sessione
        const user = sdk.gun.user().recall({ sessionStorage: true });

        // Utilizziamo un timeout per dare tempo a Gun di recuperare la sessione
        setTimeout(async () => {
          // Verifica se l'utente è autenticato dopo il recall
          if (user.is) {
            console.log("Utente recuperato da sessione:", user.is);
            setSignedIn(true);
            setUserpub(user.is.pub);

            // Carica i dati dell'utente
            try {
              // Recupera l'username dal record dell'utente
              const userRecord = await new Promise((resolve) => {
                sdk.gundb.gun.get("users").get(user.is.pub).once(resolve);
              });

              if (
                userRecord &&
                typeof userRecord === "object" &&
                "username" in userRecord
              ) {
                setUsername(userRecord.username as string); // Aggiungi cast esplicito
              }

              // Carica i wallet dell'utente
              await loadWallets();
            } catch (error) {
              console.error("Errore nel recupero dei dati utente:", error);
            }
          } else {
            console.log("Nessuna sessione utente trovata");
          }
        }, 300); // 300ms di ritardo per dare tempo a Gun di completare il recall
      } catch (error) {
        console.error("Errore nel controllo dello stato di login:", error);
      }
    };

    checkLoginStatus();
  }, []);

  // Funzione per connettere MetaMask
  const handleMetaMaskConnect = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      // Verifica se MetaMask è disponibile
      if (!window.ethereum) {
        throw new Error("MetaMask non è installato");
      }

      // Richiedi l'accesso agli account
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      if (accounts && accounts.length > 0) {
        setMetamaskAddress(accounts[0]);
        return accounts[0];
      } else {
        throw new Error("Nessun account MetaMask disponibile");
      }
    } catch (error: any) {
      console.error("Errore nella connessione a MetaMask:", error);
      setErrorMessage(`Errore nella connessione a MetaMask: ${error.message}`);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Funzione per il login con MetaMask
  const handleMetaMaskLogin = async () => {
    try {
      // Prima connetti MetaMask
      const address = await handleMetaMaskConnect();
      if (!address) return;

      setLoading(true);
      setErrorMessage("");

      // Effettua il login con MetaMask
      const result = await sdk.loginWithMetaMask(address);
      
      if (result.success) {
        // Salva i dati dell'utente
        setUserpub(result.userPub || "");
        setUsername(`metamask_${address}`);
        setSignedIn(true);
        
        // Carica i wallet
        await loadWallets();
        
        // Salva i dati nel localStorage
        localStorage.setItem("userPub", result.userPub || "");
        localStorage.setItem("username", `metamask_${address}`);
        localStorage.setItem("isAuthenticated", "true");
        
        setSignedIn(true);
      } else if (result.error) {
        setErrorMessage(result.error);
      }
    } catch (error: any) {
      console.error("Errore nel login con MetaMask:", error);
      setErrorMessage(`Errore nel login con MetaMask: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Funzione per verificare il supporto WebAuthn
  const checkWebAuthnSupport = () => {
    return sdk.isWebAuthnSupported();
  };

  // Funzione per la registrazione con WebAuthn
  const handleWebAuthnSignUp = async () => {
    if (!username) {
      setErrorMessage("Inserisci un nome utente per la registrazione WebAuthn");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      // Registra l'utente con WebAuthn
      const result = await sdk.registerWithWebAuthn(username);
      
      if (result.success) {
        // Salva i dati dell'utente
        setUserpub(result.userPub || "");
        setUsername(username);
        setSignedIn(true);
        
        // Carica i wallet
        await loadWallets();
        
        // Salva i dati nel localStorage
        localStorage.setItem("userPub", result.userPub || "");
        localStorage.setItem("username", username);
        localStorage.setItem("isAuthenticated", "true");
        
        // Se c'è un credentialId, salvalo
        if (result.credentialId) {
          localStorage.setItem("credentialId", result.credentialId);
        }
        
        setSignedIn(true);
      } else if (result.error) {
        setErrorMessage(result.error);
      }
    } catch (error: any) {
      console.error("Errore nella registrazione WebAuthn:", error);
      setErrorMessage(`Errore nella registrazione WebAuthn: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Funzione per il login con WebAuthn
  const handleWebAuthnLogin = async () => {
    if (!username) {
      setErrorMessage("Inserisci un nome utente per il login WebAuthn");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      // Effettua il login con WebAuthn
      const result = await sdk.loginWithWebAuthn(username);
      
      if (result.success) {
        // Salva i dati dell'utente
        setUserpub(result.userPub || "");
        setUsername(username);
        setSignedIn(true);
        
        // Carica i wallet
        await loadWallets();
        
        // Salva i dati nel localStorage
        localStorage.setItem("userPub", result.userPub || "");
        localStorage.setItem("username", username);
        localStorage.setItem("isAuthenticated", "true");
        
        // Se c'è un credentialId, salvalo
        if (result.credentialId) {
          localStorage.setItem("credentialId", result.credentialId);
        }
        
        setSignedIn(true);
      } else if (result.error) {
        setErrorMessage(result.error);
      }
    } catch (error: any) {
      console.error("Errore nel login WebAuthn:", error);
      setErrorMessage(`Errore nel login WebAuthn: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Aggiorna il useEffect per verificare il supporto WebAuthn
  useEffect(() => {
    checkWebAuthnSupport();
  }, []);

  // Aggiunta di una funzione per caricare i dispositivi WebAuthn
  const loadWebAuthnDevices = async () => {
    if (username && userpub) {
      try {
        // Accediamo direttamente al localStorage per ottenere le credenziali WebAuthn
        const credentialsStr = localStorage.getItem(`webauthn_${username}`);
        
        if (credentialsStr) {
          try {
            const credentials = JSON.parse(credentialsStr);
            
            if (credentials && credentials.credentials) {
              // Converti le credenziali in un array di dispositivi
              const devices = Object.entries(credentials.credentials).map(([id, info]: [string, any]) => ({
                id,
                name: info.name || 'Dispositivo sconosciuto',
                platform: info.platform || 'Piattaforma sconosciuta',
                timestamp: info.timestamp || Date.now()
              }));
              
              setWebauthnDevices(devices);
            } else {
              setWebauthnDevices([]);
            }
          } catch (parseError) {
            console.error("Errore durante il parsing delle credenziali WebAuthn:", parseError);
            setWebauthnDevices([]);
          }
        } else {
          setWebauthnDevices([]);
        }
      } catch (error) {
        console.error("Errore durante il caricamento dei dispositivi WebAuthn:", error);
        setWebauthnDevices([]);
      }
    }
  };

  // Funzione per generare un indirizzo stealth
  const generateStealthAddress = async () => {
    if (!recipientPublicKey) {
      setErrorMessage("Inserisci la chiave pubblica del destinatario");
      return;
    }

    setStealthGenerating(true);
    setErrorMessage("");

    try {
      // Ottieni il wallet dell'utente
      const user = sdk.gun.user().recall({ sessionStorage: true }).is;
      if (!user || !user.pub) {
        throw new Error("Utente non autenticato");
      }

      // Genera l'indirizzo stealth usando l'SDK
      const result = await sdk.stealth?.generateStealthAddress(recipientPublicKey);

      if (!result) {
        throw new Error("Errore nella generazione dell'indirizzo stealth");
      }

      // Salva i risultati
      setStealthAddress(result.stealthAddress);
      setEphemeralPublicKey(result.ephemeralPublicKey);

      // Feedback positivo
      setErrorMessage("Indirizzo stealth generato con successo!");
      setTimeout(() => setErrorMessage(""), 3000);
    } catch (error: any) {
      console.error("Errore nella generazione dell'indirizzo stealth:", error);
      setErrorMessage(
        error.message || "Errore nella generazione dell'indirizzo stealth"
      );
    } finally {
      setStealthGenerating(false);
    }
  };

  // Funzione per aprire un indirizzo stealth
  const openStealthAddress = async () => {
    if (!stealthToOpen || !ephemeralKeyToOpen) {
      setErrorMessage(
        "Inserisci sia l'indirizzo stealth che la chiave pubblica effimera"
      );
      return;
    }

    setOpeningStealthAddress(true);
    setErrorMessage("");

    try {
      // Verifica che l'SDK stealth sia disponibile
      if (!sdk.stealth) {
        throw new Error("Il modulo stealth non è disponibile");
      }
      
      // Ottieni le chiavi dell'utente per creare un oggetto StealthKeyPair
      const user = sdk.gun.user();
      if (!user.is) {
        throw new Error("Utente non autenticato");
      }
      
      // Accedi alle chiavi dell'utente usando type assertion
      const userSea = (user._ as any).sea;
      if (!userSea) {
        throw new Error("Chiavi dell'utente non disponibili");
      }
      
      // Crea un oggetto StealthKeyPair con le chiavi dell'utente
      const userKeyPair: StealthKeyPair = {
        pub: userSea.pub,
        priv: userSea.priv,
        epub: userSea.epub,
        epriv: userSea.epriv,
        privateKey: userSea.priv,
        publicKey: userSea.pub
      };
      
      // Ottieni il wallet stealth usando l'SDK con i tre parametri richiesti
      const result = await sdk.stealth.openStealthAddress(
        stealthToOpen,
        ephemeralKeyToOpen,
        userKeyPair // Passiamo l'oggetto StealthKeyPair completo
      );

      if (!result) {
        throw new Error("Impossibile aprire l'indirizzo stealth");
      }

      setOpenedStealthWallet(result);
      setErrorMessage("Indirizzo stealth aperto con successo!");
      setTimeout(() => setErrorMessage(""), 3000);
    } catch (error: any) {
      console.error("Errore nell'apertura dell'indirizzo stealth:", error);
      setErrorMessage(
        error.message || "Errore nell'apertura dell'indirizzo stealth"
      );
    } finally {
      setOpeningStealthAddress(false);
    }
  };

  // Modifica la funzione checkGunState per usare sdk invece di user
  const checkGunState = () => {
    console.log("=== VERIFICA STATO GUN ===");

    try {
      // Verifica se l'utente è autenticato usando sdk invece di user
      const gunUser = sdk.gun.user();
      if (!gunUser.is) {
        console.error("Utente Gun non autenticato!");
        return;
      }

      console.log("Utente Gun:", gunUser.is);

      // Verifica i percorsi di Gun usando sdk
      sdk.gun
        .user()
        .get("friends")
        .once((data: any) => {
          console.log("Percorso amici:", data);
        });

      // Verifica i percorsi di Gun per gli inviti
      sdk.gun
        .user()
        .get("friendRequests")
        .once((data: any) => {
          console.log("Percorso richieste amicizia:", data);
        });
    } catch (error) {
      console.error("Errore nella verifica dello stato Gun:", error);
    }
  };

  // Correggi questa funzione per usare sdk invece di lonewolfGun e authentication
  const ensureAuthenticated = async () => {
    try {
      // Verifica se l'utente è già autenticato
      const gunUser = sdk.gun.user();
      if (gunUser.is) {
        console.log("Utente già autenticato con Gun:", gunUser.is);
        return true;
      }

      console.log("Utente non autenticato, tentativo di ripristino sessione...");

      // Tenta di recuperare la sessione tramite recall
      sdk.gun.user().recall({ sessionStorage: true });

      // Attendi per dare tempo al recall di funzionare
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verifica nuovamente
      if (sdk.gun.user().is) {
        console.log("Sessione ripristinata con successo via recall");
        return true;
      }

      console.log("Impossibile ripristinare la sessione automaticamente");
      return false;
    } catch (error) {
      console.error("Errore durante il controllo/recupero dell'autenticazione:", error);
      return false;
    }
  };

  // Funzione per verificare lo stato di Hedgehog
  const checkHedgehogState = () => {
    try {
      // Sostituisci isLoggedIn con un controllo alternativo
      const isLoggedIn = sdk.getMainWallet() !== null;
      console.log("Stato login Hedgehog:", isLoggedIn);

      if (isLoggedIn) {
        const wallet = sdk.getMainWallet();
        console.log(
          "Wallet principale:",
          wallet ? "Disponibile" : "Non disponibile"
        );
      }

      return isLoggedIn;
    } catch (error) {
      console.error("Errore nel controllo dello stato Hedgehog:", error);
      return false;
    }
  };

  // Funzione per rimuovere un dispositivo WebAuthn
  const removeWebAuthnDevice = async (deviceId: string) => {
    if (!username) {
      setErrorMessage("Nome utente non disponibile");
      return false;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      // Accediamo direttamente al localStorage per ottenere le credenziali WebAuthn
      const credentialsStr = localStorage.getItem(`webauthn_${username}`);
      
      if (!credentialsStr) {
        setErrorMessage("Nessuna credenziale WebAuthn trovata");
        return false;
      }
      
      try {
        const credentials = JSON.parse(credentialsStr);
        
        if (credentials && credentials.credentials) {
          // Rimuovi il dispositivo dalle credenziali
          if (credentials.credentials[deviceId]) {
            delete credentials.credentials[deviceId];
            
            // Salva le credenziali aggiornate
            localStorage.setItem(`webauthn_${username}`, JSON.stringify(credentials));
            
            // Aggiorna la lista dei dispositivi
            await loadWebAuthnDevices();
            
            return true;
          } else {
            setErrorMessage("Dispositivo non trovato");
            return false;
          }
        } else {
          setErrorMessage("Formato credenziali non valido");
          return false;
        }
      } catch (parseError) {
        console.error("Errore durante il parsing delle credenziali WebAuthn:", parseError);
        setErrorMessage("Errore durante il parsing delle credenziali");
        return false;
      }
    } catch (error: any) {
      console.error("Errore durante la rimozione del dispositivo WebAuthn:", error);
      setErrorMessage(`Errore: ${error.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Shogun Wallet</h1>
          {signedIn && (
            <Button 
              onClick={logout} 
              variant="secondary" 
              size="sm"
              text="Logout"
            />
          )}
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4">
        {!signedIn ? (
          <div className="max-w-md mx-auto">
            {showLoginModal ? (
              <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
                <ShogunButtonProvider
                  sdk={sdk}
                  options={{
                    appName: "Shogun Wallet",
                    appDescription: "Wallet per criptovalute basato su Shogun",
                    appUrl: "http://localhost:3000",
                    showMetamask: true,
                    showWebauthn: true,
                    darkMode: true
                  }}
                >
                  <div className="flex flex-col items-center">
                    <div className="mb-4 w-full flex justify-end">
                      <button 
                        className="text-gray-400 hover:text-white"
                        onClick={() => setShowLoginModal(false)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <ShogunLoginModal 
                      onLoginSuccess={handleLoginSuccess}
                      onSignupSuccess={handleSignupSuccess}
                    />
                  </div>
                </ShogunButtonProvider>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg p-6 shadow-lg text-center">
                <h2 className="text-2xl font-bold mb-6">Benvenuto in Shogun Wallet</h2>
                <p className="mb-6 text-gray-300">Accedi o registrati per gestire i tuoi asset crypto in modo sicuro.</p>
                
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:shadow-outline transition duration-300"
                >
                  Accedi o Registrati
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="min-h-screen flex">
            <Sidebar
              selectedRpc={selectedRpc}
              onRpcChange={handleRpcChange}
              wallets={derivedWallets}
              selectedAddress={selectedAddress}
              onSelectAddress={selectAddress}
              onCreateWallet={createNewWallet}
              onLogout={logout}
            />
            <div className="flex-1 p-4">
              {/* Contenuto principale */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">Il tuo wallet</h2>
                {errorMessage && (
                  <div className="bg-red-900/20 border border-red-500/30 text-red-500 p-3 rounded-lg mb-4">
                    {errorMessage}
                  </div>
                )}
                {selectedAddress && (
                  <div className="bg-gray-800 rounded-lg p-6 mb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-medium text-gray-300">
                          Indirizzo
                        </h3>
                        <p className="text-sm font-mono break-all">
                          {selectedAddress}
                        </p>
                      </div>
                      <div className="mt-4 md:mt-0">
                        <h3 className="text-lg font-medium text-gray-300">
                          Saldo
                        </h3>
                        <p className="text-xl font-bold">
                          {senderBalance ? `${senderBalance} ETH` : "Caricamento..."}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={handleSend}
                        text="Invia"
                        variant={activeAction === "send" ? "primary" : "secondary"}
                      />
                      <Button
                        onClick={handleReceive}
                        text="Ricevi"
                        variant="secondary"
                      />
                      <Button
                        onClick={() => setActiveAction(activeAction === "sign" ? null : "sign")}
                        text="Firma Messaggio"
                        variant={activeAction === "sign" ? "primary" : "secondary"}
                      />
                    </div>
                  </div>
                )}

                {/* Form di firma messaggio */}
                {activeAction === "sign" && (
                  <div className="bg-white/5 p-6 rounded-lg">
                    <h4 className="text-gray-400 mb-4">
                      Firma Messaggio
                    </h4>
                    <textarea
                      className="w-full min-h-[80px] p-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-primary outline-none resize-y mb-4"
                      placeholder="Inserisci il messaggio da firmare..."
                      value={messageToSign}
                      onChange={(e) => setMessageToSign(e.target.value)}
                    />
                    <Button
                      onClick={signMessage}
                      loading={loading}
                      text="Firma"
                      fullWidth
                    />
                    {signedMessage && (
                      <div className="mt-4">
                        <h5 className="text-gray-400 mb-2">Firma:</h5>
                        <div className="bg-black/20 p-3 rounded-lg border border-white/10 break-all font-mono text-xs">
                          {signedMessage}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
