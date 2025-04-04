const express = require('express');
const cors = require('cors');
const Gun = require('gun');
const path = require('path');
const morgan = require('morgan');
const multer = require('multer');
const fs = require('fs');
require('bullet-catcher')

// Percorso per il backup locale delle tracce
const LOCAL_DB_PATH = path.join(__dirname, 'local_tracks_db.json');

// Funzione per salvare il database in memoria su file
function saveLocalDB() {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(inMemoryDB, null, 2), 'utf8');
    console.log(`Database locale salvato su ${LOCAL_DB_PATH}`);
  } catch (err) {
    console.error('Errore nel salvataggio del database locale:', err);
  }
}

// Funzione per caricare il database da 
function loadLocalDB() {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
      const parsedData = JSON.parse(data);
      console.log(`Database locale caricato da ${LOCAL_DB_PATH}, ${Object.keys(parsedData).length} tracce trovate`);
      return parsedData;
    }
  } catch (err) {
    console.error('Errore nel caricamento del database locale:', err);
  }
  return {};
}

// Parsing dei parametri da linea di comando
let cmdPort;
let cmdToken;
for (let i = 2; i < process.argv.length; i++) {
  if ((process.argv[i] === '-p' || process.argv[i] === '--port') && i + 1 < process.argv.length) {
    cmdPort = parseInt(process.argv[i + 1]);
    i++; // Salta il prossimo argomento (il valore della porta)
    console.log(`Porta specificata via linea di comando: ${cmdPort}`);
  }
  else if ((process.argv[i] === '-t' || process.argv[i] === '--token') && i + 1 < process.argv.length) {
    cmdToken = process.argv[i + 1];
    i++; // Salta il prossimo argomento (il valore del token)
    console.log(`Token di sicurezza specificato via linea di comando`);
  }
}

// Il token di sicurezza può essere fornito da varie fonti, in ordine di priorità
const SECURITY_TOKEN = cmdToken || process.env.GUN_TOKEN || "thisIsTheTokenForReals";
console.log(`Token di sicurezza configurato${cmdToken ? ' da linea di comando' : process.env.GUN_TOKEN ? ' da variabile ambiente' : ' (default)'}`);

// ---- NUOVA LOGICA PER PEERING SERVER-TO-SERVER ----
// Determina la porta corrente e quella dell'altro peer
const currentPort = cmdPort || parseInt(process.env.PORT || '3001');
const otherPort = currentPort === 3001 ? 3000 : 3001;
const selfUrl = `http://localhost:${currentPort}/gun`;
const otherPeerUrl = `http://localhost:${otherPort}/gun`;
console.log(`Server su porta ${currentPort}. Tento peering con ${otherPeerUrl}`);
// ---------------------------------------------------

// Funzione per inizializzare il database in memoria dai dati in Gun.js
async function initializeFromGun(gunInstance) {
  console.log("Inizializzazione dati da Gun.js in corso...");
  
  return new Promise((resolve) => {
    let tracksLoaded = 0;
    let timedOut = false;
    
    // Timeout per non bloccare l'avvio del server se Gun è lento
    const timeout = setTimeout(() => {
      console.log("Timeout durante il caricamento dati da Gun.js. Continuiamo con i dati caricati finora.");
      timedOut = true;
      resolve({ loaded: tracksLoaded, timedOut: true });
    }, 5000); // 5 secondi di timeout
    
    // Leggiamo l'indice delle tracce da Gun.js
    gunInstance.get('audio_files').get('tracks').map().once((trackRef) => {
      if (trackRef && trackRef.id && !timedOut) {
        try {
          // Se esiste già in memoria, saltiamo
          if (inMemoryDB[trackRef.id]) {
            return;
          }
          
          // Creiamo un'istanza completa della traccia
          const trackData = {
            id: trackRef.id,
            title: trackRef.t || 'Senza titolo',
            artist: trackRef.a || 'Sconosciuto',
            album: trackRef.alb || '', // Supporto per album
            timestamp: trackRef.ts || Date.now(),
            audio_path: trackRef.ap || null,
            artwork_path: trackRef.wp || null,
            originUrl: trackRef.o || null
          };
          
          // Salviamo in memoria
          inMemoryDB[trackRef.id] = trackData;
          tracksLoaded++;
          
          if (tracksLoaded % 10 === 0) {
            console.log(`Caricate ${tracksLoaded} tracce da Gun.js...`);
          }
        } catch (e) {
          console.error("Errore nel caricare la traccia da Gun.js:", e);
        }
      }
    });
    
    // Dopo 3 secondi, se non ha già fatto timeout, consideriamo completo il caricamento
    setTimeout(() => {
      if (!timedOut) {
        clearTimeout(timeout);
        console.log(`Caricamento da Gun.js completato: ${tracksLoaded} tracce caricate in inMemoryDB`);
        resolve({ loaded: tracksLoaded, timedOut: false });
      }
    }, 3000);
  });
}

