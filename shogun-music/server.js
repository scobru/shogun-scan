const express = require('express');
const Gun = require('gun');
const path = require('path');
const PocketBase = require('pocketbase/cjs');
const dotenv = require('dotenv');
const multer = require('multer');
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Log di avvio chiaro
console.log('=== SHOGUN MUSIC SERVER ===');
console.log(`Avvio server sulla porta ${port}`);
console.log('Se vuoi usare la porta 3001, riavvia con: PORT=3001 npm run dev');
console.log('===========================');

// Configurazione limiti aumentati
app.use(express.json({ limit: '100mb' })); // Aumentiamo il limite per i file
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Aggiungiamo middleware CORS per consentire richieste cross-origin
app.use((req, res, next) => {
  // Permettiamo richieste da localhost su varie porte
  res.header('Access-Control-Allow-Origin', '*');
  // Metodi consentiti
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  // Headers consentiti
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Gestiamo le richieste preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Configurazione PocketBase
const pbUrl = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
console.log('Inizializzazione PocketBase con URL:', pbUrl);
const pb = new PocketBase(pbUrl);

// Credenziali admin predefinite
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || 'admin123456';

// Log delle credenziali
console.log('Email admin predefinita:', ADMIN_EMAIL);
console.log('Password admin predefinita:', ADMIN_PASSWORD);
console.log('Per modificare le credenziali admin, usa le variabili d\'ambiente PB_ADMIN_EMAIL e PB_ADMIN_PASSWORD');
console.log('Es: PB_ADMIN_EMAIL=mia@email.com PB_ADMIN_PASSWORD=miapassword npm run dev');

// Test connessione PocketBase con retry e autenticazione
const MAX_RETRIES = 5; // Aumentiamo i tentativi
const RETRY_DELAY = 3000; // Ridotto a 3 secondi per essere più reattivi

// Configurazione server con timeout più lungo per file grandi
const serverTimeout = 5 * 60 * 1000; // 5 minuti

// Sistema di fallback per il salvataggio file se PocketBase non è disponibile
const FALLBACK_STORAGE_DIR = path.join(__dirname, 'fallback_storage');

// Assicuriamoci che la directory esista
if (!fs.existsSync(FALLBACK_STORAGE_DIR)) {
  try {
    fs.mkdirSync(FALLBACK_STORAGE_DIR, { recursive: true });
    console.log(`[FALLBACK] Directory di storage creata: ${FALLBACK_STORAGE_DIR}`);
  } catch (err) {
    console.error(`[FALLBACK] Errore creazione directory: ${err.message}`);
  }
}

// Funzione per salvare un file con il sistema di fallback
function saveFallbackFile(fileName, data, mimeType) {
  return new Promise((resolve, reject) => {
    try {
      const filePath = path.join(FALLBACK_STORAGE_DIR, fileName);
      
      // Se il dato è in formato data URI (base64), estraiamo i dati binari
      if (typeof data === 'string' && data.startsWith('data:')) {
        // Estrai i dati binari dal data URI
        const base64Data = data.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        
        fs.writeFile(filePath, buffer, (err) => {
          if (err) {
            console.error(`[FALLBACK] Errore salvataggio file: ${err.message}`);
            reject(err);
          } else {
            console.log(`[FALLBACK] File salvato con successo: ${filePath}`);
            
            // Crea un URL accessibile
            const fileUrl = `/fallback/${fileName}`;
            resolve({
              success: true,
              fileUrl,
              filePath
            });
          }
        });
      } else if (Buffer.isBuffer(data)) {
        // Se è già un buffer, salvalo direttamente
        fs.writeFile(filePath, data, (err) => {
          if (err) {
            console.error(`[FALLBACK] Errore salvataggio file: ${err.message}`);
            reject(err);
          } else {
            console.log(`[FALLBACK] File salvato con successo: ${filePath}`);
            
            // Crea un URL accessibile
            const fileUrl = `/fallback/${fileName}`;
            resolve({
              success: true,
              fileUrl,
              filePath
            });
          }
        });
      } else {
        console.error(`[FALLBACK] Formato dati non supportato`);
        reject(new Error('Formato dati non supportato'));
      }
    } catch (error) {
      console.error(`[FALLBACK] Errore generale: ${error.message}`);
      reject(error);
    }
  });
}

async function initializePocketBase(retryCount = 0) {
  try {
    console.log(`[PB] Test connessione PocketBase (tentativo ${retryCount + 1}/${MAX_RETRIES})...`);
    const health = await pb.health.check();
    console.log('[PB] PocketBase è attivo:', health);
    
    // Tentiamo di autenticarci come ADMIN (non come utente)
    try {
      console.log(`[PB] Tentativo di autenticazione admin con ${ADMIN_EMAIL}...`);
      
      // Utilizziamo l'autenticazione tramite collection admin
      try {
        // Prima proviamo con _superusers (nuova versione PB)
        const authData = await pb.collection('_superusers').authWithPassword(
          ADMIN_EMAIL,
          ADMIN_PASSWORD
        );
        console.log('[PB] Autenticazione riuscita come ADMIN (_superusers)');
        console.log('[PB] Admin autenticato:', pb.authStore.model?.email);
        return true;
      } catch (err) {
        // Se fallisce, prova con l'endpoint regolare admin (versioni older)
        console.log('[PB] Tentativo fallito con _superusers, provo con admin...');
        const authData = await pb.admins.authWithPassword(
          ADMIN_EMAIL,
          ADMIN_PASSWORD
        );
        console.log('[PB] Autenticazione riuscita come ADMIN (admin)');
        console.log('[PB] Admin autenticato:', pb.authStore.model?.email);
        return true;
      }
    } catch (authError) {
      console.error('[PB] Errore autenticazione admin:', authError);
      
      // Se siamo all'ultimo tentativo, suggerisco di verificare le credenziali
      if (retryCount >= MAX_RETRIES - 1) {
        console.error('[PB] ATTENZIONE: Tutti i tentativi di autenticazione falliti!');
        console.error('[PB] Verifica che:');
        console.error(`[PB] 1. L'utente admin ${ADMIN_EMAIL} esista in PocketBase`);
        console.error('[PB] 2. La password sia corretta');
        console.error('[PB] 3. PocketBase sia in esecuzione all\'URL:', pbUrl);
        console.error('[PB] Puoi modificare le credenziali usando le variabili d\'ambiente:');
        console.error('[PB] PB_ADMIN_EMAIL=mia@email.com PB_ADMIN_PASSWORD=miapassword npm run dev');
      }
      
      // Continua comunque, anche se alcune funzionalità saranno limitate
      console.warn('[PB] Continuiamo senza autenticazione admin: alcune funzionalità potrebbero non essere disponibili');
      return false;
    }
  } catch (error) {
    console.error('[PB] ERRORE CRITICO - PocketBase non raggiungibile:', error);
    if (retryCount < MAX_RETRIES) {
      console.log(`[PB] Nuovo tentativo (${retryCount + 2}/${MAX_RETRIES}) tra ${RETRY_DELAY/1000} secondi...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return await initializePocketBase(retryCount + 1);
    }
    console.error('[PB] Impossibile connettersi a PocketBase dopo tutti i tentativi');
    console.error('[PB] Verifica che:');
    console.error('[PB] 1. PocketBase sia in esecuzione all\'URL:', pbUrl);
    console.error('[PB] 2. Non ci siano firewall che bloccano la connessione');
    console.error('[PB] Puoi modificare l\'URL usando la variabile d\'ambiente:');
    console.error('[PB] POCKETBASE_URL=http://mio-server:8090 npm run dev');
    return false;
  }
}

// Avviamo l'inizializzazione
(async () => {
  try {
    // Inizializziamo PocketBase e verifichiamo l'autenticazione
    const initialized = await initializePocketBase();
    
    // Log dello stato di autenticazione
    console.log('Stato autenticazione:', pb.authStore.isValid ? 'Autenticato' : 'Non autenticato');
    
    // Verifichiamo lo stato di autenticazione
    if (pb.authStore.isValid) {
      console.log('Utente autenticato:', pb.authStore.model.email);
      console.log('Token valido:', pb.authStore.token ? 'Sì' : 'No');
      
      // Creiamo le collections solo se l'autenticazione è valida
      try {
        console.log('Inizializzazione delle collezioni...');
        
        // Creazione collection per file audio
        const audioCollectionCreated = await createAudioFilesCollection();
        console.log('Collection audio:__Files:', audioCollectionCreated ? 'creata/esistente' : 'errore');
        
        // Creazione collection per dati Gun
        const adapter = new GunPocketBaseAdapter();
        const gunCollectionCreated = await adapter.ensureCollections();
        console.log('Collection gun_data:', gunCollectionCreated ? 'creata/esistente' : 'errore');
      } catch (error) {
        console.error('Errore inizializzazione collection:', error);
        console.warn('Il server continuerà con funzionalità limitate.');
      }
    } else {
      console.warn('Autenticazione non riuscita. Non sarà possibile creare o modificare collection.');
      console.warn('Alcune funzionalità potrebbero non essere disponibili.');
    }

    // Avviamo il server sempre, anche se l'autenticazione fallisce
    const server = app.listen(port, () => {
      console.log(`Server in ascolto sulla porta ${port}`);
    });

    // Inizializziamo GunDB con configurazione migliorata
    const gun = Gun({
      web: server,
      file: false,
      radisk: false,
      localStorage: false,
      multicast: false,
      peers: [`http://localhost:${port}/gun`],
      axe: false // Disabilitiamo AXE per debug
    });

    // Log dettagliato per ogni connessione peer
    gun.on('hi', peer => {
      console.log('[GUN] Nuovo peer connesso:', peer);
    });

    gun.on('bye', peer => {
      console.log('[GUN] Peer disconnesso:', peer);
    });

    // Listener per tutti i messaggi PUT
    gun.on('put', function(msg) {
      console.log('[GUN] Messaggio PUT ricevuto:', {
        key: msg.put ? Object.keys(msg.put)[0] : 'N/A',
        data: msg.put,
        peer: msg['#']
      });
    });

    console.log('[GUN] Inizializzazione completata con configurazione:', {
      port: port,
      peers: gun._.opt.peers
    });

    // Aggiungiamo middleware per log dettagliati
    app.use((req, res, next) => {
      // Logging completo per tutte le richieste HTTP
      const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
      console.log(`[HTTP] ${req.method} ${fullUrl} (${res.statusCode})`);
      
      // Log corpo per richieste non GET
      if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
        const bodySize = JSON.stringify(req.body).length;
        console.log(`[HTTP] Body size: ${bodySize} bytes`);
        
        // Mostro solo primi parametri per debug, no dati sensibili
        const safeKeys = Object.keys(req.body).filter(k => !k.toLowerCase().includes('password'));
        if (safeKeys.length > 0) {
          console.log(`[HTTP] Body params: ${safeKeys.join(', ')}`);
        }
      }
      
      // Next middleware
      next();
    });

    // Listener per debug Gun
    Gun.on('opt', function(context) {
      if (context.once) return;
      
      // Log per tutti gli eventi in entrata
      context.on('in', function(msg) {
        if (msg.put) {
          const keys = Object.keys(msg.put);
          console.log(`[GUN IN] Ricevuto messaggio PUT con ${keys.length} keys:`, keys);
          console.log(`[GUN IN] Dimensione dati: ${JSON.stringify(msg.put).length} bytes`);
        } else if (msg.get) {
          console.log(`[GUN IN] Ricevuto messaggio GET:`, msg.get);
        }
        this.to.next(msg);
      });
      
      // Log per tutti gli eventi in uscita
      context.on('out', function(msg) {
        if (msg.put) {
          const keys = Object.keys(msg.put);
          console.log(`[GUN OUT] Inviato messaggio PUT con ${keys.length} keys:`, keys);
        } else if (msg.get) {
          console.log(`[GUN OUT] Inviato messaggio GET:`, msg.get);
        }
        this.to.next(msg);
      });
    });

    // Registriamo l'adapter personalizzato
    gun.on('create', function(root) {
      console.log('[GUN] ==========================================');
      console.log('[GUN] Evento create attivato');
      console.log('[GUN] Root options:', root.opt);
      this.to.next(root);
      
      // Registra l'adapter per Gun come store
      const adapter = new GunPocketBaseAdapter();
      
      console.log('[GUN] Adapter PocketBase registrato');
      
      root.opt.store = {
        put: (key, data, callback) => {
          console.log(`[GUN DEBUG] ==========================================`);
          console.log(`[GUN DEBUG] Richiesta PUT ricevuta`);
          console.log(`[GUN DEBUG] Chiave:`, key);
          console.log(`[GUN DEBUG] Tipo dati:`, typeof data);
          console.log(`[GUN DEBUG] Dati completi:`, JSON.stringify(data, null, 2));
          
          // Verifichiamo che i dati siano validi
          if (!data) {
            console.error(`[GUN PUT] Errore: dati non validi per chiave ${key}`);
            callback(new Error('Dati non validi'));
            return;
          }

          // Log aggiuntivo per release
          if (key.startsWith('releases/')) {
            console.log('[GUN PUT] Rilevata richiesta salvataggio release');
            console.log('[GUN PUT] Release ID:', key.split('/')[1]);
          }
          
          // Chiamiamo l'adapter con gestione errori migliorata
          adapter.put(key, data, (err) => {
            if (err) {
              console.error(`[GUN PUT] Errore per chiave ${key}:`, err);
              console.error(`[GUN PUT] Stack trace:`, err.stack);
              callback(err);
            } else {
              console.log(`[GUN PUT] Successo per chiave ${key}`);
              // Verifichiamo che i dati siano stati effettivamente salvati
              adapter.get(key, (getErr, savedData) => {
                if (getErr) {
                  console.error(`[GUN PUT] Errore verifica salvataggio:`, getErr);
                } else {
                  console.log(`[GUN PUT] Verifica salvataggio:`, savedData);
                }
              });
              callback(null);
            }
          });
        },
        get: (key, callback) => {
          console.log(`[GUN GET] Richiesta GET per la chiave: ${key}`);
          adapter.get(key, (err, data) => {
            if (err) {
              console.error(`[GUN GET] Errore per chiave ${key}:`, err);
              callback(err, null);
            } else if (data) {
              console.log(`[GUN GET] Dati trovati per chiave ${key}:`, data);
              callback(null, data);
            } else {
              console.log(`[GUN GET] Nessun dato per chiave ${key}`);
              callback(null, null);
            }
          });
        }
      };

      // Aggiungiamo listener per debug
      root.on('put', function(msg) {
        console.log('[GUN] Evento PUT ricevuto:', {
          key: msg.put ? Object.keys(msg.put)[0] : 'N/A',
          data: msg.put
        });
      });

      console.log('[GUN] ==========================================');
    });
  } catch (error) {
    console.error('Errore fatale durante l\'inizializzazione:', error);
    process.exit(1);
  }
})();

