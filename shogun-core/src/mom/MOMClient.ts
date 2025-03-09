import { ethers } from 'ethers';
import { 
  MOMCoreOperation, 
  MOMExtendedOperation, 
  MOMMessage, 
  MOMDraftMessage, 
  MOMTransaction,
  MOMOptions
} from '../types/mom';
import CONFIG from '../config';
import { log } from '../utils/logger';

/**
 * Client per gestire messaggi secondo lo standard EIP-2848 (My Own Messages)
 */
export class MOMClient {
  private provider: ethers.JsonRpcProvider;
  private ipfsGateway: string;
  private ipfsService: string;
  private gun: any;
  private storageType: "gun" | "ipfs";
  
  // Cache dei messaggi per indirizzo
  private messageCache: Map<string, MOMMessage[]> = new Map();
  
  /**
   * Costruttore del client MOM
   * @param options Opzioni di configurazione
   */
  constructor(options: MOMOptions) {
    this.provider = options.provider;
    this.gun = options.gun;
    this.storageType = options.storageType || CONFIG.MOM.DEFAULT_STORAGE;
    this.ipfsGateway = options.ipfsGateway || CONFIG.MOM.IPFS_GATEWAY;
    this.ipfsService = options.ipfsService || CONFIG.MOM.IPFS_SERVICE;
    
    log(`MOMClient inizializzato con storage: ${this.storageType}`);
  }
  
  /**
   * Genera una transazione MOM
   * @param operation Operazione da eseguire
   * @param parameters Parametri dell'operazione
   * @param sender Indirizzo del mittente
   * @returns Dati per la transazione
   */
  public createMOMTransaction(
    operation: MOMCoreOperation | MOMExtendedOperation,
    parameters: string[],
    sender: string
  ): MOMTransaction {
    // Verifica che i parametri siano conformi all'operazione
    this.validateParameters(operation, parameters);
    
    return {
      operation,
      parameters,
      from: sender
    };
  }
  
  /**
   * Valida i parametri per un'operazione
   * @param operation Operazione da validare
   * @param parameters Parametri da validare
   * @throws Error se i parametri non sono validi
   */
  private validateParameters(operation: MOMCoreOperation | MOMExtendedOperation, parameters: string[]): void {
    switch (operation) {
      case MOMCoreOperation.ADD:
      case MOMCoreOperation.DELETE:
      case MOMCoreOperation.CLOSE_ACCOUNT:
      case MOMExtendedOperation.ENDORSE:
      case MOMExtendedOperation.REMOVE_ENDORSEMENT:
      case MOMExtendedOperation.DISAPPROVE:
      case MOMExtendedOperation.REMOVE_DISAPPROVAL:
        if (parameters.length !== 1) {
          throw new Error(`L'operazione ${operation} richiede esattamente 1 parametro`);
        }
        break;
        
      case MOMCoreOperation.UPDATE:
      case MOMCoreOperation.REPLY:
      case MOMExtendedOperation.ENDORSE_AND_REPLY:
      case MOMExtendedOperation.DISAPPROVE_AND_REPLY:
        if (parameters.length !== 2) {
          throw new Error(`L'operazione ${operation} richiede esattamente 2 parametri`);
        }
        break;
        
      case MOMExtendedOperation.ADD_AND_REFER:
        if (parameters.length !== 2) {
          throw new Error(`L'operazione ${operation} richiede esattamente 2 parametri`);
        }
        // Verifica che il secondo parametro sia un indirizzo valido
        if (!ethers.isAddress(parameters[1])) {
          throw new Error('Il secondo parametro deve essere un indirizzo valido');
        }
        break;
        
      case MOMExtendedOperation.UPDATE_AND_REFER:
        if (parameters.length !== 3) {
          throw new Error(`L'operazione ${operation} richiede esattamente 3 parametri`);
        }
        // Verifica che il terzo parametro sia un indirizzo valido
        if (!ethers.isAddress(parameters[2])) {
          throw new Error('Il terzo parametro deve essere un indirizzo valido');
        }
        break;
        
      case MOMCoreOperation.RAW:
        if (parameters.length < 1) {
          throw new Error(`L'operazione ${operation} richiede almeno 1 parametro`);
        }
        break;
        
      default:
        throw new Error(`Operazione ${operation} non supportata`);
    }
  }
  
