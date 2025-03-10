import React, { useState, useEffect } from 'react';
import { TokenService } from '../services/TokenService';
import { TokenInfo, TokenBalance } from '../types/token';
import { ethers } from 'ethers';

interface TokenManagerProps {
  address: string;
  provider: ethers.JsonRpcProvider;
  networkId?: string;
}

export const TokenManager: React.FC<TokenManagerProps> = ({ address, provider, networkId }) => {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [newTokenAddress, setNewTokenAddress] = useState('');
  const [ethBalance, setEthBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenService, setTokenService] = useState<TokenService | null>(null);

  useEffect(() => {
    const service = new TokenService(provider);
    setTokenService(service);
    
    setTokens(service.getTokens());
    
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
        setTokens(tokenService.getTokens());
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

  return (
    <div className="space-y-4">
      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="text-xl font-bold mb-2">ETH Balance</h3>
        <p className="text-2xl">{ethBalance} ETH</p>
      </div>

      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="text-xl font-bold mb-4">Token ERC20</h3>
        
        <div className="flex gap-2 mb-4">
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

        {error && (
          <div className="text-red-500 mb-4">{error}</div>
        )}

        {loading && (
          <div className="text-blue-400 mb-4">Caricamento in corso...</div>
        )}

        <div className="space-y-2">
          {balances.length === 0 ? (
            <div className="text-gray-400 p-2">Nessun token aggiunto per questa rete</div>
          ) : (
            balances.map((balance) => (
              <div key={balance.token.address} className="flex justify-between items-center p-2 bg-gray-700 rounded">
                <div>
                  <span className="font-bold">{balance.token.symbol}</span>
                  <span className="text-gray-400 text-sm ml-2">({balance.token.name})</span>
                </div>
                <div>{balance.formattedBalance}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}; 