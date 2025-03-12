import express from "express";
import Gun from "gun";
import http from "http";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 8765;

// Configura Gun
app.use(Gun.serve);

// Configura CORS in modo più dettagliato
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  // Gestisci OPTIONS per CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Crea il server HTTP
const server = http.createServer(app);

// Avvia il server sulla porta specificata
server.listen(port, () => {
  console.log(`Server GUN in esecuzione su http://localhost:${port}`);
  console.log(`WebSocket server in esecuzione su ws://localhost:${port}/gun`);
});

// Inizializza Gun con opzioni specifiche 
const gun = new Gun({
  web: server,
  file: "radata", 
  radisk: true,
  axe: true,
  multicast: false, // Disabilita multicast che può causare problemi
  websocket: {      // Configurazione esplicita per WebSocket
    mode: 'websocket',
    path: '/gun'
  },
  wire:true
});

// Rendi l'istanza accessibile
global.gun = gun;

// Configurazione del relay per i canali di pagamento
const RELAY_ADDRESS = process.env.RELAY_ADDRESS || "0x..."; // Indirizzo Ethereum del relay
const RELAY_PRIVATE_KEY = process.env.RELAY_PRIVATE_KEY || "0x..."; // Chiave privata del relay
const RPC_URL = process.env.RPC_URL || "http://localhost:8545";

// Inizializza il provider e il wallet del relay
const provider = new ethers.JsonRpcProvider(RPC_URL);
const relayWallet = new ethers.Wallet(RELAY_PRIVATE_KEY, provider);

// Gestione dei canali di pagamento
gun.get('channels').on((data, key) => {
  if (!data) return;
  
  try {
    // Verifica che il messaggio sia per questo relay
    if (data.counterparty?.toLowerCase() === RELAY_ADDRESS.toLowerCase()) {
      console.log(`Nuovo aggiornamento canale: ${key}`);
      
      // Verifica la firma del client
      const stateStr = JSON.stringify(data.state);
      const verified = Gun.SEA.verify(data.signature, data.state.pubKey);
      
      if (verified) {
        // Verifica il nonce
        const currentNonce = gun.get('channels').get(key).get('currentNonce');
        if (!currentNonce || data.state.nonce > currentNonce) {
          // Aggiorna lo stato del canale
          gun.get('channels').get(key).get('currentNonce').put(data.state.nonce);
          gun.get('channels').get(key).get('currentState').put(data.state);
          
          console.log(`Stato del canale ${key} aggiornato al nonce ${data.state.nonce}`);
          
          // Se il canale sta per essere chiuso, firma lo stato finale
          if (data.state.status === 'closing') {
            const signature = relayWallet.signMessage(stateStr);
            gun.get('channels').get(key).get('relaySignature').put(signature);
            console.log(`Firma relay fornita per chiusura canale ${key}`);
          }
        }
      } else {
        console.error(`Firma non valida per il canale ${key}`);
      }
    }
  } catch (error) {
    console.error(`Errore nella gestione del canale ${key}:`, error);
  }
});

// Endpoint per ottenere l'indirizzo del relay
app.get("/relay-address", (req, res) => {
  res.json({ 
    address: RELAY_ADDRESS,
    supportedServices: [
      {
        name: "API Access",
        pricePerCall: "0.0001", // ETH
        description: "Accesso alle API del relay"
      },
      {
        name: "Storage",
        pricePerMB: "0.001", // ETH
        description: "Storage decentralizzato"
      }
    ]
  });
});

// Endpoint di base per verificare che il server sia in funzione
app.get("/status", (req, res) => {
  res.json({ 
    status: "Server GUN attivo",
    relay: {
      address: RELAY_ADDRESS,
      channelsActive: gun.get('channels').get('active').length || 0
    }
  });
});

// Middleware per il parsing del JSON
app.use(express.json());