// This is an example validation function
function hasValidToken (msg) {
  return msg && msg && msg.headers && msg.headers.token && msg.headers.token === SECURITY_TOKEN
}

// Initialize Express app
const app = express();
const PORT = cmdPort || process.env.PORT || 3001;

// Aggiunta di una semplice struttura dati locale
// Questo sarà il nostro db locale che useremo al posto di Gun.js per i messaggi grandi
const inMemoryDB = loadLocalDB(); // Carica subito dai file locali

// Creiamo prima il server HTTP
const server = require('http').createServer(app);

// Configurazione per il salvataggio automatico periodico del DB
const AUTO_SAVE_INTERVAL = 5 * 60 * 1000; // 5 minuti in millisecondi
let autoSaveInterval = null;

// Funzione per iniziare il salvataggio periodico
function startAutoSave() {
  // Pulisce eventuali interval precedenti
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
  }
  
  // Configura un nuovo interval
  autoSaveInterval = setInterval(() => {
    const trackCount = Object.keys(inMemoryDB).length;
    if (trackCount > 0) {
      console.log(`Salvataggio automatico: ${trackCount} tracce`);
      saveLocalDB();
    }
  }, AUTO_SAVE_INTERVAL);
  
  console.log(`Salvataggio automatico configurato ogni ${AUTO_SAVE_INTERVAL/60000} minuti`);
}

// Gestisce il salvataggio all'arresto del server
function handleShutdown() {
  console.log('Server in fase di arresto, salvataggio dati...');
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
  }
  saveLocalDB();
  console.log('Dati salvati, arresto in corso...');
  process.exit(0);
}

// Registra i gestori degli eventi per arresto graceful
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

// Configurazione Gun con limiti più alti
const gunOptions = {
  web: server,  // Riferimento al server HTTP (non app.server)
  file: path.join(__dirname, 'gundb'), 
  multicast: false,
  chunk: 1 * 1024 * 1024, // 1MB invece di 5MB
  max: 1 * 1024 * 1024,   // 1MB invece di 5MB
  axe: false,              // Disabilitiamo AXE completamente
  multicast: false,        // Disabilitiamo multicast
  isValid: hasValidToken,  // Aggiungiamo la funzione di validazione richiesta da bullet-catcher
  peers: [otherPeerUrl]    // <-- AGGIUNTO: Connetti all'altro server peer
};

function hasValidToken (msg) {
  return msg && msg && msg.headers && msg.headers.token && msg.headers.token === SECURITY_TOKEN
}

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// Configurazione di multer con limiti di dimensione più alti per gli upload
const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 20 * 1024 * 1024, // 20MB massimo per file (aumentato da 5MB)
    files: 2,                   // Massimo 2 file (audio + artwork)
  }
});

// Middleware
app.use(cors());
app.use(express.json({limit: '5mb'}));
app.use(express.urlencoded({limit: '5mb', extended: true}));
app.use(morgan('dev'));
app.use('/uploads', express.static(uploadsDir));

// Serve static files from the current directory
app.use(express.static(__dirname));

// Middleware per controllare dimensione dei messaggi
app.use(function(req, res, next) {
  // Escludi l'endpoint /api/upload dalla verifica generale
  if (req.path === '/api/upload') {
    return next();
  }
  
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) { // 5MB invece di 50MB
    console.warn(`Richiesta troppo grande (${Math.round(contentLength/1024/1024)}MB) rifiutata`);
    return res.status(413).send('Payload troppo grande');
  }
  next();
});

