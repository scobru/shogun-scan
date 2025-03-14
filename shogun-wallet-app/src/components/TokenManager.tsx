import React, { useState, useEffect } from 'react';
import { TokenService } from '../services/TokenService';
import { TokenInfo, TokenBalance } from '../types/token';
import { ethers } from 'ethers';

interface TokenManagerProps {
  address: string;
  provider: ethers.JsonRpcProvider;
  networkId?: string;
  privateKey: string;
}

type TabType = 'tokens' | 'send' | 'receive';

export const TokenManager: React.FC<TokenManagerProps> = ({ address, provider, networkId, privateKey }) => {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [newTokenAddress, setNewTokenAddress] = useState('');
  const [ethBalance, setEthBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('tokens');
  const [sendAmount, setSendAmount] = useState('');
  const [sendAddress, setSendAddress] = useState('');
  const [sendToken, setSendToken] = useState<string>('eth');
  const [tokenService, setTokenService] = useState<TokenService | null>(null);

  useEffect(() => {
    if (scanning) {
      const originalConsoleLog = console.log;
      
      console.log = function(...args) {
        const message = args.join(' ');
        if (message.includes('Scansione token:')) {
          setScanStatus(message);
        } else if (message.includes('Rilevati')) {
          setScanStatus(`Completato: ${message}`);
        }
        originalConsoleLog.apply(console, args);
      };
      
      return () => {
        console.log = originalConsoleLog;
      };
    }
  }, [scanning]);

  useEffect(() => {
    const service = new TokenService(provider);
    setTokenService(service);
    
    const loadTokens = async () => {
      const tokensList = await service.getTokens();
      setTokens(tokensList);
    };
    
    loadTokens();
    loadBalances(service);
  }, [provider, networkId]);

  useEffect(() => {
    if (tokenService && address) {
      loadBalances(tokenService);
    }
  }, [address, tokenService]);

  const loadBalances = async (service: TokenService) => {
    try {
      setLoading(true);
      const ethBal = await service.getETHBalance(address);
      setEthBalance(ethBal);

      const tokenBalances = await service.getAllTokenBalances(address);
      setBalances(tokenBalances);
    } catch (error) {
      console.error("Errore nel caricamento dei balance:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToken = async () => {
    if (!tokenService) return;
    
    setLoading(true);
    setError('');

    try {
      const tokenInfo = await tokenService.addToken(newTokenAddress);
      if (tokenInfo) {
        const updatedTokens = await tokenService.getTokens();
        setTokens(updatedTokens);
        setNewTokenAddress('');
        await loadBalances(tokenService);
      } else {
        setError('Impossibile aggiungere il token');
      }
    } catch (error) {
      setError('Errore nell\'aggiunta del token');
    } finally {
      setLoading(false);
    }
  };

  const handleScanTokens = async () => {
    if (!tokenService) return;
    
    setScanning(true);
    setError('');
    setScanStatus('Avvio scansione token...');
    
    try {
      const detectedTokens = await tokenService.detectTokensInWallet(address);
      
      if (detectedTokens.length > 0) {
        const updatedTokens = await tokenService.getTokens();
        setTokens(updatedTokens);
        
        setBalances(prev => {
          const existingAddresses = new Set(prev.map(b => b.token.address.toLowerCase()));
          const newBalances = detectedTokens.filter(
            b => !existingAddresses.has(b.token.address.toLowerCase())
          );
          return [...prev, ...newBalances];
        });
        
        setScanStatus(`Completato: trovati ${detectedTokens.length} token`);
      } else {
        setScanStatus('Nessun token trovato con saldo diverso da zero');
      }
    } catch (error) {
      console.error("Errore nella scansione dei token:", error);
      setError('Errore nella ricerca automatica di token');
      setScanStatus('Errore durante la scansione');
    } finally {
      setScanning(false);
    }
  };

  const handleSendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sendAmount || !sendAddress || !provider) {
      setError('Inserisci un importo e un indirizzo validi');
      return;
    }
    
    // Conferma dall'utente
    if (!window.confirm(`Conferma invio di ${sendAmount} ${sendToken === 'eth' ? 'ETH' : 
      tokens.find(t => t.address === sendToken)?.symbol || sendToken} a ${sendAddress}`)) {
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Verifica che la privateKey sia valida e nel formato corretto
      if (!privateKey || privateKey.trim() === '') {
        throw new Error('Chiave privata non disponibile. Impossibile firmare la transazione.');
      }
      
      // Assicuriamoci che la chiave privata sia nel formato corretto
      let formattedPrivateKey = privateKey;
      if (!formattedPrivateKey.startsWith('0x')) {
        formattedPrivateKey = '0x' + formattedPrivateKey;
      }
      
      // Crea il wallet dell'utente con la chiave privata
      const wallet = new ethers.Wallet(formattedPrivateKey, provider);
      
      // Verifica che l'indirizzo del wallet corrisponda all'indirizzo fornito
      if (wallet.address.toLowerCase() !== address.toLowerCase()) {
        console.warn('Il wallet generato ha un indirizzo diverso da quello atteso', {
          expected: address,
          actual: wallet.address
        });
      }
      
      let tx;
      
      // Invio di ETH nativo
      if (sendToken === 'eth') {
        // Preparazione della transazione
        tx = await wallet.sendTransaction({
          to: sendAddress,
          value: ethers.parseEther(sendAmount),
        });
      } 
      // Invio di token ERC-20
      else {
        // Trova il token nell'elenco
        const tokenInfo = tokens.find(t => t.address === sendToken);
        
        if (!tokenInfo) {
          throw new Error('Token non trovato');
        }
        
        // Crea un'istanza del contratto del token
        const tokenContract = new ethers.Contract(
          sendToken,
          ['function transfer(address to, uint256 amount) returns (bool)'],
          wallet
        );
        
        // Calcola l'importo in base alle decimals del token
        const amount = ethers.parseUnits(sendAmount, tokenInfo.decimals);
        
        // Esegui il metodo transfer del token
        tx = await tokenContract.transfer(sendAddress, amount);
      }
      
      // Attendi la conferma della transazione
      await tx.wait();
      
      // Mostra messaggio di successo
      alert(`Transazione completata! Hash: ${tx.hash}`);
      
      // Pulisci il form
      setSendAmount('');
      setSendAddress('');
      
      // Aggiorna i saldi
      await loadBalances(tokenService!);
      
    } catch (error: any) {
      console.error('Errore durante l\'invio:', error);
      setError(`Errore: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setLoading(false);
    }
  };

  // Rendering delle tabs
  const renderTabButtons = () => {
    return (
      <div className="flex mb-6 bg-gray-900 rounded-lg p-1">
        <button 
          onClick={() => setActiveTab('tokens')}
          className={`flex-1 px-4 py-2 rounded-md text-center ${activeTab === 'tokens' 
            ? 'bg-gray-800 text-white' 
            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
        >
          I tuoi Token
        </button>
        <button 
          onClick={() => setActiveTab('send')}
          className={`flex-1 px-4 py-2 rounded-md text-center ${activeTab === 'send' 
            ? 'bg-gray-800 text-white' 
            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
        >
          Invia
        </button>
        <button 
          onClick={() => setActiveTab('receive')}
          className={`flex-1 px-4 py-2 rounded-md text-center ${activeTab === 'receive' 
            ? 'bg-gray-800 text-white' 
            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
        >
          Ricevi
        </button>
      </div>
    );
  };

  // Rendering della lista dei token
  const renderTokenList = () => {
    return (
      <>
        <div className="flex flex-col gap-3 mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newTokenAddress}
              onChange={(e) => setNewTokenAddress(e.target.value)}
              placeholder="Indirizzo del token"
              className="flex-1 p-2 bg-gray-700 rounded"
            />
            <button
              onClick={handleAddToken}
              disabled={loading || !newTokenAddress}
              className={`px-4 py-2 rounded ${
                loading || !newTokenAddress ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              } text-white transition-colors`}
            >
              {loading ? 'Aggiunta...' : 'Aggiungi Token'}
            </button>
          </div>
          
          <button
            onClick={handleScanTokens}
            disabled={scanning || loading}
            className={`w-full py-2 rounded ${
              scanning || loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
            } text-white transition-colors flex justify-center items-center`}
          >
            {scanning ? (
              <>
                <span className="mr-2">Ricerca in corso...</span>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </>
            ) : 'Rileva automaticamente i token'}
          </button>
        </div>

        {error && (
          <div className="text-red-500 mb-4">{error}</div>
        )}

        {scanning && scanStatus && (
          <div className="text-blue-400 mb-4 bg-gray-700 p-2 rounded">
            <div className="mb-2">Stato scansione:</div>
            <div className="pl-2">{scanStatus}</div>
          </div>
        )}

        {loading && !scanning && (
          <div className="text-blue-400 mb-4">Caricamento in corso...</div>
        )}

        <div className="space-y-2">
          {balances.length === 0 ? (
            <div className="text-gray-400 p-2">Nessun token aggiunto per questa rete</div>
          ) : (
            balances.map((balance) => (
              <div key={balance.token.address} className="flex justify-between items-center p-2 bg-gray-700 rounded">
                <div className="flex items-center">
                  {balance.token.logoURI && (
                    <img 
                      src={balance.token.logoURI} 
                      alt={balance.token.symbol} 
                      className="w-6 h-6 mr-2 rounded-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  <div>
                    <span className="font-bold">{balance.token.symbol}</span>
                    <span className="text-gray-400 text-sm ml-2">({balance.token.name})</span>
                  </div>
                </div>
                <div>{balance.formattedBalance}</div>
              </div>
            ))
          )}
        </div>
      </>
    );
  };

  // Rendering del tab di invio
  const renderSendTab = () => {
    return (
      <form onSubmit={handleSendSubmit} className="space-y-4">
        <div>
          <label htmlFor="sendToken" className="block text-sm text-gray-400 mb-1">
            Seleziona Token
          </label>
          <select
            id="sendToken"
            value={sendToken}
            onChange={(e) => setSendToken(e.target.value)}
            className="w-full p-2 bg-gray-700 rounded"
          >
            <option value="eth">ETH</option>
            {balances.map(balance => (
              <option key={balance.token.address} value={balance.token.address}>
                {balance.token.symbol} ({balance.formattedBalance})
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="sendAmount" className="block text-sm text-gray-400 mb-1">
            Importo {sendToken === 'eth' ? '(ETH)' : ''}
          </label>
          <input
            id="sendAmount"
            type="text"
            value={sendAmount}
            onChange={(e) => setSendAmount(e.target.value)}
            placeholder="0.0"
            className="w-full p-2 bg-gray-700 rounded"
          />
        </div>
        
        <div>
          <label htmlFor="sendAddress" className="block text-sm text-gray-400 mb-1">
            Indirizzo Destinatario
          </label>
          <input
            id="sendAddress"
            type="text"
            value={sendAddress}
            onChange={(e) => setSendAddress(e.target.value)}
            placeholder="0x..."
            className="w-full p-2 bg-gray-700 rounded"
          />
        </div>
        
        <div className="flex gap-4 mt-6">
          <button
            type="submit"
            disabled={!sendAmount || !sendAddress}
            className={`flex-1 py-3 rounded ${
              !sendAmount || !sendAddress ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            } text-white transition-colors`}
          >
            Invia
          </button>
          
          <button
            type="button"
            onClick={() => {
              setSendAmount('');
              setSendAddress('');
              setSendToken('eth');
            }}
            className="flex-1 py-3 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          >
            Annulla
          </button>
        </div>
      </form>
    );
  };

  // Rendering del tab di ricezione
  const renderReceiveTab = () => {
    return (
      <div className="space-y-4 text-center">
        <div className="bg-white p-4 rounded-lg inline-block mx-auto">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            width="200" 
            height="200"
            className="mx-auto"
          >
            <rect width="100%" height="100%" fill="#fff" />
            <text 
              x="50%" 
              y="50%" 
              dominantBaseline="middle" 
              textAnchor="middle" 
              fill="#000" 
              fontSize="10"
            >
              QR Code for {address.substring(0, 6)}...{address.substring(address.length - 4)}
            </text>
          </svg>
        </div>
        
        <div className="bg-gray-700 p-2 rounded break-all">
          <p className="text-sm mb-1 text-gray-400">Il tuo indirizzo:</p>
          <p className="font-mono">{address}</p>
        </div>
        
        <button
          onClick={() => {
            navigator.clipboard.writeText(address);
            alert('Indirizzo copiato negli appunti!');
          }}
          className="bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded text-white transition-colors"
        >
          Copia Indirizzo
        </button>
      </div>
    );
  };

  // Selezione del tab attivo
  const renderActiveTab = () => {
    switch(activeTab) {
      case 'send':
        return renderSendTab();
      case 'receive':
        return renderReceiveTab();
      default:
        return renderTokenList();
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 p-4 rounded-lg">
        <h2 className="text-xl font-bold mb-1">Il tuo wallet</h2>
        <p className="text-gray-400 text-sm mb-3 break-all">{address}</p>
        <div>
          <h3 className="text-gray-400 text-sm">ETH Balance</h3>
          <p className="text-2xl">{ethBalance} ETH</p>
        </div>
      </div>

      <div className="bg-gray-800 p-4 rounded-lg">
        {renderTabButtons()}
        {renderActiveTab()}
      </div>
    </div>
  );
}; 