// Endpoint per la chiusura di canali
app.post("/api/channels/close", async (req, res) => {
  try {
    const { channelId, state, clientSignature } = req.body;
    
    if (!channelId || !state || !clientSignature) {
      return res.status(400).json({
        success: false,
        error: "Dati mancanti. Sono richiesti channelId, state e clientSignature."
      });
    }
    
    console.log(`Richiesta di chiusura per il canale ${channelId}`);
    console.log(`Stato finale del canale:`, state);
    
    // 1. Verifica che il canale esista
    const channelData = await new Promise(resolve => {
      gun.get('channels').get(channelId).once(data => {
        resolve(data);
      });
    });
    
    if (!channelData) {
      return res.status(404).json({
        success: false,
        error: `Canale ${channelId} non trovato.`
      });
    }
    
    // 2. Verifica che lo stato sia valido
    if (!state.nonce && state.nonce !== 0) {
      return res.status(400).json({
        success: false,
        error: "Lo stato del canale deve includere un nonce."
      });
    }
    
    // 3. Verifica che il nonce sia valido (deve essere maggiore o uguale all'ultimo nonce)
    const currentNonce = channelData.currentNonce || 0;
    if (state.nonce < currentNonce) {
      return res.status(400).json({
        success: false,
        error: `Il nonce fornito (${state.nonce}) è inferiore all'ultimo nonce registrato (${currentNonce}).`
      });
    }
    
    // 4. Verifica la firma del client
    let isValidSignature = false;
    try {
      const stateString = JSON.stringify(state);
      const recoveredAddress = ethers.verifyMessage(stateString, clientSignature);
      
      if (recoveredAddress.toLowerCase() !== state.pubKey.toLowerCase()) {
        return res.status(401).json({
          success: false,
          error: "Firma del client non valida. L'indirizzo recuperato non corrisponde alla pubkey."
        });
      }
      
      isValidSignature = true;
      console.log(`Firma del client verificata per il canale ${channelId}`);
    } catch (error) {
      console.error(`Errore nella verifica della firma:`, error);
      return res.status(401).json({
        success: false,
        error: "Errore nella verifica della firma: " + error.message
      });
    }
    
    if (!isValidSignature) {
      return res.status(401).json({
        success: false,
        error: "Firma del client non valida."
      });
    }
    
    // 5. Firma lo stato con il relay
    let relaySignature;
    try {
      const stateString = JSON.stringify(state);
      relaySignature = await relayWallet.signMessage(stateString);
      console.log(`Stato del canale ${channelId} firmato dal relay.`);
      
      // 6. Aggiorna lo stato del canale in Gun
      gun.get('channels').get(channelId).get('currentNonce').put(state.nonce);
      gun.get('channels').get(channelId).get('currentState').put(state);
      gun.get('channels').get(channelId).get('status').put('closing');
      gun.get('channels').get(channelId).get('relaySignature').put(relaySignature);
      
      console.log(`Stato del canale ${channelId} aggiornato a 'closing'.`);
    } catch (error) {
      console.error(`Errore nella firma dello stato:`, error);
      return res.status(500).json({
        success: false,
        error: "Errore nella firma dello stato: " + error.message
      });
    }
    
    // 7. Restituisci la firma del relay
    return res.status(200).json({
      success: true,
      channelId,
      relaySignature,
      message: `Canale ${channelId} in fase di chiusura. Firma relay fornita.`
    });
  } catch (error) {
    console.error(`Errore nella gestione della richiesta di chiusura:`, error);
    return res.status(500).json({
      success: false,
      error: "Errore interno del server: " + error.message
    });
  }
});

// Endpoint per verificare lo stato di un canale specifico
app.get("/api/channels/:channelId", (req, res) => {
  const { channelId } = req.params;
  
  if (!channelId) {
    return res.status(400).json({
      success: false,
      error: "ID canale mancante."
    });
  }
  
  gun.get('channels').get(channelId).once((data) => {
    if (!data) {
      return res.status(404).json({
        success: false,
        error: `Canale ${channelId} non trovato.`
      });
    }
    
    return res.status(200).json({
      success: true,
      channelId,
      data,
      diagnostics: {
        hasSignature: !!data.relaySignature,
        currentNonce: data.currentNonce || 0,
        status: data.status || 'unknown'
      }
    });
  });
});