// Serviamo i file statici dalla cartella "public"
app.use(express.static(path.join(__dirname, 'public')));

// Servi i file salvati con il fallback system
app.use('/fallback', express.static(FALLBACK_STORAGE_DIR));

console.log('Email admin:', ADMIN_EMAIL);
console.log('Password admin:', ADMIN_PASSWORD);

// Endpoint di test per verificare connettività
app.get('/api/test', (req, res) => {
  console.log('[TEST] Richiesta di test ricevuta');
  res.json({
    success: true,
    message: 'Server operativo',
    timestamp: Date.now()
  });
});

app.post('/api/test', (req, res) => {
  console.log('[TEST] POST di test ricevuta');
  const body = req.body;
  console.log('[TEST] Payload ricevuto:', body);
  
  res.json({
    success: true,
    message: 'POST ricevuto con successo',
    receivedData: body,
    timestamp: Date.now()
  });
});

// Endpoint per l'upload dei file audio
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Creiamo una cartella temporanea per i file
    const uploadDir = path.join(os.tmpdir(), 'shogun-music-uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Nome univoco per evitare conflitti
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 50 * 1024 * 1024, // Limite 50MB
    fieldSize: 50 * 1024 * 1024 // Limite per campi form
  }
});

// Creiamo una collection in PocketBase per i file audio
async function createAudioFilesCollection() {
  const collectionName = 'audio_files';
  
  try {
    // Verifichiamo che siamo autenticati (l'autenticazione con _superusers implica già che siamo admin)
    if (!pb.authStore.isValid) {
      console.error(`[COLLECTION] Creazione "${collectionName}" richiede autenticazione ADMIN`);
      // Tentiamo una nuova autenticazione admin
      try {
        console.log('[COLLECTION] Tentativo di autenticazione admin...');
        await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
        console.log('[COLLECTION] Autenticazione admin riuscita');
      } catch (authError) {
        console.error('[COLLECTION] Impossibile autenticarsi come admin:', authError);
        return false;
      }
    }
    
    // Verifichiamo nuovamente solo la validità dell'autenticazione
    if (!pb.authStore.isValid) {
      console.error('[COLLECTION] Autenticazione admin fallita, impossibile creare collection');
      return false;
    }
    
    // Loghiamo le info sull'utente autenticato per debug
    console.log('[COLLECTION] Autenticazione corrente:', {
      isValid: pb.authStore.isValid,
      model: pb.authStore.model ? {
        id: pb.authStore.model.id,
        email: pb.authStore.model.email,
        collection: pb.authStore.model.collectionName || pb.authStore.model.collection
      } : null
    });
    
    console.log(`[COLLECTION] Verifica esistenza collection "${collectionName}"...`);
    
    try {
      await pb.collections.getOne(collectionName);
      console.log(`[COLLECTION] Collection "${collectionName}" trovata, nessuna azione necessaria`);
      return true;
    } catch (error) {
      // Se non esiste (404), proviamo a crearla
      if (error.status === 404) {
        console.log(`[COLLECTION] Collection "${collectionName}" non trovata, creazione...`);
        
        try {
          const collection = await pb.collections.create({
            name: collectionName,
            type: 'base',
            // Permessi aperti per tutti
            listRule: '',   // chiunque può visualizzare la lista
            viewRule: '',   // chiunque può visualizzare i record
            createRule: '', // chiunque può creare record
            updateRule: '', // chiunque può aggiornare record
            deleteRule: '', // chiunque può eliminare record
            schema: [
              {
                name: 'trackId',
                type: 'text',
                required: true
              },
              {
                name: 'audioFile',
                type: 'file',
                required: true
              },
              {
                name: 'mimeType',
                type: 'text',
                required: false
              }
            ]
          });
          
          console.log(`[COLLECTION] Collection "${collectionName}" creata con successo (ID: ${collection.id})`);
          
          try {
            await pb.collections.createIndex(collectionName, {
              field: 'trackId',
              unique: true
            });
            console.log(`[COLLECTION] Indice creato su campo "trackId"`);
          } catch (indexError) {
            console.warn(`[COLLECTION] Errore creazione indice: ${indexError.message}`);
          }
          
          return true;
        } catch (createError) {
          console.error(`[COLLECTION] Errore creazione: ${createError.message}`);
          return false;
        }
      } else {
        console.error(`[COLLECTION] Errore verifica: ${error.message}`);
        return false;
      }
    }
  } catch (error) {
    console.error(`[COLLECTION] Errore generale: ${error.message}`);
    return false;
  }
}