// Define routes for the main pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'player.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Funzione per scrivere in modo sicuro su Gun.js
function safeGunPut(gun, key, data) {
  return new Promise((resolve, reject) => {
    // Assicuriamoci che i dati abbiano un ID
    if (!data.id) {
      data.id = key;
    }
    
    const timeout = setTimeout(() => {
      console.log("Timeout nella scrittura su Gun.js, continuiamo comunque");
      resolve({warning: "Timeout nella scrittura su Gun.js"});
    }, 10000);
    
    try {
      console.log(`Tentativo di salvare su Gun.js per chiave "${key}"`);

      // IMPORTANTE: Salviamo SOLO metadati leggeri in Gun.js, mai i file
      const minimumData = {
        // Dati essenziali
        id: data.id || key,
        t: data.title,
        a: data.artist,
        alb: data.album || '', // Supporto per album
        ts: data.timestamp || Date.now(),
      };
      
      // Salva riferimenti ai percorsi ma solo se sono stringhe corte
      if (typeof data.audio_path === 'string' && data.audio_path.length < 256) {
        minimumData.ap = data.audio_path; // Usiamo 'ap' per audio_path
      }
      
      if (typeof data.artwork_path === 'string' && data.artwork_path.length < 256) {
        minimumData.wp = data.artwork_path; // Usiamo 'wp' per artwork_path
      }
      
      if (typeof data.originUrl === 'string' && data.originUrl.length < 256) {
        minimumData.o = data.originUrl; // Usiamo 'o' per originUrl
      }
      
      // Verifico la dimensione dei dati prima di salvarli
      const dataSize = JSON.stringify(minimumData).length;
      if (dataSize > 10 * 1024) { // Se > 10KB
        console.warn(`Dati troppo grandi (${Math.round(dataSize/1024)}KB) per Gun.js. Salvando solo metadati di base.`);
        // In questo caso manteniamo solo i dati assolutamente essenziali
        delete minimumData.ap;
        delete minimumData.wp;
      }
      
      // Salva i dati principali nel nodo specifico (audio_files/key)
      gun.get('audio_files').get(key).put(minimumData, (ack) => {
        clearTimeout(timeout);
        
        if (ack.err) {
          console.error("Errore nella scrittura su Gun.js:", ack.err);
          reject(new Error(`Errore Gun.js: ${ack.err}`));
          return;
        }
        
        console.log("Scrittura su Gun.js completata con successo");
        
        // Salva riferimento anche nell'indice principale
        gun.get('audio_files').get('tracks').get(key).put(minimumData, (indexAck) => {
          if (indexAck.err) {
            console.warn("Avviso: Indice tracks non aggiornato:", indexAck.err);
          } else {
            console.log("Indice tracks aggiornato con successo");
          }
          
          resolve(ack);
        });
      });
    } catch (error) {
      clearTimeout(timeout);
      console.error("Errore durante l'operazione con Gun.js:", error);
      reject(error);
    }
  });
}

// Initialize Gun
const gun = Gun(gunOptions);

// Carica i dati esistenti all'avvio del server
initializeFromGun(gun).then(result => {
  console.log(`Inizializzazione completata: ${result.loaded} tracce caricate${result.timedOut ? ' (timeout)' : ''}`);
  
  // Se non sono state caricate tracce, stampiamo un messaggio informativo
  if (result.loaded === 0) {
    console.log("Nessuna traccia trovata in Gun.js. Il database potrebbe essere vuoto o non sincronizzato correttamente.");
  }
}).catch(err => {
  console.error("Errore durante l'inizializzazione dati da Gun.js:", err);
});

// Endpoint specifico per Gun.js
app.use('/gun', function(req, res, next) {
  console.log('Richiesta Gun.js ricevuta a /gun', req.method);
  // Se è una richiesta HEAD, rispondiamo direttamente 
  if (req.method === 'HEAD') {
    return res.status(200).end();
  }
  // Altrimenti lasciamo che Gun gestisca la richiesta
  next();
});

// Per debug, esporta l'istanza di Gun su window
global.GUN_INSTANCE = gun;

// // Debugging dettagliato
// gun.on('put', function(msg){
//   console.log('Dato ricevuto:', msg.put);
// });


// Make Gun available to our routes
app.gun = gun;

