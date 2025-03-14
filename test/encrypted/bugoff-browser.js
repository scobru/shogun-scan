// Browser-friendly version of Bugoff
function Bugoff(identifier, opts = {}) {
  // Inizializza un event emitter per gestire gli eventi interni
  this.events = new EventEmitter();
  
  // Identifica questa istanza
  this.identifier = identifier;
  
  // Configurazione dei tracker alternativi
  const defaultOpts = {
    trackers: [
      'wss://tracker.openwebtorrent.com',
      'wss://tracker.btorrent.xyz',
      'wss://tracker.files.fm:7073/announce',
      'wss://tracker.webtorrent.dev',
      'wss://tracker.sloppyta.co:443/announce',
      'wss://spacetradersapi-chatbox.herokuapp.com:443/announce'
    ],
    rtcConfig: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    }
  };
  
  // Estrai il seed dalle opzioni se presente
  const seed = opts.seed;
  
  // Crea una copia delle opzioni senza il seed
  const bugoutOpts = Object.assign({}, defaultOpts);
  
  // Aggiungi altre opzioni tranne il seed
  for (const key in opts) {
    if (key !== 'seed') {
      bugoutOpts[key] = opts[key];
    }
  }
  
  console.log("Inizializzando Bugout con identifier:", identifier);
  
  // Inizializza Bugout con una logica diversa in base ai parametri disponibili
  if (identifier === null || identifier === undefined) {
    if (seed) {
      // Se non c'è identifier ma c'è il seed, lo passiamo come opzione
      bugoutOpts.seed = seed;
      this.bugout = new Bugout(bugoutOpts);
    } else {
      // Se non ci sono né identifier né seed
      this.bugout = new Bugout(bugoutOpts);
    }
  } else {
    // Se c'è un identifier, lo passiamo come primo parametro
    this.bugout = new Bugout(identifier, bugoutOpts);
  }
  
  this.address = this.bugout.address();
  this.peers = {};
  
  // Inizializza SEA per la crittografia
  this.SEA = async (pair) => {
    this.sea = pair || await SEA.pair();
    return this.sea;
  }
  
  // Bugout internals bindings
  this.on = this.bugout.on.bind(this.bugout);
  this.once = this.bugout.once.bind(this.bugout);
  this.register = this.bugout.register.bind(this.bugout);
  
  // Gestione connessione al server
  this.bugout.on("server", () => {
    console.log("Connected to server:", this.bugout.serveraddress);
    // Se questo è un client che si connette a un server, assicurati di scambiare le chiavi
    if (this.sea) {
      this.rpc(this.bugout.serveraddress, 'peer', this.sea);
    } else {
      console.log("SEA keys not initialized yet, initializing...");
      this.SEA().then(pair => {
        this.rpc(this.bugout.serveraddress, 'peer', pair);
      });
    }
  });
  
  // Bugout message handling
  this.events.on('encoded', encrypted => {
    if(typeof encrypted === 'object') {
      this.bugout.send(encrypted[0], encrypted[1]);
    } else if (typeof address !== 'undefined') {
      this.bugout.send(address, encrypted);
    }
  });

  this.on('message', async (address, message) => {
    try {
      let decrypted = await decrypt(address, message);
      if (!decrypted) return;
      
      let addr = await decrypted.address;
      let pubkeys = await decrypted.pubkeys;
      let msg = await decrypted.message;
      
      if(decrypted && msg) {
        this.bugout.emit('decrypted', addr, pubkeys, msg);
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  let encrypt = async (address, message) => {
    try {
      if(!message) {
        msg = address;
        // this is a broadcast message, encrypt with this instance SEA pair
        for(peer in this.peers){
          try {
            let enc = [peer, await SEA.encrypt(msg, await SEA.secret(this.peers[peer].epub, this.sea))];
            this.events.emit('encoded', enc);
          } catch (error) {
            console.error(`Error encrypting broadcast message for peer ${peer}:`, error);
          }
        }
      } else if(message && this.peers[address]){
        // this is a direct message
        let enc = await SEA.encrypt(message, await SEA.secret(this.peers[address].epub, this.sea));
        this.events.emit('encoded', [address, enc]);
      } else {
        console.warn("Cannot send message to unknown peer:", address);
      }
    } catch (error) {
      console.error("Error in encrypt function:", error);
    }
  }

  this.send = encrypt;

  let decrypt = async (address, message) => {
    try {
      let pubkeys;
      for(peer in this.peers){
        if(peer === address){
          pubkeys = {pub: this.peers[peer].pub, epub: this.peers[peer].epub};
          break;
        }
      }
      
      if (!pubkeys) {
        console.warn("No public keys found for peer:", address);
        return null;
      }
      
      const decryptedMsg = await SEA.decrypt(message, await SEA.secret(pubkeys.epub, this.sea));
      
      if (!decryptedMsg) {
        console.warn("Failed to decrypt message from:", address);
        return null;
      }
      
      return { 
        address: address, 
        pubkeys: pubkeys, 
        message: decryptedMsg 
      };
    } catch (error) {
      console.error("Error decrypting message:", error);
      return null;
    }
  }

  // Registra la funzione RPC per lo scambio delle chiavi
  this.register('peer', (address, sea, cb) => {
    if (!sea || !sea.pub || !sea.epub) {
      console.warn("Received invalid peer keys from:", address);
      if (cb) cb(false);
      return;
    }
    
    Object.assign(this.peers, {[address]:{pub: sea.pub, epub: sea.epub}});
    console.log(`Peer keys received from ${address}`);
    this.events.emit('newPeer', this.peers);
    
    if (cb) cb(true);
  });

  // Quando vediamo un nuovo peer, inviamo le nostre chiavi
  this.on('seen', async address => {
    try {
      if (!this.sea) {
        console.warn("SEA keys not initialized yet, initializing...");
        await this.SEA();
      }
      
      console.log("Sending keys to newly seen peer:", address);
      this.rpc(address, 'peer', await this.sea);
    } catch (error) {
      console.error("Error responding to seen event:", error);
    }
  });
  
  // RPC method
  this.rpc = function(address, call, args, callback) {
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds
    let attempts = 0;

    const attemptRPC = () => {
      attempts++;
      try {
        return this.bugout.rpc(address, call, args, (result) => {
          if (result) {
            if (callback) callback(result);
          } else if (attempts < maxRetries) {
            console.log(`RPC attempt ${attempts} failed, retrying in ${retryDelay}ms...`);
            setTimeout(attemptRPC, retryDelay);
          } else {
            console.error(`RPC call "${call}" failed after ${maxRetries} attempts`);
            if (callback) callback(null);
          }
        });
      } catch (error) {
        console.error(`Error in RPC call "${call}" (attempt ${attempts}):`, error);
        if (attempts < maxRetries) {
          console.log(`Retrying in ${retryDelay}ms...`);
          setTimeout(attemptRPC, retryDelay);
        } else {
          if (callback) callback(null);
        }
      }
    };

    attemptRPC();
  }
  
  // Altre funzioni
  this.heartbeat = (interval) => {
    return this.bugout.heartbeat(interval);
  }
  
  this.destroy = this.bugout.destroy.bind(this.bugout);
}

// Funzione per tentare una connessione diretta
Bugoff.prototype.attemptDirectConnection = function(peerAddress) {
  if (!peerAddress) {
    console.error("Indirizzo peer mancante per connessione diretta");
    return false;
  }
  
  console.log("Tentativo di connessione diretta con:", peerAddress);
  
  // Normalizza l'indirizzo per assicurarsi che sia una stringa
  const parsedAddress = String(peerAddress).trim();
  
  try {
    // Tenta di aggiungere il peer direttamente al torrent
    if (this.bugout && this.bugout.torrent) {
      console.log("Tentativo di aggiungere peer direttamente:", parsedAddress);
      
      // Forza un annuncio per aumentare le probabilità di connessione
      if (this.bugout.torrent.discovery && typeof this.bugout.torrent.discovery.announce === 'function') {
        try {
          console.log("Forzando un annuncio sui tracker prima della connessione diretta");
          this.bugout.torrent.discovery.announce();
        } catch (e) {
          console.warn("Errore nel forzare l'annuncio:", e);
        }
      }
      
      let connectionAttempted = false;
      const maxAttempts = 3;
      let currentAttempt = 0;
      
      const attemptConnection = () => {
        currentAttempt++;
        console.log(`Tentativo di connessione ${currentAttempt}/${maxAttempts}`);
        
        // 1. Metodo preferito: usa il metodo addPeer del torrent
        if (typeof this.bugout.torrent.addPeer === 'function') {
          try {
            this.bugout.torrent.addPeer(parsedAddress);
            console.log("Aggiunto peer usando indirizzo completo:", parsedAddress);
            connectionAttempted = true;
          } catch (error) {
            console.error("Errore nell'aggiungere peer con indirizzo completo:", error);
          }
        }
        
        // 2. Prova a usare l'indirizzo come InfoHash
        try {
          if (parsedAddress && parsedAddress.length >= 20) {
            this.bugout.torrent.addPeer(parsedAddress);
            console.log("Aggiunto peer usando InfoHash:", parsedAddress);
            connectionAttempted = true;
          }
        } catch (error) {
          console.error("Errore nell'aggiungere peer con InfoHash:", error);
        }
        
        if (!connectionAttempted && currentAttempt < maxAttempts) {
          console.log(`Ritentativo tra 2 secondi...`);
          setTimeout(attemptConnection, 2000);
        }
      };
      
      attemptConnection();
      return connectionAttempted;
    }
  } catch (error) {
    console.error("Errore generale nella connessione diretta:", error);
  }
  
  console.warn("Tutti i tentativi di connessione diretta falliti");
  return false;
};

// Funzione per forzare un annuncio sui tracker
Bugoff.prototype.forceAnnounce = function() {
  if (this.bugout && this.bugout.torrent && this.bugout.torrent.discovery) {
    console.log("Forcing announce on trackers...");
    try {
      if (typeof this.bugout.torrent.discovery.announce === 'function') {
        this.bugout.torrent.discovery.announce();
        return true;
      } else {
        console.warn("No valid announce method found");
        return false;
      }
    } catch (e) {
      console.error("Failed to announce:", e);
      return false;
    }
  }
  return false;
};

// Funzione per verificare i nonce (necessaria per le chiamate RPC)
Bugoff.prototype.resolvenonce = function(result) {
  // Questa funzione verifica nonce per prevenire attacchi di replay
  // In questa implementazione semplificata restituiamo semplicemente il risultato
  return result;
};

// Simple EventEmitter for browser
class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  once(event, listener) {
    const onceWrapper = (...args) => {
      listener(...args);
      this.off(event, onceWrapper);
    }
    return this.on(event, onceWrapper);
  }

  off(event, listener) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
    return this;
  }

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
    return this;
  }
} 