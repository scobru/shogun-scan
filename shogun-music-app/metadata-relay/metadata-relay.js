// gundb-relay.js
const express = require('express');
const Gun = require('gun');
const app = express();
const cors = require('cors');
const axios = require('axios'); // Per le richieste HTTP allo storage-relay

const PORT = 8765; // Porta per il relay GunDB
const SECRET_TOKEN = "myMetadataToken123"; // Token di autenticazione
const STORAGE_RELAY_URL = 'http://localhost:3000'; // URL dello storage-relay
const STORAGE_AUTH_TOKEN = "mySecretToken123"; // Token per auth con storage-relay

// Array di altri relay GunDB a cui connettersi
let PEER_RELAYS = [
  'http://localhost:8766/gun'
  // I peer verranno aggiunti dinamicamente
];

// Abilita CORS
app.use(cors());
app.use(express.json()); // Supporto per JSON

// Middleware per l'autenticazione
function checkToken(req, res, next) {
  // Controlla se la richiesta è una connessione WebSocket (non richiede token)
  if (req.headers.upgrade && req.headers.upgrade.toLowerCase() === 'websocket') {
    return next();
  }
  
  // Controlla che l'header Authorization sia presente ed abbia il token corretto
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization header missing" });
  }
  // Assumiamo che il token venga passato come "Bearer <token>" oppure direttamente come stringa
  let token = authHeader;
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }
  if (token !== SECRET_TOKEN) {
    return res.status(403).json({ error: "Invalid token" });
  }
  next();
}

// Endpoint per gestire i peer relay
app.get('/peers', checkToken, (req, res) => {
  res.json({ peers: PEER_RELAYS });
});

// Aggiungi un nuovo peer relay
app.post('/peers/add', checkToken, (req, res) => {
  const { peerUrl } = req.body;
  
  if (!peerUrl) {
    return res.status(400).json({ error: "URL del peer mancante" });
  }
  
  if (PEER_RELAYS.includes(peerUrl)) {
    return res.json({ success: false, message: "Peer già presente" });
  }
  
  PEER_RELAYS.push(peerUrl);
  console.log(`Nuovo peer aggiunto: ${peerUrl}`);
  
  // Ricrea l'istanza Gun con i nuovi peer
  updateGunInstance();
  
  res.json({ success: true, peers: PEER_RELAYS });
});

// Rimuovi un peer relay
app.post('/peers/remove', checkToken, (req, res) => {
  const { peerUrl } = req.body;
  
  if (!peerUrl) {
    return res.status(400).json({ error: "URL del peer mancante" });
  }
  
  const index = PEER_RELAYS.indexOf(peerUrl);
  if (index === -1) {
    return res.json({ success: false, message: "Peer non trovato" });
  }
  
  PEER_RELAYS.splice(index, 1);
  console.log(`Peer rimosso: ${peerUrl}`);
  
  // Ricrea l'istanza Gun con i peer aggiornati
  updateGunInstance();
  
  res.json({ success: true, peers: PEER_RELAYS });
});

// Applica middleware di autenticazione per richieste HTTP (non WebSocket)
app.use('/gun', checkToken);

// Funzione per verificare l'esistenza di un file nello storage-relay
async function verifyFileExists(fileUrl) {
  try {
    const response = await axios.get(`${STORAGE_RELAY_URL}/verify-file`, {
      params: { url: fileUrl },
      headers: { 'Authorization': STORAGE_AUTH_TOKEN }
    });
    return response.data.exists;
  } catch (error) {
    console.error(`Errore verifica file ${fileUrl}:`, error.message);
    return false;
  }
}

// Database in-memory per tenere traccia dei file notificati dallo storage-relay
const notifiedFiles = [];

// Endpoint per ricevere notifiche di nuovi file dallo storage-relay
app.post('/file-uploaded', checkToken, (req, res) => {
  const fileInfo = req.body;
  console.log('Nuovo file notificato:', fileInfo);
  
  // Aggiungi alla lista di file notificati
  notifiedFiles.push(fileInfo);
  
  res.json({ success: true, message: 'File registrato con successo' });
});

// Endpoint di ricerca avanzata
app.get('/api/search', async (req, res) => {
  try {
    const { query, genre, artist } = req.query;
    
    // Inizializza Gun per accedere ai dati
    const gunInstance = Gun({ file: false, radisk: false });
    const musicProtocol = gunInstance.get('music-protocol');
    const songsRef = musicProtocol.get('songs');
    
    // Raccolta risultati
    const results = [];
    let matchCounter = 0;
    
    // Promise per attendere la raccolta dei risultati
    await new Promise((resolve) => {
      songsRef.map().once(async (song, id) => {
        if (!song || !song.title) return;
        
        // Verifica se il brano corrisponde ai criteri di ricerca
        let matches = !query || (
          song.title.toLowerCase().includes(query.toLowerCase()) ||
          song.artist.toLowerCase().includes(query.toLowerCase()) ||
          (song.album && song.album.toLowerCase().includes(query.toLowerCase()))
        );
        
        // Applica filtri aggiuntivi
        if (matches && genre && song.genre) {
          matches = song.genre.toLowerCase() === genre.toLowerCase();
        }
        
        if (matches && artist && song.artist) {
          matches = song.artist.toLowerCase().includes(artist.toLowerCase());
        }
        
        // Se corrisponde, aggiungilo ai risultati
        if (matches) {
          // Verifica esistenza file se c'è l'URL
          let fileExists = true;
          if (song.fileUrl) {
            fileExists = await verifyFileExists(song.fileUrl);
          }
          
          results.push({
            id: id,
            ...song,
            fileAvailable: fileExists
          });
          
          matchCounter++;
        }
        
        // Risolvi dopo aver processato tutti i brani
        if (matchCounter >= 20 || results.length >= Object.keys(gunInstance._.graph).length) {
          resolve();
        }
      });
      
      // Timeout per evitare attese infinite
      setTimeout(resolve, 2000);
    });
    
    res.json({
      results,
      count: results.length
    });
  } catch (error) {
    console.error('Errore durante la ricerca:', error);
    res.status(500).json({ error: 'Errore durante la ricerca' });
  }
});

// Informazioni di stato
app.get('/status', checkToken, (req, res) => {
  res.json({
    port: PORT,
    peers: PEER_RELAYS,
    files: notifiedFiles.length,
    uptime: process.uptime()
  });
});

// Variabile per tenere traccia dell'istanza Gun
let gun;

// Funzione per creare/aggiornare l'istanza Gun con i peer aggiornati
function updateGunInstance() {
  console.log(`Inizializzazione Gun con ${PEER_RELAYS.length} peer...`);
  
  // Avvia il server Express sul PORT specificato
  gun = Gun({
    web: server,
    peers: PEER_RELAYS,
    multicast: false, // Disabilita multicast per rendere più stabile il sync
    axe: true,       // Disabilita axe per semplicità
    radisk: true,
    file: 'radata',
    localStorage: false
  });
  
  console.log('Gun reinizialization completa');
  console.log('Peers connessi:', PEER_RELAYS);
  
  return gun;
}

// Avvia il server Express sul PORT specificato
const server = app.listen(PORT, () => console.log(`GunDB Relay in esecuzione sulla porta ${PORT}`));

// Inizializza Gun con il server Express (supporto WebSocket incluso)
gun = Gun({
  web: server,
  peers: PEER_RELAYS,
  radisk: true,
  file: 'radata' + PORT,
  localStorage: false,
  axe: false,
  multicast: false, // Disabilita multicast per rendere più stabile il sync

});

// Esporta istanza Gun per utilizzo esterno
module.exports = { gun, app, server };
