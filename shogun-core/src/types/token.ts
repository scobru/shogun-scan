export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  balance?: string;
}

export interface TokenBalance {
  token: TokenInfo;
  balance: string;
  formattedBalance: string;
} 