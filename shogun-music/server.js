const express = require('express');
const cors = require('cors');
const Gun = require('gun');
const path = require('path');
const morgan = require('morgan');
const multer = require('multer');
const fs = require('fs');
require('bullet-catcher')

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3002;

function hasValidToken (msg) {
  return msg && msg && msg.headers && msg.headers.token && msg.headers.token === 'thisIsTheTokenForReals'
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
const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));
app.use(morgan('dev'));
app.use('/uploads', express.static(uploadsDir));

// Serve static files from the current directory
app.use(express.static(__dirname));

// Middleware per controllare dimensione dei messaggi
app.use(function(req, res, next) {
  const contentLength = req.headers['content-length'];
  if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) { // 50MB
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
    const ref = gun.get('audio_files').get(key);
    
    const timeout = setTimeout(() => {
      console.log("Timeout nella scrittura su Gun.js, continuiamo comunque");
      resolve({warning: "Timeout nella scrittura su Gun.js"});
    }, 10000);
    
    try {
      console.log(`Tentativo di salvare su Gun.js per chiave "${key}":`, data);

      // Assicurati che i dati abbiano i campi sia in formato completo che in formato compatto
      // per massima compatibilità con il player
      const enhancedData = {
        ...data,
        // Formato completo
        id: data.id || key,
        title: data.title,
        artist: data.artist,
        timestamp: data.timestamp || Date.now(),
        // Formato compatto per compatibilità
        i: data.id || key,
        t: data.title,
        a: data.artist,
        l: 0, // Non è solo locale
        audio_path: data.audio_path,
        artwork_path: data.artwork_path,
      };
      
      // Salva i dati principali
      ref.put(enhancedData, (ack) => {
        clearTimeout(timeout);
        
        if (ack.err) {
          console.error("Errore nella scrittura su Gun.js:", ack.err);
          reject(new Error(`Errore Gun.js: ${ack.err}`));
          return;
        }
        
        console.log("Scrittura su Gun.js completata con successo");
        
        // Salva riferimento anche nell'indice principale
        gun.get('audio_files').get('tracks').set({
          id: data.id || key,
          t: data.title,
          a: data.artist,
          ts: Date.now()
        }, (indexAck) => {
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

// Endpoint per l'upload di tracce audio
app.post('/api/upload', upload.fields([
  { name: 'audioFile', maxCount: 1 }, 
  { name: 'artworkFile', maxCount: 1 }
]), async (req, res) => {
  console.log('Richiesta di upload ricevuta');
  
  try {
    // Estrai i file e i metadati dalla richiesta
    const { title, artist } = req.body;
    const audioFile = req.files['audioFile'][0];
    const artworkFile = req.files['artworkFile'] ? req.files['artworkFile'][0] : null;
    
    // Genera un ID univoco per la traccia
    const trackId = `track_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
    console.log(`ID traccia generato: ${trackId}`);
    
    let trackMetadata = { id: `local_${Date.now()}` };
    
    // Salva i dati in Gun.js
    console.log('Sincronizzazione con Gun.js...');
    const gunData = {
      id: trackId,
      title: title,
      artist: artist,
      pbId: trackMetadata.id,
      pbUrl: null,
      audio_id: null,
      artwork_id: null,
      audio_path: `/uploads/${path.basename(audioFile.path)}`,
      artwork_path: artworkFile ? `/uploads/${path.basename(artworkFile.path)}` : null,
      audio_mime: audioFile.mimetype,
      artwork_mime: artworkFile ? artworkFile.mimetype : null,
      timestamp: Date.now(),
      pb_format: false
    };
    
    try {
      await safeGunPut(app.gun, trackId, gunData);
      console.log('Sincronizzazione con Gun.js completata con successo');
      
      // Debug - Verifica che i dati siano stati salvati correttamente
      setTimeout(() => {
        console.log('Verifica dei dati salvati in Gun.js...');
        app.gun.get('audio_files').get(trackId).once((savedData) => {
          console.log(`Dati salvati per trackId ${trackId}:`, savedData ? 'Trovati' : 'Non trovati');
          if (savedData) {
            console.log(`Titolo: ${savedData.title}, Artista: ${savedData.artist}`);
          }
        });
        
        app.gun.get('audio_files').get('tracks').map().once((trackRef) => {
          if (trackRef && trackRef.id === trackId) {
            console.log(`Riferimento traccia trovato nell'indice: ${trackRef.id}`);
          }
        });
      }, 1000);
      
      // Invia un segnale di refresh per tutti i client
      app.gun.get('app_events').get('new_track_added').put({
        id: trackId,
        timestamp: Date.now(),
        title: title,
        artist: artist,
        audio_id: null,
        artwork_id: null,
        audio_path: gunData.audio_path,
        artwork_path: gunData.artwork_path
      });
      
      // Invia anche un evento tracks per maggiore compatibilità
      app.gun.get('audio_files').get('tracks').set({
        id: trackId,
        t: title,
        a: artist,
        ts: Date.now()
      });
      
      console.log('Segnale di nuova traccia inviato a tutti i client');
    } catch (gunError) {
      console.warn('Avviso: Sincronizzazione con Gun.js fallita:', gunError.message);
    }
  
    // Risposta al client
    res.status(200).json({
      success: true,
      message: 'Upload completato con successo',
      trackId: trackId,
      metadata: gunData
    });
    
  } catch (error) {
    console.error('Errore durante l\'upload:', error);
    
    // Pulisci i file temporanei in caso di errore
    if (req.files) {
      if (req.files['audioFile'] && req.files['audioFile'][0]) {
        try { fs.unlinkSync(req.files['audioFile'][0].path); } catch (e) {}
      }
      if (req.files['artworkFile'] && req.files['artworkFile'][0]) {
        try { fs.unlinkSync(req.files['artworkFile'][0].path); } catch (e) {}
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Errore durante l\'upload',
      error: error.message
    });
  }
});

// Implementare un semplice database in-memory per Gun
const inMemoryDB = {};

const simpleFlatStore = {
  get: function(key, cb) {
    console.log(`[store.get] Requesting key: ${key}`);
    setTimeout(() => { // Simuliamo l'I/O asincrono
      try {
        const val = inMemoryDB[key];
        console.log(`[store.get] Retrieved for ${key}:`, val ? 'Found' : 'Not found');
        cb(null, val);
      } catch (e) {
        console.error('[store.get] Error:', e);
        cb(e);
      }
    }, 1);
  },
  put: function(key, val, cb) {
    console.log(`[store.put] Storing key: ${key}, data length: ${val ? JSON.stringify(val).length : 0}`);
    setTimeout(() => { // Simuliamo l'I/O asincrono
      try {
        inMemoryDB[key] = val;
        cb(null, true);
      } catch (e) {
        console.error('[store.put] Error:', e);
        cb(e);
      }
    }, 1);
  },
  list: function(cb) {
    console.log('[store.list] Listing all keys');
    setTimeout(() => {
      try {
        const keys = Object.keys(inMemoryDB);
        cb(null, keys);
      } catch (e) {
        console.error('[store.list] Error:', e);
        cb(e);
      }
    }, 1);
  }
};

// Initialize Gun
const server = require('http').createServer(app);
const gun = Gun({
  web: server,         // Usa il server http per le connessioni websocket
  file: false,         // Non usare file storage
  multicast: false,    // Disabilita il multicast per evitare problemi
  isValid: hasValidToken, // Validazione token
  radisk: false,       // Disabilita radisk per evitare problemi con 'dare'
  radix: false,        // Disabilita radix
  store: simpleFlatStore, // Usa il nostro store personalizzato
  axe: false,          // Disabilita axe per problemi di compatibilità
  peers: [],           // Nessun peer iniziale
  websocket: {         // Configurazione websocket
    mode: 'connect',
    path: '/gun'       // Path esplicito per l'endpoint websocket
  },
  maxSockets: 100,    // Aumenta il numero di socket
  memory: {           // Aumenta i limiti di memoria
    max: 1000 * 1000 * 100, // 100MB
  },
  rfs: false,         // Disabilita Radix File Storage per evitare problemi di I/O
  localStorage: false, // Disabilita localStorage (non è disponibile su Node.js)
  chunk: 10240        // Limita la dimensione dei chunks a 10KB
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
      const size = JSON.stringify(msg).length;
      if (size > 1024 * 1024) { // Se il messaggio è più grande di 1MB
        console.log(`Messaggio grande (${Math.round(size/1024)}KB) ricevuto e gestito`);
      }
    }
    this.to.next(msg);
  });
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