  /**
   * Converte una transazione MOM in dati da inviare
   * @param transaction Transazione MOM
   * @returns Dati esadecimali da includere nella transazione Ethereum
   */
  public encodeMOMTransaction(transaction: MOMTransaction): string {
    // Il primo byte è l'operazione
    let data = '0x' + transaction.operation.toString(16).padStart(2, '0');
    
    // Aggiungi i parametri
    for (const param of transaction.parameters) {
      // Se il parametro è un indirizzo, rimuovi 0x e aggiungi i byte
      if (param.startsWith('0x') && param.length === 42) {
        data += param.slice(2);
      } else {
        // Altrimenti, è un multihash, aggiungilo direttamente
        data += param;
      }
    }
    
    return data;
  }
  
  /**
   * Decodifica i dati di una transazione MOM
   * @param data Dati esadecimali della transazione
   * @returns Transazione MOM decodificata
   */
  public decodeMOMTransaction(data: string, from: string): MOMTransaction | null {
    // Rimuovi 0x se presente
    data = data.startsWith('0x') ? data.slice(2) : data;
    
    // Verifica la lunghezza minima (almeno 1 byte per l'operazione e 1 byte per un parametro)
    if (data.length < 2) {
      return null;
    }
    
    // Estrai l'operazione (primo byte)
    const operationCode = parseInt(data.slice(0, 2), 16);
    let operation: MOMCoreOperation | MOMExtendedOperation;
    
    // Verifica che l'operazione sia valida
    if (Object.values(MOMCoreOperation).includes(operationCode as MOMCoreOperation)) {
      operation = operationCode as MOMCoreOperation;
    } else if (Object.values(MOMExtendedOperation).includes(operationCode as MOMExtendedOperation)) {
      operation = operationCode as MOMExtendedOperation;
    } else {
      return null; // Operazione non supportata
    }
    
    // Estrai i parametri in base all'operazione
    const parameters: string[] = [];
    let remainingData = data.slice(2); // Rimuovi l'operazione
    
    switch (operation) {
      case MOMCoreOperation.ADD:
      case MOMCoreOperation.DELETE:
      case MOMCoreOperation.CLOSE_ACCOUNT:
      case MOMExtendedOperation.ENDORSE:
      case MOMExtendedOperation.REMOVE_ENDORSEMENT:
      case MOMExtendedOperation.DISAPPROVE:
      case MOMExtendedOperation.REMOVE_DISAPPROVAL:
        // Un solo parametro: tutto il resto è il multihash
        parameters.push(remainingData);
        break;
        
      case MOMCoreOperation.UPDATE:
      case MOMCoreOperation.REPLY:
      case MOMExtendedOperation.ENDORSE_AND_REPLY:
      case MOMExtendedOperation.DISAPPROVE_AND_REPLY:
        // Due multihash, assumiamo che siano di lunghezza fissa (per semplicità)
        // In una implementazione reale, dovremmo avere un modo per determinare la lunghezza esatta
        const halfLength = Math.floor(remainingData.length / 2);
        parameters.push(remainingData.slice(0, halfLength));
        parameters.push(remainingData.slice(halfLength));
        break;
        
      case MOMExtendedOperation.ADD_AND_REFER:
        // Un multihash seguito da un indirizzo (40 caratteri)
        const addressStartPos = remainingData.length - 40;
        parameters.push(remainingData.slice(0, addressStartPos));
        parameters.push('0x' + remainingData.slice(addressStartPos));
        break;
        
      case MOMExtendedOperation.UPDATE_AND_REFER:
        // Due multihash seguiti da un indirizzo (40 caratteri)
        const addrPos = remainingData.length - 40;
        const multihashPart = remainingData.slice(0, addrPos);
        const midPoint = Math.floor(multihashPart.length / 2);
        
        parameters.push(multihashPart.slice(0, midPoint));
        parameters.push(multihashPart.slice(midPoint));
        parameters.push('0x' + remainingData.slice(addrPos));
        break;
        
      case MOMCoreOperation.RAW:
        // Tutto il resto è dati raw
        parameters.push(remainingData);
        break;
        
      default:
        return null; // Operazione non supportata
    }
    
    return {
      operation,
      parameters,
      from
    };
  }
  
