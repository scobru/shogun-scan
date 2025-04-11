// storage-server.js
const express = require('express');
const multer  = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios'); // Per le richieste HTTP al metadata-relay
const app = express();

const PORT = 3000;
const METADATA_AUTH_TOKEN = "myMetadataToken123"; // Token per auth con metadata-relay

// Array di metadata relay a cui notificare i nuovi file
let METADATA_RELAYS = [
  'http://localhost:8765',  // Relay predefinito
  'http://localhost:8766',  // Relay predefinito
  // Aggiungi altri relay qui
];

// Definisci il token segreto (in produzione, potresti usare una variabile d'ambiente)
const SECRET_TOKEN = "mySecretToken123";

// Middleware per verificare il token
function checkToken(req, res, next) {
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

// Controlla se la cartella 'uploads' esiste; se no, creala
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Abilita CORS
app.use(cors());
app.use(express.json()); // Aggiungi supporto JSON per il body

// Configurazione di Multer per salvare il file su disco
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Esponi la cartella "uploads" come statica
app.use('/uploads', express.static(uploadDir));

// Endpoint per gestire i relay metadata
app.get('/relays', checkToken, (req, res) => {
  res.json({ relays: METADATA_RELAYS });
});

// Aggiungi un nuovo relay
app.post('/relays/add', checkToken, (req, res) => {
  const { relayUrl } = req.body;
  
  if (!relayUrl) {
    return res.status(400).json({ error: "URL del relay mancante" });
  }
  
  if (METADATA_RELAYS.includes(relayUrl)) {
    return res.json({ success: false, message: "Relay già presente" });
  }
  
  METADATA_RELAYS.push(relayUrl);
  console.log(`Nuovo relay aggiunto: ${relayUrl}`);
  res.json({ success: true, relays: METADATA_RELAYS });
});

// Rimuovi un relay
app.post('/relays/remove', checkToken, (req, res) => {
  const { relayUrl } = req.body;
  
  if (!relayUrl) {
    return res.status(400).json({ error: "URL del relay mancante" });
  }
  
  const index = METADATA_RELAYS.indexOf(relayUrl);
  if (index === -1) {
    return res.json({ success: false, message: "Relay non trovato" });
  }
  
  METADATA_RELAYS.splice(index, 1);
  console.log(`Relay rimosso: ${relayUrl}`);
  res.json({ success: true, relays: METADATA_RELAYS });
});

// Funzione per notificare tutti i metadata-relay di un nuovo file
async function notifyMetadataRelays(fileInfo) {
  console.log(`Notifica a ${METADATA_RELAYS.length} relay...`);
  
  const results = await Promise.allSettled(
    METADATA_RELAYS.map(async (relayUrl) => {
      try {
        console.log(`Notifica a relay: ${relayUrl}`);
        const response = await axios.post(`${relayUrl}/file-uploaded`, fileInfo, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': METADATA_AUTH_TOKEN
          },
          timeout: 5000 // 5 secondi timeout
        });
        return { relayUrl, success: true, data: response.data };
      } catch (error) {
        console.error(`Errore notifica a ${relayUrl}:`, error.message);
        return { relayUrl, success: false, error: error.message };
      }
    })
  );
  
  const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  console.log(`${successCount}/${METADATA_RELAYS.length} relay notificati con successo`);
  
  return results;
}

// NUOVE FUNZIONALITÀ:

// 1. Metadata per file (mantiene informazioni sui file)
const fileMetadata = {};

// 2. Replicazione file tra nodi
app.post('/replicate', checkToken, (req, res) => {
  const { fileId, nodeUrl } = req.body;
  // Logica per replicare un file verso un altro nodo
  // ...
  res.json({ success: true });
});

// 3. Gestione IPFS (simulata per ora)
app.post('/pin-ipfs', checkToken, (req, res) => {
  const { cid } = req.body;
  // Simulazione pin IPFS
  res.json({ success: true, pinned: cid });
});

// 4. Endpoint per verificare disponibilità file
app.get('/health/:fileId', (req, res) => {
  const filePath = path.join(uploadDir, req.params.fileId);
  if (fs.existsSync(filePath)) {
    res.json({ available: true });
  } else {
    res.status(404).json({ available: false });
  }
});

// Nuovo endpoint per verificare l'esistenza di un file tramite URL
app.get('/verify-file', (req, res) => {
  const fileUrl = req.query.url;
  if (!fileUrl) {
    return res.status(400).json({ error: "URL del file mancante" });
  }
  
  // Estrai nome file dall'URL
  const filename = fileUrl.split('/').pop();
  const filePath = path.join(uploadDir, filename);
  
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    res.json({ 
      exists: true, 
      size: stats.size,
      lastModified: stats.mtime
    });
  } else {
    res.json({ exists: false });
  }
});

// Nuovo endpoint per eliminare file fisici dallo storage
app.delete('/delete/:filePath(*)', checkToken, (req, res) => {
  try {
    // Il parametro filePath può contenere sottodirectory, quindi decodifichiamolo
    const filePath = decodeURIComponent(req.params.filePath);
    
    // Verifica che il percorso sia sicuro (non consente ../ per prevenire directory traversal)
    if (filePath.includes('../') || filePath.includes('..\\')) {
      return res.status(400).json({ 
        success: false, 
        error: "Percorso file non valido: tentativo di directory traversal"
      });
    }

    // Costruisci il percorso completo del file
    const fullPath = path.join(uploadDir, filePath);
    
    console.log(`Richiesta eliminazione file: ${fullPath}`);
    
    // Verifica se il file esiste
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ 
        success: false, 
        error: "File non trovato"
      });
    }
    
    // Elimina il file
    fs.unlinkSync(fullPath);
    
    // Rimuovi anche i metadati associati
    if (fileMetadata[filePath]) {
      delete fileMetadata[filePath];
    }
    
    console.log(`File eliminato con successo: ${fullPath}`);
    
    res.json({ 
      success: true, 
      message: "File eliminato con successo",
      file: filePath
    });
  } catch (error) {
    console.error(`Errore durante l'eliminazione del file:`, error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Errore interno del server durante l'eliminazione"
    });
  }
});

// Endpoint per l'upload dei file, protetto dal middleware checkToken
app.post('/upload', checkToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('Nessun file caricato');
  }
  
  const fileUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
  
  // Raccoglie metadati sul file
  const fileInfo = {
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    fileUrl: fileUrl,
    uploadedAt: new Date().toISOString()
  };
  
  // Salva nel registro file
  fileMetadata[req.file.filename] = fileInfo;
  
  // Notifica TUTTI i metadata-relay del nuovo file
  const notificationResults = await notifyMetadataRelays(fileInfo);
  
  res.json({ 
    fileUrl, 
    fileInfo,
    notificationResults: notificationResults.map(r => ({
      relayUrl: r.value?.relayUrl,
      success: r.value?.success || false
    }))
  });
});

app.listen(PORT, () => console.log(`Storage Server in esecuzione sulla porta ${PORT}`));
