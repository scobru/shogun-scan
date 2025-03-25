import React, { useState, useEffect, useRef } from "react";
import {
  shogunConnector,
  ShogunButtonProvider,
  ShogunButton,
} from "shogun-button-react";
import Sidebar from "./components/Sidebar";
import { rpcOptions } from "./constants";
import { WalletInfo, AuthMethod, StealthKeyPair } from "./types";
import "./App.css";
import { ethers } from "ethers";
import { TokenService } from "./services/TokenService";
import { TokenManager } from "./components/TokenManager";
import StealthSection from "./components/StealthSection";

// Modifica la configurazione per utilizzare il provider locale
const connectorConfig = {
  appName: "Shogun Wallet",
  appDescription: "Un wallet Layer2 per GunDB",
  appUrl: "http://localhost:5173",
  providerUrl: "https://gun-relay.scobrudot.dev/gun", // Uso provider locale Hardhat
  peers: ["https://gun-relay.scobrudot.dev/gun"],
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
      options: {},
    };
  }
};

export const { sdk, options } = initShogunSDK();
export const gun = sdk ? sdk.gun : null;

// Funzione helper per verificare se l'SDK è disponibile
const withSdk = <T,>(callback: (sdk: any) => T, fallback: T): T => {
  if (!sdk) {
    console.error("SDK non disponibile");
    return fallback;
  }
  return callback(sdk);
};

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
  const [generatingStealthAddress, setGeneratingStealthAddress] =
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
  const [importType, setImportType] = useState<
    "mnemonic" | "wallets" | "gunpair" | "alldata"
  >("mnemonic");
  const [importData, setImportData] = useState<string>("");
  const [importPassword, setImportPassword] = useState<string>("");
  const [importFile, setImportFile] = useState<File | null>(null);

  // Stato per modali
  const [showTransactionModal, setShowTransactionModal] =
    useState<boolean>(false);
  const [showSignMessageModal, setShowSignMessageModal] =
    useState<boolean>(false);
  const [showMnemonicModal, setShowMnemonicModal] = useState<boolean>(false);
  const [generatedMnemonic, setGeneratedMnemonic] = useState<string>("");

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
      const walletsToSave = wallets.map((wallet) => ({
        address: wallet.address,
        path: wallet.path || "legacy", // Uso legacy come fallback se path non esiste
        privateKey: wallet.wallet?.privateKey || undefined,
      }));

      localStorage.setItem("shogun_wallets", JSON.stringify(walletsToSave));
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
      setErrorMessage("");

      if (!sdk) {
        setErrorMessage("SDK non inizializzato");
        setLoading(false);
        return;
      }

      // Utilizziamo il nuovo metodo loadWallets dell'SDK
      const wallets = await sdk.loadWallets();

      if (wallets && wallets.length > 0) {
        const walletInfos = wallets.map((walletInfo, index) => ({
          wallet: walletInfo.wallet,
          path: `m/44'/60'/0'/0/${index}`,
          address: walletInfo.wallet.address,
          getAddressString: () => walletInfo.wallet.address,
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

      if (!sdk) {
        setErrorMessage("SDK non inizializzato");
        setLoading(false);
        return null;
      }

      // Verifica se l'utente è autenticato
      if (!sdk.isLoggedIn()) {
        throw new Error(
          "Utente non autenticato. Effettua il login per creare un wallet."
        );
      }

      // fetch id

      // Utilizziamo il nuovo metodo createWallet dell'SDK
      const newWalletInfo = await sdk?.createWallet();

      // Crea un oggetto wallet compatibile con l'app
      const walletInfo: WalletInfo = {
        wallet: newWalletInfo?.wallet,
        path: newWalletInfo?.path || "",
        address: newWalletInfo?.address || "",
        getAddressString: newWalletInfo?.getAddressString || (() => ""),
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
      setErrorMessage(
        "Errore durante la creazione del wallet: " + error.message
      );
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
    try {
      // Verifico se l'utente è autenticato
      if (sdk && !sdk.isLoggedIn()) {
        console.log(
          "Utente non autenticato, tentativo di ripristino sessione..."
        );

        // Tenta di riautenticare con le credenziali fornite
        if (data.password) {
          console.log("Tentativo di riautenticazione con password...");

          // Riautenticazione manuale
          if (sdk) {
            const loginResult = await sdk.login(data.username, data.password);

            if (!loginResult.success) {
              throw new Error(
                "Impossibile riautenticare l'utente dopo la registrazione"
              );
            }
          }
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
      throw new Error(
        "Errore durante la riautenticazione dopo la registrazione"
      );
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
    if (sdk && sdk.isLoggedIn()) {
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
    if (gun) {
      try {
        gun.user().leave();
        console.log("Logout Gun completato");
      } catch (error) {
        console.error("Errore durante il logout Gun:", error);
      }
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

  // Opzioni RPC
  /* const rpcOptions = [
    { value: "mainnet", label: "Ethereum Mainnet", url: "https://eth-mainnet.g.alchemy.com/v2/yjhjIoJ3o_at8ALT7nCJtFtjdqFpiBdx" },
    { value: "sepolia", label: "Sepolia Testnet", url: "https://eth-sepolia.g.alchemy.com/v2/yjhjIoJ3o_at8ALT7nCJtFtjdqFpiBdx" },
    { value: "optimism_sepolia", label: "Optimism Sepolia Testnet", url: "https://opt-sepolia.g.alchemy.com/v2/yjhjIoJ3o_at8ALT7nCJtFtjdqFpiBdx" }
  ];
 */
  // Inizializza il provider all'avvio dell'app
  useEffect(() => {
    try {
      const rpcData = rpcOptions.find((opt) => opt.value === selectedRpc);
      console.log(rpcData);

      if (!rpcData || !rpcData.url) {
        throw new Error(`URL RPC non trovato per la rete: ${selectedRpc}`);
      }

      // Crea un nuovo provider con l'URL pubblico
      const newProvider = new ethers.JsonRpcProvider(rpcData.url);
      setProvider(newProvider);
      console.log(
        `Provider inizializzato per la rete: ${selectedRpc} (${rpcData.url})`
      );

      // Aggiorna il provider anche nel MOMClient - RIMUOVI O MODIFICA QUESTA PARTE
      if (sdk) {
        try {
          // RIMUOVI o COMMENTA questa riga che genera l'errore
          // sdk.setProvider(newProvider);

          // Invece, puoi fare questo solo se l'SDK ha un'interfaccia per modificare il provider
          // ad esempio, se esistono metodi specifici per aggiornare i componenti che usano il provider
          if (
            sdk.metamask &&
            typeof sdk.metamask.setCustomProvider === "function"
          ) {
            // Ottieni la chiave privata dal wallet selezionato
            const selectedWallet = derivedWallets.find(
              (w) => w.address === selectedAddress
            );
            const privateKey = selectedWallet?.wallet?.privateKey || "";

            if (privateKey) {
              sdk.metamask.setCustomProvider(rpcData.url, privateKey);
              console.log("Provider MetaMask aggiornato con successo");
            } else {
              console.log(
                "Nessuna chiave privata disponibile per aggiornare MetaMask"
              );
            }
          }

          console.log("Provider aggiornato dove possibile");
        } catch (providerError) {
          console.error(
            "Errore nell'aggiornamento del provider:",
            providerError
          );
          // Continuiamo anche se questo fallisce
        }
      }

      // Trova il wallet corrispondente all'indirizzo selezionato
      let walletPrivateKey = "";
      if (selectedAddress) {
        const selectedWallet = derivedWallets.find(
          (w) => w.address === selectedAddress
        );
        if (selectedWallet && selectedWallet.wallet) {
          walletPrivateKey = selectedWallet.wallet.privateKey;
        }
      }

      // Passa l'URL e la chiave privata al connector MetaMask
      if (sdk?.metamask && walletPrivateKey) {
        try {
          sdk.metamask.setCustomProvider(rpcData.url, walletPrivateKey);
        } catch (error) {
          console.error(
            "Errore nell'impostazione del provider per MetaMask:",
            error
          );
          // Continuiamo l'esecuzione anche se fallisce questo passaggio
        }
      }

      // Se c'è un indirizzo selezionato, aggiorna il saldo
      if (selectedAddress) {
        updateBalance(selectedAddress, newProvider);
      }
    } catch (error) {
      console.error("Errore nell'inizializzazione del provider:", error);
    }
  }, [selectedRpc, selectedAddress, derivedWallets]);

  // Aggiorna il saldo quando cambiano provider o indirizzo selezionato
  useEffect(() => {
    if (selectedAddress && provider) {
      updateBalance(selectedAddress);
    }
  }, [selectedAddress, provider]);

  useEffect(() => {
    if (gun?.user()._) {
      const userSea = (gun.user()._ as any).sea;
      setUserEpub(userSea?.epub || "");
    }
  }, [userpub]);

  // Funzione per firmare un messaggio
  const signMessage = async () => {
    try {
      if (!selectedAddress || !messageToSign) {
        setErrorMessage(
          "Seleziona un indirizzo e inserisci un messaggio da firmare"
        );
        return;
      }

      const selectedWallet = derivedWallets.find(
        (w) => w.address === selectedAddress
      );

      if (!selectedWallet) {
        setErrorMessage("Wallet non trovato");
        return;
      }

      // Usa withSdk per gestire in sicurezza l'SDK
      const signature = await withSdk(
        async (s) => s.signMessage(selectedWallet.wallet, messageToSign),
        null
      );

      if (!signature) {
        throw new Error("Errore durante la firma del messaggio");
      }

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

    // Mostra il modal di ricezione
    setShowReceiveModal(true);
    setActiveAction("receive");
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
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

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
      const address = await handleMetaMaskConnect();
      if (!address) return;

      setLoading(true);
      setErrorMessage("");

      const result = await withSdk(async (s) => s.loginWithMetaMask(address), {
        success: false,
        error: "SDK non disponibile",
      });

      if (result.success) {
        setUserpub(result.userPub || "");
        setUsername(`metamask_${address}`);
        setSignedIn(true);
        await loadWallets();
        localStorage.setItem("userPub", result.userPub || "");
        localStorage.setItem("username", `metamask_${address}`);
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
    return withSdk((s) => s.isWebAuthnSupported(), false);
  };

  // Funzione per la registrazione con WebAuthn
  const handleWebAuthnSignUp = async () => {
    try {
      if (!sdk) {
        throw new Error("SDK non inizializzato");
      }

      if (!sdk.isWebAuthnSupported()) {
        throw new Error("WebAuthn non è supportato dal tuo browser");
      }

      const username = prompt(
        "Inserisci il tuo username per registrarti con WebAuthn:"
      );

      if (!username) {
        throw new Error("Username richiesto per registrazione WebAuthn");
      }

      setLoading(true);

      // Verifica che l'SDK supporti il metodo registerWithWebAuthn o signUpWithWebAuthn
      const registerMethod =
        "signUpWithWebAuthn" in sdk
          ? "signUpWithWebAuthn"
          : "registerWithWebAuthn";

      if (!(registerMethod in sdk)) {
        throw new Error(
          "Il metodo di registrazione WebAuthn non è disponibile nell'SDK"
        );
      }

      // Registra l'utente con WebAuthn usando il metodo appropriato
      const result = await (sdk as any)[registerMethod](username);

      if (result.success) {
        // Salva i dati dell'utente
        handleSignupSuccess({
          userPub: result.userPub || "",
          username,
          authMethod: "webauthn",
        });
      } else {
        throw new Error(result.error || "Registrazione con WebAuthn fallita");
      }
    } catch (error: any) {
      console.error("Errore durante la registrazione WebAuthn:", error);
      handleAuthError(
        error.message || "Errore sconosciuto durante la registrazione WebAuthn"
      );
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

      const result = await withSdk(async (s) => s.loginWithWebAuthn(username), {
        success: false,
        error: "SDK non disponibile",
      });

      if (result.success) {
        setUserpub(result.userPub || "");
        setUsername(username);
        setSignedIn(true);
        await loadWallets();
        localStorage.setItem("userPub", result.userPub || "");
        localStorage.setItem("username", username);
        if (result.credentialId) {
          localStorage.setItem("credentialId", result.credentialId);
        }
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
              const devices = Object.entries(credentials.credentials).map(
                ([id, info]: [string, any]) => ({
                  id,
                  name: info.name || "Dispositivo sconosciuto",
                  platform: info.platform || "Piattaforma sconosciuta",
                  timestamp: info.timestamp || Date.now(),
                })
              );

              setWebauthnDevices(devices);
            } else {
              setWebauthnDevices([]);
            }
          } catch (parseError) {
            console.error(
              "Errore durante il parsing delle credenziali WebAuthn:",
              parseError
            );
            setWebauthnDevices([]);
          }
        } else {
          setWebauthnDevices([]);
        }
      } catch (error) {
        console.error(
          "Errore durante il caricamento dei dispositivi WebAuthn:",
          error
        );
        setWebauthnDevices([]);
      }
    }
  };

  // Funzione per generare un indirizzo stealth
  const generateStealthAddress = async () => {
    setGeneratingStealthAddress(true);

    try {
      // Ottieni il wallet dell'utente
      if (!sdk) {
        throw new Error("SDK non inizializzato");
      }

      const user = sdk.gun.user().recall({ sessionStorage: true }).is;
      if (!user || !user.pub) {
        throw new Error("Utente non autenticato");
      }

      let result = null;

      // Chiedi con chi vuoi comunicare
      const recipientPublicKey = prompt(
        "Inserisci la chiave pubblica del destinatario:"
      );

      if (!recipientPublicKey) {
        throw new Error("Nessuna chiave pubblica fornita");
      }

      if (!sdk.stealth) {
        throw new Error("Modulo stealth non disponibile nell'SDK");
      }

      try {
        const useSimplified = window.confirm(
          "Usare modalità stealth semplificata?"
        );

        if (useSimplified) {
          // result = await sdk.stealth?.generateSimpleStealthAddress(recipientPublicKey);
          // Usiamo il metodo standard anche in modalità semplificata
          if (sdk.stealth) {
            result =
              await sdk.stealth.generateStealthAddress(recipientPublicKey);
          }
        } else {
          // Usa il metodo standard
          if (sdk.stealth) {
            result =
              await sdk.stealth.generateStealthAddress(recipientPublicKey);
          }
        }
      } catch (error: any) {
        console.error(
          "Errore nella generazione dell'indirizzo stealth:",
          error
        );
        throw new Error(`Errore nella generazione: ${error.message}`);
      }

      // ... resto del codice ...
    } catch (error) {
      // ... resto del codice ...
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
          if (!privateKey.startsWith("0x")) {
            privateKey = "0x" + privateKey;
          }

          // Crea il wallet
          const wallet = new ethers.Wallet(privateKey);
          console.log("Wallet creato da chiave privata:", wallet.address);

          // Verifica se l'indirizzo del wallet corrisponde all'indirizzo stealth
          if (wallet.address.toLowerCase() === stealthToOpen.toLowerCase()) {
            console.log("SUCCESSO con chiave privata fornita manualmente!");
            setOpenedStealthWallet(wallet);
            setErrorMessage(
              "Indirizzo stealth aperto con successo tramite chiave privata!"
            );
            setPrivateKeyOverride(""); // Pulisci il campo per sicurezza
            setTimeout(() => setErrorMessage(""), 3000);
            setOpeningStealthAddress(false);
            return;
          } else {
            console.log(
              "La chiave privata fornita non corrisponde all'indirizzo stealth"
            );
            setErrorMessage(
              "La chiave privata fornita non genera l'indirizzo stealth richiesto"
            );
            setOpeningStealthAddress(false);
            return;
          }
        } catch (e) {
          console.error(
            "Errore nell'utilizzo della chiave privata diretta:",
            e
          );
          setErrorMessage(
            "Chiave privata non valida. Verifica il formato e riprova."
          );
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
        ephemeralKey:
          ephemeralKeyToOpen && ephemeralKeyToOpen.substring(0, 15) + "...",
      });

      // Crea un oggetto StealthKeyPair completo con le chiavi dell'utente
      const userKeyPair: StealthKeyPair = {
        pub: userSea.pub,
        priv: userSea.priv,
        epub: userSea.epub,
        epriv: userSea.epriv,
      };

      // Mostra le chiavi disponibili (solo parte iniziale per sicurezza)
      console.log("Chiavi disponibili:", {
        pub: userKeyPair.pub && userKeyPair.pub.substring(0, 10) + "...",
        epub: userKeyPair.epub && userKeyPair.epub.substring(0, 10) + "...",
        priv: !!userKeyPair.priv, // Solo conferma che esiste, non mostrare
        epriv: !!userKeyPair.epriv, // Solo conferma che esiste, non mostrare
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
        privateKey: result.privateKey?.substring(0, 5) + "...", // non mostrare tutta la privateKey per sicurezza
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

      console.log(
        "Utente non autenticato, tentativo di ripristino sessione..."
      );

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
      console.error(
        "Errore durante il controllo/recupero dell'autenticazione:",
        error
      );
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
            localStorage.setItem(
              `webauthn_${username}`,
              JSON.stringify(credentials)
            );

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
        console.error(
          "Errore durante il parsing delle credenziali WebAuthn:",
          parseError
        );
        setErrorMessage("Errore durante il parsing delle credenziali");
        return false;
      }
    } catch (error: any) {
      console.error(
        "Errore durante la rimozione del dispositivo WebAuthn:",
        error
      );
      setErrorMessage(`Errore: ${error.message}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Funzione per cambiare sezione
  const setSection = (section: string) => {
    setActiveSection(section);

    // Se stiamo cambiando sezione, chiudi qualsiasi azione attiva
    if (activeAction) {
      setActiveAction(null);
      setShowSendForm(false);
      setShowSignBox(false);
      setShowStealthBox(false);
      setShowStealthOpener(false);
    }
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
      setErrorMessage(
        "Inserisci un indirizzo destinatario e un importo valido"
      );
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      // Trova il wallet corrispondente all'indirizzo selezionato
      const wallet = derivedWallets.find(
        (w) => w.address === selectedAddress
      )?.wallet;
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
      setErrorMessage(
        `Transazione inviata con successo: ${tx.substring(0, 20)}...`
      );
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
      setErrorMessage(
        `Errore nell'invio della transazione: ${error.message || String(error)}`
      );
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
            setErrorMessage(
              "La password è obbligatoria per il backup completo"
            );
            setLoading(false);
            return;
          }
          exportData = await sdk.exportAllUserData(exportPassword);
          fileName = "shogun-backup.json";
          break;
      }

      // Crea e scarica il file
      const blob = new Blob([exportData], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
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
      setErrorMessage(
        `Errore durante l'esportazione: ${error.message || String(error)}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Modal per la password di esportazione
  const renderPasswordModal = () => {
    if (!showPasswordModal) return null;

    let title = "Inserisci Password (opzionale)";
    let description =
      "Inserisci una password per proteggere i dati esportati. Se non inserisci una password, i dati saranno esportati in chiaro.";
    let isRequired = false;

    if (passwordModalAction === "alldata") {
      title = "Inserisci Password";
      description =
        "Per il backup completo è richiesta una password. Questa password sarà necessaria per ripristinare i dati.";
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
              placeholder={
                isRequired ? "Password (obbligatoria)" : "Password (opzionale)"
              }
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
      console.log(
        `File selezionato: ${selectedFile.name}, tipo: ${selectedFile.type}, dimensione: ${selectedFile.size} bytes`
      );

      // Verifica che il file non sia troppo grande
      if (selectedFile.size > 5 * 1024 * 1024) {
        // 5MB
        setErrorMessage("Il file è troppo grande (limite 5MB)");
        return;
      }

      // Verifica estensione del file
      const fileExt = selectedFile.name.split(".").pop()?.toLowerCase();
      if (fileExt !== "json" && fileExt !== "txt") {
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
          if (fileContent.charCodeAt(0) === 0xfeff) {
            console.log("BOM rilevato e rimosso");
            fileContent = fileContent.slice(1);
          }

          // Pulizia generale
          fileContent = fileContent.trim();

          console.log(
            `Contenuto letto (primi 100 caratteri): ${fileContent.substring(0, 100)}...`
          );

          // Verifica se è JSON valido
          try {
            if (fileContent.startsWith("{") || fileContent.startsWith("[")) {
              const jsonData = JSON.parse(fileContent);
              console.log(
                "Il file contiene JSON valido",
                jsonData.type || "Tipo non specificato"
              );

              // Log specifico per il tipo di backup
              if (jsonData.type === "encrypted-shogun-backup") {
                console.log("File identificato come backup cifrato Shogun");
              }
            } else {
              console.log(
                "Il contenuto non inizia con { o [, potrebbe non essere JSON"
              );
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

      console.log(
        `Inizio importazione tipo: ${importType}, lunghezza dati: ${importData.length}`
      );
      console.log(`Password fornita: ${importPassword ? "Sì" : "No"}`);

      let result: any;

      switch (importType) {
        case "mnemonic":
          try {
            result = await sdk.importMnemonic(
              importData,
              importPassword || undefined
            );
            setErrorMessage(
              result
                ? "Mnemonica importata con successo"
                : "Errore nell'importazione della mnemonica"
            );
          } catch (error: any) {
            console.error("Errore nell'importazione della mnemonica:", error);
            setErrorMessage(
              `Errore nell'importazione della mnemonica: ${error.message}`
            );
          }
          break;

        case "wallets":
          try {
            result = await sdk.importWalletKeys(
              importData,
              importPassword || undefined
            );
            setErrorMessage(`${result} wallet importati con successo`);
          } catch (error: any) {
            console.error("Errore nell'importazione dei wallet:", error);
            setErrorMessage(
              `Errore nell'importazione dei wallet: ${error.message}`
            );
          }
          break;

        case "gunpair":
          try {
            result = await sdk.importGunPair(
              importData,
              importPassword || undefined
            );
            setErrorMessage(
              result
                ? "Pair Gun validato con successo. Effettua logout e login per applicare le modifiche."
                : "Errore nell'importazione del pair Gun"
            );
          } catch (error: any) {
            console.error("Errore nell'importazione del pair Gun:", error);
            setErrorMessage(
              `Errore nell'importazione del pair Gun: ${error.message}`
            );
          }
          break;

        case "alldata":
          if (!importPassword) {
            setErrorMessage(
              "La password è obbligatoria per importare il backup completo"
            );
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
              setErrorMessage(
                "Errore nell'importazione del backup: nessun elemento importato"
              );
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
        description =
          "Inserisci la tua frase mnemonica per recuperare i tuoi wallet.";
        formatInfo =
          "La mnemonica deve essere composta da 12 o più parole separate da spazi.";
        break;
      case "wallets":
        title = "Importa Wallet";
        description = "Importa uno o più wallet dal backup.";
        formatInfo =
          "Il file deve contenere un JSON con un array di wallet, ciascuno con un campo 'privateKey'. " +
          'Formato: { "wallets": [{ "address": "0x...", "privateKey": "0x...", "path": "m/44\'/60\'/0\'/0/0" }] }';
        break;
      case "gunpair":
        title = "Importa Pair Gun";
        description = "Importa il pair Gun per accedere ai tuoi dati cifrati.";
        formatInfo =
          "Il file deve contenere un JSON con i campi 'pub', 'priv', 'epub' e 'epriv'.";
        break;
      case "alldata":
        title = "Importa Backup Completo";
        description =
          "Importa un backup completo dei tuoi dati (mnemonica, wallet e pair Gun).";
        formatInfo =
          "Il file deve essere nel formato cifrato esportato da Shogun Wallet. È richiesta la password utilizzata per cifrare il backup.";
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
            <button
              onClick={() =>
                document.getElementById("import-file-input")?.click()
              }
            >
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
                File selezionato: {importFile.name} (
                {Math.round(importFile.size / 1024)} KB)
              </span>
            )}
          </div>

          {/* Campo password se necessario */}
          {(importType === "alldata" ||
            importType === "mnemonic" ||
            importType === "wallets" ||
            importType === "gunpair") && (
            <div style={{ marginBottom: "10px" }}>
              <label>
                Password (opzionale
                {importType === "alldata"
                  ? ", ma richiesta per backup cifrati"
                  : ""}
                ):
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
            <div
              className="error-message"
              style={{
                color: errorMessage.includes("successo") ? "green" : "red",
                marginBottom: "10px",
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Pulsanti */}
          <div
            style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}
          >
            <button
              onClick={() => {
                setShowImportModal(false);
                setImportData("");
                setImportPassword("");
                setImportFile(null);
                setErrorMessage("");
              }}
            >
              Annulla
            </button>
            <button
              onClick={performImport}
              disabled={loading || (!importData && !importFile)}
            >
              {loading ? "Importazione in corso..." : "Importa"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Renderizza la sezione principale in base alla sezione attiva
  const renderMainContent = () => {
    // Se non è autenticato, mostra il login
    if (!signedIn || !sdk) {
      return renderLogin();
    }
    
    // Ottieni il wallet selezionato
    const selectedWallet = derivedWallets.find(
      (w) => w.address === selectedAddress
    );

    switch (activeSection) {
      case "wallet":
        return (
          <div className="p-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold mb-2">Il tuo wallet</h2>
              {/* Pulsanti di azione */}
            </div>

            <div className="mt-4 bg-gray-800 rounded-lg p-4">
              <p className="text-center text-gray-400">
                {selectedWallet ? (
                  <span>
                    Indirizzo:{" "}
                    <span className="text-white">{selectedWallet.address}</span>
                  </span>
                ) : (
                  "Seleziona un wallet dalla sidebar per visualizzare i dettagli."
                )}
              </p>
            </div>

            {/* Aggiungi il TokenManager qui */}
            {selectedAddress && provider && (
              <div className="mt-4">
                <TokenManager
                  address={selectedAddress}
                  provider={provider}
                  networkId={selectedRpc} // Passa la rete selezionata
                  privateKey={derivedWallets.find(w => w.address === selectedAddress)?.wallet?.privateKey || ""}
                />
              </div>
            )}
          </div>
        );
      case "stealth":
        return (
          <StealthSection
            sdk={sdk}
            userEpub={userEpub}
            setErrorMessage={setErrorMessage}
          />
        );
      case "settings":
        return (
          <div className="p-6 flex-grow overflow-auto">
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
                <label className="block text-gray-400 mb-2">
                  Chiave Pubblica
                </label>
                <div className="p-3 bg-gray-700 rounded break-all font-mono text-xs">
                  {userpub || "Non disponibile"}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-gray-400 mb-2">
                  Metodo di Autenticazione
                </label>
                <div className="p-3 bg-gray-700 rounded">Standard</div>
              </div>
            </div>

            {/* Sezione Esportazione */}
            <div className="bg-gray-800 rounded-lg p-6 mb-4">
              <h3 className="text-xl font-bold mb-4">Esportazione Dati</h3>
              <p className="text-gray-400 mb-4">
                Esporta i tuoi dati per backup o migrazione. Nota che
                l'esportazione di chiavi private è rischiosa. Assicurati di
                proteggere sempre i tuoi dati con una password forte.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <button
                  className="p-4 bg-blue-600 hover:bg-blue-700 rounded flex items-center justify-center"
                  onClick={handleExportMnemonic}
                >
                  <span className="mr-2">📄</span>
                  Esporta Mnemonica
                </button>

                <button
                  className="p-4 bg-blue-600 hover:bg-blue-700 rounded flex items-center justify-center"
                  onClick={handleExportWallets}
                >
                  <span className="mr-2">🔑</span>
                  Esporta Wallet Keys
                </button>

                <button
                  className="p-4 bg-blue-600 hover:bg-blue-700 rounded flex items-center justify-center"
                  onClick={handleExportGunPair}
                >
                  <span className="mr-2">🔒</span>
                  Esporta Gun Pair
                </button>

                <button
                  className="p-4 bg-purple-600 hover:bg-purple-700 rounded flex items-center justify-center"
                  onClick={handleExportAllData}
                >
                  <span className="mr-2">💾</span>
                  Backup Completo
                </button>
              </div>

              <div className="p-4 bg-yellow-800 bg-opacity-30 rounded">
                <p className="text-yellow-300 text-sm">
                  <span className="mr-1 text-sm">⚠️</span>
                  Attenzione: Le chiavi private e la mnemonica permettono
                  l'accesso completo ai tuoi wallet. Non condividere mai questi
                  dati e conservali in modo sicuro.
                </p>
              </div>
            </div>

            {/* Sezione Generazione Mnemonica */}
            <div className="bg-gray-800 rounded-lg p-6 mb-4">
              <h3 className="text-xl font-bold mb-4">Generazione Mnemonica</h3>
              <p className="text-gray-400 mb-4">
                Genera una nuova mnemonica BIP-39 compatibile con MetaMask e
                altri wallet. La mnemonica generata può essere salvata in GunDB
                per il recupero futuro.
              </p>

              <div className="flex flex-col mb-4">
                <button
                  className="p-4 bg-indigo-600 hover:bg-indigo-700 rounded flex items-center justify-center"
                  onClick={handleGenerateNewMnemonic}
                >
                  <span className="mr-2">🔐</span>
                  Genera Nuova Mnemonica
                </button>
              </div>

              <div className="p-4 bg-blue-800 bg-opacity-30 rounded">
                <p className="text-blue-300 text-sm">
                  <span className="mr-1 text-sm">ℹ️</span>
                  La nuova mnemonica generata sarà conforme allo standard BIP-39
                  e compatibile con tutti i wallet che supportano questo
                  standard, come MetaMask. Salva sempre la mnemonica in un luogo
                  sicuro.
                </p>
              </div>
            </div>

            {/* Sezione Ripristino */}
            <div className="bg-gray-800 rounded-lg p-6 mb-4">
              <h3 className="text-xl font-bold mb-4">Ripristino Dati</h3>
              <p className="text-gray-400 mb-4">
                Ripristina i tuoi dati da un backup precedente. Puoi importare
                una mnemonica, chiavi wallet, pair Gun o un backup completo.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <button
                  className="p-4 bg-green-600 hover:bg-green-700 rounded flex items-center justify-center"
                  onClick={handleImportMnemonic}
                >
                  <span className="mr-2">🔄</span>
                  Importa Mnemonica
                </button>

                <button
                  className="p-4 bg-green-600 hover:bg-green-700 rounded flex items-center justify-center"
                  onClick={handleImportWallets}
                >
                  <span className="mr-2">🔑</span>
                  Importa Wallet Keys
                </button>

                <button
                  className="p-4 bg-green-600 hover:bg-green-700 rounded flex items-center justify-center"
                  onClick={handleImportGunPair}
                >
                  <span className="mr-2">🔒</span>
                  Importa Gun Pair
                </button>

                <button
                  className="p-4 bg-green-600 hover:bg-green-700 rounded flex items-center justify-center"
                  onClick={handleImportAllData}
                >
                  <span className="mr-2">📥</span>
                  Ripristina Backup
                </button>
              </div>

              <div className="p-4 bg-blue-800 bg-opacity-30 rounded">
                <p className="text-blue-300 text-sm">
                  <span className="mr-1 text-sm">ℹ️</span>
                  Suggerimento: Per ripristinare un backup completo, avrai
                  bisogno della password utilizzata durante l'esportazione. Dopo
                  il ripristino del Gun Pair, effettua logout e login.
                </p>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="text-center text-gray-400 py-8">
            Sezione non disponibile.
          </div>
        );
    }
  };

  // Inizializza il provider RPC
  const initializeRpc = async (network: string = selectedRpc) => {
    try {
      // Trova l'URL RPC per la rete selezionata
      const rpcData = rpcOptions.find((opt) => opt.value === network);

      if (!rpcData) {
        console.error(`URL RPC non trovato per la rete: ${network}`);
        throw new Error(`URL RPC non trovato per la rete: ${network}`);
      }

      // Crea un nuovo provider con l'URL pubblico
      const newProvider = new ethers.JsonRpcProvider(rpcData.url);
      setProvider(newProvider);
      console.log(
        `Provider inizializzato per la rete: ${network} (${rpcData.url})`
      );

      // Aggiorna il provider nell'SDK se disponibile
      if (sdk) {
        try {
          // Aggiorniamo il provider in modo generico nell'SDK
          // Se non esiste setProvider, utilizziamo un approccio alternativo
          if (typeof sdk.setProvider === "function") {
            sdk.setProvider(newProvider);
          } else {
            // Fallback per la vecchia versione dell'SDK
            console.log(
              "setProvider non disponibile, applico l'aggiornamento tramite approccio alternativo"
            );

            // Aggiorniamo direttamente il provider dove possibile
            if (sdk.metamask && sdk.getMainWallet()?.privateKey) {
              const wallet = sdk.getMainWallet();
              if (wallet) {
                console.log("Aggiornamento provider per wallet");
              }
            }
          }
          console.log("Provider aggiornato nell'SDK");
        } catch (sdkError) {
          console.error(
            "Errore nell'aggiornamento del provider nell'SDK:",
            sdkError
          );
        }
      } else {
        console.warn(
          "SDK non inizializzato, impossibile aggiornare il provider"
        );
      }

      return newProvider;
    } catch (error: any) {
      console.error("Errore nell'inizializzazione del provider RPC:", error);
      setErrorMessage(
        `Errore nell'inizializzazione del provider RPC: ${error.message}`
      );
      return null;
    }
  };

  const initTokenService = (provider: ethers.JsonRpcProvider) => {
    // Usa il servizio importato a livello superiore
    return new TokenService(provider);
  };

  // All'interno del componente App
  useEffect(() => {
    // Verifica lo stato di autenticazione all'avvio dell'app
    const checkAuth = async () => {
      try {
        console.log("Verifica dello stato di login...");

        if (!sdk) {
          console.error("SDK non inizializzato");
          setSignedIn(false);
          return;
        }

        if (sdk.isLoggedIn()) {
          console.log("Sessione utente trovata");
          const user = sdk.gundb.gun.user();
          if (user && user.is) {
            setSignedIn(true);
            setUserpub(user.is.pub);
            // Carica i wallet dopo aver verificato l'autenticazione
            await loadWallets();
          }
        } else {
          console.log("Nessuna sessione utente trovata, necessario login");
          setSignedIn(false);
        }
      } catch (error) {
        console.error("Errore nella verifica dell'autenticazione:", error);
        setSignedIn(false);
      }
    };

    if (sdkInitialized) {
      checkAuth();
    }
  }, [sdkInitialized]);

  // Funzione per verificare se l'SDK è disponibile prima di usarlo
  const withSdk = (callback: (sdk: any) => any, fallback: any = null) => {
    if (sdk) {
      return callback(sdk);
    }
    console.error("SDK non disponibile");
    return fallback;
  };

  // Funzione per verificare se Gun è disponibile prima di usarlo
  const withGun = (callback: (gun: any) => any, fallback: any = null) => {
    if (gun) {
      return callback(gun);
    }
    console.error("Gun non disponibile");
    return fallback;
  };

  // Modifica nelle funzioni che usano sdk e gun

  // Per evitare errori di tipo con ShogunButton
  const ShogunButtonSafe = ShogunButton as any;

  // Verifica se l'utente è autenticato
  const isUserAuthenticated = () => signedIn;

  const handleGenerateNewMnemonic = () => {
    if (!sdk) {
      setErrorMessage("SDK non inizializzato");
      return;
    }

    try {
      let newMnemonic;

      // Verifica se il metodo esiste nell'SDK
      if (typeof sdk.generateNewMnemonic === "function") {
        newMnemonic = sdk.generateNewMnemonic();
      } else {
        // Alternativa utilizzando ethers.js se il metodo non esiste nell'SDK
        console.log(
          "[ShogunApp] Metodo generateNewMnemonic non trovato nell'SDK, utilizzo alternativa con ethers.js"
        );
        newMnemonic = ethers.Wallet.createRandom().mnemonic?.phrase || "";
      }

      // Salva la mnemonica in GunDB per utilizzo futuro
      if (sdk?.gun) {
        // Salviamo la mnemonica in GunDB cifrata
        sdk.gun
          .user()
          .get("masterMnemonic")
          .put(newMnemonic, (ack: any) => {
            if (ack.err) {
              console.error(
                "[ShogunApp] Errore nel salvare la mnemonica in GunDB:",
                ack.err
              );
            } else {
              console.log(
                "[ShogunApp] Mnemonica salvata con successo in GunDB"
              );
            }
          });
      }

      setGeneratedMnemonic(newMnemonic);
      setShowMnemonicModal(true);
      console.log("[ShogunApp] Nuova mnemonica generata con successo");
      setErrorMessage("Mnemonica generata con successo e salvata nel database");
      setTimeout(() => setErrorMessage(""), 3000);
    } catch (error) {
      console.error(
        "[ShogunApp] Errore durante la generazione della mnemonica:",
        error
      );
      setErrorMessage("Errore durante la generazione della mnemonica");
    }
  };

  // Funzione per copiare la mnemonica negli appunti
  const copyMnemonicToClipboard = () => {
    if (generatedMnemonic) {
      navigator.clipboard
        .writeText(generatedMnemonic)
        .then(() => {
          setErrorMessage("Mnemonica copiata negli appunti!");
          setTimeout(() => setErrorMessage(""), 3000);
        })
        .catch((err) => {
          console.error("Errore durante la copia negli appunti:", err);
          setErrorMessage("Impossibile copiare negli appunti");
        });
    }
  };

  // Funzione per importare la mnemonica generata
  const importGeneratedMnemonic = () => {
    if (!generatedMnemonic) return;

    // Chiudiamo il modale
    setShowMnemonicModal(false);

    // Utilizziamo la funzione di importazione esistente
    setImportType("mnemonic");
    setImportData(generatedMnemonic);
    setShowImportModal(true);
  };

  // Componente modale per visualizzare la mnemonica generata
  const renderMnemonicModal = () => {
    if (!showMnemonicModal) return null;

    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-75 p-4">
        <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
          <h3 className="text-xl font-bold mb-4">Nuova Mnemonica Generata</h3>
          <p className="text-gray-400 mb-4">
            Questa mnemonica è la chiave per accedere ai tuoi fondi. Non
            condividerla mai con nessuno e conservala in un luogo sicuro.
          </p>

          <div className="mb-4 p-4 bg-gray-700 rounded font-mono text-sm break-words">
            {generatedMnemonic}
          </div>

          <div className="p-4 bg-red-800 bg-opacity-30 rounded mb-4 text-sm">
            <p className="text-red-300">
              <strong>ATTENZIONE:</strong> Se perdi questa mnemonica, perderai
              l'accesso ai tuoi fondi. Scrivila e conservala in un luogo sicuro.
            </p>
          </div>

          <div className="flex space-x-4">
            <button
              className="flex-1 p-3 bg-blue-600 rounded hover:bg-blue-700"
              onClick={copyMnemonicToClipboard}
            >
              Copia negli Appunti
            </button>
            <button
              className="flex-1 p-3 bg-green-600 rounded hover:bg-green-700"
              onClick={importGeneratedMnemonic}
            >
              Importa
            </button>
            <button
              className="flex-1 p-3 bg-gray-700 rounded hover:bg-gray-600"
              onClick={() => setShowMnemonicModal(false)}
            >
              Chiudi
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Funzione per rendere la schermata di login
  const renderLogin = () => {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-full">
        {!sdkInitialized ? (
          <div className="text-center bg-red-900 p-6 rounded-lg max-w-lg">
            <h2 className="text-xl font-bold mb-4">
              Errore di inizializzazione
            </h2>
            <p className="mb-4">
              {errorMessage ||
                "Impossibile inizializzare l'SDK Shogun. Ricarica la pagina o verifica la tua connessione."}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded text-white"
            >
              Riprova
            </button>
          </div>
        ) : (
          <>
            {sdk ? (
              <ShogunButtonProvider
                sdk={sdk}
                options={{
                  appName: "Shogun Wallet",
                  appDescription: "Il tuo wallet per la blockchain",
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
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex">
      {signedIn ? (
        <>
          <Sidebar
            selectedRpc={selectedRpc}
            onRpcChange={handleRpcChange}
            wallets={derivedWallets}
            selectedAddress={selectedAddress || ""}
            onSelectAddress={selectAddress}
            onCreateWallet={createNewWallet}
            onLogout={logout}
            activeSection={activeSection}
            onSectionChange={setSection}
          />
          <div className="flex-grow flex flex-col min-h-screen">
            {renderMainContent()}
          </div>
        </>
      ) : (
        renderLogin()
      )}

      {/* Modal per le password */}
      {renderPasswordModal()}

      {/* Modal per l'importazione */}
      {renderImportModal()}

      {/* Modal per la mnemonica generata */}
      {renderMnemonicModal()}
    </div>
  );
};

export default App;
