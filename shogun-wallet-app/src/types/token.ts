export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number | bigint;
  name: string;
}

export interface TokenBalance {
  token: TokenInfo;
  balance: string;
  formattedBalance: string;
} 