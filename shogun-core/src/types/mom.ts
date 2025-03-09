/**
 * Tipi per il modulo MOM (My Own Messages) secondo EIP-2848
 */

/**
 * Operazioni core supportate da MOM
 */
export enum MOMCoreOperation {
  ADD = 0x00,
  UPDATE = 0x01,
  REPLY = 0x02,
  DELETE = 0x03,
  CLOSE_ACCOUNT = 0xFD,
  RAW = 0xFF
}

/**
 * Operazioni estese supportate da MOM
 */
export enum MOMExtendedOperation {
  ADD_AND_REFER = 0x04,
  UPDATE_AND_REFER = 0x05,
  ENDORSE = 0x06,
  REMOVE_ENDORSEMENT = 0x07,
  DISAPPROVE = 0x08,
  REMOVE_DISAPPROVAL = 0x09,
  ENDORSE_AND_REPLY = 0x0A,
  DISAPPROVE_AND_REPLY = 0x0B
}

/**
 * Combinazione di tutte le operazioni MOM
 */
export type MOMOperation = MOMCoreOperation | MOMExtendedOperation;

/**
 * Interfaccia per un messaggio MOM
 */
export interface MOMMessage {
  /**
   * Multihash del contenuto del messaggio
   */
  multihash: string;
  
  /**
   * Contenuto del messaggio (opzionale, utilizzato dopo il download)
   */
  content?: string;
  
  /**
   * Tipo di contenuto (default: text/markdown)
   */
  contentType?: string;
  
  /**
   * Hash della transazione Ethereum che ha registrato il messaggio
   */
  transactionHash: string;
  
  /**
   * Indirizzo dell'autore del messaggio
   */
  author: string;
  
  /**
   * Timestamp del blocco in cui è stata inclusa la transazione
   */
  timestamp: number;
  
  /**
   * Eventuali messaggi di risposta
   */
  replies?: MOMMessage[];
  
  /**
   * Multihash del messaggio a cui si risponde (per REPLY, ENDORSE_AND_REPLY, ecc.)
   */
  replyTo?: string;
  
  /**
   * Indica se il messaggio è stato approvato
   */
  endorsed?: boolean;
  
  /**
   * Indica se il messaggio è stato disapprovato
   */
  disapproved?: boolean;
  
  /**
   * Indirizzi a cui si fa riferimento nel messaggio
   */
  references?: string[];
}

/**
 * Interfaccia per un messaggio non ancora inviato/registrato
 */
export interface MOMDraftMessage {
  /**
   * Contenuto del messaggio
   */
  content: string;
  
  /**
   * Tipo di contenuto (default: text/markdown)
   */
  contentType?: string;
  
  /**
   * Multihash del messaggio a cui si risponde (per REPLY, ENDORSE_AND_REPLY, ecc.)
   */
  replyTo?: string;
  
  /**
   * Indirizzi a cui si fa riferimento nel messaggio
   */
  references?: string[];
}

/**
 * Interfaccia per la transazione MOM
 */
export interface MOMTransaction {
  /**
   * Operazione MOM da effettuare
   */
  operation: MOMOperation;
  
  /**
   * Parametri dell'operazione (dipendono dall'operazione specifica)
   */
  parameters: string[];
  
  /**
   * Indirizzo dell'autore
   */
  from: string;
  
  /**
   * Hash della transazione Ethereum
   */
  transactionHash?: string;
}

/**
 * Opzioni per il client MOM
 */
export interface MOMOptions {
  /**
   * Provider Ethereum da utilizzare
   */
  provider: any;
  
  /**
   * Istanza GunDB da utilizzare per lo storage dei messaggi
   */
  gun?: any;
  
  /**
   * Tipo di storage da utilizzare (default: "gun")
   */
  storageType?: "gun" | "ipfs";
  
  /**
   * Gateway IPFS da utilizzare per il download dei contenuti (solo per storage IPFS)
   */
  ipfsGateway?: string;
  
  /**
   * Servizio IPFS da utilizzare per il caricamento dei contenuti (solo per storage IPFS)
   */
  ipfsService?: string;
} 