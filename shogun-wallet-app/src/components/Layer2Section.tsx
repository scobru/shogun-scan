import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// ABI minimo per interagire con il contratto GunL2
const GunL2ABI = [
  "function requestWithdraw(uint256 amount) external",
  "function getBalance(address user) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function deposit() external payable"
];

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
  
  // Stati per l'invio di GT
  const [recipient, setRecipient] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [processing, setProcessing] = useState<boolean>(false);
  
  // Stati per il prelievo
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [withdrawing, setWithdrawing] = useState<boolean>(false);

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

  // Funzione per inviare GT
  const sendGT = async () => {
    if (!selectedAddress || !recipient || !amount || !sdk) {
      setError("Informazioni mancanti. Verifica indirizzo destinatario e importo.");
      return;
    }
    
    try {
      setProcessing(true);
      setError("");
      
      // Trova la chiave privata dell'indirizzo selezionato
      const wallet = sdk.getMainWallet();
      
      if (!wallet) {
        throw new Error("Wallet non trovato");
      }
      
      // Utilizza il metodo dell'SDK per inviare GT
      await sdk.sendGT(
        selectedAddress,
        recipient,
        parseFloat(amount),
        wallet.privateKey
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
    if (!selectedAddress || !withdrawAmount || !sdk || !provider) {
      setError("Informazioni mancanti. Verifica l'importo del prelievo.");
      return;
    }
    
    try {
      setWithdrawing(true);
      setError("");
      
      // Trova la chiave privata dell'indirizzo selezionato
      const wallet = sdk.getMainWallet();
      
      if (!wallet) {
        throw new Error("Wallet non trovato");
      }
      
      // Utilizza il metodo dell'SDK per richiedere il prelievo
      await sdk.requestWithdrawGT(
        parseFloat(withdrawAmount),
        selectedAddress,
        wallet.privateKey,
        contractAddress,
        GunL2ABI
      );
      
      // Aggiorna saldo
      await loadGTBalance();
      
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

  // Funzione per depositare ETH e ricevere GT
  const depositETH = async () => {
    if (!selectedAddress || !depositAmount || !provider || !contractAddress) {
      setError("Informazioni mancanti. Verifica l'importo del deposito.");
      return;
    }
    
    try {
      setDepositing(true);
      setError("");
      
      // Trova il wallet dell'utente
      const wallet = sdk.getMainWallet();
      
      if (!wallet) {
        throw new Error("Wallet non trovato");
      }
      
      // Crea un'istanza del contratto con signer
      const walletWithProvider = new ethers.Wallet(wallet.privateKey, provider);
      const contract = new ethers.Contract(contractAddress, GunL2ABI, walletWithProvider);
      
      // Converti l'importo in wei
      const valueInWei = ethers.parseEther(depositAmount);
      
      // Invia la transazione di deposito
      const tx = await contract.deposit({ value: valueInWei });
      
      // Attendi che la transazione sia confermata
      await tx.wait();
      
      // Aggiorna i saldi
      await loadGTBalance();
      await loadNativeBalance();
      
      // Pulisci il campo
      setDepositAmount("");
      
      setDepositing(false);
      
      // Mostra messaggio di successo
      setError("Deposito completato con successo!");
      setTimeout(() => setError(""), 3000);
      
    } catch (error: any) {
      console.error("Errore nel deposito di ETH:", error);
      setError(`Errore nel deposito: ${error.message}`);
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
      
      {/* Messaggio di errore/successo */}
      {error && (
        <div className={`p-4 mb-6 rounded-lg ${error.includes("successo") ? "bg-green-800 bg-opacity-30" : "bg-red-800 bg-opacity-30"}`}>
          <p className={error.includes("successo") ? "text-green-300" : "text-red-300"}>
            {error}
          </p>
        </div>
      )}
      
      {/* Sezione Saldo */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <h3 className="text-xl font-bold mb-4">Saldo GT</h3>
        <div className="flex items-center justify-between">
          <div className="text-3xl font-bold">
            {loading ? "Caricamento..." : `${gtBalance} GT`}
          </div>
          <button 
            className="p-3 bg-blue-600 hover:bg-blue-700 rounded"
            onClick={loadGTBalance}
            disabled={loading}
          >
            Aggiorna Saldo
          </button>
        </div>
        <div className="mt-2 text-sm text-gray-400">
          Saldo ETH: {nativeBalance} ETH
        </div>
      </div>
      
      {/* Grid a 3 colonne per Deposito, Invio e Prelievo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Sezione Deposito */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">Deposita ETH</h3>
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
          </div>
          <button
            className="w-full p-3 bg-blue-600 hover:bg-blue-700 rounded flex items-center justify-center"
            onClick={depositETH}
            disabled={depositing || !selectedAddress}
          >
            {depositing ? "Elaborazione..." : "Deposita ETH"}
          </button>
          <p className="text-sm text-gray-400 mt-2">
            Deposita ETH per ricevere un equivalente in GT nel Layer2
          </p>
        </div>
        
        {/* Sezione Invio GT */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">Invia GT</h3>
          <div className="mb-4">
            <label className="block text-gray-400 mb-2">Destinatario</label>
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
          </div>
          <button
            className="w-full p-3 bg-green-600 hover:bg-green-700 rounded flex items-center justify-center"
            onClick={sendGT}
            disabled={processing || !selectedAddress}
          >
            {processing ? "Elaborazione..." : "Invia GT"}
          </button>
        </div>
        
        {/* Sezione Richiesta Prelievo */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">Richiedi Prelievo</h3>
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
          </div>
          <button
            className="w-full p-3 bg-purple-600 hover:bg-purple-700 rounded flex items-center justify-center"
            onClick={requestWithdraw}
            disabled={withdrawing || !selectedAddress}
          >
            {withdrawing ? "Elaborazione..." : "Richiedi Prelievo"}
          </button>
          <p className="text-sm text-gray-400 mt-2">
            Nota: Il prelievo richiede la conferma on-chain e può richiedere gas.
          </p>
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
                  <th className="text-left py-3 px-4">Da</th>
                  <th className="text-left py-3 px-4">A</th>
                  <th className="text-left py-3 px-4">Importo</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, index) => (
                  <tr key={index} className="border-b border-gray-700 hover:bg-gray-700">
                    <td className="py-3 px-4">{formatDate(tx.timestamp)}</td>
                    <td className="py-3 px-4">{truncateAddress(tx.from)}</td>
                    <td className="py-3 px-4">{truncateAddress(tx.to)}</td>
                    <td className="py-3 px-4">{tx.amount} GT</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Layer2Section; 