// Implementazione GunDB PocketBase Adapter
class GunPocketBaseAdapter {
  constructor() {
    this.pb = pb;
    this.collectionName = 'gun_data';
    console.log('[ADAPTER] Inizializzazione GunPocketBaseAdapter');
  }

  async ensureCollections() {
    try {
      // Verifica autenticazione
      if (!this.pb.authStore.isValid) {
        console.warn('[ADAPTER] Creazione collection richiede autenticazione ADMIN');
        return false;
      }

      console.log('[ADAPTER] Verifica collection gun_data...');
      
      try {
        // Verifica se esiste
        await this.pb.collections.getOne('gun_data');
        console.log('[ADAPTER] Collection gun_data trovata');
        return true;
      } catch (error) {
        // Se non esiste (404), la creiamo
        if (error.status === 404) {
          console.log('[ADAPTER] Collection gun_data non trovata, creazione...');
          
          try {
            const collection = await this.pb.collections.create({
              name: 'gun_data',
              type: 'base',
              listRule: '',
              viewRule: '',
              createRule: '',
              updateRule: '',
              deleteRule: '',
              schema: [
                {
                  name: 'key',
                  type: 'text',
                  required: true
                },
                {
                  name: 'data',
                  type: 'json',
                  required: false
                },
                {
                  name: 'type',
                  type: 'text',
                  required: false
                }
              ]
            });
            
            console.log('[ADAPTER] Collection gun_data creata con successo');
            return true;
          } catch (createError) {
            console.error('[ADAPTER] Errore creazione collection:', createError);
            return false;
          }
        } else {
          console.error('[ADAPTER] Errore verifica collection:', error);
          return false;
        }
      }
    } catch (error) {
      console.error('[ADAPTER] Errore generale:', error);
      return false;
    }
  }

