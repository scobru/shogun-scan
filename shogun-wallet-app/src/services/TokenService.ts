import { ethers, Contract } from 'ethers';
import { TokenInfo, TokenBalance, TokenList, TokenListItem } from '../types/token';

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
  private numericChainId: number = 1;     // Numeric chain ID, default to Ethereum mainnet
  private tokenLists: Map<string, TokenList> = new Map(); // Store token lists

  constructor(provider: ethers.JsonRpcProvider) {
    this.provider = provider;
    this.tokens = new Map();
    this.initializeChainId().then(() => {
      this.loadSavedTokens();
      this.fetchTokenLists();
    });
  }

  private async initializeChainId() {
    try {
      // Ottieni il chainId dalla rete
      const network = await this.provider.getNetwork();
      this.chainId = network.chainId.toString();
      this.numericChainId = Number(network.chainId);
      console.log(`TokenService inizializzato per la rete con ID: ${this.chainId}`);
    } catch (error) {
      console.error("Errore nel recupero dell'ID di rete:", error);
      this.chainId = 'unknown';
      this.numericChainId = 1; // Default to Ethereum mainnet
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

  // Fetch token lists from popular sources
  async fetchTokenLists() {
    try {
      // Fetch Uniswap token list
      try {
        const uniswapUrl = "https://gateway.ipfs.io/ipns/tokens.uniswap.org";
        const uniswapResponse = await fetch(uniswapUrl);
        if (uniswapResponse.ok) {
          const uniswapList: TokenList = await uniswapResponse.json();
          this.tokenLists.set('uniswap', uniswapList);
          console.log(`Caricati token Uniswap: ${uniswapList.tokens.length}`);
        } else {
          console.error(`Errore nel caricamento della lista Uniswap: ${uniswapResponse.statusText}`);
        }
      } catch (error) {
        console.error("Errore nel caricamento della lista Uniswap:", error);
      }
      
      // Fetch 1inch token list - specific to chainId
      try {
        const oneInchUrl = `https://tokens.1inch.io/v1.1/${this.numericChainId}`;
        const oneInchResponse = await fetch(oneInchUrl);
        
        if (oneInchResponse.ok) {
          // 1inch API returns a different format (object of objects), convert to standard format
          const oneInchData = await oneInchResponse.json();
          
          // Create a standard token list from 1inch format
          const oneInchTokens: TokenListItem[] = Object.values(oneInchData).map((token: any) => ({
            chainId: this.numericChainId,
            address: token.address,
            name: token.name,
            symbol: token.symbol,
            decimals: token.decimals,
            logoURI: token.logoURI
          }));
          
          const oneInchList: TokenList = {
            name: "1inch Token List",
            timestamp: new Date().toISOString(),
            tokens: oneInchTokens,
            version: {
              major: 1,
              minor: 0,
              patch: 0
            }
          };
          
          this.tokenLists.set('1inch', oneInchList);
          console.log(`Caricati token 1inch: ${oneInchTokens.length}`);
        } else {
          console.error(`Errore nel caricamento della lista 1inch: ${oneInchResponse.statusText}`);
        }
      } catch (error) {
        console.error("Errore nel caricamento della lista 1inch:", error);
      }
    } catch (error) {
      console.error("Errore generale nel caricamento delle liste di token:", error);
    }
  }

  // Get all tokens from lists for current chain
  getTokensFromLists(): TokenInfo[] {
    const tokens: TokenInfo[] = [];
    
    for (const list of this.tokenLists.values()) {
      // Filter tokens for current chain
      const chainTokens = list.tokens.filter(t => t.chainId === this.numericChainId);
      
      // Convert to TokenInfo format
      chainTokens.forEach(token => {
        tokens.push({
          address: token.address,
          symbol: token.symbol,
          decimals: token.decimals,
          name: token.name,
          logoURI: token.logoURI,
          chainId: token.chainId
        });
      });
    }
    
    return tokens;
  }

  // Auto-detect tokens in a wallet from token lists
  async detectTokensInWallet(walletAddress: string): Promise<TokenBalance[]> {
    const balances: TokenBalance[] = [];
    const listTokens = this.getTokensFromLists();
    const batchSize = 10; // Process tokens in batches to avoid rate limiting
    
    console.log(`Checking ${listTokens.length} tokens from lists for wallet ${walletAddress}`);
    
    let processedCount = 0;
    let lastLoggedPercentage = 0;
    
    // Process tokens in batches
    for (let i = 0; i < listTokens.length; i += batchSize) {
      const batch = listTokens.slice(i, i + batchSize);
      
      // Process batch concurrently
      const batchResults = await Promise.allSettled(
        batch.map(async (tokenInfo) => {
          try {
            const tokenContract = new Contract(tokenInfo.address, ERC20_ABI, this.provider);
            const balance = await tokenContract.balanceOf(walletAddress);
            
            // Only consider tokens with non-zero balance
            // Convert to string and check if it's not equal to '0'
            if (balance.toString() !== '0') {
              const formattedBalance = ethers.formatUnits(balance, tokenInfo.decimals);
              
              // Add token to the user's saved tokens
              this.tokens.set(tokenInfo.address.toLowerCase(), tokenInfo);
              
              return {
                token: tokenInfo,
                balance: balance.toString(),
                formattedBalance
              };
            }
            return null;
          } catch (error) {
            // Log error but continue with other tokens
            console.debug(`Error checking token ${tokenInfo.symbol || tokenInfo.address}:`, error);
            return null;
          }
        })
      );
      
      // Filter out failures and nulls
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          balances.push(result.value);
        }
      });
      
      // Log progress
      processedCount += batch.length;
      const percentage = Math.floor((processedCount / listTokens.length) * 100);
      
      if (percentage >= lastLoggedPercentage + 10) {
        lastLoggedPercentage = percentage;
        console.log(`Scansione token: ${percentage}% completata`);
      }
    }
    
    // Save the detected tokens
    if (balances.length > 0) {
      this.saveTokens();
      console.log(`Rilevati ${balances.length} token nel wallet`);
    } else {
      console.log('Nessun token trovato con saldo diverso da zero');
    }
    
    return balances;
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