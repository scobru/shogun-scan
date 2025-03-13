import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// ABI minimo per interagire con il contratto GunL2
const GunL2ABI = [
  "function requestWithdraw(uint256 amount) external",
  "function processWithdraw() external",
  "function pendingWithdrawals(address user) external view returns (uint256)",
  "function getBalance(address user) external view returns (uint256)",
  "function balanceGT(address user) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function deposit() external payable"
];

// Tasso di cambio dal contratto (100% - rapporto 1:1)
const COLLATERAL_RATIO = 1.0; // 100%

interface Layer2SectionProps {
  sdk: any; // Cambiato da ShogunCore a any per compatibilità
  selectedAddress?: string | null;
  provider?: ethers.JsonRpcProvider | null;
  contractAddress?: string;
  userEpub?: string;
  setErrorMessage: (message: string) => void;
}

const Layer2Section: React.FC<Layer2SectionProps> = ({ 
  sdk, 
  selectedAddress, 
  provider,
  contractAddress,
  userEpub,
  setErrorMessage
}) => {
  // Stati per la gestione del Layer2
  const [gtBalance, setGtBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  
  // Stati per l'invio di GT
  const [recipient, setRecipient] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [processing, setProcessing] = useState<boolean>(false);
  
  // Stati per il prelievo
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [withdrawing, setWithdrawing] = useState<boolean>(false);
  const [pendingWithdrawal, setPendingWithdrawal] = useState<string>("0");
  const [completingWithdraw, setCompletingWithdraw] = useState<boolean>(false);

  // Stati per il deposito
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [depositing, setDepositing] = useState<boolean>(false);
  const [nativeBalance, setNativeBalance] = useState<string>("0");

  // Carica il saldo GT e le transazioni quando cambia l'indirizzo selezionato
  useEffect(() => {
    if (selectedAddress && sdk) {
      loadGTBalance();
      loadTransactionHistory();
      loadNativeBalance();
      loadPendingWithdrawal();
    }
  }, [selectedAddress, sdk]);

  // Funzione per caricare il saldo nativo (ETH)
  const loadNativeBalance = async () => {
    if (!selectedAddress || !provider) return;
    
    try {
      const balance = await provider.getBalance(selectedAddress);
      setNativeBalance(ethers.formatEther(balance));
    } catch (error: any) {
      console.error("Errore nel caricamento del saldo ETH:", error);
    }
  };

  // Funzione per caricare il saldo GunToken
  const loadGTBalance = async () => {
    if (!selectedAddress || !sdk) return;
    
    try {
      setLoading(true);
      
      // Utilizza il metodo dell'SDK per ottenere il saldo GT
      const balance = await sdk.getGTBalance(selectedAddress);
      setGtBalance(balance);
      
      setLoading(false);
    } catch (error: any) {
      console.error("Errore nel caricamento del saldo GT:", error);
      setError(`Errore nel caricamento del saldo: ${error.message}`);
      setLoading(false);
    }
  };

  // Funzione per caricare la cronologia delle transazioni
  const loadTransactionHistory = async () => {
    if (!selectedAddress || !sdk) return;
    
    try {
      setLoading(true);
      
      // Utilizza il metodo dell'SDK per ottenere la cronologia
      const history = await sdk.getGTTransactionHistory(selectedAddress);
      setTransactions(history);
      
      setLoading(false);
    } catch (error: any) {
      console.error("Errore nel caricamento della cronologia:", error);
      setError(`Errore nel caricamento della cronologia: ${error.message}`);
      setLoading(false);
    }
  };

  // Funzione per caricare il prelievo in attesa
  const loadPendingWithdrawal = async () => {
    if (!selectedAddress || !provider || !contractAddress) return;
    
    try {
      // Crea un'istanza del contratto per leggere il prelievo in attesa
      const contract = new ethers.Contract(contractAddress, GunL2ABI, provider);
      
      try {
        // Ottieni il prelievo in attesa
        const pending = await contract.pendingWithdrawals(selectedAddress);
        setPendingWithdrawal(ethers.formatEther(pending));
      } catch (error: any) {
        console.error("Errore nella chiamata a pendingWithdrawals:", error);
        console.log("Tentativo alternativo di lettura del prelievo in attesa...");
        
        // Se non riesce a leggere il prelievo in attesa, controlla se esiste un metodo alternativo
        try {
          // Alcuni contratti potrebbero avere una funzione diversa o struttura dati diversa
          const pendingWithdrawals = await contract.getPendingWithdrawal(selectedAddress);
          setPendingWithdrawal(ethers.formatEther(pendingWithdrawals));
          console.log("Prelievo in attesa trovato con metodo alternativo:", ethers.formatEther(pendingWithdrawals));
        } catch (alternativeError) {
          console.error("Anche il tentativo alternativo è fallito:", alternativeError);
          
          // Se anche il tentativo alternativo fallisce, imposta un valore predefinito basato sullo stato
          // Se l'utente ha appena fatto una richiesta di prelievo, mostrerà l'importo richiesto
          if (parseFloat(withdrawAmount) > 0) {
            console.log("Uso il valore appena richiesto come fallback:", withdrawAmount);
            setPendingWithdrawal(withdrawAmount);
          }
        }
      }
    } catch (error: any) {
      console.error("Errore nel caricamento del prelievo in attesa:", error);
    }
  };

  // Funzione per sincronizzare manualmente il saldo on-chain con off-chain
  const syncOnChainWithOffChain = async () => {
    if (!selectedAddress || !provider || !contractAddress || !sdk) {
      setError("Informazioni mancanti per la sincronizzazione.");
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      
      // Crea un'istanza del contratto per leggere il saldo GT on-chain
      const contract = new ethers.Contract(contractAddress, GunL2ABI, provider);
      
      // Ottieni il saldo GT on-chain
      const onChainBalance = await contract.balanceGT(selectedAddress);
      const formattedOnChainBalance = parseFloat(ethers.formatEther(onChainBalance));
      console.log(`Saldo GT on-chain: ${formattedOnChainBalance} GT`);
      
      // Ottieni il saldo corrente off-chain
      const currentOffChainBalance = await sdk.getGTBalance(selectedAddress);
      console.log(`Saldo GT off-chain corrente: ${currentOffChainBalance} GT`);
      
      if (formattedOnChainBalance !== currentOffChainBalance) {
        // Aggiorna il saldo off-chain con quello on-chain
        console.log(`Sincronizzazione del saldo off-chain da ${currentOffChainBalance} a ${formattedOnChainBalance} GT`);
        await sdk.updateGTBalance(selectedAddress, formattedOnChainBalance, false);
        
        // Aggiorna l'interfaccia
        setGtBalance(formattedOnChainBalance);
        setSuccessMessage(`Saldo GT sincronizzato con successo (${formattedOnChainBalance} GT)`);
        setTimeout(() => setSuccessMessage(""), 5000);
      } else {
        setSuccessMessage("I saldi sono già sincronizzati");
        setTimeout(() => setSuccessMessage(""), 3000);
      }
      
      setLoading(false);
    } catch (error: any) {
      console.error("Errore nella sincronizzazione dei saldi:", error);
      setError(`Errore nella sincronizzazione: ${error.message}`);
      setLoading(false);
    }
  };

  // Funzione per aggiornare tutti i saldi contemporaneamente
  const refreshAllBalances = async () => {
    setLoading(true);
    try {
      // Prima sincronizza i saldi on-chain con off-chain se possibile
      if (selectedAddress && provider && contractAddress && sdk) {
        try {
          // Crea un'istanza del contratto per leggere il saldo GT on-chain
          const contract = new ethers.Contract(contractAddress, GunL2ABI, provider);
          
          // Ottieni il saldo GT on-chain
          const onChainBalance = await contract.balanceGT(selectedAddress);
          const formattedOnChainBalance = parseFloat(ethers.formatEther(onChainBalance));
          
          // Ottieni il saldo corrente off-chain
          const currentOffChainBalance = await sdk.getGTBalance(selectedAddress);
          
          // Se i saldi sono diversi, sincronizza
          if (formattedOnChainBalance !== currentOffChainBalance) {
            console.log(`Sincronizzazione automatica: on-chain ${formattedOnChainBalance} GT, off-chain ${currentOffChainBalance} GT`);
            await sdk.updateGTBalance(selectedAddress, formattedOnChainBalance, false);
          }
        } catch (syncError) {
          console.error("Errore nella sincronizzazione automatica:", syncError);
          // Continuiamo con gli aggiornamenti normali anche se la sincronizzazione fallisce
        }
      }
      
      await Promise.all([
        loadGTBalance(),
        loadNativeBalance(),
        loadPendingWithdrawal()
      ]);
      
      // Breve messaggio di conferma
      setSuccessMessage("Saldi aggiornati con successo!");
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      console.error("Errore nell'aggiornamento dei saldi:", error);
      setError(`Errore nell'aggiornamento dei saldi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Funzione per inviare GT
  const sendGT = async () => {
    if (!selectedAddress || !recipient || !amount || !sdk) {
      setError("Informazioni mancanti. Verifica indirizzo destinatario e importo.");
      return;
    }
    
    try {
      setProcessing(true);
      setError("");
      
      // CORREZIONE: Invece di utilizzare il wallet principale, otteniamo il wallet associato all'indirizzo selezionato
      const derivedWallets = await sdk.loadWallets();
      console.log("Wallet disponibili per invio GT:", derivedWallets.map((w: any) => w.address));
      
      const selectedWallet = derivedWallets.find((w: any) => 
        w.address.toLowerCase() === selectedAddress.toLowerCase()
      );
      
      if (!selectedWallet || !selectedWallet.wallet) {
        throw new Error(`Non è stato possibile trovare il wallet per l'indirizzo selezionato: ${selectedAddress}`);
      }
      
      console.log("Wallet trovato per invio GT:", {
        address: selectedWallet.address,
        hasPK: !!selectedWallet.wallet.privateKey
      });
      
      // Utilizza il metodo dell'SDK per inviare GT
      await sdk.sendGT(
        selectedAddress,
        recipient,
        parseFloat(amount),
        selectedWallet.wallet.privateKey
      );
      
      // Aggiorna saldo e cronologia
      await loadGTBalance();
      await loadTransactionHistory();
      
      // Pulisci i campi del form
      setRecipient("");
      setAmount("");
      
      setProcessing(false);
      
      // Mostra messaggio di successo temporaneo
      setError("Transazione completata con successo!");
      setTimeout(() => setError(""), 3000);
      
    } catch (error: any) {
      console.error("Errore nell'invio di GT:", error);
      setError(`Errore nell'invio di GT: ${error.message}`);
      setProcessing(false);
    }
  };

  // Funzione per richiedere il prelievo sul chain
  const requestWithdraw = async () => {
    if (!selectedAddress || !withdrawAmount || !sdk || !provider || !contractAddress) {
      setError("Informazioni mancanti. Verifica l'importo del prelievo.");
      return;
    }
    
    try {
      setWithdrawing(true);
      setError("");
      
      // Log diagnostico
      console.log("Tentativo di prelievo:", {
        indirizzo: selectedAddress,
        importo: withdrawAmount,
        importoWei: ethers.parseEther(withdrawAmount).toString()
      });
      
      // CORREZIONE: Invece di utilizzare il wallet principale, otteniamo il wallet associato all'indirizzo selezionato
      const derivedWallets = await sdk.loadWallets();
      console.log("Wallet disponibili per prelievo:", derivedWallets.map((w: any) => w.address));
      
      const selectedWallet = derivedWallets.find((w: any) => 
        w.address.toLowerCase() === selectedAddress.toLowerCase()
      );
      
      if (!selectedWallet || !selectedWallet.wallet) {
        throw new Error(`Non è stato possibile trovare il wallet per l'indirizzo selezionato: ${selectedAddress}`);
      }
      
      console.log("Wallet trovato per prelievo:", {
        address: selectedWallet.address,
        hasPK: !!selectedWallet.wallet.privateKey
      });
      
      // Verifica che il wallet abbia abbastanza ETH per il gas
      const walletBalance = await provider.getBalance(selectedWallet.address);
      console.log(`Saldo ETH del wallet per prelievo: ${ethers.formatEther(walletBalance)} ETH`);
      
      if (walletBalance.toString() === '0') {
        throw new Error("Il wallet non ha ETH per pagare il gas della transazione. Aggiungi ETH a questo indirizzo prima di prelevare.");
      }
      
      // Utilizza il metodo dell'SDK per richiedere il prelievo con il wallet corretto
      await sdk.requestWithdrawGT(
        parseFloat(withdrawAmount),
        selectedAddress,
        selectedWallet.wallet.privateKey,
        contractAddress,
        GunL2ABI
      );
      
      // Aggiorna saldo e prelievi in attesa
      await loadGTBalance();
      await loadPendingWithdrawal();
      
      // Pulisci il campo
      setWithdrawAmount("");
      
      setWithdrawing(false);
      
      // Mostra messaggio di successo temporaneo
      setError("Richiesta di prelievo completata con successo!");
      setTimeout(() => setError(""), 3000);
      
    } catch (error: any) {
      console.error("Errore nella richiesta di prelievo:", error);
      setError(`Errore nella richiesta di prelievo: ${error.message}`);
      setWithdrawing(false);
    }
  };

  // Funzione per completare il prelievo
  const completeWithdraw = async () => {
    if (!selectedAddress || !sdk || !provider || !contractAddress) {
      setError("Informazioni mancanti per completare il prelievo.");
      return;
    }
    
    try {
      setCompletingWithdraw(true);
      setError("");
      
      // Ottieni i wallet disponibili
      const derivedWallets = await sdk.loadWallets();
      
      // Trova il wallet corrispondente all'indirizzo selezionato
      const selectedWallet = derivedWallets.find((w: any) => 
        w.address.toLowerCase() === selectedAddress.toLowerCase()
      );
      
      if (!selectedWallet || !selectedWallet.wallet) {
        throw new Error(`Non è stato possibile trovare il wallet per l'indirizzo selezionato: ${selectedAddress}`);
      }
      
      // Crea un'istanza del contratto con signer
      const walletWithProvider = new ethers.Wallet(selectedWallet.wallet.privateKey, provider);
      const contract = new ethers.Contract(contractAddress, GunL2ABI, walletWithProvider);
      
      // Verifica che ci sia un prelievo in attesa (se possibile)
      let hasPendingWithdrawal = false;
      let pendingAmount = "0";
      
      try {
        // Tenta di utilizzare pendingWithdrawals
        const amount = await contract.pendingWithdrawals(selectedAddress);
        pendingAmount = ethers.formatEther(amount);
        hasPendingWithdrawal = amount.toString() !== "0";
      } catch (pendingCheckError) {
        console.log("Impossibile verificare il prelievo in attesa tramite contratto:", pendingCheckError);
        
        try {
          // Tenta di utilizzare il metodo alternativo
          const amount = await contract.getPendingWithdrawal(selectedAddress);
          pendingAmount = ethers.formatEther(amount);
          hasPendingWithdrawal = amount.toString() !== "0";
        } catch (alternativeCheckError) {
          console.log("Impossibile verificare il prelievo in attesa con metodo alternativo:", alternativeCheckError);
          
          // Se non riesce a verificare, ma l'utente ha un valore in pendingWithdrawal nell'interfaccia
          // considera valido quello e procedi
          hasPendingWithdrawal = parseFloat(pendingWithdrawal) > 0;
          pendingAmount = pendingWithdrawal;
          console.log("Utilizzo il valore dell'interfaccia per il prelievo in attesa:", pendingWithdrawal);
        }
      }
      
      if (!hasPendingWithdrawal) {
        throw new Error("Non ci sono prelievi in attesa da completare.");
      }
      
      console.log("Completamento prelievo:", {
        indirizzo: selectedAddress,
        importoInAttesa: pendingAmount
      });
      
      // Stima il gas necessario
      let gasLimit;
      try {
        const gasEstimate = await contract.processWithdraw.estimateGas();
        gasLimit = Math.floor(Number(gasEstimate) * 1.2);
      } catch (gasError) {
        console.warn("Impossibile stimare il gas, uso un valore predefinito:", gasError);
        // Utilizza un valore predefinito se la stima fallisce
        gasLimit = 200000;
      }
      
      // Esegui la transazione per completare il prelievo
      const tx = await contract.processWithdraw({ gasLimit });
      
      console.log("Transazione di prelievo inviata:", tx.hash);
      
      setError("Prelievo in corso. Attendi la conferma...");
      const receipt = await tx.wait();
      console.log("Prelievo completato:", receipt);
      
      // Aggiorna saldi
      await loadGTBalance();
      await loadNativeBalance();
      await loadPendingWithdrawal();
      
      setCompletingWithdraw(false);
      
      // Mostra messaggio di successo
      setError("Prelievo completato con successo!");
      setTimeout(() => setError(""), 3000);
      
    } catch (error: any) {
      console.error("Errore nel completamento del prelievo:", error);
      setError(`Errore nel completamento del prelievo: ${error.message}`);
      setCompletingWithdraw(false);
    }
  };

  // Funzione per depositare ETH e ricevere GT
  const depositETH = async () => {
    if (!selectedAddress || !depositAmount || !provider || !contractAddress) {
      setError("Informazioni mancanti. Verifica l'importo del deposito.");
      return;
    }
    
    try {
      setDepositing(true);
      setError("");
      
      // Controlla il saldo effettivo prima di procedere
      const currentBalance = await provider.getBalance(selectedAddress);
      const depositWei = ethers.parseEther(depositAmount);
      
      if (currentBalance < depositWei) {
        throw new Error(`Saldo insufficiente. Hai ${ethers.formatEther(currentBalance)} ETH, ma stai cercando di inviare ${depositAmount} ETH.`);
      }
      
      // Log diagnostico
      console.log("Tentativo di deposito:", {
        indirizzo: selectedAddress,
        importo: depositAmount,
        importoWei: depositWei.toString(),
        saldoAttuale: ethers.formatEther(currentBalance),
        saldoAttualeWei: currentBalance.toString(),
        contractAddress
      });
      
      // CORREZIONE: Invece di utilizzare il wallet principale, otteniamo il wallet associato all'indirizzo selezionato
      const derivedWallets = await sdk.loadWallets();
      console.log("Wallet disponibili:", derivedWallets.map((w: any) => w.address));
      
      const selectedWallet = derivedWallets.find((w: any) => 
        w.address.toLowerCase() === selectedAddress.toLowerCase()
      );
      
      if (!selectedWallet || !selectedWallet.wallet) {
        throw new Error(`Non è stato possibile trovare il wallet per l'indirizzo selezionato: ${selectedAddress}`);
      }
      
      console.log("Wallet trovato:", {
        address: selectedWallet.address,
        hasPK: !!selectedWallet.wallet.privateKey
      });
      
      // Crea un'istanza del contratto con signer usando il wallet selezionato
      const walletWithProvider = new ethers.Wallet(selectedWallet.wallet.privateKey, provider);
      
      // Verifica che l'indirizzo del wallet sia effettivamente quello selezionato
      if (walletWithProvider.address.toLowerCase() !== selectedAddress.toLowerCase()) {
        throw new Error(`Errore di corrispondenza del wallet: ${walletWithProvider.address} vs ${selectedAddress}`);
      }
      
      // Verifica il saldo del wallet con provider
      const walletBalance = await provider.getBalance(walletWithProvider.address);
      console.log(`Saldo del wallet con provider: ${ethers.formatEther(walletBalance)} ETH`);
      
      if (walletBalance < depositWei) {
        throw new Error(`Il wallet non ha saldo sufficiente. Saldo: ${ethers.formatEther(walletBalance)} ETH, Richiesto: ${depositAmount} ETH`);
      }
      
      const contract = new ethers.Contract(contractAddress, GunL2ABI, walletWithProvider);
      
      // Stima il gas necessario per sicurezza
      const gasEstimate = await provider.estimateGas({
        from: walletWithProvider.address,
        to: contractAddress,
        value: depositWei
      });
      
      // Aggiungi un margine del 20% alla stima del gas
      const gasLimit = Math.floor(Number(gasEstimate) * 1.2);
      
      console.log("Stima gas:", {
        gasEstimate: gasEstimate.toString(),
        gasLimit
      });
      
      // Invia la transazione di deposito con opzioni di gas esplicite
      const tx = await contract.deposit({
        value: depositWei,
        gasLimit
      });
      
      console.log("Transazione inviata:", tx.hash);
      
      // Attendi che la transazione sia confermata
      setError("Transazione in corso. Attendi la conferma...");
      const receipt = await tx.wait();
      console.log("Transazione confermata:", receipt);
      
      // Calcola quanti GT sono stati effettivamente ricevuti (100% dell'ETH depositato)
      const receivedGT = parseFloat(depositAmount);
      
      // NUOVO: Aggiorna il saldo GT nel database GunDB per sincronizzare on-chain e off-chain
      try {
        console.log(`Sincronizzazione del saldo GT per ${selectedAddress} dopo il deposito...`);
        
        // Verifica il saldo GT on-chain
        const onChainBalance = await contract.balanceGT(selectedAddress);
        const formattedOnChainBalance = parseFloat(ethers.formatEther(onChainBalance));
        console.log(`Saldo GT on-chain: ${formattedOnChainBalance} GT`);
        
        // Ottieni il saldo corrente off-chain
        const currentOffChainBalance = await sdk.getGTBalance(selectedAddress);
        console.log(`Saldo GT off-chain corrente: ${currentOffChainBalance} GT`);
        
        // Calcola la differenza (GT appena ricevuti)
        if (formattedOnChainBalance > currentOffChainBalance) {
          // Usa l'API per aggiornare il saldo off-chain
          console.log(`Aggiornamento saldo off-chain a ${formattedOnChainBalance} GT`);
          await sdk.updateGTBalance(selectedAddress, formattedOnChainBalance, false);
          console.log(`Saldo sincronizzato con successo`);
        } else {
          // Fallback: aggiungi direttamente i GT ricevuti
          console.log(`Aggiunta di ${receivedGT} GT al saldo off-chain`);
          await sdk.updateGTBalance(selectedAddress, receivedGT, true);
          console.log(`GT aggiunti con successo`);
        }
      } catch (syncError) {
        console.error("Errore durante la sincronizzazione del saldo GT:", syncError);
        // Continuiamo anche se la sincronizzazione fallisce, ma segniamo il problema
        setError("Deposito completato ma la sincronizzazione del saldo potrebbe non essere riuscita. Aggiorna manualmente i saldi.");
      }
      
      // Aggiorna i saldi
      await loadGTBalance();
      await loadNativeBalance();
      
      // Pulisci il campo
      setDepositAmount("");
      
      setDepositing(false);
      
      // Mostra messaggio di successo temporaneo
      setSuccessMessage(`Hai depositato con successo ${depositAmount} ETH e ricevuto ${receivedGT.toFixed(4)} GT!`);
      setError(""); // Pulisce eventuali messaggi di errore
      setTimeout(() => setSuccessMessage(""), 5000);
      
    } catch (error: any) {
      console.error("Errore nel deposito di ETH:", error);
      
      // Gestione errori specifica
      let errorMessage = "Errore nel deposito: ";
      
      if (error.code === 'INSUFFICIENT_FUNDS') {
        errorMessage += "Fondi insufficienti per completare la transazione (incluso gas).";
      } else if (error.message && error.message.includes("sender doesn't have enough funds")) {
        errorMessage += "Il mittente non ha abbastanza fondi.";
      } else if (error.message && error.message.includes("user rejected transaction")) {
        errorMessage += "Transazione rifiutata dall'utente.";
      } else {
        errorMessage += error.message || "Errore sconosciuto.";
      }
      
      setError(errorMessage);
      setDepositing(false);
    }
  };

  // Formatta la data
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Troncamento dell'indirizzo per visualizzazione
  const truncateAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <div className="p-6 flex-grow overflow-auto">
      <h2 className="text-2xl font-bold mb-6">Layer2 GunTokens (GT)</h2>
      
      {/* Messaggio di errore */}
      {error && (
        <div className="p-4 mb-6 rounded-lg bg-red-800 bg-opacity-30">
          <p className="text-red-300">{error}</p>
        </div>
      )}
      
      {/* Messaggio di successo */}
      {successMessage && (
        <div className="p-4 mb-6 rounded-lg bg-green-800 bg-opacity-30 border border-green-700">
          <p className="text-green-300 font-bold flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {successMessage}
          </p>
        </div>
      )}
      
      {/* Pannello informativo sul Layer2 */}
      <div className="bg-blue-900 bg-opacity-30 rounded-lg p-4 mb-6 border border-blue-800">
        <h3 className="text-lg font-bold mb-2 text-blue-300">Informazioni sul Layer2</h3>
        <p className="text-sm text-gray-300 mb-2">
          <span className="font-bold">Come funziona:</span> Deposita ETH per ricevere GT (GunTokens) nel Layer2 in rapporto 1:1.
          Puoi inviare GT ad altri utenti senza costi di gas, e quando vuoi ritornare a ETH, usa la funzione di prelievo.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
          <span className="font-bold">Tasso di cambio:</span>
          <span className="bg-blue-800 px-2 py-1 rounded">1 ETH = 1 GT</span>
          <span className="bg-blue-800 px-2 py-1 rounded">1 GT = 1 ETH</span>
        </div>
      </div>
      
      {/* Sezione Saldo */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">I Tuoi Saldi</h3>
          <div className="flex gap-2">
            <button 
              className="p-2 bg-purple-600 hover:bg-purple-700 rounded flex items-center gap-2 text-sm"
              onClick={syncOnChainWithOffChain}
              disabled={loading}
              title="Sincronizza il saldo GT dal contratto con il database"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              {loading ? "Sincronizzando..." : "Sincronizza Saldi"}
            </button>
            <button 
              className="p-2 bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-2"
              onClick={refreshAllBalances}
              disabled={loading}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? "Aggiornamento..." : "Aggiorna Saldi"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-700 rounded-lg p-4 border-l-4 border-green-600">
            <p className="text-gray-400 mb-1 flex items-center">
              <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2"></span>
              Saldo Layer2 (GT):
            </p>
            <p className="text-3xl font-bold">
              {loading ? "Caricamento..." : `${gtBalance} GT`}
            </p>
            <p className="text-xs text-gray-500 mt-1">Token utilizzabili nel Layer2 senza costi di gas</p>
            {gtBalance > 0 && (
              <p className="text-xs text-green-400 mt-1">
                ℹ️ I tuoi {gtBalance} GT equivalgono a {gtBalance.toFixed(4)} ETH bloccati nel contratto
              </p>
            )}
          </div>
          <div className="bg-gray-700 rounded-lg p-4 border-l-4 border-blue-600">
            <p className="text-gray-400 mb-1 flex items-center">
              <span className="inline-block w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
              Saldo Wallet (ETH):
            </p>
            <p className="text-3xl font-bold">{nativeBalance} ETH</p>
            <p className="text-xs text-gray-500 mt-1">Ether disponibili nel tuo wallet per depositi e gas</p>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-gray-700 rounded-lg border border-gray-600">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Riassunto dei tuoi fondi:</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-400">ETH nel wallet:</span>
              <span className="float-right font-mono">{nativeBalance} ETH</span>
            </div>
            <div>
              <span className="text-gray-400">GT nel Layer2:</span>
              <span className="float-right font-mono">{gtBalance} GT</span>
            </div>
            <div>
              <span className="text-gray-400">Valore totale:</span>
              <span className="float-right font-mono font-bold">{(parseFloat(nativeBalance) + gtBalance).toFixed(8)} ETH</span>
            </div>
            <div>
              <span className="text-gray-400">Prelievi in attesa:</span>
              <span className="float-right font-mono">{pendingWithdrawal} ETH</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Grid a 3 colonne per Deposito, Invio e Prelievo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Sezione Deposito (ETH → GT) */}
        <div className="bg-gray-800 rounded-lg p-6 border-t-4 border-blue-600">
          <h3 className="text-xl font-bold mb-2">Deposita ETH</h3>
          <p className="text-sm text-gray-400 mb-4">Converti i tuoi ETH in GT nel Layer2</p>
          <div className="mb-4">
            <label className="block text-gray-400 mb-2">Importo (ETH)</label>
            <input
              type="number"
              className="w-full p-3 bg-gray-700 rounded"
              placeholder="Importo da depositare"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              min="0"
              step="0.01"
            />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-gray-500">
                Riceverai <span className="font-bold">{depositAmount ? depositAmount : '0'} GT</span>
              </p>
              {parseFloat(nativeBalance) > 0 && (
                <button 
                  className="text-xs text-blue-400 hover:text-blue-300"
                  onClick={() => setDepositAmount(nativeBalance)}
                  type="button"
                >
                  Deposita tutto ({nativeBalance} ETH)
                </button>
              )}
            </div>
          </div>
          <button
            className="w-full p-3 bg-blue-600 hover:bg-blue-700 rounded flex items-center justify-center"
            onClick={depositETH}
            disabled={depositing || !selectedAddress || !depositAmount || parseFloat(depositAmount) <= 0 || parseFloat(depositAmount) > parseFloat(nativeBalance)}
          >
            {depositing ? "Elaborazione..." : "Deposita ETH → GT"}
          </button>
          {parseFloat(depositAmount) > parseFloat(nativeBalance) && (
            <p className="text-xs text-red-400 mt-1">Importo superiore al tuo saldo ETH</p>
          )}
        </div>
        
        {/* Sezione Invio GT */}
        <div className="bg-gray-800 rounded-lg p-6 border-t-4 border-green-600">
          <h3 className="text-xl font-bold mb-2">Invia GT</h3>
          <p className="text-sm text-gray-400 mb-4">Trasferisci GT ad altri utenti (o a te stesso)</p>
          
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-gray-400">Destinatario</label>
              {selectedAddress && (
                <button 
                  className="text-xs text-blue-400 hover:text-blue-300"
                  onClick={() => setRecipient(selectedAddress)}
                  type="button"
                >
                  Invia a me stesso
                </button>
              )}
            </div>
            <input
              type="text"
              className="w-full p-3 bg-gray-700 rounded"
              placeholder="Indirizzo destinatario"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-400 mb-2">Importo (GT)</label>
            <input
              type="number"
              className="w-full p-3 bg-gray-700 rounded"
              placeholder="Importo"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.1"
            />
            {gtBalance > 0 && (
              <div className="flex justify-end mt-1">
                <button 
                  className="text-xs text-blue-400 hover:text-blue-300"
                  onClick={() => setAmount(String(gtBalance))}
                  type="button"
                >
                  Invia tutto ({gtBalance} GT)
                </button>
              </div>
            )}
          </div>
          
          <button
            className="w-full p-3 bg-green-600 hover:bg-green-700 rounded flex items-center justify-center"
            onClick={sendGT}
            disabled={processing || !selectedAddress || parseFloat(amount) > gtBalance}
          >
            {processing ? "Elaborazione..." : "Invia GT"}
          </button>
          {parseFloat(amount) > gtBalance && (
            <p className="text-xs text-red-400 mt-1">Importo superiore al tuo saldo GT</p>
          )}
        </div>
        
        {/* Sezione Richiesta Prelievo - Modificata */}
        <div className="bg-gray-800 rounded-lg p-6 border-t-4 border-yellow-600">
          <h3 className="text-xl font-bold mb-2">Preleva (GT → ETH)</h3>
          <p className="text-sm text-gray-400 mb-4">Converti i tuoi GT in ETH nel wallet</p>
          
          {/* Prima fase: Richiesta prelievo */}
          <div className="mb-6">
            <h4 className="text-md font-semibold mb-2 bg-gray-700 p-2 rounded">Fase 1: Richiedi</h4>
            <div className="mb-4">
              <label className="block text-gray-400 mb-2">Importo (GT)</label>
              <input
                type="number"
                className="w-full p-3 bg-gray-700 rounded"
                placeholder="Importo da prelevare"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                min="0"
                step="0.1"
              />
              {gtBalance > 0 && (
                <div className="flex justify-end mt-1">
                  <button 
                    className="text-xs text-blue-400 hover:text-blue-300"
                    onClick={() => setWithdrawAmount(String(gtBalance))}
                    type="button"
                  >
                    Preleva tutto ({gtBalance} GT)
                  </button>
                </div>
              )}
            </div>
            <button
              className="w-full p-3 bg-purple-600 hover:bg-purple-700 rounded flex items-center justify-center"
              onClick={requestWithdraw}
              disabled={withdrawing || !selectedAddress || parseFloat(withdrawAmount) > gtBalance}
            >
              {withdrawing ? "Elaborazione..." : "Richiedi Prelievo"}
            </button>
            {parseFloat(withdrawAmount) > gtBalance && (
              <p className="text-xs text-red-400 mt-1">Importo superiore al tuo saldo GT</p>
            )}
          </div>
          
          {/* Divisore */}
          <div className="border-t border-gray-700 my-4"></div>
          
          {/* Seconda fase: Completamento prelievo */}
          <div>
            <h4 className="text-md font-semibold mb-2 bg-gray-700 p-2 rounded">Fase 2: Completa</h4>
            
            {/* Mostra il prelievo in attesa */}
            <div className="mb-4 bg-gray-700 p-3 rounded">
              <p className="text-sm text-gray-400">Prelievo in attesa:</p>
              <p className="font-bold">{pendingWithdrawal} ETH</p>
              <p className="text-xs text-gray-500 mt-1">
                {parseFloat(pendingWithdrawal) > 0 
                  ? "Completa il prelievo per ricevere questi ETH" 
                  : "Nessun prelievo in attesa. Esegui prima la Fase 1."
                }
              </p>
            </div>
            
            <button
              className="w-full p-3 bg-yellow-600 hover:bg-yellow-700 rounded flex items-center justify-center"
              onClick={completeWithdraw}
              disabled={completingWithdraw || !selectedAddress || parseFloat(pendingWithdrawal) <= 0}
            >
              {completingWithdraw ? "Elaborazione..." : "Completa Prelievo"}
            </button>
          </div>
        </div>
      </div>
      
      {/* Sezione Transazioni */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Cronologia Transazioni</h3>
          <button 
            className="p-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            onClick={loadTransactionHistory}
            disabled={loading}
          >
            Aggiorna
          </button>
        </div>
        
        {loading ? (
          <p className="text-center text-gray-400 py-4">Caricamento transazioni...</p>
        ) : transactions.length === 0 ? (
          <p className="text-center text-gray-400 py-4">Nessuna transazione trovata.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4">Data</th>
                  <th className="text-left py-3 px-4">Tipo</th>
                  <th className="text-left py-3 px-4">Da</th>
                  <th className="text-left py-3 px-4">A</th>
                  <th className="text-left py-3 px-4">Importo</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, index) => {
                  // Determina il tipo di transazione
                  let txType = "Invio";
                  if (tx.from === selectedAddress && tx.to === selectedAddress) {
                    txType = "Self-Transfer";
                  } else if (tx.from === selectedAddress) {
                    txType = "Invio";
                  } else if (tx.to === selectedAddress) {
                    txType = "Ricezione";
                  }
                  
                  return (
                    <tr key={index} className="border-b border-gray-700 hover:bg-gray-700">
                      <td className="py-3 px-4">{formatDate(tx.timestamp)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold
                          ${txType === "Invio" ? "bg-red-900 text-red-300" : ""}
                          ${txType === "Ricezione" ? "bg-green-900 text-green-300" : ""}
                          ${txType === "Self-Transfer" ? "bg-blue-900 text-blue-300" : ""}
                        `}>
                          {txType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {truncateAddress(tx.from)}
                        {tx.from === selectedAddress && <span className="text-xs text-gray-500 ml-1">(Tu)</span>}
                      </td>
                      <td className="py-3 px-4">
                        {truncateAddress(tx.to)}
                        {tx.to === selectedAddress && <span className="text-xs text-gray-500 ml-1">(Tu)</span>}
                      </td>
                      <td className="py-3 px-4">{tx.amount} GT</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Layer2Section; 