  /**
   * Carica un contenuto nel sistema di storage e restituisce il multihash
   * @param content Contenuto da caricare
   * @returns Multihash del contenuto
   */
  private async uploadToStorage(content: string): Promise<string> {
    if (this.storageType === "gun") {
      return this.uploadToGun(content);
    } else {
      return this.uploadToIPFS(content);
    }
  }
  
  /**
   * Carica un contenuto su GunDB e restituisce il multihash
   * @param content Contenuto da caricare
   * @returns Multihash del contenuto
   */
  private async uploadToGun(content: string): Promise<string> {
    if (!this.gun) {
      throw new Error("Gun non inizializzato. Impossibile caricare il contenuto.");
    }
    
    // Genera un ID univoco per il contenuto (simile a multihash)
    const contentHash = await this.generateContentHash(content);
    
    // Memorizza il contenuto in GunDB
    await new Promise<void>((resolve, reject) => {
      try {
        this.gun
          .get(CONFIG.GUN_TABLES.MOM_MESSAGES)
          .get(contentHash)
          .put({ content, timestamp: Date.now() }, (ack: any) => {
            if (ack.err) {
              reject(new Error(`Errore caricamento contenuto su GunDB: ${ack.err}`));
            } else {
              resolve();
            }
          });
      } catch (error) {
        reject(error);
      }
    });
    
    return contentHash;
  }
  
  /**
   * Genera un hash del contenuto
   * @param content Contenuto da cui generare l'hash
   * @returns Hash del contenuto in formato simile a multihash
   */
  private async generateContentHash(content: string): Promise<string> {
    // Utilizziamo ethers.js per generare una keccak256 hash
    const hash = ethers.keccak256(ethers.toUtf8Bytes(content));
    
    // Convertiamo in formato simile a multihash (prefisso "Qm")
    return "Qm" + hash.slice(2, 44);
  }
  
  /**
   * Carica un contenuto su IPFS e restituisce il multihash
   * @param content Contenuto da caricare
   * @returns Multihash del contenuto
   */
  private async uploadToIPFS(content: string): Promise<string> {
    // TODO: Implementare l'upload effettivo su IPFS
    // Per ora utilizziamo una funzione mock che genera un hash fittizio
    const mockMultihash = 'Qm' + Array.from({ length: 44 }, () => 
      '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'[
        Math.floor(Math.random() * 62)
      ]).join('');
    
    return mockMultihash;
  }
  
  /**
   * Recupera il contenuto di un messaggio dal sistema di storage
   * @param multihash Multihash del contenuto
   * @returns Contenuto del messaggio
   */
  public async getContentFromStorage(multihash: string): Promise<string> {
    if (this.storageType === "gun") {
      return this.getContentFromGun(multihash);
    } else {
      return this.getContentFromIPFS(multihash);
    }
  }
  