  put(key, data, callback) {
    console.log('[ADAPTER] ==========================================');
    console.log('[ADAPTER] PUT richiesto per chiave:', key);
    console.log('[ADAPTER] Tipo dati:', typeof data);

    try {
      // Verifichiamo che i dati siano validi
      if (!data) {
        console.error('[ADAPTER] Dati non validi');
        callback(new Error('Dati non validi'));
        return;
      }

      // Gestiamo diversi tipi di dati
      if (key === 'all_releases') {
        console.log('[ADAPTER] Inizializzazione nodo all_releases');
        this._saveToGunData(key, data, 'node', callback);
        return;
      }

      // Gestiamo le release
      if (key.startsWith('release_')) {
        console.log('[ADAPTER] Salvataggio release');
        
        // Se c'è un artwork in base64, lo salviamo separatamente
        let processedData = { ...data };
        if (data.artwork && data.artwork.startsWith('data:')) {
          const artworkKey = `artwork_${data.id}`;
          this._saveBinaryData(artworkKey, data.artwork, (err, artworkUrl) => {
            if (err) {
              console.error('[ADAPTER] Errore salvataggio artwork:', err);
              processedData.artwork = '';
            } else {
              processedData.artwork = artworkUrl;
            }
            this._saveToGunData(key, processedData, 'release', callback);
          });
        } else {
          this._saveToGunData(key, processedData, 'release', callback);
        }
        return;
      }

      // Gestiamo le tracce
      if (key.startsWith('track_')) {
        console.log('[ADAPTER] Salvataggio traccia');
        
        // Se c'è un file audio in base64, lo salviamo separatamente
        let processedData = { ...data };
        if (data.audioData && data.audioData.startsWith('data:')) {
          const audioKey = `audio_${data.id}`;
          this._saveBinaryData(audioKey, data.audioData, (err, audioUrl) => {
            if (err) {
              console.error('[ADAPTER] Errore salvataggio audio:', err);
              processedData.audioData = '';
            } else {
              processedData.audioUrl = audioUrl;
              delete processedData.audioData;
            }
            this._saveToGunData(key, processedData, 'track', callback);
          });
        } else {
          this._saveToGunData(key, processedData, 'track', callback);
        }
        return;
      }

      // Altri tipi di dati
      this._saveToGunData(key, data, 'generic', callback);

    } catch (error) {
      console.error('[ADAPTER] Errore generale:', error);
      callback(error);
    }
  }

