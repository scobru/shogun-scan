// server.js - Funzionante come "tracker" per i peer P2P
const express = require('express');
const Gun = require('gun');
const app = express();
const path = require('path');

// Servi i file statici (per il client)
app.use(express.static(path.join(__dirname)));

// Rotta principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client.html'));
});

// Rotta per informazioni sul tracker
app.get('/info', (req, res) => {
  const roomsData = Object.keys(activeRooms).map(roomId => ({
    id: roomId,
    peers: activeRooms[roomId],
    created: roomCreationTimes[roomId] || Date.now()
  }));
  
  res.json({
    status: 'online',
    serverUptime: process.uptime(),
    activeRooms: roomsData,
    totalPeers: Object.values(activeRooms).reduce((sum, count) => sum + count, 0)
  });
});

const server = app.listen(8765, () => {
  console.log('Tracker server in ascolto su http://localhost:8765');
  console.log('Questo server agisce solo come punto di incontro per i peer P2P');
});

// Traccia le stanze attive e il numero di partecipanti
const activeRooms = {};
const roomCreationTimes = {};

// Inizializza Gun sul server con opzioni minime
// Configurato per non persistere i dati ma solo facilitare le connessioni
const gun = Gun({
  web: server,
  localStorage: false,      // Non usare localStorage
  radisk: false,            // Non salvare su disco
  file: false,              // Non usare file per lo storage
  axe:true,
});

// Ascolta i messaggi per tracciare le stanze
gun.on('in', function(msg) {
  if (msg && msg.put) {
    const data = msg.put;
    const keys = Object.keys(data);
    
    // Cerca se c'è una chiave che corrisponde a una stanza
    for (const key of keys) {
      if (key.startsWith('chat-room-')) {
        const roomId = key.replace('chat-room-', '');
        if (!activeRooms[roomId]) {
          activeRooms[roomId] = 0;
          roomCreationTimes[roomId] = Date.now();
          console.log(`Nuova stanza creata: ${roomId}`);
        }
      }
    }
  }
});

// Log delle connessioni dei peer
gun.on('hi', peer => {
  console.log(`Nuovo peer connesso: ${peer.id || 'Anonimo'}`);
  // Incrementa il contatore delle stanze se il peer invia dati delle stanze
  updateRoomPeers(peer, 1);
});

gun.on('bye', peer => {
  console.log(`Peer disconnesso: ${peer.id || 'Anonimo'}`);
  // Decrementa il contatore delle stanze quando un peer si disconnette
  updateRoomPeers(peer, -1);
});

// Funzione di supporto per aggiornare il conteggio dei peer nelle stanze
function updateRoomPeers(peer, increment) {
  if (peer && peer.url) {
    const roomMatch = peer.url.match(/[#&]([a-z0-9]+)$/);
    if (roomMatch && roomMatch[1]) {
      const roomId = roomMatch[1];
      if (!activeRooms[roomId]) {
        activeRooms[roomId] = 0;
      }
      activeRooms[roomId] += increment;
      if (activeRooms[roomId] <= 0) {
        delete activeRooms[roomId];
        console.log(`Stanza chiusa: ${roomId}`);
      } else {
        console.log(`Stanza ${roomId}: ${activeRooms[roomId]} peer connessi`);
      }
    }
  }
}

// Pulizia automatica delle stanze inattive
setInterval(() => {
  const now = Date.now();
  for (const [roomId, peers] of Object.entries(activeRooms)) {
    const roomAge = now - (roomCreationTimes[roomId] || now);
    if (peers === 0 && roomAge > 3600000) { // 1 ora di inattività
      delete activeRooms[roomId];
      delete roomCreationTimes[roomId];
      console.log(`Stanza rimossa per inattività: ${roomId}`);
    }
  }
}, 300000); // Controlla ogni 5 minuti