  /**
   * Recupera il contenuto di un messaggio da GunDB
   * @param contentHash Hash del contenuto
   * @returns Contenuto del messaggio
   */
  private async getContentFromGun(contentHash: string): Promise<string> {
    if (!this.gun) {
      throw new Error("Gun non inizializzato. Impossibile recuperare il contenuto.");
    }
    
    return new Promise<string>((resolve, reject) => {
      try {
        this.gun
          .get(CONFIG.GUN_TABLES.MOM_MESSAGES)
          .get(contentHash)
          .once((data: any) => {
            if (data && data.content) {
              resolve(data.content);
            } else {
              reject(new Error(`Contenuto non trovato per hash: ${contentHash}`));
            }
          });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Recupera il contenuto di un messaggio da IPFS
   * @param multihash Multihash del contenuto
   * @returns Contenuto del messaggio
   */
  private async getContentFromIPFS(multihash: string): Promise<string> {
    // TODO: Implementare il recupero effettivo da IPFS
    // Per ora restituiamo un contenuto fittizio
    return `Contenuto del messaggio con multihash ${multihash}`;
  }
  
  /**
   * Pubblica un messaggio MOM
   * @param wallet Wallet Ethereum per firmare la transazione
   * @param message Messaggio da pubblicare
   * @param operation Operazione da eseguire
   * @param additionalParams Parametri aggiuntivi (es. indirizzo da riferire)
   * @returns Hash della transazione
   */
  public async publishMessage(
    wallet: ethers.Wallet,
    message: MOMDraftMessage,
    operation: MOMCoreOperation | MOMExtendedOperation = MOMCoreOperation.ADD,
    additionalParams: string[] = []
  ): Promise<string> {
    // Carica il contenuto sul sistema di storage scelto
    const multihash = await this.uploadToStorage(message.content);
    
    // Crea i parametri in base all'operazione
    const parameters: string[] = [];
    
    switch (operation) {
      case MOMCoreOperation.ADD:
        parameters.push(multihash);
        break;
        
      case MOMCoreOperation.UPDATE:
        if (!message.replyTo) {
          throw new Error("L'operazione UPDATE richiede un messaggio da aggiornare");
        }
        parameters.push(message.replyTo); // Multihash del messaggio da aggiornare
        parameters.push(multihash); // Multihash del nuovo contenuto
        break;
        
      case MOMCoreOperation.REPLY:
        if (!message.replyTo) {
          throw new Error("L'operazione REPLY richiede un messaggio a cui rispondere");
        }
        parameters.push(message.replyTo); // Multihash del messaggio a cui rispondere
        parameters.push(multihash); // Multihash del nuovo contenuto
        break;
        
      case MOMExtendedOperation.ADD_AND_REFER:
        if (!message.references || message.references.length === 0) {
          throw new Error("L'operazione ADD_AND_REFER richiede un indirizzo da riferire");
        }
        parameters.push(multihash); // Multihash del nuovo contenuto
        parameters.push(message.references[0]); // Indirizzo da riferire
        break;
        
      case MOMExtendedOperation.ENDORSE_AND_REPLY:
      case MOMExtendedOperation.DISAPPROVE_AND_REPLY:
        if (!message.replyTo) {
          throw new Error("L'operazione richiede un messaggio a cui rispondere");
        }
        parameters.push(message.replyTo); // Multihash del messaggio da approvare/disapprovare
        parameters.push(multihash); // Multihash del nuovo contenuto
        break;
        
      // Casi per operazioni che richiedono solo un multihash esistente
      case MOMCoreOperation.DELETE:
      case MOMExtendedOperation.ENDORSE:
      case MOMExtendedOperation.DISAPPROVE:
      case MOMExtendedOperation.REMOVE_ENDORSEMENT:
      case MOMExtendedOperation.REMOVE_DISAPPROVAL:
        if (!message.replyTo) {
          throw new Error("L'operazione richiede un messaggio esistente");
        }
        parameters.push(message.replyTo); // Multihash del messaggio esistente
        break;
        
      case MOMCoreOperation.CLOSE_ACCOUNT:
        parameters.push(multihash); // Multihash del messaggio con le motivazioni
        break;
        
      case MOMExtendedOperation.UPDATE_AND_REFER:
        if (!message.replyTo || !message.references || message.references.length === 0) {
          throw new Error("L'operazione UPDATE_AND_REFER richiede un messaggio da aggiornare e un indirizzo da riferire");
        }
        parameters.push(message.replyTo); // Multihash del messaggio da aggiornare
        parameters.push(multihash); // Multihash del nuovo contenuto
        parameters.push(message.references[0]); // Indirizzo da riferire
        break;
        
      case MOMCoreOperation.RAW:
        parameters.push(message.content); // Contenuto raw
        break;
        
      default:
        throw new Error(`Operazione ${operation} non supportata`);
    }
    
    // Aggiungi eventuali parametri aggiuntivi
    parameters.push(...additionalParams);
    
    // Crea la transazione MOM
    const momTransaction = this.createMOMTransaction(
      operation,
      parameters,
      wallet.address
    );
    
    // Codifica la transazione MOM
    const txData = this.encodeMOMTransaction(momTransaction);
    
    // Crea la transazione Ethereum
    const tx = {
      to: wallet.address, // Self-send
      value: 0, // 0 valore
      data: txData,
      gasLimit: 100000
    };
    
    // Firma e invia la transazione
    const response = await wallet.sendTransaction(tx);
    
    // Aggiorna la cache dei messaggi
    const fromAddress = wallet.address;
    if (!this.messageCache.has(fromAddress)) {
      this.messageCache.set(fromAddress, []);
    }
    
    // Aggiungi il transactionHash alla transazione MOM
    momTransaction.transactionHash = response.hash;
    
    return response.hash;
  }
  
  /**
   * Recupera i messaggi per un indirizzo specifico
   * @param address Indirizzo di cui recuperare i messaggi
   * @param fromBlock Blocco di partenza (default: 0)
   * @param toBlock Blocco di arrivo (default: 'latest')
   * @returns Lista dei messaggi dell'indirizzo
   */
  public async getMessagesForAddress(
    address: string,
    fromBlock: number = 0,
    toBlock: string | number = 'latest'
  ): Promise<MOMMessage[]> {
    // Recupera le transazioni self-send per l'indirizzo
    const filter = {
      fromBlock,
      toBlock,
      address, // Indirizzo del contratto (in questo caso è l'indirizzo dell'utente)
      topics: [] // Non filtriamo per topics
    };
    
    // Recupera i log delle transazioni
    const logs = await this.provider.getLogs(filter);
    
    // Processa i log per estrarre i messaggi MOM
    const messages: MOMMessage[] = [];
    
    for (const log of logs) {
      // Recupera la transazione completa per ottenere il payload
      const tx = await this.provider.getTransaction(log.transactionHash);
      
      // Verifica che sia una transazione self-send con valore 0
      if (tx && tx.from === tx.to && tx.value.toString() === '0' && tx.data.length > 2) {
        // Decodifica la transazione MOM
        const momTx = this.decodeMOMTransaction(tx.data, tx.from);
        
        // Se è una transazione MOM valida, processala
        if (momTx) {
          // Recupera il timestamp del blocco
          const block = await this.provider.getBlock(log.blockNumber);
          const timestamp = block?.timestamp || 0;
          
          // Processa la transazione in base all'operazione
          this.processTransaction(momTx, timestamp, messages);
        }
      }
    }
    
    // Aggiorna la cache dei messaggi
    this.messageCache.set(address, messages);
    
    return messages;
  }
  
  /**
   * Processa una transazione MOM e aggiorna la lista dei messaggi
   * @param transaction Transazione MOM
   * @param timestamp Timestamp del blocco
   * @param messages Lista dei messaggi da aggiornare
   */
  private processTransaction(
    transaction: MOMTransaction,
    timestamp: number,
    messages: MOMMessage[]
  ): void {
    const { operation, parameters, from, transactionHash } = transaction;
    
    switch (operation) {
      case MOMCoreOperation.ADD:
        // Aggiungi un nuovo messaggio
        messages.push({
          multihash: parameters[0],
          author: from,
          timestamp,
          transactionHash: transactionHash || ''
        });
        break;
        
      case MOMCoreOperation.UPDATE:
        // Aggiorna un messaggio esistente
        const updateIndex = messages.findIndex(msg => msg.multihash === parameters[0]);
        if (updateIndex >= 0) {
          messages[updateIndex].multihash = parameters[1];
          // Mantieni gli altri dati invariati
          messages[updateIndex].transactionHash = transactionHash || '';
        }
        break;
        
      case MOMCoreOperation.REPLY:
        // Aggiungi una risposta
        const replyToIndex = messages.findIndex(msg => msg.multihash === parameters[0]);
        if (replyToIndex >= 0) {
          // Inizializza l'array delle risposte se non esiste
          if (!messages[replyToIndex].replies) {
            messages[replyToIndex].replies = [];
          }
          
          // Aggiungi la risposta
          messages[replyToIndex].replies?.push({
            multihash: parameters[1],
            author: from,
            timestamp,
            transactionHash: transactionHash || '',
            replyTo: parameters[0]
          });
        } else {
          // Se il messaggio originale non è trovato, aggiungi comunque la risposta
          messages.push({
            multihash: parameters[1],
            author: from,
            timestamp,
            transactionHash: transactionHash || '',
            replyTo: parameters[0]
          });
        }
        break;
        
      case MOMCoreOperation.DELETE:
        // Rimuovi un messaggio
        const deleteIndex = messages.findIndex(msg => msg.multihash === parameters[0]);
        if (deleteIndex >= 0) {
          messages.splice(deleteIndex, 1);
        }
        break;
        
      case MOMCoreOperation.CLOSE_ACCOUNT:
        // Chiudi l'account
        // Aggiungi il messaggio di chiusura
        messages.push({
          multihash: parameters[0],
          author: from,
          timestamp,
          transactionHash: transactionHash || '',
          content: "ACCOUNT CLOSED"
        });
        break;
        
      case MOMExtendedOperation.ADD_AND_REFER:
        // Aggiungi un messaggio con riferimento
        messages.push({
          multihash: parameters[0],
          author: from,
          timestamp,
          transactionHash: transactionHash || '',
          references: [parameters[1]]
        });
        break;
        
      case MOMExtendedOperation.ENDORSE:
        // Approva un messaggio
        const endorseIndex = messages.findIndex(msg => msg.multihash === parameters[0]);
        if (endorseIndex >= 0) {
          messages[endorseIndex].endorsed = true;
        }
        break;
        
      case MOMExtendedOperation.DISAPPROVE:
        // Disapprova un messaggio
        const disapproveIndex = messages.findIndex(msg => msg.multihash === parameters[0]);
        if (disapproveIndex >= 0) {
          messages[disapproveIndex].disapproved = true;
        }
        break;
        
      // Implementazione delle altre operazioni...
      
      default:
        // Operazione non supportata
        break;
    }
  }
  
  /**
   * Recupera il contenuto di un messaggio dal sistema di storage
   * @param multihash Multihash del contenuto
   * @returns Contenuto del messaggio
   */
  public async getMessageContent(multihash: string): Promise<string> {
    return this.getContentFromStorage(multihash);
  }
  
  /**
   * Recupera il contenuto di tutti i messaggi in un array
   * @param messages Lista dei messaggi
   * @returns Lista dei messaggi con contenuto
   */
  public async getMessagesWithContent(messages: MOMMessage[]): Promise<MOMMessage[]> {
    // Clona i messaggi per non modificare l'originale
    const messagesWithContent = [...messages];
    
    // Recupera il contenuto per ogni messaggio
    for (const message of messagesWithContent) {
      try {
        message.content = await this.getMessageContent(message.multihash);
        
        // Recupera il contenuto anche per le risposte
        if (message.replies && message.replies.length > 0) {
          await this.getMessagesWithContent(message.replies);
        }
      } catch (error) {
        console.error(`Errore nel recupero del contenuto per ${message.multihash}:`, error);
        message.content = `Errore nel recupero del contenuto: ${error}`;
      }
    }
    
    return messagesWithContent;
  }
} 