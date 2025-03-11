export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number | bigint;
  name: string;
  logoURI?: string;  // URL dell'icona del token
  chainId?: number;  // Chain ID dove il token è disponibile
}

export interface TokenBalance {
  token: TokenInfo;
  balance: string;
  formattedBalance: string;
}

// Interfaccia per le liste di token (TokenList standard)
export interface TokenList {
  name: string;
  logoURI?: string;
  timestamp: string;
  tokens: TokenListItem[];
  version: {
    major: number;
    minor: number;
    patch: number;
  };
}

// Interfaccia per i token nelle liste 
export interface TokenListItem {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
} 