  _saveToGunData(key, data, type, callback) {
    const saveData = {
      key: key,
      data: data,
      type: type,
      timestamp: Date.now()
    };

    this.pb.collection('gun_data').create(saveData).then(() => {
      console.log(`[ADAPTER] Dati tipo ${type} salvati con successo`);
      callback(null);
    }).catch(err => {
      if (err.status === 400 && err.data.code === 'record_not_unique') {
        // Aggiorniamo il record esistente
        this.pb.collection('gun_data').getFirstListItem(`key="${key}"`).then(record => {
          this.pb.collection('gun_data').update(record.id, saveData).then(() => {
            console.log(`[ADAPTER] Dati tipo ${type} aggiornati con successo`);
            callback(null);
          });
        });
      } else {
        console.error('[ADAPTER] Errore salvataggio:', err);
        callback(err);
      }
    });
  }

  _saveBinaryData(key, dataUri, callback) {
    try {
      const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        callback(new Error('Formato data URI non valido'));
        return;
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      const extension = mimeType.split('/')[1];
      const fileName = `${key}.${extension}`;

      // Salviamo usando il meccanismo di fallback
      saveFallbackFile(fileName, buffer, mimeType).then(result => {
        console.log(`[ADAPTER] File binario salvato: ${result.fileUrl}`);
        callback(null, result.fileUrl);
      }).catch(err => {
        console.error('[ADAPTER] Errore salvataggio file binario:', err);
        callback(err);
      });
    } catch (error) {
      console.error('[ADAPTER] Errore processamento dati binari:', error);
      callback(error);
    }
  }

  get(key, callback) {
    console.log('[ADAPTER] GET richiesto per chiave:', key);
    
    this.pb.collection('gun_data').getFirstListItem(`key="${key}"`).then(record => {
      console.log('[ADAPTER] Dati trovati:', record);
      callback(null, record.data);
    }).catch(err => {
      if (err.status === 404) {
        console.log('[ADAPTER] Nessun dato trovato per la chiave:', key);
        callback(null, null);
      } else {
        console.error('[ADAPTER] Errore recupero dati:', err);
        callback(err);
      }
    });
  }
}

// Endpoint per creare un nuovo utente
app.post('/api/users/register', async (req, res) => {
  try {
    console.log('[REGISTER] Richiesta creazione nuovo utente');
    
    const { email, password, passwordConfirm, name } = req.body;
    
    if (!email || !password || !passwordConfirm) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email, password e conferma password sono richiesti' 
      });
    }
    
    if (password !== passwordConfirm) {
      return res.status(400).json({ 
        success: false, 
        error: 'Le password non corrispondono'
      });
    }
    
    try {
      // Dati per creazione utente
      const userData = {
        email: email,
        password: password,
        passwordConfirm: passwordConfirm
      };
      
      // Aggiungiamo il nome se fornito
      if (name) {
        userData.name = name;
      }
      
      // Creiamo l'utente in PocketBase
      const record = await pb.collection('users').create(userData);
      
      console.log(`[REGISTER] Utente creato con ID: ${record.id}`);
      
      // Opzionale: invio email di verifica
      await pb.collection('users').requestVerification(email);
      
      res.json({
        success: true,
        message: 'Utente creato con successo. Controlla la tua email per verificare l\'account.',
        userId: record.id
      });
    } catch (error) {
      console.error('[REGISTER] Errore creazione utente:', error);
      res.status(400).json({ 
        success: false, 
        error: error.message || 'Errore durante la creazione dell\'utente'
      });
    }
  } catch (error) {
    console.error('[REGISTER] Errore generale:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Errore interno del server'
    });
  }
});

// Endpoint per l'autenticazione utente
app.post('/api/users/login', async (req, res) => {
  try {
    console.log('[LOGIN] Richiesta autenticazione utente');
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email e password sono richiesti' 
      });
    }
    
    try {
      // Autenticazione tramite collection users
      const authData = await pb.collection('users').authWithPassword(email, password);
      
      console.log(`[LOGIN] Utente autenticato: ${authData.record.email}`);
      
      res.json({
        success: true,
        message: 'Autenticazione riuscita',
        user: {
          id: authData.record.id,
          email: authData.record.email,
          name: authData.record.name
        },
        token: pb.authStore.token
      });
    } catch (error) {
      console.error('[LOGIN] Errore autenticazione:', error);
      res.status(401).json({ 
        success: false, 
        error: 'Credenziali non valide'
      });
    }
  } catch (error) {
    console.error('[LOGIN] Errore generale:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Errore interno del server'
    });
  }
});

// Endpoint per il logout
app.post('/api/users/logout', (req, res) => {
  try {
    console.log('[LOGOUT] Richiesta logout utente');
    
    // Effettua il logout eliminando i dati di autenticazione
    pb.authStore.clear();
    
    res.json({
      success: true,
      message: 'Logout effettuato con successo'
    });
  } catch (error) {
    console.error('[LOGOUT] Errore durante il logout:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Errore durante il logout'
    });
  }
});

