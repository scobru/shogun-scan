import { ethers, Contract } from 'ethers';
import { TokenInfo, TokenBalance } from '../types/token';

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

export class TokenService {
  private provider: ethers.JsonRpcProvider;
  private tokens: Map<string, TokenInfo>; // chiave: indirizzo token
  private chainId: string = 'unknown';    // ID della blockchain corrente

  constructor(provider: ethers.JsonRpcProvider) {
    this.provider = provider;
    this.tokens = new Map();
    this.initializeChainId().then(() => {
      this.loadSavedTokens();
    });
  }

  private async initializeChainId() {
    try {
      // Ottieni il chainId dalla rete
      const network = await this.provider.getNetwork();
      this.chainId = network.chainId.toString();
      console.log(`TokenService inizializzato per la rete con ID: ${this.chainId}`);
    } catch (error) {
      console.error("Errore nel recupero dell'ID di rete:", error);
      this.chainId = 'unknown';
    }
  }

  private getTokenStorageKey() {
    return `tokens_${this.chainId}`;
  }

  private loadSavedTokens() {
    const savedTokens = localStorage.getItem(this.getTokenStorageKey());
    if (savedTokens) {
      try {
        const tokens = JSON.parse(savedTokens);
        tokens.forEach((token: TokenInfo) => {
          this.tokens.set(token.address.toLowerCase(), token);
        });
        console.log(`Caricati ${tokens.length} token per la rete ${this.chainId}`);
      } catch (error) {
        console.error("Errore nel caricamento dei token salvati:", error);
      }
    }
  }

  private saveTokens() {
    // Converti BigInt in stringhe prima di salvare
    const tokensToSave = Array.from(this.tokens.values()).map(token => ({
      ...token,
      decimals: typeof token.decimals === 'bigint' ? Number(token.decimals) : token.decimals
    }));
    
    localStorage.setItem(this.getTokenStorageKey(), JSON.stringify(tokensToSave));
  }

  async getETHBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error("Errore nel recupero del balance ETH:", error);
      return "0";
    }
  }

  async addToken(tokenAddress: string): Promise<TokenInfo | null> {
    try {
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, this.provider);
      
      const [decimals, symbol, name] = await Promise.all([
        tokenContract.decimals(),
        tokenContract.symbol(),
        tokenContract.name()
      ]);

      const tokenInfo: TokenInfo = {
        address: tokenAddress,
        symbol,
        decimals,
        name
      };

      this.tokens.set(tokenAddress.toLowerCase(), tokenInfo);
      this.saveTokens();

      return tokenInfo;
    } catch (error) {
      console.error("Errore nell'aggiunta del token:", error);
      return null;
    }
  }

  async getTokenBalance(walletAddress: string, tokenAddress: string): Promise<TokenBalance | null> {
    try {
      const tokenInfo = this.tokens.get(tokenAddress.toLowerCase());
      if (!tokenInfo) {
        throw new Error("Token non trovato");
      }

      const tokenContract = new Contract(tokenAddress, ERC20_ABI, this.provider);
      const balance = await tokenContract.balanceOf(walletAddress);
      const formattedBalance = ethers.formatUnits(balance, tokenInfo.decimals);

      return {
        token: tokenInfo,
        balance: balance.toString(),
        formattedBalance
      };
    } catch (error) {
      console.error("Errore nel recupero del balance del token:", error);
      return null;
    }
  }

  async getAllTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];
    
    for (const tokenInfo of this.tokens.values()) {
      const balance = await this.getTokenBalance(walletAddress, tokenInfo.address);
      if (balance) {
        balances.push(balance);
      }
    }

    return balances;
  }

  async getTokens(): Promise<TokenInfo[]> {
    return Array.from(this.tokens.values());
  }
} 