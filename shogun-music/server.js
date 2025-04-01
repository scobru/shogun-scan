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

// Test connessione PocketBase con retry e autenticazione
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 secondi

// Configurazione server con timeout più lungo per file grandi
const serverTimeout = 5 * 60 * 1000; // 5 minuti

async function initializePocketBase(retryCount = 0) {
  try {
    console.log('Test connessione PocketBase...');
    const health = await pb.health.check();
    console.log('PocketBase è attivo:', health);
    
    // Tentiamo di autenticarci come ADMIN (non come utente)
    try {
      console.log(`Tentativo di autenticazione admin con ${ADMIN_EMAIL}...`);
      
      // Utilizziamo l'autenticazione tramite collection _superusers
      const authData = await pb.collection('_superusers').authWithPassword(
        ADMIN_EMAIL,
        ADMIN_PASSWORD
      );
      
      console.log('Autenticazione riuscita come ADMIN');
      console.log('Stato autenticazione:', pb.authStore.isValid ? 'Autenticato' : 'Non autenticato');
      console.log('Admin autenticato:', pb.authStore.model?.email);
      return true;
    } catch (authError) {
      console.error('Errore autenticazione admin:', authError);
      console.warn('Continuiamo senza autenticazione admin: alcune funzionalità potrebbero non essere disponibili');
      return false;
    }
  } catch (error) {
    console.error('ERRORE CRITICO - PocketBase non raggiungibile:', error);
    if (retryCount < MAX_RETRIES) {
      console.log(`Nuovo tentativo tra ${RETRY_DELAY/1000} secondi...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return await initializePocketBase(retryCount + 1);
    }
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
        const gunCollectionCreated = await adapter._ensureCollection(adapter.collectionName);
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

    // Inizializziamo GunDB
    const gun = Gun({
      web: server,
      radisk: false,
      file: false,
      localStorage: false,
      multicast: false
    });

    console.log('[GUN] Inizializzazione completata');

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
    Gun.on('create', function(root) {
      console.log('[GUN] Evento create attivato');
      this.to.next(root);
      
      // Registra l'adapter per Gun come store
      const adapter = new GunPocketBaseAdapter();
      
      console.log('[GUN] Adapter PocketBase registrato');
      
      root.opt.store = {
        put: (key, data, callback) => {
          console.log(`[GUN PUT] Richiesta PUT per la chiave: ${key}, dimensione dati: ${JSON.stringify(data).length} caratteri`);
          
          // Verifichiamo che i dati siano validi
          if (!data) {
            console.error(`[GUN PUT] Errore: dati non validi per chiave ${key}`);
            callback(new Error('Dati non validi'));
            return;
          }
          
          // Log più dettagliato
          const dataKeys = Object.keys(data);
          console.log(`[GUN PUT] Chiave: ${key}, Proprietà: ${dataKeys.join(', ')}`);
          
          // Alcuni dati hanno sottochiavi '#'
          if (data['#']) {
            console.log(`[GUN PUT] Rilevata chiave speciale '#': ${data['#']}`);
          }
          
          // Chiamiamo l'adapter con gestione errori migliorata
          adapter.put(key, data, (err) => {
            if (err) {
              console.error(`[GUN PUT] Errore per chiave ${key}:`, err);
              
              // Aggiungiamo un secondo tentativo
              console.log(`[GUN PUT] Secondo tentativo per chiave ${key}...`);
              adapter.put(key, data, (secondErr) => {
                if (secondErr) {
                  console.error(`[GUN PUT] Anche il secondo tentativo è fallito per chiave ${key}:`, secondErr);
                } else {
                  console.log(`[GUN PUT] Secondo tentativo riuscito per chiave ${key}`);
                }
                callback(secondErr);
              });
            } else {
              console.log(`[GUN PUT] Successo per chiave ${key}`);
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
              console.log(`[GUN GET] Dati trovati per chiave ${key} (${typeof data}): ${Object.keys(data).join(', ')}`);
              callback(null, data);
            } else {
              console.log(`[GUN GET] Nessun dato per chiave ${key}`);
              callback(null, null);
            }
          });
        }
      };
    });
  } catch (error) {
    console.error('Errore fatale durante l\'inizializzazione:', error);
    process.exit(1);
  }
})();

// Serviamo i file statici dalla cartella "public"
app.use(express.static(path.join(__dirname, 'public')));

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
    this.collectionName = 'gun_data';
    console.log('[ADAPTER] Inizializzazione GunPocketBaseAdapter');
    // Inizializziamo al primo utilizzo, non nel costruttore
  }

  // Metodo semplificato per controllare/creare la collection
  async _ensureCollection(collectionName) {
    try {
      // Verifichiamo che siamo autenticati (l'autenticazione con _superusers implica già che siamo admin)
      if (!pb.authStore.isValid) {
        console.warn(`[ADAPTER] Creazione "${collectionName}" richiede autenticazione ADMIN`);
        // Tentiamo una nuova autenticazione admin
        try {
          console.log('[ADAPTER] Tentativo di autenticazione admin...');
          await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
          console.log('[ADAPTER] Autenticazione admin riuscita');
        } catch (authError) {
          console.error('[ADAPTER] Impossibile autenticarsi come admin:', authError);
          return false;
        }
      }
      
      // Verifichiamo nuovamente solo la validità dell'autenticazione
      if (!pb.authStore.isValid) {
        console.error('[ADAPTER] Autenticazione admin fallita, impossibile creare collection');
        return false;
      }
      
      // Loghiamo le info sull'utente autenticato per debug
      console.log('[ADAPTER] Autenticazione corrente:', {
        isValid: pb.authStore.isValid,
        model: pb.authStore.model ? {
          id: pb.authStore.model.id,
          email: pb.authStore.model.email,
          collection: pb.authStore.model.collectionName || pb.authStore.model.collection
        } : null
      });
      
      console.log(`[ADAPTER] Verifica esistenza collection "${collectionName}"...`);
      
      try {
        // Verifica se esiste
        await pb.collections.getOne(collectionName);
        console.log(`[ADAPTER] Collection "${collectionName}" trovata`);
        return true;
      } catch (error) {
        // Se non esiste (404), proviamo a crearla
        if (error.status === 404) {
          console.log(`[ADAPTER] Collection "${collectionName}" non trovata, creazione...`);
          
          try {
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
                  name: 'key',
                  type: 'text',
                  required: true
                },
                {
                  name: 'data',
                  type: 'json',
                  required: true
                }
              ]
            });
            
            console.log(`[ADAPTER] Collection "${collectionName}" creata con successo (ID: ${collection.id})`);
            
            try {
              await pb.collections.createIndex(collectionName, {
                field: 'key',
                unique: true
              });
              console.log(`[ADAPTER] Indice creato su campo "key"`);
            } catch (indexError) {
              console.warn(`[ADAPTER] Errore creazione indice: ${indexError.message}`);
            }
            
            return true;
          } catch (createError) {
            console.error(`[ADAPTER] Errore creazione: ${createError.message}`);
            return false;
          }
        } else {
          console.error(`[ADAPTER] Errore verifica: ${error.message}`);
          return false;
        }
      }
    } catch (error) {
      console.error(`[ADAPTER] Errore generale: ${error.message}`);
      return false;
    }
  }

  async put(key, data, callback) {
    try {
      console.log(`[ADAPTER PUT] Inizio operazione PUT per chiave: ${key}`);
      console.log(`[ADAPTER PUT] Tipo di dati:`, typeof data);
      console.log(`[ADAPTER PUT] Dimensione dati: ${JSON.stringify(data).length} bytes`);
      
      if (!key) {
        console.error(`[ADAPTER PUT] Errore: chiave non valida`, key);
        callback(new Error('Chiave non valida'));
        return;
      }
      
      if (!data) {
        console.error(`[ADAPTER PUT] Errore: dati non validi`, data);
        callback(new Error('Dati non validi'));
        return;
      }
      
      // 1. Assicuriamoci che la collection esista
      console.log(`[ADAPTER PUT] Verifica esistenza collection...`);
      const collectionExists = await this._ensureCollection(this.collectionName);
      
      if (!collectionExists) {
        console.error(`[ADAPTER PUT] La collection non esiste e non può essere creata`);
        callback(new Error('Collection non disponibile'));
        return;
      }
      
      // 2. Prepariamo i dati da salvare
      console.log(`[ADAPTER PUT] Preparazione dati per salvataggio...`);
      const saveData = {
        key: key,
        data: JSON.stringify(data)
      };
      
      // 3. Verifichiamo se esiste già un record
      console.log(`[ADAPTER PUT] Verifica esistenza record con chiave "${key}"...`);
      try {
        const existingRecords = await pb.collection(this.collectionName).getList(1, 1, {
          filter: `key = "${key}"`
        });
        
        if (existingRecords.items.length > 0) {
          // Aggiorniamo il record esistente
          const recordId = existingRecords.items[0].id;
          console.log(`[ADAPTER PUT] Record esistente trovato (ID: ${recordId}), aggiornamento...`);
          
          try {
            await pb.collection(this.collectionName).update(recordId, saveData);
            console.log(`[ADAPTER PUT] Record aggiornato con successo: ${key}`);
            callback(null);
          } catch (updateError) {
            console.error(`[ADAPTER PUT] Errore aggiornamento record:`, updateError);
            // Facciamo un secondo tentativo se c'è un errore
            try {
              console.log(`[ADAPTER PUT] Secondo tentativo di aggiornamento...`);
              await pb.collection(this.collectionName).update(recordId, saveData);
              console.log(`[ADAPTER PUT] Record aggiornato con successo al secondo tentativo: ${key}`);
              callback(null);
            } catch (e) {
              console.error('[ADAPTER PUT] Errore critico nel secondo tentativo:', e);
              callback(e);
            }
          }
        } else {
          // Creiamo un nuovo record
          console.log(`[ADAPTER PUT] Nessun record esistente, creazione nuovo record per chiave "${key}"...`);
          
          try {
            const record = await pb.collection(this.collectionName).create(saveData);
            console.log(`[ADAPTER PUT] Nuovo record creato con successo: ${key} (ID: ${record.id})`);
            callback(null);
          } catch (createError) {
            console.error('[ADAPTER PUT] Errore creazione record:', createError);
            callback(createError);
          }
        }
      } catch (e) {
        console.error('[ADAPTER PUT] Errore verifica record esistente:', e);
        
        // Se non riusciamo a verificare, proviamo a creare direttamente
        try {
          console.log(`[ADAPTER PUT] Tentativo diretto di creazione record...`);
          const record = await pb.collection(this.collectionName).create(saveData);
          console.log(`[ADAPTER PUT] Record creato con approccio di fallback: ${key}`);
          callback(null);
        } catch (directCreateError) {
          console.error('[ADAPTER PUT] Errore anche nel tentativo diretto:', directCreateError);
          callback(directCreateError);
        }
      }
    } catch (error) {
      console.error('[ADAPTER PUT] Errore critico:', error);
      callback(error);
    }
  }

  async get(key, callback) {
    try {
      console.log(`[ADAPTER GET] Inizio operazione GET per chiave: ${key}`);
      
      if (!key) {
        console.error(`[ADAPTER GET] Errore: chiave non valida`, key);
        callback(new Error('Chiave non valida'), null);
        return;
      }
      
      // 1. Assicuriamoci che la collection esista
      const collectionExists = await this._ensureCollection(this.collectionName);
      if (!collectionExists) {
        console.log(`[ADAPTER GET] Collection non disponibile, ritorno null`);
        callback(null, null);
        return;
      }
      
      // 2. Tentiamo di recuperare il record
      console.log(`[ADAPTER GET] Ricerca record con chiave "${key}"...`);
      try {
        const records = await pb.collection(this.collectionName).getList(1, 1, {
          filter: `key = "${key}"`
        });
        
        if (records.items.length > 0) {
          // Record trovato
          const record = records.items[0];
          console.log(`[ADAPTER GET] Record trovato (ID: ${record.id})`);
          
          let data = null;
          try {
            data = JSON.parse(record.data);
            console.log(`[ADAPTER GET] Dati estratti con successo per chiave: ${key}`);
          } catch (parseError) {
            console.error('[ADAPTER GET] Errore parsing JSON:', parseError);
          }
          
          callback(null, data);
        } else {
          console.log(`[ADAPTER GET] Nessun dato trovato per chiave: ${key}`);
          callback(null, null);
        }
      } catch (e) {
        console.error('[ADAPTER GET] Errore recupero record:', e);
        callback(null, null);
      }
    } catch (error) {
      console.error('[ADAPTER GET] Errore critico:', error);
      callback(null, null);
    }
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
    
    // Verifichiamo che il file sia stato caricato
    if (!req.file) {
      console.error('[UPLOAD] Errore: Nessun file audio ricevuto nella richiesta');
      return res.status(400).json({
        success: false,
        error: 'Nessun file audio caricato'
      });
    }
    
    // Verifichiamo che sia fornito un trackId
    const { trackId } = req.body;
    if (!trackId) {
      console.error('[UPLOAD] Errore: Nessun trackId fornito nella richiesta');
      return res.status(400).json({
        success: false,
        error: 'trackId è obbligatorio'
      });
    }
    
    console.log(`[UPLOAD] File ricevuto: "${req.file.originalname}", Tipo: ${req.file.mimetype}, Dimensione: ${req.file.size} bytes, Salvato in: ${req.file.path}, Track ID: ${trackId}`);
    console.log(`[UPLOAD] Headers richiesta: ${JSON.stringify(req.headers['content-type'])}`);
    console.log(`[UPLOAD] Body parametri: ${JSON.stringify(Object.keys(req.body))}`);
    
    try {
      // Controlliamo se siamo autenticati, altrimenti proviamo a riautenticarci
      if (!pb.authStore.isValid) {
        console.warn('[UPLOAD] Autenticazione non valida, tentativo di riautenticazione...');
        try {
          await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
          console.log('[UPLOAD] Riautenticazione riuscita');
        } catch (authError) {
          console.error('[UPLOAD] Errore di riautenticazione:', authError);
          // Continuiamo comunque, potrebbe funzionare senza autenticazione se la collection ha permessi aperti
        }
      }
      
      console.log(`[UPLOAD] Stato autenticazione PocketBase: ${pb.authStore.isValid ? 'Autenticato' : 'Non autenticato'}`);
      
      // Controlliamo se esiste già un record con questo trackId
      let existingRecord = null;
      try {
        const records = await pb.collection('audio_files').getList(1, 1, {
          filter: `trackId = "${trackId}"`
        });
        
        if (records.items.length > 0) {
          existingRecord = records.items[0];
          console.log(`[UPLOAD] Trovato record esistente per trackId "${trackId}"`);
        }
      } catch (error) {
        console.warn(`[UPLOAD] Errore durante la verifica del record esistente: ${error.message}`);
      }
      
      // Creiamo un FormData per PocketBase utilizzando il file su disco
      console.log('[UPLOAD] Preparazione dati per PocketBase...');
      
      // Creiamo un FormData direttamente per l'API di PocketBase
      const pbFormData = new FormData();
      
      // Aggiungiamo i campi di metadati
      pbFormData.append('trackId', trackId);
      pbFormData.append('mimeType', req.file.mimetype);
      
      // Aggiungiamo il file dal filesystem (non dal buffer in memoria)
      console.log(`[UPLOAD] Lettura file da disco: ${req.file.path}`);
      
      try {
        // Apriamo il file salvato su disco e lo aggiungiamo
        const fileStream = fs.createReadStream(req.file.path);
        pbFormData.append('audioFile', fileStream, {
          filename: req.file.originalname,
          contentType: req.file.mimetype
        });
        
        console.log('[UPLOAD] FormData preparato con file da disco e metadati');
        
        let record;
        console.log(`[UPLOAD] Inizio ${existingRecord ? 'aggiornamento' : 'creazione'} record in PocketBase...`);
        
        try {
          if (existingRecord) {
            // Aggiorniamo il record esistente
            record = await pb.collection('audio_files').update(existingRecord.id, pbFormData);
            console.log(`[UPLOAD] Record aggiornato con ID: ${record.id}`);
          } else {
            // Creiamo un nuovo record
            console.log(`[UPLOAD] Tentativo creazione nuovo record in PocketBase con trackId: ${trackId}`);
            record = await pb.collection('audio_files').create(pbFormData);
            console.log(`[UPLOAD] Nuovo record creato con ID: ${record.id}`);
          }
          
          // Costruiamo l'URL per accedere al file
          const fileUrl = `${pbUrl}/api/files/audio_files/${record.id}/${record.audioFile}`;
          console.log(`[UPLOAD] URL file generato: ${fileUrl}`);
          
          // Pulizia file temporaneo
          try {
            fs.unlinkSync(req.file.path);
            console.log(`[UPLOAD] File temporaneo rimosso: ${req.file.path}`);
          } catch (unlinkError) {
            console.warn(`[UPLOAD] Impossibile rimuovere file temporaneo: ${unlinkError.message}`);
          }
          
          // Risposta con successo
          const response = {
            success: true,
            message: existingRecord ? 'File audio aggiornato con successo' : 'File audio caricato con successo',
            fileUrl: fileUrl,
            recordId: record.id
          };
          
          console.log('[UPLOAD] Invio risposta di successo al client:', response);
          res.json(response);
        } catch (pbError) {
          console.error('[UPLOAD] Errore PocketBase:', pbError);
          
          // Dettagli dell'errore per debug
          if (pbError.response) {
            console.error('[UPLOAD] Dettagli errore PB:', pbError.response.data || pbError.response);
            console.error('[UPLOAD] Status errore PB:', pbError.status || 'Unknown');
            console.error('[UPLOAD] Message errore PB:', pbError.message || 'No message');
          }
          
          // Pulizia file temporaneo
          try {
            fs.unlinkSync(req.file.path);
          } catch (unlinkError) {
            console.warn(`[UPLOAD] Impossibile rimuovere file temporaneo: ${unlinkError.message}`);
          }
          
          throw new Error(`Errore PocketBase: ${pbError.message}`);
        }
      } catch (fileError) {
        console.error('[UPLOAD] Errore gestione file:', fileError);
        
        // Pulizia file temporaneo
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.warn(`[UPLOAD] Impossibile rimuovere file temporaneo: ${unlinkError.message}`);
        }
        
        throw new Error(`Errore gestione file: ${fileError.message}`);
      }
    } catch (error) {
      console.error('[UPLOAD] Errore durante il caricamento:', error);
      
      // Pulizia file temporaneo se esiste
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.warn(`[UPLOAD] Impossibile rimuovere file temporaneo: ${unlinkError.message}`);
        }
      }
      
      res.status(500).json({
        success: false,
        error: error.message || 'Errore durante il caricamento del file'
      });
    }
  } catch (error) {
    console.error('[UPLOAD] Errore generale:', error);
    
    // Pulizia file temporaneo se esiste
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.warn(`[UPLOAD] Impossibile rimuovere file temporaneo: ${unlinkError.message}`);
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});

// Endpoint per il salvataggio diretto dei dati delle tracce (soluzione alternativa a Gun)
app.post('/api/track_data', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    console.log('[TRACK_DATA] Ricevuta richiesta di salvataggio traccia alternativo');
    
    // Verifichiamo che siano forniti i dati necessari
    const { title, index, mimeType, fileSize, lastModified, audioUrl, releaseId } = req.body;
    
    if (!title || !audioUrl || !releaseId) {
      console.error('[TRACK_DATA] Dati mancanti nella richiesta');
      return res.status(400).json({
        success: false,
        error: 'Dati mancanti: title, audioUrl e releaseId sono obbligatori'
      });
    }
    
    console.log(`[TRACK_DATA] Salvataggio dati per traccia "${title}" della release ${releaseId}`);
    
    try {
      // Verifichiamo se esiste la collection
      const collectionName = 'track_data';
      let collectionExists = false;
      
      try {
        await pb.collections.getOne(collectionName);
        collectionExists = true;
        console.log(`[TRACK_DATA] Collection "${collectionName}" trovata`);
      } catch (error) {
        if (error.status === 404) {
          console.log(`[TRACK_DATA] Collection "${collectionName}" non esiste, creazione...`);
          
          // Assicuriamoci di essere autenticati come admin
          if (!pb.authStore.isValid) {
            console.log('[TRACK_DATA] Tentativo di autenticazione admin...');
            try {
              await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
            } catch (authError) {
              console.error('[TRACK_DATA] Errore autenticazione admin:', authError);
              return res.status(500).json({
                success: false,
                error: 'Impossibile autenticarsi come admin per creare la collection'
              });
            }
          }
          
          // Creazione collection
          try {
            await pb.collections.create({
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
                  name: 'title',
                  type: 'text',
                  required: true
                },
                {
                  name: 'index',
                  type: 'number',
                  required: true
                },
                {
                  name: 'releaseId',
                  type: 'text',
                  required: true
                },
                {
                  name: 'audioUrl',
                  type: 'text',
                  required: true
                },
                {
                  name: 'mimeType',
                  type: 'text',
                  required: false
                },
                {
                  name: 'fileSize',
                  type: 'number',
                  required: false
                }
              ]
            });
            
            collectionExists = true;
            console.log(`[TRACK_DATA] Collection "${collectionName}" creata con successo`);
          } catch (createError) {
            console.error('[TRACK_DATA] Errore creazione collection:', createError);
            return res.status(500).json({
              success: false,
              error: 'Errore nella creazione della collection'
            });
          }
        } else {
          console.error('[TRACK_DATA] Errore verifica collection:', error);
          return res.status(500).json({
            success: false,
            error: 'Errore nella verifica della collection'
          });
        }
      }
      
      if (!collectionExists) {
        return res.status(500).json({
          success: false,
          error: 'Impossibile verificare o creare la collection'
        });
      }
      
      // Creiamo il record
      const saveData = {
        title,
        index,
        releaseId,
        audioUrl,
        mimeType,
        fileSize
      };
      
      // Verifichiamo se esiste già un record per questa traccia in questa release
      const filter = `releaseId = "${releaseId}" && index = ${index}`;
      const existingRecords = await pb.collection(collectionName).getList(1, 1, { filter });
      
      let record;
      if (existingRecords.items.length > 0) {
        // Aggiorniamo il record esistente
        const recordId = existingRecords.items[0].id;
        record = await pb.collection(collectionName).update(recordId, saveData);
        console.log(`[TRACK_DATA] Record aggiornato con ID: ${record.id}`);
      } else {
        // Creiamo un nuovo record
        record = await pb.collection(collectionName).create(saveData);
        console.log(`[TRACK_DATA] Nuovo record creato con ID: ${record.id}`);
      }
      
      // Risposta di successo
      res.json({
        success: true,
        message: 'Dati traccia salvati con successo',
        recordId: record.id
      });
    } catch (error) {
      console.error('[TRACK_DATA] Errore durante il salvataggio:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Errore durante il salvataggio dei dati della traccia'
      });
    }
  } catch (error) {
    console.error('[TRACK_DATA] Errore generale:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server'
    });
  }
});