// Endpoint per verificare lo stato di autenticazione
app.get('/api/users/me', (req, res) => {
  try {
    if (pb.authStore.isValid) {
      res.json({
        success: true,
        isAuthenticated: true,
        user: {
          id: pb.authStore.model.id,
          email: pb.authStore.model.email,
          name: pb.authStore.model.name
        }
      });
    } else {
      res.json({
        success: true,
        isAuthenticated: false
      });
    }
  } catch (error) {
    console.error('[AUTH CHECK] Errore:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Errore durante la verifica dell\'autenticazione'
    });
  }
});

// Endpoint per caricare file audio
app.post('/upload/audio', upload.single('audioFile'), async (req, res) => {
  try {
    console.log('[UPLOAD] Richiesta caricamento file audio ricevuta');
    
    if (!req.file) {
      console.error('[UPLOAD] Errore: Nessun file audio ricevuto');
      return res.status(400).json({
        success: false,
        error: 'Nessun file audio caricato'
      });
    }
    
    const { trackId } = req.body;
    if (!trackId) {
      console.error('[UPLOAD] Errore: Nessun trackId fornito');
      return res.status(400).json({
        success: false,
        error: 'trackId è obbligatorio'
      });
    }
    
    console.log(`[UPLOAD] File ricevuto: "${req.file.originalname}", Tipo: ${req.file.mimetype}, Dimensione: ${req.file.size} bytes`);
    
    try {
      // Leggiamo il file come Base64
      const fileBuffer = fs.readFileSync(req.file.path);
      const base64Data = fileBuffer.toString('base64');
      const dataUri = `data:${req.file.mimetype};base64,${base64Data}`;
      
      // Creiamo il path in Gun per questo file audio
      const audioPath = `releases/${trackId.split('_')[0]}/tracks/${trackId.split('_')[1]}/audioData`;
      
      // Salviamo in Gun (che userà l'adapter per salvare in PocketBase)
      gun.get(audioPath).put({
        type: 'audio',
        mimeType: req.file.mimetype,
        data: dataUri,
        timestamp: Date.now()
      }, ack => {
        // Pulizia file temporaneo
        fs.unlinkSync(req.file.path);
        
        if(ack.err) {
          console.error('[UPLOAD] Errore salvataggio in Gun:', ack.err);
          return res.status(500).json({
            success: false,
            error: `Errore durante il salvataggio: ${ack.err}`
          });
        }
        
        console.log(`[UPLOAD] File audio salvato con successo in Gun al path: ${audioPath}`);
        
        res.json({
          success: true,
          message: 'File audio caricato con successo',
          path: audioPath
        });
      });
      
    } catch (error) {
      console.error('[UPLOAD] Errore:', error);
      res.status(500).json({
        success: false,
        error: `Errore durante il salvataggio: ${error.message}`
      });
    }
  } catch (error) {
    console.error('[UPLOAD] Errore generale:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// Endpoint per ottenere i dati audio
app.get('/api/audio/:trackId', async (req, res) => {
  const { trackId } = req.params;
  
  try {
    console.log(`[GET AUDIO] Richiesta file audio per trackId: ${trackId}`);
    
    // Costruiamo il path Gun
    const [releaseId, trackNum] = trackId.split('_');
    const audioPath = `releases/${releaseId}/tracks/${trackNum}/audioData`;
    
    // Recuperiamo da Gun
    gun.get(audioPath).once((data, key) => {
      if (!data) {
        console.error(`[GET AUDIO] Nessun file trovato per path: ${audioPath}`);
        return res.status(404).json({
          success: false,
          error: 'File audio non trovato'
        });
      }
      
      console.log(`[GET AUDIO] File trovato in Gun al path: ${audioPath}`);
      
      // Restituiamo i dati
      res.json({
        success: true,
        audioData: data
      });
    });
    
  } catch (error) {
    console.error('[GET AUDIO] Errore:', error);
    res.status(500).json({
      success: false,
      error: `Errore durante il recupero del file: ${error.message}`
    });
  }
});

// Endpoint per i dati delle tracce
app.post('/api/track_data', async (req, res) => {
  console.log('[TRACK_DATA] Richiesta ricevuta');
  try {
    // Verifichiamo che ci siano tutti i dati necessari
    const { trackId, audioUrl, releaseId, title, index, mimeType, fileSize, lastModified } = req.body;
    
    if (!trackId || !audioUrl || !releaseId) {
      return res.status(400).json({
        success: false,
        error: 'Dati traccia incompleti. Sono richiesti: trackId, audioUrl, releaseId'
      });
    }
    
    console.log(`[TRACK_DATA] Salvando dati per traccia ID: ${trackId}, Release: ${releaseId}`);
    
    // Creiamo un oggetto minimo con tutti i dati
    const trackData = {
      trackId,
      audioUrl,
      releaseId,
      title: title || 'Untitled Track',
      index: index !== undefined ? index : 0,
      mimeType: mimeType || 'audio/mpeg',
      fileSize: fileSize || 0,
      lastModified: lastModified || Date.now(),
      storageType: 'pocketbase', // Da dove proviene l'URL 
      saved: Date.now()
    };
    
    // Verifichiamo se esiste la collection track_data
    try {
      console.log('[TRACK_DATA] Verifica esistenza collection "track_data"...');
      
      // Creiamo la collection se non esiste
      try {
        const existingCollections = await pb.collections.getFullList({
          filter: `name = "track_data"`
        });
        
        if (existingCollections.length === 0) {
          console.log('[TRACK_DATA] Collection "track_data" non trovata, creazione...');
          
          // Creiamo la collection
          const newCollection = await pb.collections.create({
            name: 'track_data',
            type: 'base',
            schema: [
              {
                name: 'trackId',
                type: 'text',
                required: true,
                unique: true
              },
              {
                name: 'audioUrl',
                type: 'text',
                required: true
              },
              {
                name: 'releaseId',
                type: 'text',
                required: true
              },
              {
                name: 'title',
                type: 'text'
              },
              {
                name: 'index',
                type: 'number'
              },
              {
                name: 'mimeType',
                type: 'text'
              },
              {
                name: 'fileSize',
                type: 'number'
              },
              {
                name: 'lastModified',
                type: 'number'
              },
              {
                name: 'storageType',
                type: 'text'
              },
              {
                name: 'saved',
                type: 'number'
              }
            ]
          });
          
          console.log('[TRACK_DATA] Collection "track_data" creata con successo');
          
          // Impostiamo le regole di accesso aperte
          await pb.collections.update(newCollection.id, {
            listRule: '',
            viewRule: '',
            createRule: '',
            updateRule: '',
            deleteRule: ''
          });
          
          console.log('[TRACK_DATA] Regole di accesso impostate per "track_data"');
        } else {
          console.log('[TRACK_DATA] Collection "track_data" trovata, nessuna azione necessaria');
        }
      } catch (collectionError) {
        console.error('[TRACK_DATA] Errore verifica/creazione collection:', collectionError);
      }
      
      // Ora salviamo i dati in PocketBase
      try {
        console.log('[TRACK_DATA] Salvataggio dati in PocketBase');
        
        // Controlliamo se esiste già un record con questo trackId
        const existingRecords = await pb.collection('track_data').getList(1, 1, {
          filter: `trackId='${trackId}'`
        });
        
        if (existingRecords.items.length > 0) {
          // Aggiorniamo il record esistente
          const recordId = existingRecords.items[0].id;
          console.log(`[TRACK_DATA] Record esistente trovato (ID: ${recordId}), aggiornamento...`);
          
          await pb.collection('track_data').update(recordId, trackData);
          console.log(`[TRACK_DATA] Record aggiornato con successo: ${trackId}`);
        } else {
          // Creiamo un nuovo record
          console.log(`[TRACK_DATA] Nessun record esistente, creazione nuovo record...`);
          
          const record = await pb.collection('track_data').create(trackData);
          console.log(`[TRACK_DATA] Nuovo record creato con successo: ${trackId} (ID: ${record.id})`);
        }
        
        console.log('[TRACK_DATA] Dati salvati con successo in PocketBase');
        return res.json({
          success: true,
          message: 'Dati traccia salvati con successo',
          trackId: trackId
        });
      } catch (pbError) {
        console.error('[TRACK_DATA] Errore salvataggio in PocketBase:', pbError);
        
        // Se PocketBase fallisce, salviamo sul filesystem come fallback
        console.log('[TRACK_DATA] Tentativo salvataggio su filesystem come fallback...');
        
        const filePath = path.join(FALLBACK_STORAGE_DIR, 'track_data', `${trackId}.json`);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        
        fs.writeFileSync(filePath, JSON.stringify(trackData, null, 2));
        console.log(`[TRACK_DATA] Dati salvati come fallback su filesystem: ${filePath}`);
        
        return res.json({
          success: true,
          message: 'Dati traccia salvati con successo (fallback filesystem)',
          trackId: trackId,
          fallback: true
        });
      }
      
    } catch (error) {
      console.error('[TRACK_DATA] Errore generale:', error);
      
      // Se tutto fallisce, tentiamo il salvataggio diretto su filesystem
      try {
        const filePath = path.join(FALLBACK_STORAGE_DIR, 'track_data', `${trackId}.json`);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        
        fs.writeFileSync(filePath, JSON.stringify(trackData, null, 2));
        console.log(`[TRACK_DATA] Dati salvati come fallback su filesystem: ${filePath}`);
        
        return res.json({
          success: true,
          message: 'Dati traccia salvati con successo (fallback filesystem)',
          trackId: trackId,
          fallback: true
        });
      } catch (fsError) {
        console.error('[TRACK_DATA] Errore critico anche nel salvataggio filesystem:', fsError);
        return res.status(500).json({
          success: false,
          error: `Errore critico nel salvataggio dati: ${error.message}, fallback: ${fsError.message}`
        });
      }
    }
    
  } catch (error) {
    console.error('[TRACK_DATA] Errore generale:', error);
    res.status(500).json({
      success: false,
      error: `Errore nel processare la richiesta: ${error.message}`
    });
  }
});

// Endpoint per caricamento diretto dei file audio (fallback estremo che accetta direttamente Base64)
app.post('/api/track_data_direct', express.json({ limit: '50mb' }), async (req, res) => {
  console.log('[TRACK_DATA_DIRECT] Richiesta upload diretto ricevuta');
  
  try {
    // Verifichiamo che ci siano tutti i dati necessari
    const { trackId, audioData, mimeType } = req.body;
    
    if (!trackId || !audioData) {
      return res.status(400).json({
        success: false,
        error: 'Dati incompleti. Sono richiesti: trackId, audioData'
      });
    }
    
    console.log(`[TRACK_DATA_DIRECT] Salvando file audio per trackId: ${trackId}`);
    
    // Decodifichiamo i dati Base64 in un buffer
    try {
      // Verifichiamo che i dati siano in formato valido
      if (!audioData.startsWith('data:')) {
        return res.status(400).json({
          success: false,
          error: 'Formato dati non valido. È richiesto un data URI'
        });
      }
      
      // Estraiamo il MIME type e i dati
      const matches = audioData.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({
          success: false,
          error: 'Formato data URI non valido'
        });
      }
      
      const detectedMimeType = matches[1];
      const base64Data = matches[2];
      const fileBuffer = Buffer.from(base64Data, 'base64');
      
      console.log(`[TRACK_DATA_DIRECT] File decodificato: ${(fileBuffer.length/1024).toFixed(2)}KB, tipo: ${detectedMimeType}`);
      
      // Salviamo il file direttamente su disco
      const extension = mimeType ? mimeType.split('/')[1] : detectedMimeType.split('/')[1] || 'mp3';
      const fileName = `${trackId}.${extension}`;
      
      // Salviamo usando il meccanismo di fallback
      const result = await saveFallbackFile(fileName, fileBuffer, detectedMimeType);
      
      console.log(`[TRACK_DATA_DIRECT] File salvato con successo: ${result.fileUrl}`);
      
      return res.json({
        success: true,
        message: 'File audio caricato con successo (direct)',
        fileUrl: result.fileUrl,
        trackId: trackId
      });
      
    } catch (decodeError) {
      console.error('[TRACK_DATA_DIRECT] Errore decodifica/salvataggio file:', decodeError);
      return res.status(500).json({
        success: false,
        error: `Errore nel processare il file audio: ${decodeError.message}`
      });
    }
    
  } catch (error) {
    console.error('[TRACK_DATA_DIRECT] Errore generale:', error);
    res.status(500).json({
      success: false,
      error: `Errore nel processare la richiesta: ${error.message}`
    });
  }
});

// Funzione per creare la collection release_data
async function createReleaseDataCollection() {
  const collectionName = 'release_data';
  
  try {
    console.log(`[COLLECTION] Verifica collection "${collectionName}"...`);
    
    try {
      await pb.collections.getOne(collectionName);
      console.log(`[COLLECTION] Collection "${collectionName}" già esistente`);
      return true;
    } catch (error) {
      if (error.status === 404) {
        console.log(`[COLLECTION] Collection "${collectionName}" non trovata, creazione...`);
        
        const collection = await pb.collections.create({
          name: collectionName,
          type: 'base',
          // Permessi aperti per tutti
          listRule: '',    // chiunque può visualizzare la lista
          viewRule: '',    // chiunque può visualizzare i record
          createRule: '',  // chiunque può creare record
          updateRule: '',  // chiunque può aggiornare record
          deleteRule: '',  // chiunque può eliminare record
          schema: [
            {
              name: 'releaseId',
              type: 'text',
              required: true
            },
            {
              name: 'title',
              type: 'text',
              required: true
            },
            {
              name: 'type',
              type: 'text',
              required: false
            },
            {
              name: 'creator',
              type: 'text',
              required: false
            },
            {
              name: 'trackCount',
              type: 'number',
              required: false
            },
            {
              name: 'data',
              type: 'json',
              required: false
            }
          ]
        });
        
        console.log(`[COLLECTION] Collection "${collectionName}" creata con successo`);
        return true;
      }
      throw error;
    }
  } catch (error) {
    console.error(`[COLLECTION] Errore creazione collection "${collectionName}":`, error);
    return false;
  }
}

// Endpoint per salvare i dati della release
app.post('/api/release_data', async (req, res) => {
  try {
    const releaseData = req.body;
    console.log('[RELEASE_DATA] Ricevuta richiesta di salvataggio release');
    console.log(`[RELEASE_DATA] Salvataggio dati per release "${releaseData.title}" (ID: ${releaseData.id})`);

    // Salviamo direttamente in Gun
    gun.get('releases').get(releaseData.id).put(releaseData, (ack) => {
      if (ack.err) {
        console.error('[RELEASE_DATA] Errore salvataggio Gun:', ack.err);
        res.status(500).json({
          success: false,
          error: `Errore durante il salvataggio: ${ack.err}`
        });
        return;
      }

      console.log('[RELEASE_DATA] Release salvata con successo in Gun');
      res.json({
        success: true,
        message: 'Release salvata con successo'
      });
    });

  } catch (error) {
    console.error('[RELEASE_DATA] Errore:', error);
    res.status(500).json({
      success: false,
      error: `Errore durante il salvataggio: ${error.message}`
    });
  }
});

// Endpoint per ottenere i dati della release
app.get('/api/release_data/:releaseId', (req, res) => {
  const { releaseId } = req.params;
  console.log(`[RELEASE_DATA] Richiesta dati per release ${releaseId}`);

  // Recuperiamo da Gun
  gun.get('releases').get(releaseId).once((data, key) => {
    if (!data) {
      console.log('[RELEASE_DATA] Release non trovata');
      res.status(404).json({
        success: false,
        error: 'Release non trovata'
      });
      return;
    }

    console.log('[RELEASE_DATA] Release trovata:', data);
    res.json({
      success: true,
      data: data
    });
  });
});

// Endpoint di test per upload semplificato
app.post('/upload/test', upload.single('testFile'), (req, res) => {
  console.log('[UPLOAD_TEST] Richiesta test upload ricevuta');
  
  try {
    if (!req.file) {
      console.log('[UPLOAD_TEST] Nessun file ricevuto');
      return res.json({
        success: false,
        message: 'Nessun file ricevuto'
      });
    }
    
    console.log('[UPLOAD_TEST] File ricevuto:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });
    
    // Rimuoviamo il file temporaneo
    try {
      fs.unlinkSync(req.file.path);
      console.log('[UPLOAD_TEST] File temporaneo rimosso');
    } catch (unlinkError) {
      console.warn('[UPLOAD_TEST] Errore rimozione file temporaneo:', unlinkError);
    }
    
    return res.json({
      success: true,
      message: 'File ricevuto correttamente',
      fileDetails: {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('[UPLOAD_TEST] Errore:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Errore interno'
    });
  }
});