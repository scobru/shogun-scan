export interface WalletInfo {
  wallet: any;
  path: string;
  getAddressString: () => string;
  address?: string;
}

export interface ConversationData {
  id: string;
  recipient: string;
  recipientType: string;
  recipientPubKey: string;
  messages: MessageData[];
}

export interface MessageData {
  id: string;
  sender: string;
  senderName: string;
  content: string;
  timestamp: number;
  isCurrentUser: boolean;
}

export interface MessageConstants {
  mismatched: string;
  empty: string;
  exists: string;
  invalid: string;
  signedIn: {
    header: string;
    body: string;
  };
  signedOut: {
    header: string;
    body: string;
    instructions: string;
  };
  metamaskMessage: string;
  webauthnMessage: string;
}

export interface RpcOption {
  value: string;
  label: string;
  url: string;
}

export interface SearchResult {
  type: string;
  key: string;
  data: any;
  epub: string;
  username: string;
} 