import React, { useState, useEffect } from "react";
import Button from "./components/Button";
import Sidebar from "./components/Sidebar";
import LoginWithShogunReact from "./components/LoginWithShogunReact";
import { messages, rpcOptions } from "./constants";
import { WalletInfo } from "./types";
import "./App.css";
import { ShogunSDK } from "shogun-sdk";
import { ethers } from "ethers";

export const shogunSDK = new ShogunSDK({
  peers: ["http://localhost:8765/gun"]
});

export const gun = shogunSDK.gun;

const App: React.FC = () => {
  // Stati per l'autenticazione
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [userpub, setUserpub] = useState<string>("");
  const [username, setUsername] = useState<string>("");

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

  // Funzione per gestire il successo del login
  const handleLoginSuccess = async (data: {
    userPub: string;
    username: string;
    password?: string;
    wallet?: any;
    authMethod?:
      | "standard"
      | "metamask_direct"
      | "metamask_saved"
      | "metamask_signup"
      | "standard_signup"
      | "webauthn";
  }) => {
    console.log("Login effettuato con successo:", data);
    setUserpub(data.userPub);
    setUsername(data.username);
    setSignedIn(true);


    // Salva l'username per future sessioni
    localStorage.setItem("shogun_username", data.username);

    // Carica i wallet
    await loadWallets();
  };

  // Funzione per gestire il successo della registrazione
  const handleSignupSuccess = async (data: {
    userPub: string;
    username: string;
    password?: string;
    wallet?: any;
    authMethod?:
      | "standard"
      | "metamask_direct"
      | "metamask_saved"
      | "metamask_signup"
      | "standard_signup"
      | "webauthn";
  }) => {
    console.log("Registrazione completata con successo:", data);
    setUserpub(data.userPub);
    setUsername(data.username);
    setSignedIn(true);

    // Salva l'username per future sessioni
    localStorage.setItem("shogun_username", data.username);

    // Carica i wallet
    await loadWallets();
  };

  // Funzione per gestire gli errori di autenticazione
  const handleAuthError = (error: string) => {
    console.error("Errore di autenticazione:", error);
    setErrorMessage(error);
  };

  // Funzione di logout
  const logout = () => {
    const resetState = () => {
      setUsername("");
      setDerivedWallets([]);
      setSelectedAddress(null);
      setMessageToSign("");
      setSignedMessage("");
      setGunPublicKey("");
      setUserpub("");
      setSignedIn(false);
    };

    // Utilizziamo direttamente gun.user().leave() per il logout
    shogunSDK.gun.user().leave();
    shogunSDK.gundb.logout();
    resetState();
  };

  // Funzioni per i wallet
  const loadWallets = async () => {
    try {
      // Effettua recall della sessione prima di caricare i wallet
      shogunSDK.gun.user().recall({ sessionStorage: true });

      // Aggiungi un breve ritardo
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Carica i wallet derivati utilizzando il mainWallet e i percorsi salvati
      const mainWallet = shogunSDK.getMainWallet();
      if (!mainWallet) {
        console.error("Wallet principale non disponibile");
        return;
      }

      // Ottieni la chiave pubblica dell'utente
      const user = shogunSDK.gun.user().is;
      if (!user || !user.pub) {
        console.error("Chiave pubblica non disponibile");
        return;
      }

      // Ottieni i percorsi di derivazione salvati
      const paths = await shogunSDK.getWalletPaths(user.pub);
      if (!paths || paths.length === 0) {
        setDerivedWallets([]);
        return;
      }

      // Crea un array di wallet derivati
      const wallets = [];
      for (let i = 0; i < paths.length; i++) {
        try {
          const wallet = await shogunSDK.deriveWallet(user.pub, i);
          wallets.push({
            wallet: wallet,
            path: paths[i],
            address: wallet.address,
            getAddressString: () => wallet.address,
          });
        } catch (error) {
          console.error(`Errore nella derivazione del wallet ${i}:`, error);
        }
      }

      setDerivedWallets(wallets);
    } catch (error: any) {
      console.error("Errore nel caricamento dei wallet:", error);
    }
  };

  // Modifica la funzione createNewWallet per garantire l'autenticazione
  const createNewWallet = async () => {
    setLoading(true);
    try {
      // Accedi direttamente a shogunSDK per la gestione dei wallet
      // Esegui recall sulla sessione per assicurarti che l'utente sia autenticato
      shogunSDK.gun.user().recall({ sessionStorage: true });

      // Aggiungi un breve ritardo per dare tempo al recall di funzionare
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Ottieni la chiave pubblica dell'utente
      const user = shogunSDK.gun.user().is;
      if (!user || !user.pub) {
        throw new Error("Chiave pubblica non disponibile");
      }

      console.log("Creazione wallet con chiave pubblica:", user.pub);

      // Deriva un nuovo wallet all'indice successivo
      const newIndex = derivedWallets.length;
      const newWallet = await shogunSDK.deriveWallet(user.pub, newIndex);

      // Aggiorna l'elenco dei wallet
      await loadWallets();
    } catch (error: any) {
      console.error("Errore nella creazione del wallet:", error);
      setErrorMessage("Errore nella creazione del wallet: " + error.message);
    } finally {
      setLoading(false);
    }
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

  // Funzione per aggiornare il saldo
  const updateBalance = async (
    address: string,
    providerToUse: any = provider
  ) => {
    if (!address || !providerToUse) return;

    try {
      setSenderBalance("Caricamento...");
      const balance = await providerToUse.getBalance(address);
      const formattedBalance = ethers.formatEther(balance);
      setSenderBalance(formattedBalance);
    } catch (error) {
      console.error("Errore nel recupero del saldo:", error);
      setSenderBalance("Errore");
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
    if (!selectedAddress || !messageToSign) return;

    setLoading(true);
    try {
      const signature = await shogunSDK.signMessage(
        selectedAddress,
        messageToSign
      );
      setSignedMessage(signature);
      setErrorMessage("");
    } catch (error: any) {
      console.error("Errore durante la firma:", error);
      setErrorMessage("Errore durante la firma: " + error.message);
    } finally {
      setLoading(false);
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
        const user = shogunSDK.gun.user().recall({ sessionStorage: true });

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
                shogunSDK.gundb.gun.get("users").get(user.is.pub).once(resolve);
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

  // Aggiungi questi gestori per MetaMask
  const handleMetaMaskConnect = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const result = await shogunSDK.connectMetaMask();
      if (result.success) {
        setMetamaskAddress(result.address || "");
        setIsMetaMaskConnected(true);
        setUsername(result.username || "");
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "Errore nella connessione a MetaMask");
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMaskLogin = async () => {
    if (!isMetaMaskConnected || !metamaskAddress) {
      setErrorMessage("Connetti prima MetaMask");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const result = await shogunSDK.handleMetaMaskLogin(metamaskAddress, {
        setUserpub,
        setSignedIn,
      });

      if (result.success) {
        await loadWallets();
      } else {
        setErrorMessage(result.error);
      }
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "Errore nel login con MetaMask");
    } finally {
      setLoading(false);
    }
  };

  // Funzione per verificare il supporto WebAuthn
  const checkWebAuthnSupport = () => {
    setIsWebAuthnSupported(shogunSDK.isWebAuthnSupported());
  };

  // Funzione handleWebAuthnSignUp aggiornata
  const handleWebAuthnSignUp = async () => {
    if (!username) {
      setErrorMessage(messages.empty);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const result = await shogunSDK.handleWebAuthnSignUp(username, {
        setUserpub,
        setSignedIn,
      });

      if (result.success) {
        await loadWallets();
      } else {
        setErrorMessage(result.error);
      }
    } catch (error: any) {
      console.error("Errore nella registrazione con WebAuthn:", error);
      setErrorMessage(
        error.message || "Errore nella registrazione con WebAuthn"
      );
    } finally {
      setLoading(false);
    }
  };

  // Funzione handleWebAuthnLogin aggiornata
  const handleWebAuthnLogin = async () => {
    if (!username) {
      setErrorMessage(messages.empty);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const result = await shogunSDK.handleWebAuthnLogin(username, {
        setUserpub,
        setSignedIn,
      });

      if (result.success) {
        await loadWallets();
      } else {
        setErrorMessage(result.error);
      }
    } catch (error: any) {
      console.error("Errore nell'autenticazione con WebAuthn:", error);
      setErrorMessage(
        error.message || "Errore nell'autenticazione con WebAuthn"
      );
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
      const devices = await shogunSDK.getWebAuthnDevices(username);
      setWebauthnDevices(devices);
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
      const user = shogunSDK.gun.user().recall({ sessionStorage: true }).is;
      if (!user || !user.pub) {
        throw new Error("Utente non autenticato");
      }

      // Ottieni la chiave pubblica dell'utente
      const senderPublicKey = user.epub || user.pub;

      // Genera l'indirizzo stealth usando l'SDK
      const result = await shogunSDK.stealth?.generateStealthAddress(
        senderPublicKey,
        recipientPublicKey
      );

      if (!result) {
        throw new Error("Errore nella generazione dell'indirizzo stealth");
      }

      // Salva i risultati
      setStealthAddress(result.stealthAddress);
      setEphemeralPublicKey(result.ephemeralPublicKey);
      setStealthWallet(result.wallet);

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
      // Ottieni il wallet stealth usando l'SDK
      const wallet = await shogunSDK.stealth?.openStealthAddress(
        stealthToOpen,
        ephemeralKeyToOpen
      );

      if (!wallet) {
        throw new Error("Impossibile aprire l'indirizzo stealth");
      }

      setOpenedStealthWallet(wallet);
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

  // Modifica la funzione checkGunState per usare shogunSDK invece di user
  const checkGunState = () => {
    console.log("=== VERIFICA STATO GUN ===");

    try {
      // Verifica se l'utente è autenticato usando shogunSDK invece di user
      const gunUser = shogunSDK.gun.user();
      if (!gunUser.is) {
        console.error("Utente Gun non autenticato!");
        return;
      }

      console.log("Utente Gun:", gunUser.is);

      // Verifica i percorsi di Gun usando shogunSDK
      shogunSDK.gun
        .user()
        .get("friends")
        .once((data: any) => {
          console.log("Percorso amici:", data);
        });

      // Verifica i percorsi di Gun per gli inviti
      shogunSDK.gun
        .user()
        .get("friendRequests")
        .once((data: any) => {
          console.log("Percorso richieste amicizia:", data);
        });
    } catch (error) {
      console.error("Errore nella verifica dello stato Gun:", error);
    }
  };

  // Correggi questa funzione per usare shogunSDK invece di lonewolfGun e authentication
  const ensureAuthenticated = async () => {
    try {
      // Verifica se l'utente è già autenticato
      const gunUser = shogunSDK.gun.user();
      if (gunUser.is) {
        return true;
      }

      console.log(
        "Utente non autenticato, tentativo di ripristino sessione..."
      );

      // Tenta di recuperare la sessione
      shogunSDK.gun.user().recall({ sessionStorage: true });

      // Attendi per dare tempo al recall di funzionare
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verifica nuovamente
      if (shogunSDK.gun.user().is) {
        console.log("Sessione ripristinata con successo");
        return true;
      }

      // Fallback al login manuale usando shogunSDK
      const savedUsername = localStorage.getItem("shogun_username");
      if (savedUsername) {
        try {
          console.log("Tentativo di riautenticazione automatica fallito");
          return false;
        } catch (error) {
          console.error("Fallimento nella riautenticazione:", error);
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error("Errore durante la verifica dell'autenticazione:", error);
      return false;
    }
  };

  // Funzione per verificare lo stato di Hedgehog
  const checkHedgehogState = () => {
    try {
      // Sostituisci isLoggedIn con un controllo alternativo
      const isLoggedIn = shogunSDK.getMainWallet() !== null;
      console.log("Stato login Hedgehog:", isLoggedIn);

      if (isLoggedIn) {
        const wallet = shogunSDK.getMainWallet();
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

  return (
    <div className="min-h-screen flex">
      {signedIn ? (
        <div className="flex w-full h-screen">
          <Sidebar
            selectedRpc={selectedRpc}
            handleRpcChange={handleRpcChange}
            logout={logout}
            rpcOptions={rpcOptions}
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
          <div className="flex-1 p-6 overflow-y-auto">
            {activeSection === "wallet" ? (
              <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
                <div className="bg-card rounded-xl p-6 mb-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">I tuoi Wallet</h2>
                    <Button
                      onClick={createNewWallet}
                      loading={loading}
                      text="+ Nuovo Wallet"
                      small
                    />
                  </div>

                  <div className="flex flex-col gap-4">
                    {/* Menu a discesa per i wallet */}
                    <div className="relative">
                      <select
                        className="w-full p-4 bg-[#1a1a1a] border border-white/10 rounded-xl text-white appearance-none cursor-pointer focus:border-primary outline-none text-base"
                        value={selectedAddress || ""}
                        onChange={(e) => selectAddress(e.target.value)}
                      >
                        <option value="" className="bg-[#1a1a1a]">
                          Seleziona un wallet
                        </option>
                        {derivedWallets.map((walletInfo, index) => (
                          <option
                            key={index}
                            value={walletInfo.getAddressString()}
                            className="bg-[#1a1a1a] py-2"
                          >
                            Wallet {index + 1} •{" "}
                            {walletInfo.getAddressString().slice(0, 6)}...
                            {walletInfo.getAddressString().slice(-4)}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <svg
                          className="w-4 h-4 text-white/50"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Dettagli wallet selezionato */}
                    {selectedAddress && (
                      <div className="flex flex-col gap-4">
                        <div className="bg-white/5 rounded-xl p-4">
                          <div className="font-mono text-sm text-secondary mb-2">
                            Indirizzo completo:
                          </div>
                          <div className="font-mono text-sm break-all bg-black/20 p-2 rounded">
                            {selectedAddress}
                          </div>
                          <div className="mt-4">
                            <div className="text-gray-400 text-sm mb-1">
                              Saldo:
                            </div>
                            <div className="text-xl font-bold">
                              {senderBalance
                                ? `${senderBalance} ETH`
                                : "Caricamento..."}
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                              onClick={handleSend}
                              text="Invia"
                              small
                              className={
                                activeAction === "send" ? "bg-secondary" : ""
                              }
                            />
                            <Button
                              onClick={handleReceive}
                              text="Ricevi"
                              small
                            />
                            <Button
                              onClick={() =>
                                setActiveAction(
                                  activeAction === "sign" ? null : "sign"
                                )
                              }
                              text="Firma Messaggio"
                              small
                              className={
                                activeAction === "sign" ? "bg-secondary" : ""
                              }
                            />
                          </div>
                        </div>

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
                                <div className="text-sm text-gray-400 mb-1">
                                  Firma:
                                </div>
                                <div className="font-mono text-sm break-all bg-black/20 p-2 rounded">
                                  {signedMessage}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : activeSection === "stealth" ? (
              <div className="bg-card rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-6">
                  Transazione Stealth
                </h2>

                {/* Tabs per Generare/Aprire */}
                <div className="flex mb-6 bg-black/20 rounded-xl p-1">
                  <button
                    className={`flex-1 py-2 rounded-lg ${
                      !showStealthOpener ? "bg-white/10" : ""
                    }`}
                    onClick={() => setShowStealthOpener(false)}
                  >
                    Genera Indirizzo
                  </button>
                  <button
                    className={`flex-1 py-2 rounded-lg ${
                      showStealthOpener ? "bg-white/10" : ""
                    }`}
                    onClick={() => setShowStealthOpener(true)}
                  >
                    Apri Indirizzo
                  </button>
                </div>

                {!showStealthOpener ? (
                  // Generazione indirizzo stealth
                  <div className="flex flex-col gap-4 max-w-xl mx-auto">
                    <input
                      className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-primary outline-none"
                      placeholder="Chiave pubblica del destinatario"
                      value={recipientPublicKey}
                      onChange={(e) => setRecipientPublicKey(e.target.value)}
                    />
                    <Button
                      onClick={generateStealthAddress}
                      loading={stealthGenerating}
                      text="Genera Indirizzo Stealth"
                      fullWidth
                    />

                    {stealthAddress && (
                      <div className="mt-4 p-4 rounded-lg bg-white/5">
                        <div className="mb-2">
                          <div className="text-sm text-gray-400 mb-1">
                            Indirizzo Stealth:
                          </div>
                          <div className="font-mono text-sm break-all bg-black/20 p-2 rounded">
                            {stealthAddress}
                          </div>
                        </div>
                        <div className="mb-2">
                          <div className="text-sm text-gray-400 mb-1">
                            Chiave Pubblica Effimera:
                          </div>
                          <div className="font-mono text-sm break-all bg-black/20 p-2 rounded">
                            {ephemeralPublicKey}
                          </div>
                        </div>
                        <Button
                          onClick={() => {
                            navigator.clipboard.writeText(stealthAddress);
                            setErrorMessage("Indirizzo stealth copiato!");
                            setTimeout(() => setErrorMessage(""), 2000);
                          }}
                          text="Copia Indirizzo"
                          small
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  // Apertura indirizzo stealth
                  <div className="flex flex-col gap-4 max-w-xl mx-auto">
                    <input
                      className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-primary outline-none"
                      placeholder="Indirizzo Stealth da aprire"
                      value={stealthToOpen}
                      onChange={(e) => setStealthToOpen(e.target.value)}
                    />
                    <input
                      className="w-full p-3 bg-black/20 border border-white/10 rounded-lg text-white focus:border-primary outline-none"
                      placeholder="Chiave pubblica effimera"
                      value={ephemeralKeyToOpen}
                      onChange={(e) => setEphemeralKeyToOpen(e.target.value)}
                    />
                    <Button
                      onClick={openStealthAddress}
                      loading={openingStealthAddress}
                      text="Apri Indirizzo Stealth"
                      fullWidth
                    />

                    {openedStealthWallet && (
                      <div className="mt-4 p-4 rounded-lg bg-white/5">
                        <div className="mb-2">
                          <div className="text-sm text-gray-400 mb-1">
                            Indirizzo:
                          </div>
                          <div className="font-mono text-sm break-all bg-black/20 p-2 rounded">
                            {openedStealthWallet.address}
                          </div>
                        </div>
                        <div className="mb-2">
                          <div className="text-sm text-gray-400 mb-1">
                            Chiave Privata:
                          </div>
                          <div className="font-mono text-sm break-all bg-black/20 p-2 rounded">
                            {openedStealthWallet.privateKey}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                openedStealthWallet.address
                              );
                              setErrorMessage("Indirizzo copiato!");
                              setTimeout(() => setErrorMessage(""), 2000);
                            }}
                            text="Copia Indirizzo"
                            small
                          />
                          <Button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                openedStealthWallet.privateKey
                              );
                              setErrorMessage("Chiave privata copiata!");
                              setTimeout(() => setErrorMessage(""), 2000);
                            }}
                            text="Copia Chiave Privata"
                            small
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : activeSection === "messages" ? (
              <div className="bg-card rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-6">Messaggi</h2>
                <div className="text-center text-gray-400">
                  Funzionalità di messaggistica in arrivo...
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-6">Il tuo Profilo</h2>
                <div className="flex flex-col gap-6 max-w-xl mx-auto">
                  <div className="bg-white/5 rounded-xl p-6">
                    <div className="flex flex-col gap-4">
                      <div>
                        <div className="text-sm text-gray-400 mb-1">
                          Username:
                        </div>
                        <div className="text-lg font-medium">{username}</div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-400 mb-1">
                          Chiave Pubblica:
                        </div>
                        <div className="font-mono text-sm break-all bg-black/20 p-2 rounded flex items-center justify-between">
                          <span>{userpub || "Chiave non disponibile"}</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(userpub);
                              setErrorMessage("Chiave copiata!");
                              setTimeout(() => setErrorMessage(""), 2000);
                            }}
                            className="ml-2 p-2 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            📋
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-400 mb-1">
                          Wallet Collegati:
                        </div>
                        <div className="text-lg font-medium">
                          {derivedWallets.length}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="bg-error/10 border border-error/20 text-error text-sm rounded-lg p-3 text-center mt-4">
                {errorMessage}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-screen w-full flex justify-center items-center p-4 bg-gradient-radial from-[#1a1a1a] to-background">
          <LoginWithShogunReact
            sdk={shogunSDK}
            onLoginSuccess={handleLoginSuccess}
            onSignupSuccess={handleSignupSuccess}
            onError={handleAuthError}
            showMetamask={true}
            showWebauthn={true}
          />
        </div>
      )}
    </div>
  );
};

export default App;
