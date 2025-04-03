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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/uploads', express.static(uploadsDir));

// Serve static files from the current directory
app.use(express.static(__dirname));

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

// Initialize Gun
const server = require('http').createServer(app);
const gun = Gun({
  web: server,         // Usa il server http per le connessioni websocket
  file: 'gundb',       // Salva i dati nel file gundb
  multicast: false,    // Disabilita il multicast per evitare problemi
  isValid: hasValidToken, // Validazione token
  radisk: true,        // Salva localmente su disco
  axe: false,          // Disabilita axe per problemi di compatibilità
  peers: [],           // Nessun peer iniziale
  websocket: {         // Configurazione websocket
    mode: 'connect',
    path: '/gun'       // Path esplicito per l'endpoint websocket
  }
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

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Player disponibile su http://localhost:${PORT}/`);
  console.log(`Admin disponibile su http://localhost:${PORT}/admin`);
  console.log(`Server GUN attivo su http://localhost:${PORT}/gun`);
}); 

// Richiedi in uscita tutti i dati per favorire la sincronizzazione
// app.gun.on('out', {get: {'#': {'*': ''}}})
