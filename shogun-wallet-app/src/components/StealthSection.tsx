import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { StealthKeyPair } from '../types';

interface StealthSectionProps {
  sdk: any;
  userEpub: string;
  setErrorMessage: (message: string) => void;
}

const StealthSection: React.FC<StealthSectionProps> = ({ sdk, userEpub, setErrorMessage }) => {
  // Stati per generazione indirizzo stealth
  const [recipientPublicKey, setRecipientPublicKey] = useState<string>("");
  const [stealthAddress, setStealthAddress] = useState<string>("");
  const [ephemeralPublicKey, setEphemeralPublicKey] = useState<string>("");
  const [stealthWallet, setStealthWallet] = useState<any>(null);
  const [generatingStealthAddress, setGeneratingStealthAddress] = useState<boolean>(false);

  // Stati per apertura indirizzo stealth
  const [stealthToOpen, setStealthToOpen] = useState<string>("");
  const [ephemeralKeyToOpen, setEphemeralKeyToOpen] = useState<string>("");
  const [privateKeyOverride, setPrivateKeyOverride] = useState<string>("");
  const [openedStealthWallet, setOpenedStealthWallet] = useState<any>(null);
  const [openingStealthAddress, setOpeningStealthAddress] = useState<boolean>(false);

  // Stati per la visualizzazione
  const [showStealthBox, setShowStealthBox] = useState<boolean>(true);
  const [showStealthOpener, setShowStealthOpener] = useState<boolean>(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [stealthHistory, setStealthHistory] = useState<any[]>([]);

  // Carica lo storico degli indirizzi stealth dal localStorage
  useEffect(() => {
    try {
      const storedHistory = localStorage.getItem("stealthHistory");
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory)) {
          setStealthHistory(parsedHistory);
          console.log("[ShogunApp] Caricati", parsedHistory.length, "indirizzi stealth dallo storico");
        }
      }
    } catch (e) {
      console.error("[ShogunApp] Errore nel caricamento dello storico stealth:", e);
    }
  }, []);

  // Funzione per usare un indirizzo stealth dallo storico
  const useStealthFromHistory = (item: any) => {
    if (showStealthOpener) {
      // Se siamo nella sezione di apertura, compila i campi
      setStealthToOpen(item.address);
      setEphemeralKeyToOpen(item.ephemeralKey);
    } else {
      // Altrimenti, passa alla sezione di apertura
      setShowStealthOpener(true);
      setShowStealthBox(false);
      
      // Compila i campi con un piccolo ritardo per assicurarsi che il componente sia renderizzato
      setTimeout(() => {
        setStealthToOpen(item.address);
        setEphemeralKeyToOpen(item.ephemeralKey);
      }, 100);
    }
  };

  // Funzione per eliminare un indirizzo dallo storico
  const removeFromHistory = (address: string) => {
    const newHistory = stealthHistory.filter(item => item.address !== address);
    setStealthHistory(newHistory);
    localStorage.setItem("stealthHistory", JSON.stringify(newHistory));
    console.log("[ShogunApp] Indirizzo", address, "rimosso dallo storico");
  };

  // Funzione per generare un indirizzo stealth
  const generateStealthAddress = async () => {
    if (!recipientPublicKey) {
      setErrorMessage("Inserisci la chiave pubblica del destinatario");
      return;
    }

    setGeneratingStealthAddress(true);
    setErrorMessage("");
    
    try {
      // Verifica che l'SDK sia inizializzato
      if (!sdk) {
        throw new Error("SDK non inizializzato");
      }
      
      // Verifica che l'utente sia autenticato
      const user = sdk.gun.user().recall({ sessionStorage: true }).is;
      if (!user || !user.pub) {
        throw new Error("Utente non autenticato");
      }
      
      // Verifica che il modulo stealth sia disponibile
      if (!sdk.stealth) {
        throw new Error("Modulo stealth non disponibile nell'SDK");
      }
      
      console.log("[ShogunApp] Generazione indirizzo stealth per:", recipientPublicKey.substring(0, 10) + "...");
      
      // Genera l'indirizzo stealth
      const result = await sdk.stealth.generateStealthAddress(recipientPublicKey);
      
      if (!result) {
        throw new Error("Impossibile generare l'indirizzo stealth");
      }
      
      console.log("[ShogunApp] Risposta SDK:", result);
      console.log("[ShogunApp] Proprietà disponibili:", Object.keys(result));
      console.log("[ShogunApp] Verifica address:", result.address);
      console.log("[ShogunApp] Verifica stealthAddress:", result.stealthAddress);
      
      // Funzione per estrarre l'indirizzo e la chiave effimera da qualsiasi formato di risposta
      const extractStealthData = (data: any) => {
        // Caso base: se l'oggetto ha direttamente le proprietà che cerchiamo
        let addr = data.address || data.stealthAddress;
        let pubKey = data.ephemeralPubKey || data.ephemeralPublicKey;
        
        // Se non abbiamo trovato nulla, cerchiamo in profondità
        if (!addr || !pubKey) {
          for (const key of Object.keys(data)) {
            if (typeof data[key] === 'object' && data[key] !== null) {
              if (data[key].address || data[key].stealthAddress) {
                addr = addr || data[key].address || data[key].stealthAddress;
              }
              if (data[key].ephemeralPubKey || data[key].ephemeralPublicKey) {
                pubKey = pubKey || data[key].ephemeralPubKey || data[key].ephemeralPublicKey;
              }
            }
          }
        }
        
        return { address: addr, ephemeralPubKey: pubKey };
      };
      
      // Estrai i dati dalla risposta SDK
      const stealthData = extractStealthData(result);
      console.log("[ShogunApp] Dati estratti:", stealthData);
      
      const stealthAddress = stealthData.address;
      const ephemPubKey = stealthData.ephemeralPubKey || "";
      
      console.log("[ShogunApp] Indirizzo stealth generato:", stealthAddress);
      
      if (!stealthAddress) {
        throw new Error("L'indirizzo stealth generato non è valido");
      }
      
      // Salva i risultati
      setStealthAddress(stealthAddress);
      setEphemeralPublicKey(ephemPubKey);
      setStealthWallet(result);
      
      // Salva l'indirizzo in localStorage per recupero
      try {
        let stealthHistory = [];
        const storedHistory = localStorage.getItem("stealthHistory");
        
        if (storedHistory) {
          try {
            const parsed = JSON.parse(storedHistory);
            if (Array.isArray(parsed)) {
              stealthHistory = parsed;
            } else {
              console.warn("[ShogunApp] Lo storico stealth non è un array, inizializzando vuoto");
            }
          } catch (parseErr) {
            console.warn("[ShogunApp] Errore nel parsing dello storico stealth, inizializzando vuoto");
          }
        }
        
        // Aggiungi il nuovo elemento
        stealthHistory.push({
          address: stealthAddress,
          ephemeralKey: ephemPubKey,
          recipientPub: recipientPublicKey,
          timestamp: Date.now()
        });
        
        // Salva lo storico aggiornato
        localStorage.setItem("stealthHistory", JSON.stringify(stealthHistory));
        console.log("[ShogunApp] Storico stealth salvato, elementi totali:", stealthHistory.length);
      } catch (err) {
        console.error("[ShogunApp] Errore nel salvare lo storico stealth:", err);
      }
      
      setErrorMessage("Indirizzo stealth generato con successo!");
      setTimeout(() => setErrorMessage(""), 3000);
    } catch (error: any) {
      console.error("[ShogunApp] Errore nella generazione dell'indirizzo stealth:", error);
      setErrorMessage(error.message || "Errore nella generazione dell'indirizzo stealth");
    } finally {
      setGeneratingStealthAddress(false);
    }
  };

  // Funzione per aprire un indirizzo stealth
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
      // Se è stata fornita una chiave privata diretta, prova ad usarla
      if (privateKeyOverride) {
        try {
          console.log("[ShogunApp] Tentativo di apertura con chiave privata diretta");
          
          // Normalizza la chiave privata
          let privateKey = privateKeyOverride;
          if (!privateKey.startsWith('0x')) {
            privateKey = '0x' + privateKey;
          }
          
          // Crea il wallet con la chiave privata
          const wallet = new ethers.Wallet(privateKey);
          console.log("[ShogunApp] Wallet creato da chiave privata:", wallet.address);
          
          // Verifica se l'indirizzo corrisponde
          if (wallet.address.toLowerCase() === stealthToOpen.toLowerCase()) {
            console.log("[ShogunApp] SUCCESSO con chiave privata fornita manualmente!");
            
            setOpenedStealthWallet({
              address: wallet.address,
              privateKey: privateKey,
              wallet: wallet
            });
            
            setErrorMessage("Indirizzo stealth aperto con successo tramite chiave privata!");
            setPrivateKeyOverride(""); // Pulisci per sicurezza
            setTimeout(() => setErrorMessage(""), 3000);
            return;
          } else {
            console.log("[ShogunApp] La chiave privata fornita non corrisponde all'indirizzo stealth");
            setErrorMessage("La chiave privata fornita non genera l'indirizzo stealth richiesto");
            return;
          }
        } catch (e) {
          console.error("[ShogunApp] Errore nell'utilizzo della chiave privata diretta:", e);
          setErrorMessage("Chiave privata non valida. Verifica il formato e riprova.");
          return;
        }
      }

      // Altrimenti usa il flusso standard con la chiave effimera
      if (!sdk || !sdk.stealth) {
        throw new Error("Il modulo stealth non è disponibile");
      }
      
      // Ottieni le chiavi dell'utente
      const user = sdk.gun.user();
      if (!user || !user.is) {
        throw new Error("Utente non autenticato");
      }
      
      // Accedi alle chiavi dell'utente
      const userSea = (user._ as any).sea;
      if (!userSea) {
        throw new Error("Chiavi dell'utente non disponibili");
      }

      console.log("[ShogunApp] Tentativo di apertura indirizzo stealth con chiave effimera");
      
      // Crea l'oggetto StealthKeyPair con le chiavi dell'utente
      const userKeyPair: StealthKeyPair = {
        pub: userSea.pub,
        priv: userSea.priv,
        epub: userSea.epub,
        epriv: userSea.epriv
      };
      
      // Log parziale delle chiavi per debug (solo le prime 10 char per sicurezza)
      console.log("[ShogunApp] Chiavi disponibili:", {
        pub: userKeyPair.pub && userKeyPair.pub.substring(0, 10) + "...",
        epub: userKeyPair.epub && userKeyPair.epub.substring(0, 10) + "...",
        priv: !!userKeyPair.priv, // Solo conferma che esiste
        epriv: !!userKeyPair.epriv // Solo conferma che esiste
      });
      
      // Prima controlla se ci sono informazioni in localStorage
      let ephemeralKeyFromStorage = null;
      try {
        const storedHistory = localStorage.getItem("stealthHistory");
        if (storedHistory) {
          const parsedHistory = JSON.parse(storedHistory);
          if (Array.isArray(parsedHistory)) {
            const stealthData = parsedHistory.find((s: any) => 
              s.address && s.address.toLowerCase() === stealthToOpen.toLowerCase()
            );
            
            if (stealthData && stealthData.ephemeralKey) {
              console.log("[ShogunApp] Trovata chiave effimera in localStorage:", stealthData.ephemeralKey.substring(0, 10) + "...");
              ephemeralKeyFromStorage = stealthData.ephemeralKey;
            }
          }
        }
      } catch (e) {
        console.error("[ShogunApp] Errore nel recupero dati da localStorage:", e);
      }
      
      // Prova metodo standard con la chiave fornita dall'utente
      console.log("[ShogunApp] Tentativo 1: Metodo standard con chiave effimera");
      let result = null;
      
      try {
        result = await sdk.stealth.openStealthAddress(
          stealthToOpen,
          ephemeralKeyToOpen,
          userKeyPair
        );
      } catch (err) {
        console.log("[ShogunApp] Errore con tentativo 1:", err);
      }

      // Se fallisce, prova con la chiave da localStorage
      if (!result && ephemeralKeyFromStorage && ephemeralKeyFromStorage !== ephemeralKeyToOpen) {
        console.log("[ShogunApp] Tentativo 2: Usando la chiave effimera da localStorage");
        try {
          result = await sdk.stealth.openStealthAddress(
            stealthToOpen,
            ephemeralKeyFromStorage,
            userKeyPair
          );
        } catch (err) {
          console.log("[ShogunApp] Errore con tentativo 2:", err);
        }
      }

      if (!result) {
        throw new Error("Tutti i metodi di derivazione dell'indirizzo stealth hanno fallito");
      }

      console.log("[ShogunApp] Risultato apertura stealth:", result);
      
      // Funzione per estrarre l'indirizzo e la chiave privata da qualsiasi formato di risposta
      const extractWalletData = (data: any) => {
        // Caso base: se l'oggetto ha direttamente le proprietà che cerchiamo
        let addr = data.address || data.stealthAddress;
        let pk = data.privateKey;
        let wallet = data.wallet;
        
        // Se non abbiamo trovato nulla, cerchiamo in profondità
        if (!addr || !pk) {
          for (const key of Object.keys(data)) {
            if (typeof data[key] === 'object' && data[key] !== null) {
              if (data[key].address || data[key].stealthAddress) {
                addr = addr || data[key].address || data[key].stealthAddress;
              }
              if (data[key].privateKey) {
                pk = pk || data[key].privateKey;
              }
              if (data[key].wallet) {
                wallet = wallet || data[key].wallet;
              }
            }
          }
        }
        
        return { address: addr, privateKey: pk, wallet: wallet };
      };
      
      // Estrai i dati dalla risposta SDK
      const walletData = extractWalletData(result);
      console.log("[ShogunApp] Dati wallet estratti:", {
        indirizzo: walletData.address,
        hasPrivateKey: !!walletData.privateKey,
        hasWallet: !!walletData.wallet
      });
      
      // Costruisci un oggetto wallet completo
      const walletObj = {
        address: walletData.address,
        privateKey: walletData.privateKey,
        wallet: walletData.wallet || (walletData.privateKey ? new ethers.Wallet(walletData.privateKey) : null)
      };
      
      setOpenedStealthWallet(walletObj);
      setErrorMessage("Indirizzo stealth aperto con successo!");
      setTimeout(() => setErrorMessage(""), 3000);
    } catch (error: any) {
      console.error("[ShogunApp] Errore nell'apertura dell'indirizzo stealth:", error);
      setErrorMessage(
        error.message || "Errore nell'apertura dell'indirizzo stealth"
      );
    } finally {
      setOpeningStealthAddress(false);
    }
  };

  return (
    <div className="py-4">
      <h2 className="text-2xl font-bold mb-6">Indirizzi Stealth</h2>
      
      <div className="p-4 bg-blue-900 rounded-lg mb-6">
        <p>
          Gli <strong>indirizzi stealth</strong> permettono di ricevere pagamenti in modo anonimo, generando un indirizzo usa-e-getta
          per ogni transazione. Solo il destinatario può determinare la chiave privata corrispondente.
        </p>
      </div>
      
      <div className="flex space-x-4 mb-6">
        <button
          className={`flex-1 p-3 rounded ${
            showStealthBox ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
          }`}
          onClick={() => {
            setShowStealthBox(true);
            setShowStealthOpener(false);
            setShowHistory(false);
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
            setShowHistory(false);
          }}
        >
          Apri Indirizzo
        </button>
        <button
          className={`flex-1 p-3 rounded ${
            showHistory ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"
          }`}
          onClick={() => {
            setShowHistory(true);
            setShowStealthBox(false);
            setShowStealthOpener(false);
          }}
        >
          Storico
        </button>
      </div>
      
      {/* Sezione Storico */}
      {showHistory && (
        <div className="bg-gray-800 rounded-lg p-6 mb-4">
          <h3 className="text-xl font-bold mb-4">Storico Indirizzi Stealth</h3>
          
          {stealthHistory.length === 0 ? (
            <p className="text-gray-400">Nessun indirizzo stealth nello storico.</p>
          ) : (
            <div className="space-y-4">
              {stealthHistory.map((item, index) => (
                <div key={index} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-mono text-sm break-all">
                      <span className="text-gray-400">Indirizzo:</span> {item.address}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        className="p-1 bg-blue-600 rounded hover:bg-blue-700 text-xs"
                        onClick={() => useStealthFromHistory(item)}
                      >
                        Usa
                      </button>
                      <button
                        className="p-1 bg-red-600 rounded hover:bg-red-700 text-xs"
                        onClick={() => removeFromHistory(item.address)}
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-xs mb-2">
                    <span className="text-gray-400">Chiave effimera:</span>
                    <div className="font-mono text-sm break-all">{item.ephemeralKey}</div>
                  </div>
                  
                  <div className="text-xs text-gray-400">
                    Generato il: {new Date(item.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {stealthHistory.length > 0 && (
            <div className="mt-4">
              <button
                className="p-2 bg-red-600 rounded hover:bg-red-700 text-sm"
                onClick={() => {
                  if (window.confirm("Sei sicuro di voler cancellare tutto lo storico?")) {
                    localStorage.removeItem("stealthHistory");
                    setStealthHistory([]);
                  }
                }}
              >
                Cancella tutto lo storico
              </button>
            </div>
          )}
        </div>
      )}
      
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
            disabled={generatingStealthAddress}
          >
            {generatingStealthAddress ? "Generazione in corso..." : "Genera Indirizzo Stealth"}
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
            className="text-sm text-blue-400 mb-4 hover:underline"
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
          >
            {showAdvancedOptions ? "Nascondi opzioni avanzate" : "Mostra opzioni avanzate"}
          </button>
          
          {showAdvancedOptions && (
            <div className="mb-4">
              <label className="block text-gray-400 mb-2">Chiave Privata (solo recupero)</label>
              <input
                className="w-full p-3 bg-gray-700 rounded"
                value={privateKeyOverride}
                onChange={(e) => setPrivateKeyOverride(e.target.value)}
                placeholder="Inserisci chiave privata se nota..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Usa questo campo solo se conosci già la chiave privata dell'indirizzo stealth.
              </p>
            </div>
          )}
          
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
              onClick={() => {
                navigator.clipboard.writeText(userEpub);
                setErrorMessage("Chiave pubblica copiata negli appunti!");
                setTimeout(() => setErrorMessage(""), 3000);
              }}
            >
              Copia
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StealthSection; 