// Endpoint per verificare lo stato di Gun.js
app.get('/gun/status', (req, res) => {
  console.log('Richiesta Gun.js status ricevuta');
  
  const gunState = {
    isActive: !!gun,
    peers: gun ? Object.keys(gun._.opt.peers || {}) : [],
    version: gun ? gun._.opt.version : 'unknown',
    localStorage: gun ? !!gun._.opt.localStorage : false,
    radisk: gun ? !!gun._.opt.radisk : false
  };
  
  // Controlla anche le sottoscrizioni attive
  let subscriptions = [];
  if (gun && gun._.path) {
    try {
      Object.keys(gun._.path).forEach(key => {
        subscriptions.push({
          key: key,
          path: gun._.path[key]
        });
      });
    } catch (e) {
      console.error("Errore nell'analisi delle sottoscrizioni:", e);
    }
  }
  
  // Invia risposta con lo stato
  res.json({
    status: 'ok',
    message: 'Gun.js is running',
    details: gunState,
    subscriptions: subscriptions.length,
    time: new Date().toISOString()
  });
});

// Endpoint per verificare lo stato del server
app.get('/healthcheck', (req, res) => {
  const memoryUsage = process.memoryUsage();
  const dbStatus = {
    keys: Object.keys(inMemoryDB).length,
    totalSizeMB: Object.values(inMemoryDB).reduce((acc, val) => {
      return acc + (val ? JSON.stringify(val).length : 0);
    }, 0) / (1024 * 1024)
  };

  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB'
    },
    db: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Endpoint per forzare il salvataggio del database locale
app.post('/admin/save-db', (req, res) => {
  try {
    // Conta quanti elementi ci sono
    const trackCount = Object.keys(inMemoryDB).length;
    
    if (trackCount === 0) {
      return res.json({
        success: true,
        message: 'Nessuna traccia da salvare',
        count: 0
      });
    }
    
    // Salva su file
    saveLocalDB();
    
    res.json({
      success: true,
      message: 'Database salvato con successo',
      count: trackCount
    });
  } catch (error) {
    console.error('Errore durante il salvataggio forzato:', error);
    res.status(500).json({
      success: false,
      message: 'Errore durante il salvataggio',
      error: error.message
    });
  }
});

// Endpoint per forzare un cleanup della memoria
app.post('/admin/cleanup', (req, res) => {
  try {
    // Conta quanti elementi c'erano prima
    const beforeCount = Object.keys(inMemoryDB).length;
    const beforeSize = Object.values(inMemoryDB).reduce((acc, val) => {
      return acc + (val ? JSON.stringify(val).length : 0);
    }, 0) / (1024 * 1024);
    
    // Rimuovi elementi inutilizzati (null, undefined, {})
    for (const key in inMemoryDB) {
      const val = inMemoryDB[key];
      if (!val || Object.keys(val).length === 0) {
        delete inMemoryDB[key];
      }
    }
    
    // Conta quanti elementi ci sono dopo
    const afterCount = Object.keys(inMemoryDB).length;
    const afterSize = Object.values(inMemoryDB).reduce((acc, val) => {
      return acc + (val ? JSON.stringify(val).length : 0);
    }, 0) / (1024 * 1024);
    
    global.gc && global.gc(); // Forza la garbage collection se disponibile
    
    res.json({
      success: true,
      message: 'Cleanup completato con successo',
      cleanup: {
        removedItems: beforeCount - afterCount,
        beforeSize: beforeSize.toFixed(2) + 'MB',
        afterSize: afterSize.toFixed(2) + 'MB',
        memorySaved: (beforeSize - afterSize).toFixed(2) + 'MB'
      }
    });
  } catch (error) {
    console.error('Errore durante il cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Errore durante il cleanup',
      error: error.message
    });
  }
});

// Gestione degli errori più dettagliata
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // Puoi implementare qui un sistema di logging più avanzato
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  // Puoi implementare qui un sistema di logging più avanzato
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Player disponibile su http://localhost:${PORT}/`);
  console.log(`Admin disponibile su http://localhost:${PORT}/admin`);
  console.log(`Server GUN attivo su http://localhost:${PORT}/gun`);
  
  // Avvia il salvataggio automatico
  startAutoSave();
}); 

// Richiedi in uscita tutti i dati per favorire la sincronizzazione
// app.gun.on('out', {get: {'#': {'*': ''}}})