// Endpoint per ottenere la lista delle tracce audio
app.get('/api/tracks', (req, res) => {
  try {
    console.log('Richiesta lista tracce ricevuta');
    const tracks = [];
    
    // Cerca le entry nel database Gun che contengono informazioni sulle tracce audio
    app.gun.get('audio_files').map().once((data, id) => {
      if (data && data.title && data.audio_path) {
        tracks.push({
          id: id,
          title: data.title,
          artist: data.artist || 'Sconosciuto',
          audio_path: data.audio_path,
          artwork_path: data.artwork_path,
          timestamp: data.timestamp || Date.now()
        });
      }
    });
    
    // Invia i risultati dopo un breve ritardo per permettere a Gun di completare le query
    setTimeout(() => {
      // Ordina le tracce per timestamp (più recenti prima)
      tracks.sort((a, b) => b.timestamp - a.timestamp);
      
      console.log(`Invio di ${tracks.length} tracce al client`);
      res.json({
        success: true,
        tracks: tracks
      });
    }, 300);
  } catch (error) {
    console.error('Errore nel recupero delle tracce:', error);
    res.status(500).json({
      success: false,
      message: 'Errore nel recupero delle tracce',
      error: error.message
    });
  }
});

// Endpoint per eliminare una traccia audio
app.delete('/api/tracks/:id', (req, res) => {
  const trackId = req.params.id;
  
  try {
    console.log(`Richiesta eliminazione traccia ${trackId}`);
    
    // Cerca i dati della traccia nel database
    app.gun.get('audio_files').get(trackId).once((data) => {
      if (!data) {
        return res.status(404).json({
          success: false,
          message: 'Traccia non trovata'
        });
      }
      
      // Salva i percorsi dei file prima di eliminare i dati
      const audioPath = data.audio_path;
      const artworkPath = data.artwork_path;
      
      // Elimina i dati dalla cache Gun
      app.gun.get('audio_files').get(trackId).put(null);
      
      // Elimina anche il riferimento dall'indice delle tracce
      app.gun.get('audio_files').get('tracks').map().once((track, id) => {
        if (track && track.id === trackId) {
          app.gun.get('audio_files').get('tracks').get(id).put(null);
        }
      });
      
      // Elimina i file fisici dal sistema
      if (audioPath) {
        const fullAudioPath = path.join(__dirname, audioPath);
        if (fs.existsSync(fullAudioPath)) {
          fs.unlinkSync(fullAudioPath);
          console.log(`File audio eliminato: ${fullAudioPath}`);
        }
      }
      
      if (artworkPath) {
        const fullArtworkPath = path.join(__dirname, artworkPath);
        if (fs.existsSync(fullArtworkPath)) {
          fs.unlinkSync(fullArtworkPath);
          console.log(`File artwork eliminato: ${fullArtworkPath}`);
        }
      }
      
      // Invia un segnale di refresh per tutti i client
      app.gun.get('app_events').get('track_deleted').put({
        id: trackId,
        timestamp: Date.now()
      });
      
      res.json({
        success: true,
        message: 'Traccia eliminata con successo'
      });
    });
  } catch (error) {
    console.error(`Errore nell'eliminazione della traccia ${trackId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Errore nell\'eliminazione della traccia',
      error: error.message
    });
  }
});

module.exports = { app, gun }; 
