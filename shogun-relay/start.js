import express from "express";
import Gun from "gun";
import http from "http";

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

// Endpoint di base per verificare che il server sia in funzione
app.get("/status", (req, res) => {
  res.json({ status: "Server GUN attivo" });
});