// Aggiungi middleware personalizzato per aumentare il limite di dimensione dei messaggi
Gun.on('opt', function(context) {
  if(context.once){ return }
  context.on('in', function(msg) {
    this.to.next(msg);
  });
  
  // Personalizza il comportamento di Gun per gestire messaggi più grandi
  context.on('out', function(msg) {
    // Aumenta il limite di dimensione dei messaggi
    if (msg && msg.put) {
      try {
      const size = JSON.stringify(msg).length;
      if (size > 1024 * 1024) { // Se il messaggio è più grande di 1MB
        console.log(`Messaggio grande (${Math.round(size/1024)}KB) ricevuto e gestito`);
          
          // Tenta di suddividere il messaggio se possibile
          if (msg.put && typeof msg.put === 'object') {
            console.log("Tentativo di suddividere il messaggio grande in parti più piccole");
            // Questa è una soluzione semplificata, dovresti sviluppare una strategia 
            // più robusta per suddividere i messaggi in base alle tue esigenze
          }
        }
      } catch (e) {
        console.error("Errore durante l'elaborazione del messaggio:", e);
      }
    }
    this.to.next(msg);
  });
});

// Gestione errori specifici di Gun
gun.on('err', function(err) {
  console.error('Errore Gun.js:', err);
  
  // Gestione specifica per errori di messaggi troppo grandi
  if (err.toString().includes('too big')) {
    console.warn('Rilevato errore "Message too big" - Considera di ridurre ulteriormente i limiti');
  }
});

// Log delle connessioni
gun.on('hi', peer => {
  console.log('Peer connesso:', peer);
});

gun.on('bye', peer => {
  console.log('Peer disconnesso:', peer);
});

// Impostazioni di debug
global.Gun = Gun; // rende Gun disponibile in globale
global.gun = gun; // rende gun disponibile in globale

// Gestione errori a livello di server
app.use((err, req, res, next) => {
  console.error('Errore del server:', err);
  res.status(500).send('Errore del server');
});

// Messaggio di benvenuto
console.log('Hello wonderful person! :) Thanks for using GUN, please ask for help on http://chat.gun.eco if anything takes you longer than 5min to figure out!');

// API per ottenere la lista delle tracce
app.get('/api/tracks', async (req, res) => {
  console.log('Richiesta lista tracce ricevuta');
  
  try {
    // Verifica se è richiesto un reload forzato da Gun.js
    const forceReload = req.query.force === 'true';
    
    if (forceReload) {
      console.log('Richiesto reload forzato, ignorando cache locale');
    }
    
    // PRIORITÀ: Usa solo la cache in memoria locale per evitare completamente "Message too big!"
    const localTracksMap = {};
    
    // Primo passaggio: crea un insieme di ID delle tracce
    const trackIds = new Set(Object.keys(inMemoryDB));
    
    // Filtra le tracce per rimuovere quelle non valide o corrotte
    const localTracks = Object.values(inMemoryDB).filter(track => {
      if (!track || !track.id) return false;
      
      // Aggiungi alla mappa per il controllo dei duplicati
      localTracksMap[track.id] = true;
      
      return true;
    }).map(track => {
      // Restituisci solo i campi necessari per la UI
      return {
        id: track.id,
        title: track.title,
        artist: track.artist,
        audio_path: track.audio_path,
        artwork_path: track.artwork_path,
        timestamp: track.timestamp || Date.now(),
        originUrl: track.originUrl
      };
    });

    // Se abbiamo dati in memoria e non è richiesto un reload forzato, usiamo quelli (approccio primario)
    if (localTracks.length > 0 && !forceReload) {
      console.log(`Restituendo ${localTracks.length} tracce dalla memoria locale`);
      return res.json({
        success: true,
        source: "local_cache",
        tracks: localTracks
      });
    }
    
    // Se è richiesto un reload forzato o non abbiamo dati in memoria, leggiamo da Gun.js
    console.log(forceReload ? "Reload forzato da Gun.js" : "Nessuna traccia in memoria, tentativo lettura da Gun.js");
    
    const tracks = [];
    let hasResponded = false;
    
    // Se forceReload è true, includiamo anche le tracce locali (per combinare risultati)
    if (forceReload) {
      // Copia le tracce locali, verranno integrate con quelle da Gun.js
      tracks.push(...localTracks);
    }
    
    // Timeout breve per garantire risposta rapida
    const timeout = setTimeout(() => {
      if (!hasResponded) {
        console.log('Timeout nella lettura tracce da Gun.js, rispondo con quanto raccolto finora');
        hasResponded = true;
        res.json({
          success: true,
          source: forceReload ? "combined_sources" : "timeout_fallback",
          tracks: tracks
        });
      }
    }, 2000); // 2 secondi massimo di attesa
    
    // Leggi solo l'indice Gun.js, molto più leggero
    gun.get('audio_files').get('tracks').map().once((trackRef) => {
      if (trackRef && trackRef.id && !localTracksMap[trackRef.id]) {
        try {
          // Non facciamo query annidate!
          const minimalTrack = {
            id: trackRef.id,
            title: trackRef.t || 'Senza titolo',
            artist: trackRef.a || 'Sconosciuto',
            timestamp: trackRef.ts,
            originUrl: trackRef.o || null, // Leggi l'origine da Gun (campo 'o')
            audio_path: trackRef.ap || null, // Leggi audio_path da Gun (campo 'ap')
            artwork_path: trackRef.wp || null // Leggi artwork_path da Gun (campo 'wp')
          };
          
          // Salva in memoria locale per future richieste
          if (!inMemoryDB[trackRef.id]) {
            inMemoryDB[trackRef.id] = {
              id: trackRef.id,
              title: minimalTrack.title,
              artist: minimalTrack.artist,
              timestamp: minimalTrack.timestamp,
              originUrl: minimalTrack.originUrl, // Salva anche l'origine nella cache locale
              audio_path: minimalTrack.audio_path, // Salva anche i percorsi
              artwork_path: minimalTrack.artwork_path
            };
            
            // Se è una nuova traccia (non in cache locale), aggiungi alla lista
            tracks.push(minimalTrack);
          } else if (forceReload && !tracks.some(t => t.id === trackRef.id)) {
            // Se è richiesto un reload forzato e la traccia non è già nella lista tracks, aggiungila
            tracks.push(minimalTrack);
          }
        } catch (e) {
          console.error("Errore nel processare trackRef:", e);
        }
      }
    });
    
    // Risposta fallback dopo breve tempo
    setTimeout(() => {
      if (!hasResponded) {
        clearTimeout(timeout);
        hasResponded = true;
        console.log(`Restituendo ${tracks.length} tracce da Gun.js`);
        
        // Rimuovi eventuali duplicati (può succedere con forceReload)
        const uniqueTracks = [];
        const seenIds = new Set();
        
        tracks.forEach(track => {
          if (!seenIds.has(track.id)) {
            seenIds.add(track.id);
            uniqueTracks.push(track);
          }
        });
        
        res.json({
          success: true,
          source: forceReload ? "combined_sources" : "gun_db",
          tracks: uniqueTracks
        });
      }
    }, 1000);
    
  } catch (error) {
    console.error('Errore nel recupero tracce:', error);
    res.status(500).json({
      success: false,
      message: 'Errore nel recupero tracce',
      error: error.message
    });
  }
});

