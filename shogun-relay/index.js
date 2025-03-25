import express from "express";
import Gun from "gun";
import http from "http";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 8765;

// Configura middleware per il parsing dei form
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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

// Pagina principale con form per messaggi
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Shogun Relay Server</title>
      <!-- Includi Gun.js dalla CDN -->
      <script src="https://cdn.jsdelivr.net/npm/gun/gun.js"></script>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 {
          color: #008875;
        }
        .card {
          background-color: #f9f9f9;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        textarea {
          width: 100%;
          min-height: 200px;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
          font-family: inherit;
          resize: vertical;
          margin-top: 10px;
        }
        .status {
          margin-top: 10px;
          font-size: 14px;
          color: #008875;
        }
        .node-info {
          display: inline-block;
          margin-right: 10px;
          margin-bottom: 5px;
          padding: 4px 8px;
          background: #e9f5f3;
          border-radius: 4px;
          font-size: 14px;
        }
        .node-count {
          font-weight: bold;
          color: #008875;
        }
      </style>
    </head>
    <body>
      <h1>Shogun Relay Server</h1>
      
      <div class="card">
        <h2>Server Status</h2>
        <p>Gun server is running at <code>http://localhost:${port}</code></p>
        <p>WebSocket server is running at <code>ws://localhost:${port}/gun</code></p>
        <div id="network-info">
          <div class="node-info">Connected Peers: <span id="peer-count" class="node-count">0</span></div>
          <div class="node-info">Network Status: <span id="network-status" class="node-count">Connecting...</span></div>
        </div>
      </div>
      
      <div class="card">
        <h2>Relay Message Board</h2>
        <p>Write something that will be displayed to everyone:</p>
        <textarea id="content-box" placeholder="Write your message here..."></textarea>
        <div id="status" class="status"></div>
      </div>

      <script>
        // Inizializza Gun più affidabilmente
        document.addEventListener('DOMContentLoaded', function() {
          // Connessione completa a Gun
          const gun = Gun({
            peers: [window.location.origin + '/gun'],
            localStorage: false  // Evita conflitti con localStorage
          });
          
          // Debug per verificare la connessione
          console.log('Gun initialized with peer:', window.location.origin + '/gun');
          
          // Network stats
          const peerCountEl = document.getElementById('peer-count');
          const networkStatusEl = document.getElementById('network-status');
          
          // Track peers
          let peerCount = 0;
          gun.on('hi', peer => {
            console.log('Peer connected:', peer);
            peerCount++;
            peerCountEl.textContent = peerCount;
            networkStatusEl.textContent = 'Connected';
          });
          
          gun.on('bye', peer => {
            console.log('Peer disconnected:', peer);
            peerCount = Math.max(0, peerCount - 1);
            peerCountEl.textContent = peerCount;
            if (peerCount === 0) {
              networkStatusEl.textContent = 'Disconnected';
            }
          });
          
          // Riferimento al contenuto
          const content = gun.get('box-content');
          
          // Elementi DOM
          const textarea = document.getElementById('content-box');
          const status = document.getElementById('status');
          
          // Mostra informazioni di stato iniziali
          status.textContent = 'Loading...';
          
          // Carica il contenuto esistente
          content.on(function(data) {
            console.log('Data received from Gun:', data);
            
            if (data && data.text) {
              textarea.value = data.text;
              status.textContent = 'Content loaded';
            } else {
              status.textContent = 'No content saved yet';
            }
            
            // Nascondi il messaggio di stato dopo un po'
            setTimeout(() => {
              status.textContent = '';
            }, 1500);
          });
          
          // Salva automaticamente quando l'utente digita
          let timeout;
          textarea.addEventListener('input', function() {
            clearTimeout(timeout);
            
            // Salva dopo 500ms di inattività
            timeout = setTimeout(function() {
              const text = textarea.value;
              
              // Assicuriamoci che il salvataggio sia completo con callback
              content.put({ text: text, lastUpdate: Date.now() }, (ack) => {
                if (ack.err) {
                  console.error('Save error:', ack.err);
                  status.textContent = 'Error saving content';
                } else {
                  console.log('Successfully saved:', ack);
                  status.textContent = 'Automatically saved';
                }
                
                setTimeout(() => {
                  status.textContent = '';
                }, 1000);
              });
            }, 500);
          });
        });
      </script>
    </body>
    </html>
  `);
});

// Endpoint per gestire l'invio di messaggi
app.post('/message', (req, res) => {
  const { name, email, message } = req.body;
  
  if (!name || !message) {
    return res.status(400).json({ error: 'Nome e messaggio sono obbligatori' });
  }
  
  // Salva il messaggio con Gun
  const gun = global.gun;
  const messages = gun.get('guestbook');
  
  const messageData = {
    name,
    email: email || '',
    message,
    timestamp: Date.now()
  };
  
  console.log('Salvataggio nuovo messaggio:', messageData);
  
  messages.set(messageData);
  
  // Rispondi con JSON invece di reindirizzare
  res.status(200).json({ success: true, message: 'Messaggio salvato con successo' });
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
  localStorage: false,
  radisk: true,
  axe: true,
  multicast: false,  // Disattiva multicast per maggiore stabilità
  websocket: {      // Configurazione esplicita per WebSocket
    mode: 'websocket',
    path: '/gun'
  },
  wire: true
});

// Rendi l'istanza accessibile
global.gun = gun;



