import React, { useState, useEffect, useRef } from "react";
import {  shogunConnector  } from "@shogun/shogun-button";
import "@shogun/shogun-button/styles.css";
import ShogunLoginModal from "./components/ShogunLoginModal"; 
import { rpcOptions } from "./constants";
import { WalletInfo, AuthMethod,  StealthKeyPair } from "./types";
import "./App.css";
import { ethers } from "ethers";

// Inizializzazione del connettore Shogun
const connectorConfig = {
  appName: "Shogun Wallet",
  appDescription: "Wallet per criptovalute basato su Shogun",
  appUrl: "http://localhost:3000",
  showMetamask: true,
  showWebauthn: true,
  darkMode: true,
  websocketSecure: false // Usa WebSocket non sicuro
  
};

// Creazione del connettore Shogun per il pulsante con controllo errori
export const initShogunSDK = () => {
  try {
    const connector = shogunConnector(connectorConfig);
    console.log("SDK inizializzato con successo");
    return connector;
  } catch (error) {
    console.error("Errore nell'inizializzazione dell'SDK Shogun:", error);
    return { 
      sdk: null, 
      options: {}
    };
  }
};

export const { sdk, options } = initShogunSDK();
export const gun = sdk ? sdk.gun : null;

const App: React.FC = () => {
  // Stati per l'autenticazione
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [userpub, setUserpub] = useState<string>("");
  const [userEpub, setUserEpub] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showLoginModal, setShowLoginModal] = useState<boolean>(true);
  const [sdkInitialized, setSdkInitialized] = useState<boolean>(!!sdk);

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
  const [senderPublicKeyInput, setSenderPublicKeyInput] = useState("");
  const [privateKeyOverride, setPrivateKeyOverride] = useState("");
  const [openedStealthWallet, setOpenedStealthWallet] = useState<any>(null);
  const [openingStealthAddress, setOpeningStealthAddress] =
    useState<boolean>(false);

  // Stato per l'interfaccia utente
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [balance, setBalance] = useState("0");

  // Aggiunta dello state per la modalità semplificata
  const [useSimplifiedMode, setUseSimplifiedMode] = useState(false);

  // Stato per la gestione del modal di password
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [passwordModalAction, setPasswordModalAction] = useState<string>("");
  const [exportPassword, setExportPassword] = useState<string>("");

  // Nuovi stati per la gestione dell'importazione
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importType, setImportType] = useState<string>("");
  const [importData, setImportData] = useState<string>("");
  const [importPassword, setImportPassword] = useState<string>("");
  const [importFile, setImportFile] = useState<File | null>(null);

  // Aggiungo una referenza all'input file
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Funzione per attivare l'input file
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Funzione per salvare i wallet nel localStorage - ottimizzata
  const saveWalletsToLocalStorage = (wallets: any[]) => {
    try {
      // Prepara i dati da salvare (senza le funzioni e oggetti complessi)
      const walletsToSave = wallets.map(wallet => ({
        address: wallet.address,
        path: wallet.path || "legacy", // Uso legacy come fallback se path non esiste
        privateKey: wallet.wallet?.privateKey || undefined
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

      // fetch id 
      
      
      // Utilizziamo il nuovo metodo createWallet dell'SDK
      const newWalletInfo = await sdk?.createWallet();
      
      // Crea un oggetto wallet compatibile con l'app
      const walletInfo: WalletInfo = {
        wallet: newWalletInfo?.wallet,
        path: newWalletInfo?.path || "",
        address: newWalletInfo?.address || "",
        getAddressString: newWalletInfo?.getAddressString || (() => "")
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
    console.log("Tentativo di logout...");
    
    // Pulisci localStorage
    localStorage.removeItem("userPub");
    localStorage.removeItem("username");
    localStorage.removeItem("shogun_wallets");
    
    // Resetta lo stato dell'applicazione
    resetState();
    
    // Mostra la schermata di login
    setShowLoginModal(true);
    
    // Effettua logout dall'SDK solo se è attualmente loggato
    if (sdk.isLoggedIn()) {
      try {
        sdk.logout();
        console.log("Logout SDK completato");
      } catch (error) {
        console.error("Errore durante il logout SDK:", error);
      }
    } else {
      console.log("Utente non autenticato nell'SDK, logout locale completato");
    }
    
    // Tenta di forzare il logout da Gun
    try {
      gun.user().leave();
      console.log("Logout Gun completato");
    } catch (error) {
      console.error("Errore durante il logout Gun:", error);
    }
  };

  // Funzione per resettare lo stato dell'applicazione
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
    setActiveSection("wallet");
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


  useEffect(() => {
    if (gun?.user()._) {
      setUserEpub(gun?.user()._?.sea?.epub);
    }
  }, [userpub]);


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

    setShowSendForm(true);
    setActiveAction("send");
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
        console.log("Verifica dello stato di login...");
        
        // Mostra login per default, verrà nascosto solo se autenticazione confermata
        setShowLoginModal(true);
        
        // Verifica se l'SDK è inizializzato correttamente
        if (!sdk || !gun) {
          console.error("SDK non inizializzato correttamente");
          setSdkInitialized(false);
          return;
        }
        
        // Utilizziamo recall con sessionStorage per recuperare la sessione
        const user = gun.user().recall({ sessionStorage: true });

        // Utilizziamo un timeout per dare tempo a Gun di recuperare la sessione
        setTimeout(async () => {
          // Verifica se l'utente è autenticato dopo il recall
          if (user.is && sdk && sdk.isLoggedIn()) {
            console.log("Utente recuperato da sessione:", user.is);
            setSignedIn(true);
            setUserpub(user.is.pub);
            setShowLoginModal(false); // Nascondi la schermata di login

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
                setUsername(userRecord.username as string);
              }

              // Carica i wallet dell'utente
              await loadWallets();
            } catch (error) {
              console.error("Errore nel recupero dei dati utente:", error);
            }
          } else {
            console.log("Nessuna sessione utente trovata, necessario login");
            setSignedIn(false);
            setShowLoginModal(true);
          }
        }, 500); // Aumento a 500ms per dare più tempo
      } catch (error) {
        console.error("Errore nel controllo dello stato di login:", error);
        setShowLoginModal(true);
      }
    };

    if (sdkInitialized) {
      checkLoginStatus();
    }
  }, [sdkInitialized]);

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

      // AGGIUNTA: Pulsante per modalità semplificata
      let result: any;
      try {
        if (useSimplifiedMode) {
          // Commento questa parte perché questi metodi non esistono più
          // result = await sdk.stealth?.generateSimpleStealthAddress(recipientPublicKey);
          // Usiamo il metodo standard anche in modalità semplificata
          result = await sdk.stealth?.generateStealthAddress(recipientPublicKey);
        } else {
          // Usa il metodo standard
          result = await sdk.stealth?.generateStealthAddress(recipientPublicKey);
        }
      } catch (error: any) {
        console.error("Errore nella generazione dell'indirizzo stealth:", error);
        setErrorMessage(error.message || "Errore nella generazione dell'indirizzo stealth");
        return;
      }

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

  // Funzione per aprire un indirizzo stealth - correzione per usare solo 2 parametri
  const openStealthAddress = async () => {
    if (!stealthToOpen || (!ephemeralKeyToOpen && !privateKeyOverride)) {
      setErrorMessage(
        "Inserisci l'indirizzo stealth e almeno uno tra chiave pubblica effimera o chiave privata diretta"
      );
      return;
    }

    setOpeningStealthAddress(true);
    setErrorMessage("");

    try {
      // Controlla se è stata fornita una chiave privata diretta (metodo di recupero)
      if (privateKeyOverride) {
        try {
          console.log("Tentativo di apertura con chiave privata diretta");
          
          // Prova a creare un wallet con la chiave privata fornita
          let privateKey = privateKeyOverride;
          
          // Assicurati che la chiave privata abbia un formato valido
          if (!privateKey.startsWith('0x')) {
            privateKey = '0x' + privateKey;
          }
          
          // Crea il wallet
          const wallet = new ethers.Wallet(privateKey);
          console.log("Wallet creato da chiave privata:", wallet.address);
          
          // Verifica se l'indirizzo del wallet corrisponde all'indirizzo stealth
          if (wallet.address.toLowerCase() === stealthToOpen.toLowerCase()) {
            console.log("SUCCESSO con chiave privata fornita manualmente!");
            setOpenedStealthWallet(wallet);
            setErrorMessage("Indirizzo stealth aperto con successo tramite chiave privata!");
            setPrivateKeyOverride(""); // Pulisci il campo per sicurezza
            setTimeout(() => setErrorMessage(""), 3000);
            setOpeningStealthAddress(false);
            return;
          } else {
            console.log("La chiave privata fornita non corrisponde all'indirizzo stealth");
            setErrorMessage("La chiave privata fornita non genera l'indirizzo stealth richiesto");
            setOpeningStealthAddress(false);
            return;
          }
        } catch (e) {
          console.error("Errore nell'utilizzo della chiave privata diretta:", e);
          setErrorMessage("Chiave privata non valida. Verifica il formato e riprova.");
          setOpeningStealthAddress(false);
          return;
        }
      }

      // Verifica che l'SDK sia inizializzato correttamente
      if (!sdk || !sdk.stealth) {
        throw new Error("Il modulo stealth non è disponibile");
      }
      
      // Ottieni le chiavi dell'utente per creare un oggetto StealthKeyPair
      const user = sdk.gun.user();
      if (!user || !user.is) {
        throw new Error("Utente non autenticato");
      }
      
      // Accedi alle chiavi dell'utente usando type assertion
      const userSea = (user._ as any).sea;
      if (!userSea) {
        throw new Error("Chiavi dell'utente non disponibili");
      }

      console.log("Tentativi di apertura indirizzo stealth:", {
        indirizzo: stealthToOpen,
        ephemeralKey: ephemeralKeyToOpen && ephemeralKeyToOpen.substring(0, 15) + "..."
      });
      
      // Crea un oggetto StealthKeyPair completo con le chiavi dell'utente
      const userKeyPair: StealthKeyPair = {
        pub: userSea.pub,
        priv: userSea.priv,
        epub: userSea.epub,
        epriv: userSea.epriv
      };
      
      // Mostra le chiavi disponibili (solo parte iniziale per sicurezza)
      console.log("Chiavi disponibili:", {
        pub: userKeyPair.pub && userKeyPair.pub.substring(0, 10) + "...",
        epub: userKeyPair.epub && userKeyPair.epub.substring(0, 10) + "...",
        priv: !!userKeyPair.priv, // Solo conferma che esiste, non mostrare
        epriv: !!userKeyPair.epriv // Solo conferma che esiste, non mostrare
      });
      
      // Tentativo di apertura dell'indirizzo stealth con il keychain
      const result = await sdk.stealth?.openStealthAddress(
        stealthToOpen,
        ephemeralKeyToOpen,
        userKeyPair
      );

      if (!result) {
        throw new Error("Impossibile aprire l'indirizzo stealth");
      }

      console.log("Indirizzo stealth aperto con successo:", {
        indirizzo: result.address,
        privateKey: result.privateKey?.substring(0, 5) + "..." // non mostrare tutta la privateKey per sicurezza
      });

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

  // Funzione per impostare la sezione attiva
  const setSection = (section: string) => {
    setActiveSection(section);
  };

  useEffect(() => {
    // Resetta gli stati specifici di sezione quando cambia la sezione attiva
    if (activeSection === "wallet") {
      setShowSignBox(false);
      setShowSendForm(false);
      setShowReceiveModal(false);
    } else if (activeSection === "stealth") {
      setShowStealthBox(false);
      setShowStealthOpener(false);
    }
  }, [activeSection]);

  // Funzione per inviare una transazione
  const sendTransaction = async () => {
    if (!selectedAddress || !recipientAddress || !amount) {
      setErrorMessage("Inserisci un indirizzo destinatario e un importo valido");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      // Trova il wallet corrispondente all'indirizzo selezionato
      const wallet = derivedWallets.find(w => w.address === selectedAddress)?.wallet;
      if (!wallet) {
        throw new Error("Wallet non trovato");
      }

      // Crea e invia la transazione
      const tx = await sdk.signTransaction(
        wallet,
        recipientAddress,
        ethers.parseEther(amount).toString()
      );

      // Mostra un messaggio di successo
      setErrorMessage(`Transazione inviata con successo: ${tx.substring(0, 20)}...`);
      setTimeout(() => setErrorMessage(""), 5000);

      // Resetta i campi
      setRecipientAddress("");
      setAmount("");
      setShowSendForm(false);

      // Aggiorna il saldo dopo la transazione
      setTimeout(() => {
        updateBalance(selectedAddress);
      }, 2000);
    } catch (error: any) {
      console.error("Errore nell'invio della transazione:", error);
      setErrorMessage(`Errore nell'invio della transazione: ${error.message || String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // Funzioni per gestire l'esportazione
  const handleExportMnemonic = () => {
    setPasswordModalAction("mnemonic");
    setShowPasswordModal(true);
  };
  
  const handleExportWallets = () => {
    setPasswordModalAction("wallets");
    setShowPasswordModal(true);
  };
  
  const handleExportGunPair = () => {
    setPasswordModalAction("gunpair");
    setShowPasswordModal(true);
  };
  
  const handleExportAllData = () => {
    setPasswordModalAction("alldata");
    setShowPasswordModal(true);
  };
  
  // Funzione per eseguire l'esportazione effettiva
  const performExport = async () => {
    if (!sdk) {
      setErrorMessage("SDK non inizializzato");
      return;
    }
    
    try {
      setLoading(true);
      let exportData = "";
      let fileName = "";
      
      switch (passwordModalAction) {
        case "mnemonic":
          exportData = await sdk.exportMnemonic(exportPassword || undefined);
          fileName = "shogun-mnemonic.txt";
          break;
        case "wallets":
          exportData = await sdk.exportWalletKeys(exportPassword || undefined);
          fileName = "shogun-wallets.json";
          break;
        case "gunpair":
          exportData = await sdk.exportGunPair(exportPassword || undefined);
          fileName = "shogun-gunpair.json";
          break;
        case "alldata":
          if (!exportPassword) {
            setErrorMessage("La password è obbligatoria per il backup completo");
            setLoading(false);
            return;
          }
          exportData = await sdk.exportAllUserData(exportPassword);
          fileName = "shogun-backup.json";
          break;
      }
      
      // Crea e scarica il file
      const blob = new Blob([exportData], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setShowPasswordModal(false);
      setExportPassword("");
      setErrorMessage("Esportazione completata con successo");
      setTimeout(() => setErrorMessage(""), 3000);
    } catch (error: any) {
      console.error("Errore durante l'esportazione:", error);
      setErrorMessage(`Errore durante l'esportazione: ${error.message || String(error)}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Modal per la password di esportazione
  const renderPasswordModal = () => {
    if (!showPasswordModal) return null;
    
    let title = "Inserisci Password (opzionale)";
    let description = "Inserisci una password per proteggere i dati esportati. Se non inserisci una password, i dati saranno esportati in chiaro.";
    let isRequired = false;
    
    if (passwordModalAction === "alldata") {
      title = "Inserisci Password";
      description = "Per il backup completo è richiesta una password. Questa password sarà necessaria per ripristinare i dati.";
      isRequired = true;
    }
    
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-75 p-4">
        <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
          <h3 className="text-xl font-bold mb-4">{title}</h3>
          <p className="text-gray-400 mb-4">{description}</p>
          
          <div className="mb-4">
            <input
              type="password"
              className="w-full p-3 bg-gray-700 rounded"
              placeholder={isRequired ? "Password (obbligatoria)" : "Password (opzionale)"}
              value={exportPassword}
              onChange={(e) => setExportPassword(e.target.value)}
            />
          </div>
          
          {isRequired && !exportPassword && (
            <p className="text-red-500 mb-4">La password è obbligatoria</p>
          )}
          
          <div className="flex space-x-4">
            <button
              className="flex-1 p-3 bg-blue-600 rounded hover:bg-blue-700"
              onClick={performExport}
              disabled={isRequired && !exportPassword}
            >
              Esporta
            </button>
            <button
              className="flex-1 p-3 bg-gray-700 rounded hover:bg-gray-600"
              onClick={() => {
                setShowPasswordModal(false);
                setExportPassword("");
              }}
            >
              Annulla
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Funzioni per gestire l'importazione
  const handleImportMnemonic = () => {
    setImportType("mnemonic");
    setShowImportModal(true);
  };
  
  const handleImportWallets = () => {
    setImportType("wallets");
    setShowImportModal(true);
  };
  
  const handleImportGunPair = () => {
    setImportType("gunpair");
    setShowImportModal(true);
  };
  
  const handleImportAllData = () => {
    setImportType("alldata");
    setShowImportModal(true);
  };
  
  // Gestisce il caricamento del file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      setImportFile(selectedFile);
      
      // Log informativo
      console.log(`File selezionato: ${selectedFile.name}, tipo: ${selectedFile.type}, dimensione: ${selectedFile.size} bytes`);
      
      // Verifica che il file non sia troppo grande
      if (selectedFile.size > 5 * 1024 * 1024) { // 5MB
        setErrorMessage("Il file è troppo grande (limite 5MB)");
        return;
      }
      
      // Verifica estensione del file
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
      if (fileExt !== 'json' && fileExt !== 'txt') {
        setErrorMessage("Formato file non supportato. Usa .json o .txt");
        return; // Aggiungiamo un return per evitare di procedere con file non supportati
      }
      
      // Leggi il contenuto del file
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target && event.target.result) {
          // Converti in string e rimuovi BOM e altri caratteri problematici
          let fileContent = event.target.result as string;
          
          // Log la lunghezza del contenuto
          console.log(`Contenuto letto: ${fileContent.length} caratteri`);
          
          // Rimuovi BOM (Byte Order Mark) che può interferire con il parsing JSON
          if (fileContent.charCodeAt(0) === 0xFEFF) {
            console.log("BOM rilevato e rimosso");
            fileContent = fileContent.slice(1);
          }
          
          // Pulizia generale
          fileContent = fileContent.trim();
          
          console.log(`Contenuto letto (primi 100 caratteri): ${fileContent.substring(0, 100)}...`);
          
          // Verifica se è JSON valido
          try {
            if (fileContent.startsWith('{') || fileContent.startsWith('[')) {
              const jsonData = JSON.parse(fileContent);
              console.log("Il file contiene JSON valido", jsonData.type || "Tipo non specificato");
              
              // Log specifico per il tipo di backup
              if (jsonData.type === "encrypted-shogun-backup") {
                console.log("File identificato come backup cifrato Shogun");
              }
            } else {
              console.log("Il contenuto non inizia con { o [, potrebbe non essere JSON");
            }
          } catch (error) {
            console.warn(`Il file non contiene JSON valido: ${error}`);
            // Non bloccare il processo, potrebbe essere una mnemonica o altro testo
          }
          
          setImportData(fileContent);
        }
      };
      
      reader.onerror = (error) => {
        console.error("Errore nella lettura del file:", error);
        setErrorMessage("Errore nella lettura del file");
      };
      
      // Leggi come testo per tutti i tipi di file
      reader.readAsText(selectedFile);
    }
  };
  
  // Esegue l'importazione effettiva
  const performImport = async () => {
    if (!sdk) {
      setErrorMessage("SDK non inizializzato");
      return;
    }
    
    try {
      setLoading(true);
      setErrorMessage(""); // Reset messaggi di errore precedenti
      
      // Verifica se c'è un input diretto o un file
      if (!importData && !importFile) {
        setErrorMessage("Inserisci dati da importare o carica un file");
        setLoading(false);
        return;
      }
      
      console.log(`Inizio importazione tipo: ${importType}, lunghezza dati: ${importData.length}`);
      console.log(`Password fornita: ${importPassword ? "Sì" : "No"}`);
      
      let result: any;
      
      switch (importType) {
        case "mnemonic":
          try {
            result = await sdk.importMnemonic(importData, importPassword || undefined);
            setErrorMessage(result ? "Mnemonica importata con successo" : "Errore nell'importazione della mnemonica");
          } catch (error: any) {
            console.error("Errore nell'importazione della mnemonica:", error);
            setErrorMessage(`Errore nell'importazione della mnemonica: ${error.message}`);
          }
          break;
          
        case "wallets":
          try {
            result = await sdk.importWalletKeys(importData, importPassword || undefined);
            setErrorMessage(`${result} wallet importati con successo`);
          } catch (error: any) {
            console.error("Errore nell'importazione dei wallet:", error);
            setErrorMessage(`Errore nell'importazione dei wallet: ${error.message}`);
          }
          break;
          
        case "gunpair":
          try {
            result = await sdk.importGunPair(importData, importPassword || undefined);
            setErrorMessage(result ? "Pair Gun validato con successo. Effettua logout e login per applicare le modifiche." : "Errore nell'importazione del pair Gun");
          } catch (error: any) {
            console.error("Errore nell'importazione del pair Gun:", error);
            setErrorMessage(`Errore nell'importazione del pair Gun: ${error.message}`);
          }
          break;
          
        case "alldata":
          if (!importPassword) {
            setErrorMessage("La password è obbligatoria per importare il backup completo");
            setLoading(false);
            return;
          }
          
          try {
            console.log("Tentativo di importazione backup completo...");
            result = await sdk.importAllUserData(importData, importPassword);
            
            if (result.success) {
              let message = "Importazione completata con successo: ";
              
              if (result.mnemonicImported) {
                message += "mnemonica, ";
              }
              
              if (result.walletsImported && result.walletsImported > 0) {
                message += `${result.walletsImported} wallet, `;
              }
              
              if (result.gunPairImported) {
                message += "pair Gun (richiede riavvio), ";
              }
              
              setErrorMessage(message.slice(0, -2));
            } else {
              setErrorMessage("Errore nell'importazione del backup: nessun elemento importato");
            }
          } catch (error: any) {
            console.error("Errore nell'importazione del backup:", error);
            setErrorMessage(`Errore durante l'importazione: ${error.message}`);
          }
          break;
          
        default:
          setErrorMessage(`Tipo di importazione non valido: ${importType}`);
      }
      
      // Ricarica i wallet dopo l'importazione
      setTimeout(() => {
        loadWallets();
      }, 1000);
      
      setLoading(false);
      
      // Chiudi il modal solo se non ci sono errori
      if (!errorMessage.includes("Errore")) {
        setShowImportModal(false);
        setImportData("");
        setImportPassword("");
        setImportFile(null);
      }
    } catch (error: any) {
      console.error("Errore durante l'importazione:", error);
      setErrorMessage(`Errore durante l'importazione: ${error.message}`);
      setLoading(false);
    }
  };

  // Modal per l'importazione
  const renderImportModal = () => {
    if (!showImportModal) return null;
    
    let title = "";
    let description = "";
    let formatInfo = "";
    
    // Personalizza il titolo e la descrizione in base al tipo di importazione
    switch (importType) {
      case "mnemonic":
        title = "Importa Mnemonica";
        description = "Inserisci la tua frase mnemonica per recuperare i tuoi wallet.";
        formatInfo = "La mnemonica deve essere composta da 12 o più parole separate da spazi.";
        break;
      case "wallets":
        title = "Importa Wallet";
        description = "Importa uno o più wallet dal backup.";
        formatInfo = "Il file deve contenere un JSON con un array di wallet, ciascuno con un campo 'privateKey'. " +
                    "Formato: { \"wallets\": [{ \"address\": \"0x...\", \"privateKey\": \"0x...\", \"path\": \"m/44'/60'/0'/0/0\" }] }";
        break;
      case "gunpair":
        title = "Importa Pair Gun";
        description = "Importa il pair Gun per accedere ai tuoi dati cifrati.";
        formatInfo = "Il file deve contenere un JSON con i campi 'pub', 'priv', 'epub' e 'epriv'.";
        break;
      case "alldata":
        title = "Importa Backup Completo";
        description = "Importa un backup completo dei tuoi dati (mnemonica, wallet e pair Gun).";
        formatInfo = "Il file deve essere nel formato cifrato esportato da Shogun Wallet. È richiesta la password utilizzata per cifrare il backup.";
        break;
    }
    
    return (
      <div className="modal">
        <div className="modal-content">
          <h2>{title}</h2>
          <p>{description}</p>
          
          <div className="format-info">
            <h4>Formato richiesto:</h4>
            <p>{formatInfo}</p>
          </div>
          
          {/* Area per l'input diretto */}
          <textarea
            placeholder={`Incolla qui i dati da importare${importType === "mnemonic" ? " (12 o più parole)" : " o carica un file"}`}
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            style={{ width: "100%", minHeight: "100px", marginBottom: "10px" }}
          />
          
          {/* Opzione per caricare un file */}
          <div style={{ marginBottom: "10px" }}>
            <button onClick={() => document.getElementById("import-file-input")?.click()}>
              Carica file
            </button>
            <input
              id="import-file-input"
              type="file"
              accept=".json,.txt"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
            {importFile && (
              <span style={{ marginLeft: "10px" }}>
                File selezionato: {importFile.name} ({Math.round(importFile.size / 1024)} KB)
              </span>
            )}
          </div>
          
          {/* Campo password se necessario */}
          {(importType === "alldata" || importType === "mnemonic" || importType === "wallets" || importType === "gunpair") && (
            <div style={{ marginBottom: "10px" }}>
              <label>
                Password (opzionale{importType === "alldata" ? ", ma richiesta per backup cifrati" : ""}):
                <input
                  type="password"
                  value={importPassword}
                  onChange={(e) => setImportPassword(e.target.value)}
                  style={{ width: "100%", marginTop: "5px" }}
                  required={importType === "alldata"}
                />
              </label>
            </div>
          )}
          
          {/* Messaggio di errore */}
          {errorMessage && (
            <div className="error-message" style={{ color: errorMessage.includes("successo") ? "green" : "red", marginBottom: "10px" }}>
              {errorMessage}
            </div>
          )}
          
          {/* Pulsanti */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button onClick={() => {
              setShowImportModal(false);
              setImportData("");
              setImportPassword("");
              setImportFile(null);
              setErrorMessage("");
            }}>
              Annulla
            </button>
            <button onClick={performImport} disabled={loading || (!importData && !importFile)}>
              {loading ? "Importazione in corso..." : "Importa"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <aside className="w-1/4 bg-gray-800 p-4 border-r border-gray-700 flex flex-col">
        <h1 className="text-xl font-bold mb-8">Shogun Wallet</h1>
        
        {/* Menu di navigazione */}
        <nav className="flex flex-col space-y-2 mb-6">
          <button 
            className={`p-3 rounded flex items-center ${
              activeSection === "wallet" ? "bg-blue-600" : "hover:bg-gray-700"
            }`}
            onClick={() => setSection("wallet")}
          >
            <span className="material-icons mr-2">💲</span> 
            Wallet
          </button>
          
          <button 
            className={`p-3 rounded flex items-center ${
              activeSection === "stealth" ? "bg-blue-600" : "hover:bg-gray-700"
            }`}
            onClick={() => setSection("stealth")}
          >
            <span className="material-icons mr-2">🥷</span> 
            Stealth
          </button>
          
          <button 
            className={`p-3 rounded flex items-center ${
              activeSection === "settings" ? "bg-blue-600" : "hover:bg-gray-700"
            }`}
            onClick={() => setSection("settings")}
          >
            <span className="material-icons mr-2">⚙️</span> 
            Impostazioni
          </button>
        </nav>
        
        {/* Wallet list solo nella sezione wallet */}
        {activeSection === "wallet" && (
          <>
            <h2 className="text-md font-semibold mt-4 mb-2">I tuoi wallet</h2>
            <div className="space-y-2 mb-4 overflow-y-auto flex-grow">
              {derivedWallets.map((wallet, index) => (
                <button
                  key={wallet.address}
                  className={`w-full p-2 text-left rounded ${
                    selectedAddress === wallet.address
                      ? "bg-blue-700"
                      : "bg-gray-700"
                  }`}
                  onClick={() => selectAddress(wallet.address)}
                >
                  <div>Wallet {index + 1}</div>
                  <div className="text-xs text-gray-300 truncate">
                    {wallet.address.substring(0, 10)}...{wallet.address.substring(38)}
                  </div>
                </button>
              ))}
            </div>
            <button
              className="w-full mt-2 p-3 bg-blue-600 rounded hover:bg-blue-700"
              onClick={createNewWallet}
            >
              Nuovo Wallet
            </button>
          </>
        )}
        
        {/* Rete selection */}
        <div className="mt-auto">
          <h2 className="text-md font-semibold mb-2">Rete</h2>
          <select
            className="w-full p-2 bg-gray-700 rounded mb-4"
            value={selectedRpc}
            onChange={handleRpcChange}
          >
            {rpcOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
          <button
            className="w-full p-3 bg-red-600 rounded hover:bg-red-700"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 p-6 overflow-y-auto">
        {errorMessage && (
          <div className="w-full bg-red-700 p-3 rounded mb-4">
            {errorMessage}
          </div>
        )}

        {/* Sezione Wallet */}
        {activeSection === "wallet" && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Il tuo wallet</h2>
              {selectedAddress && (
                <div className="bg-gray-800 rounded-lg p-6 mb-4">
                  <div className="mb-2">
                    <div className="text-gray-400 mb-1">Indirizzo</div>
                    <div className="font-mono">{selectedAddress}</div>
                  </div>
                  <div>
                    <div className="text-gray-400 mb-1">Saldo</div>
                    <div className="text-2xl">{senderBalance} ETH</div>
                  </div>
                  <div className="flex space-x-4 mt-4">
                    <button
                      className="flex-1 p-3 bg-blue-600 rounded hover:bg-blue-700"
                      onClick={handleSend}
                    >
                      Invia
                    </button>
                    <button
                      className="flex-1 p-3 bg-blue-600 rounded hover:bg-blue-700"
                      onClick={handleReceive}
                    >
                      Ricevi
                    </button>
                    <button
                      className="flex-1 p-3 bg-blue-600 rounded hover:bg-blue-700"
                      onClick={() => setShowSignBox(true)}
                    >
                      Firma Messaggio
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Form di invio */}
            {showSendForm && (
              <div className="bg-gray-800 rounded-lg p-6 mb-4">
                <h3 className="text-xl font-bold mb-4">Invia ETH</h3>
                <div className="mb-4">
                  <label className="block text-gray-400 mb-2">Destinatario</label>
                  <input
                    className="w-full p-3 bg-gray-700 rounded"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="0x..."
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-400 mb-2">Importo (ETH)</label>
                  <input
                    className="w-full p-3 bg-gray-700 rounded"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    type="number"
                    step="0.0001"
                    placeholder="0.0"
                  />
                </div>
                <div className="flex space-x-4">
                  <button
                    className="flex-1 p-3 bg-blue-600 rounded hover:bg-blue-700"
                    onClick={sendTransaction}
                  >
                    Invia
                  </button>
                  <button
                    className="flex-1 p-3 bg-gray-700 rounded hover:bg-gray-600"
                    onClick={() => setShowSendForm(false)}
                  >
                    Annulla
                  </button>
                </div>
              </div>
            )}
            
            {/* Form di firma */}
            {showSignBox && (
              <div className="bg-gray-800 rounded-lg p-6 mb-4">
                <h3 className="text-xl font-bold mb-4">Firma Messaggio</h3>
                <div className="mb-4">
                  <label className="block text-gray-400 mb-2">Messaggio</label>
                  <textarea
                    className="w-full p-3 bg-gray-700 rounded"
                    value={messageToSign}
                    onChange={(e) => setMessageToSign(e.target.value)}
                    rows={3}
                    placeholder="Scrivi un messaggio da firmare..."
                  />
                </div>
                <div className="mb-4">
                  <button
                    className="w-full p-3 bg-blue-600 rounded hover:bg-blue-700"
                    onClick={signMessage}
                  >
                    Firma
                  </button>
                </div>
                {signedMessage && (
                  <div className="mt-4">
                    <label className="block text-gray-400 mb-2">Firma</label>
                    <div className="p-3 bg-gray-700 rounded break-all font-mono text-xs">
                      {signedMessage}
                    </div>
                  </div>
                )}
                <button
                  className="w-full p-3 bg-gray-700 rounded hover:bg-gray-600 mt-4"
                  onClick={() => setShowSignBox(false)}
                >
                  Chiudi
                </button>
              </div>
            )}
            
            {/* Modal di ricezione */}
            {showReceiveModal && (
              <div className="bg-gray-800 rounded-lg p-6 mb-4">
                <h3 className="text-xl font-bold mb-4">Ricevi ETH</h3>
                <div className="mb-4">
                  <label className="block text-gray-400 mb-2">Il tuo indirizzo</label>
                  <div className="flex">
                    <input
                      className="flex-1 p-3 bg-gray-700 rounded-l"
                      value={selectedAddress || ""}
                      readOnly
                    />
                    <button
                      className="p-3 bg-blue-600 rounded-r"
                      onClick={() => {
                        if (selectedAddress) {
                          navigator.clipboard.writeText(selectedAddress);
                          setErrorMessage("Indirizzo copiato negli appunti!");
                          setTimeout(() => setErrorMessage(""), 3000);
                        }
                      }}
                    >
                      Copia
                    </button>
                  </div>
                </div>
                <button
                  className="w-full p-3 bg-gray-700 rounded hover:bg-gray-600"
                  onClick={() => setShowReceiveModal(false)}
                >
                  Chiudi
                </button>
              </div>
            )}
          </>
        )}
        
        {/* Sezione Stealth */}
        {activeSection === "stealth" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Indirizzi Stealth</h2>
            
            <div className="flex space-x-4 mb-6">
              <button
                className={`flex-1 p-3 rounded ${
                  showStealthBox ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
                }`}
                onClick={() => {
                  setShowStealthBox(true);
                  setShowStealthOpener(false);
                }}
              >
                Genera Indirizzo
              </button>
              <button
                className={`flex-1 p-3 rounded ${
                  showStealthOpener ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
                }`}
                onClick={() => {
                  setShowStealthOpener(true);
                  setShowStealthBox(false);
                }}
              >
                Apri Indirizzo
              </button>
            </div>
            
            {/* Panel per generare un indirizzo stealth */}
            {showStealthBox && (
              <div className="bg-gray-800 rounded-lg p-6 mb-4">
                <h3 className="text-xl font-bold mb-4">Genera un indirizzo stealth</h3>
                <div className="mb-4">
                  <label className="block text-gray-400 mb-2">
                    Chiave pubblica del destinatario
                  </label>
                  <input
                    className="w-full p-3 bg-gray-700 rounded"
                    value={recipientPublicKey}
                    onChange={(e) => setRecipientPublicKey(e.target.value)}
                    placeholder="Inserisci la chiave pubblica del destinatario..."
                  />
                </div>
                <button
                  className="w-full p-3 bg-blue-600 rounded hover:bg-blue-700 mb-4"
                  onClick={generateStealthAddress}
                  disabled={stealthGenerating}
                >
                  {stealthGenerating ? "Generazione in corso..." : "Genera Indirizzo Stealth"}
                </button>
                
                {stealthAddress && (
                  <div className="mt-4">
                    <div className="mb-4">
                      <label className="block text-gray-400 mb-2">Indirizzo Stealth</label>
                      <div className="flex">
                        <input
                          className="flex-1 p-3 bg-gray-700 rounded-l"
                          value={stealthAddress}
                          readOnly
                        />
                        <button
                          className="p-3 bg-blue-600 rounded-r"
                          onClick={() => {
                            navigator.clipboard.writeText(stealthAddress);
                            setErrorMessage("Indirizzo stealth copiato negli appunti!");
                            setTimeout(() => setErrorMessage(""), 3000);
                          }}
                        >
                          Copia
                        </button>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-400 mb-2">Chiave Pubblica Effimera</label>
                      <div className="flex">
                        <input
                          className="flex-1 p-3 bg-gray-700 rounded-l"
                          value={ephemeralPublicKey}
                          readOnly
                        />
                        <button
                          className="p-3 bg-blue-600 rounded-r"
                          onClick={() => {
                            navigator.clipboard.writeText(ephemeralPublicKey);
                            setErrorMessage("Chiave pubblica effimera copiata negli appunti!");
                            setTimeout(() => setErrorMessage(""), 3000);
                          }}
                        >
                          Copia
                        </button>
                      </div>
                    </div>
                    <div className="p-4 bg-yellow-800 rounded mt-4">
                      <p className="font-bold mb-2">Importante:</p>
                      <p>
                        Condividi sia l'indirizzo stealth che la chiave pubblica effimera con il destinatario.
                        Entrambi sono necessari per aprire l'indirizzo stealth.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Panel per aprire un indirizzo stealth */}
            {showStealthOpener && (
              <div className="bg-gray-800 rounded-lg p-6 mb-4">
                <h3 className="text-xl font-bold mb-4">Apri un indirizzo stealth</h3>
                <div className="mb-4">
                  <label className="block text-gray-400 mb-2">Indirizzo Stealth</label>
                  <input
                    className="w-full p-3 bg-gray-700 rounded"
                    value={stealthToOpen}
                    onChange={(e) => setStealthToOpen(e.target.value)}
                    placeholder="0x..."
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-400 mb-2">Chiave Pubblica Effimera</label>
                  <input
                    className="w-full p-3 bg-gray-700 rounded"
                    value={ephemeralKeyToOpen}
                    onChange={(e) => setEphemeralKeyToOpen(e.target.value)}
                    placeholder="Inserisci la chiave pubblica effimera..."
                  />
                </div>
                <button
                  className="w-full p-3 bg-blue-600 rounded hover:bg-blue-700 mb-4"
                  onClick={openStealthAddress}
                  disabled={openingStealthAddress}
                >
                  {openingStealthAddress ? "Apertura in corso..." : "Apri Indirizzo Stealth"}
                </button>
                
                {openedStealthWallet && (
                  <div className="mt-4">
                    <div className="mb-4">
                      <label className="block text-gray-400 mb-2">Chiave Privata Recuperata</label>
                      <div className="p-3 bg-gray-700 rounded break-all font-mono text-xs">
                        {openedStealthWallet.privateKey}
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-gray-400 mb-2">Indirizzo Wallet</label>
                      <div className="p-3 bg-gray-700 rounded font-mono">
                        {openedStealthWallet.address}
                      </div>
                    </div>
                    <div className="p-4 bg-red-800 rounded mt-4">
                      <p className="font-bold mb-2">Attenzione:</p>
                      <p>
                        La chiave privata è visualizzata in chiaro. Assicurati di essere in un ambiente sicuro
                        e di non condividere mai la chiave privata.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="bg-blue-800 rounded-lg p-6 mt-6">
              <h3 className="text-xl font-bold mb-2">Le tue chiavi stealth</h3>
              <div className="mb-4">
                <label className="block text-gray-300 mb-1">Chiave pubblica (pub)</label>
                <div className="p-3 bg-gray-700 rounded break-all font-mono text-xs relative">
                  {userEpub}
                  <button 
                    className="absolute top-2 right-2 p-1 bg-gray-600 rounded hover:bg-gray-500"
                    onClick={() => navigator.clipboard.writeText(userEpub)}
                  >
                    Copia
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Sezione Impostazioni - semplificata senza mnemonic */}
        {activeSection === "settings" && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Impostazioni</h2>
            
            <div className="bg-gray-800 rounded-lg p-6 mb-4">
              <h3 className="text-xl font-bold mb-4">Informazioni Utente</h3>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">Username</label>
                <div className="p-3 bg-gray-700 rounded">
                  {username || "Non disponibile"}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">Chiave Pubblica</label>
                <div className="p-3 bg-gray-700 rounded break-all font-mono text-xs">
                  {userpub || "Non disponibile"}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">Metodo di Autenticazione</label>
                <div className="p-3 bg-gray-700 rounded">
                  Standard
                </div>
              </div>
            </div>
            
            {/* Sezione Esportazione e Ripristino */}
            <div className="bg-gray-800 rounded-lg p-6 mb-4">
              <h3 className="text-xl font-bold mb-4">Esportazione Dati</h3>
              <p className="text-gray-400 mb-4">
                Esporta i tuoi dati per backup o migrazione. Nota che l'esportazione di chiavi private è rischiosa.
                Assicurati di proteggere sempre i tuoi dati con una password forte.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <button
                  className="p-4 bg-blue-600 hover:bg-blue-700 rounded flex items-center justify-center"
                  onClick={handleExportMnemonic}
                >
                  <span className="material-icons mr-2">description</span>
                  Esporta Mnemonica
                </button>
                
                <button
                  className="p-4 bg-blue-600 hover:bg-blue-700 rounded flex items-center justify-center"
                  onClick={handleExportWallets}
                >
                  <span className="material-icons mr-2">vpn_key</span>
                  Esporta Wallet Keys
                </button>
                
                <button
                  className="p-4 bg-blue-600 hover:bg-blue-700 rounded flex items-center justify-center"
                  onClick={handleExportGunPair}
                >
                  <span className="material-icons mr-2">security</span>
                  Esporta Gun Pair
                </button>
                
                <button
                  className="p-4 bg-purple-600 hover:bg-purple-700 rounded flex items-center justify-center"
                  onClick={handleExportAllData}
                >
                  <span className="material-icons mr-2">backup</span>
                  Backup Completo
                </button>
              </div>
              
              <div className="p-4 bg-yellow-800 bg-opacity-30 rounded">
                <p className="text-yellow-300 text-sm">
                  <span className="material-icons align-text-bottom mr-1 text-sm">warning</span>
                  Attenzione: Le chiavi private e la mnemonica permettono l'accesso completo ai tuoi wallet.
                  Non condividere mai questi dati e conservali in modo sicuro.
                </p>
              </div>
            </div>
            
            {/* Nuova Sezione Ripristino */}
            <div className="bg-gray-800 rounded-lg p-6 mb-4">
              <h3 className="text-xl font-bold mb-4">Ripristino Dati</h3>
              <p className="text-gray-400 mb-4">
                Ripristina i tuoi dati da un backup precedente. Puoi importare una mnemonica, 
                chiavi wallet, pair Gun o un backup completo.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <button
                  className="p-4 bg-green-600 hover:bg-green-700 rounded flex items-center justify-center"
                  onClick={handleImportMnemonic}
                >
                  <span className="material-icons mr-2">settings_backup_restore</span>
                  Importa Mnemonica
                </button>
                
                <button
                  className="p-4 bg-green-600 hover:bg-green-700 rounded flex items-center justify-center"
                  onClick={handleImportWallets}
                >
                  <span className="material-icons mr-2">vpn_key</span>
                  Importa Wallet Keys
                </button>
                
                <button
                  className="p-4 bg-green-600 hover:bg-green-700 rounded flex items-center justify-center"
                  onClick={handleImportGunPair}
                >
                  <span className="material-icons mr-2">security</span>
                  Importa Gun Pair
                </button>
                
                <button
                  className="p-4 bg-green-600 hover:bg-green-700 rounded flex items-center justify-center"
                  onClick={handleImportAllData}
                >
                  <span className="material-icons mr-2">restore</span>
                  Ripristina Backup
                </button>
              </div>
              
              <div className="p-4 bg-blue-800 bg-opacity-30 rounded">
                <p className="text-blue-300 text-sm">
                  <span className="material-icons align-text-bottom mr-1 text-sm">info</span>
                  Suggerimento: Per ripristinare un backup completo, avrai bisogno della password
                  utilizzata durante l'esportazione. Dopo il ripristino del Gun Pair, effettua logout e login.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Modal di login se non autenticato */}
      {showLoginModal && (
        <ShogunLoginModal
          onLoginSuccess={handleLoginSuccess}
          onSignupSuccess={handleSignupSuccess}
        />
      )}
      
      {/* Aggiungi il modal per la password */}
      {renderPasswordModal()}
      
      {/* Aggiungi il modal per l'importazione */}
      {renderImportModal()}
    </div>
  );
};

export default App;