// Endpoint per eliminare una traccia audio
app.delete('/api/tracks/:id', (req, res) => {
  const trackId = req.params.id;
  
  try {
    console.log(`Richiesta eliminazione traccia ${trackId}`);
    
    // Fai un dump completo di inMemoryDB per debug
    const allKeys = Object.keys(inMemoryDB);
    console.log(`Contenuto inMemoryDB: Numero tracce: ${allKeys.length}`);
    allKeys.forEach(key => {
      console.log(`Traccia in memoria - ID: ${key}, Tipo: ${typeof key}`);
      console.log(`Dettagli: ${JSON.stringify(inMemoryDB[key])}`);
    });
    
    // Prova prima una ricerca diretta
    let foundTrack = inMemoryDB[trackId];
    let foundTrackId = trackId;
    
    // Se non trovata, prova una ricerca case-insensitive e con conversione di tipo
    if (!foundTrack) {
      console.log(`Traccia ${trackId} non trovata direttamente, provo ricerca alternativa`);
      
      for (const id in inMemoryDB) {
        if (id.toString() === trackId.toString() || 
            id.toString().toLowerCase() === trackId.toString().toLowerCase()) {
          foundTrack = inMemoryDB[id];
          foundTrackId = id;
          console.log(`Trovata corrispondenza alternativa: ${id}`);
          break;
        }
      }
    }
    
    // Se ancora non trovata, come fallback inserisci comunque l'ID nella memoria locale
    // Questo è necessario perché alcune tracce potrebbero essere state caricate tramite Gun ma non salvate in memoria
    if (!foundTrack) {
      console.log(`Traccia ${trackId} non trovata in memoria locale neanche con ricerca alternativa`);
      
      // Aggiungi una traccia fantasma in memoria locale così da poterla eliminare
      inMemoryDB[trackId] = {
        id: trackId,
        title: "Traccia fantasma",
        artist: "Sconosciuto",
        audio_path: `/uploads/unknown_${trackId}.mp3`,
        artwork_path: null,
        timestamp: Date.now(),
        isGhost: true
      };
      
      console.log(`Creata traccia fantasma per ID ${trackId}`);
      foundTrack = inMemoryDB[trackId];
      foundTrackId = trackId;
    }
    
    if (foundTrack) {
      console.log(`Traccia ${trackId} trovata in memoria locale con ID: ${foundTrackId}`);
      
      // Salva i percorsi dei file prima di eliminare i dati
      const audioPath = foundTrack.audio_path;
      const artworkPath = foundTrack.artwork_path;
      
      // Elimina i file fisici dal sistema solo se non è una traccia fantasma
      if (!foundTrack.isGhost) {
        if (audioPath) {
          const fullAudioPath = path.join(__dirname, audioPath);
          console.log(`Tentativo eliminazione file audio: ${fullAudioPath}`);
          if (fs.existsSync(fullAudioPath)) {
            try {
              fs.unlinkSync(fullAudioPath);
              console.log(`File audio eliminato: ${fullAudioPath}`);
            } catch (e) {
              console.warn(`Errore nell'eliminazione del file audio: ${e.message}`);
            }
          } else {
            console.warn(`File audio non trovato: ${fullAudioPath}`);
          }
        }
        
        if (artworkPath) {
          const fullArtworkPath = path.join(__dirname, artworkPath);
          console.log(`Tentativo eliminazione file artwork: ${fullArtworkPath}`);
          if (fs.existsSync(fullArtworkPath)) {
            try {
              fs.unlinkSync(fullArtworkPath);
              console.log(`File artwork eliminato: ${fullArtworkPath}`);
            } catch (e) {
              console.warn(`Errore nell'eliminazione del file artwork: ${e.message}`);
            }
          } else {
            console.warn(`File artwork non trovato: ${fullArtworkPath}`);
          }
        }
      }
      
      // Elimina dalla memoria locale
      delete inMemoryDB[foundTrackId];
      console.log(`Traccia ${trackId} eliminata dalla memoria locale`);
      
      // Salva immediatamente le modifiche al database locale
      saveLocalDB();
      
      // Prova anche a eliminare da Gun, ma in modo non bloccante
      try {
        // Elimina i dati dalla cache Gun
        gun.get('audio_files').get(trackId).put(null);
        
        // Elimina anche il riferimento dall'indice delle tracce
        gun.get('audio_files').get('tracks').map().once((track, id) => {
          if (track && (track.id === trackId || track.id.toString() === trackId.toString())) {
            gun.get('audio_files').get('tracks').get(id).put(null);
          }
        });
        
        console.log(`Traccia ${trackId} eliminata anche da Gun.js`);
      } catch (gunError) {
        console.warn(`Errore nell'eliminazione da Gun.js (non bloccante): ${gunError.message}`);
      }
      
      // Invia un segnale di refresh per tutti i client
      try {
        gun.get('app_events').get('track_deleted').put({
          id: trackId,
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn(`Errore nell'invio dell'evento di eliminazione (non bloccante): ${e.message}`);
      }
      
      return res.json({
        success: true,
        message: 'Traccia eliminata con successo'
      });
    } else {
      // Questo non dovrebbe mai verificarsi dato che abbiamo creato una traccia fantasma
      console.error(`Errore imprevisto: traccia ${trackId} non trovata dopo la creazione della traccia fantasma`);
      return res.status(500).json({
        success: false,
        message: 'Errore interno del server'
      });
    }
  } catch (error) {
    console.error(`Errore nell'eliminazione della traccia ${trackId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Errore nell\'eliminazione della traccia',
      error: error.message
    });
  }
});

// Endpoint per l'upload delle tracce
app.post('/api/upload', upload.fields([
  { name: 'audioFile', maxCount: 1 },
  { name: 'artworkFile', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('Richiesta upload traccia ricevuta');
    
    // Verifica file audio
    if (!req.files || !req.files.audioFile) {
      return res.status(400).json({
        success: false,
        message: 'File audio non trovato nella richiesta'
      });
    }
    
    const audioFile = req.files.audioFile[0];
    const artworkFile = req.files.artworkFile ? req.files.artworkFile[0] : null;
    const title = req.body.title || 'Senza titolo';
    const artist = req.body.artist || 'Artista sconosciuto';
    const album = req.body.album || ''; // Supporto per album
    
    // Verifica dimensione file
    const maxFileSizeMB = 20; // Aumentato a 20MB perché ora memorizziamo solo riferimenti
    if (audioFile.size > maxFileSizeMB * 1024 * 1024) {
      console.warn(`Upload rifiutato: file audio troppo grande (${Math.round(audioFile.size/1024/1024)}MB)`);
      return res.status(413).json({
        success: false,
        message: `File audio troppo grande. Dimensione massima: ${maxFileSizeMB}MB`
      });
    }
    
    // Genera un ID univoco per la traccia
    const trackId = Date.now().toString() + Math.round(Math.random() * 1000).toString();
    
    // Percorsi relativi per i file
    const audioPath = `/uploads/${audioFile.filename}`;
    const artworkPath = artworkFile ? `/uploads/${artworkFile.filename}` : null;
    
    // URL di origine del server
    const originUrl = `${req.protocol}://${req.get('host')}`;
    
    // Prepara i dati della traccia - IMPORTANTE: solo metadati, NON i file stessi
    const trackData = {
      id: trackId,
      title: title,
      artist: artist,
      album: album, // Supporto per album
      audio_path: audioPath,       // Solo il percorso, non il file
      artwork_path: artworkPath,   // Solo il percorso, non il file
      timestamp: Date.now(),
      size: audioFile.size,         // Memorizza la dimensione per riferimento
      originUrl: originUrl          // Memorizza l'URL di origine
    };
    
    // Salva PRIMA in memoria locale come fonte primaria di dati
    inMemoryDB[trackId] = {
      id: trackId,
      title: title,
      artist: artist,
      album: album, // Supporto per album
      audio_path: audioPath,
      artwork_path: artworkPath,
      timestamp: Date.now(),
      size: audioFile.size,
      originUrl: originUrl
    };
    
    console.log(`Traccia "${title}" salvata in memoria locale (ID: ${trackId}) con origine ${originUrl}`);
    
    // Salva immediatamente su file locale per persistenza
    saveLocalDB();
    
    // Prova a salvare in Gun.js ma in modo asincrono (non blocca la risposta)
    try {
      // Crea una versione minima per Gun.js, includendo l'origine
      const minimalData = {
        id: trackId,
        t: title,
        a: artist,
        alb: album, // 'alb' per album
        ts: Date.now(),
        o: originUrl, // 'o' per originUrl (più corto per Gun)
        ap: audioPath, // 'ap' per audio_path
        wp: artworkPath // 'wp' per artwork_path (può essere null)
      };
      
      // Ottieni il nodo specifico per questa traccia nell'indice e salva i dati
      app.gun.get('audio_files').get('tracks').get(trackId).put(minimalData, (ack) => {
        if (ack.err) {
          console.warn(`Errore nel salvataggio indice in Gun.js (put): ${ack.err}`);
        } else {
          console.log(`Indice traccia salvato/aggiornato in Gun.js (ID: ${trackId})`);
          
          // Verifica completa: salviamo anche la traccia nel nodo audio_files/trackId
          app.gun.get('audio_files').get(trackId).put(minimalData, (detailAck) => {
            if (detailAck.err) {
              console.warn(`Errore nel salvataggio dettagli in Gun.js: ${detailAck.err}`);
            } else {
              console.log(`Dettagli traccia salvati in Gun.js (ID: ${trackId})`);
            }
          });
        }
      });

    } catch (gunError) {
      console.warn(`Errore durante tentativo di salvataggio indice in Gun.js: ${gunError}`);
      // Non blocca il flusso, continuiamo comunque
    }

    // Rispondi con successo basandoci sulla memoria locale
    res.json({
      success: true,
      message: 'Traccia caricata con successo',
      track: {
        id: trackId,
        title: title,
        artist: artist,
        album: album, // Supporto per album
        audio_path: audioPath,
        artwork_path: artworkPath,
        originUrl: originUrl // Restituisci anche l'origine nella risposta API
      }
    });

  } catch (error) {
    console.error('Errore generale nell\'upload:', error);
    res.status(500).json({
      success: false,
      message: 'Errore durante l\'upload della traccia',
      error: error.message
    });
  }
});

module.exports = { app, gun };