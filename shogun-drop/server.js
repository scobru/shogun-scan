/**
 * Server per DROP Application
 * 
 * Questo server:
 * 1. Carica le variabili d'ambiente dal file .env
 * 2. Genera dinamicamente il file config.js
 * 3. Serve i file statici (HTML, CSS, JS)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Carica le variabili d'ambiente dal file .env
const result = dotenv.config();
if (result.error) {
  console.warn('File .env non trovato, verranno utilizzate le configurazioni di default');
}

const app = express();
const PORT = process.env.PORT || 3000;

// Imposta una configurazione di base con default value
const baseConfig = {
  FILE_SIZE_LIMIT_MB: parseInt(process.env.FILE_SIZE_LIMIT_MB) || 10,
  MAX_USER_DROPS: parseInt(process.env.MAX_USER_DROPS) || 5,
  RATE_LIMIT: {
    uploads: {
      max: parseInt(process.env.RATE_LIMIT_UPLOADS_MAX) || 5,
      period: parseInt(process.env.RATE_LIMIT_UPLOADS_PERIOD) || 60 * 60 * 1000,
    },
    downloads: {
      max: parseInt(process.env.RATE_LIMIT_DOWNLOADS_MAX) || 20,
      period: parseInt(process.env.RATE_LIMIT_DOWNLOADS_PERIOD) || 60 * 60 * 1000,
    }
  },
  API: {
    URL: process.env.API_URL || "http://localhost:8765",
    TOKEN: process.env.API_TOKEN || "thisIsTheTokenForReals"
  },
  GUNDB: {
    PEERS: process.env.GUNDB_PEERS ? process.env.GUNDB_PEERS.split(',') : ["http://localhost:8765/gun"],
    LOCAL_STORAGE: process.env.GUNDB_LOCAL_STORAGE === "true",
    RADISK: process.env.GUNDB_RADISK === "true",
    AXE: process.env.GUNDB_AXE === "true",
    WEB: process.env.GUNDB_WEB === "false",
    WIRE: process.env.GUNDB_WIRE === "true"
  },
  AUTH: {
    WEBAUTHN_NAME: process.env.WEBAUTHN_NAME || "Shogun DROP",
    WEBAUTHN_ID: process.env.WEBAUTHN_ID || null, // Si userà hostname dinamico
    METAMASK_ENABLED: process.env.METAMASK_ENABLED === "true" 
  },
  IPFS: {
    GATEWAY: process.env.IPFS_GATEWAY || "http://localhost:8080/ipfs"
  },
  UI: {
    APP_NAME: process.env.APP_NAME || "DROP",
    APP_DESCRIPTION: process.env.APP_DESCRIPTION || "Sistema di condivisione file decentralizzato",
    GITHUB_REPO: process.env.GITHUB_REPO || "https://github.com/your-repo",
    THEME: {
      primary: process.env.THEME_PRIMARY || "#0078ff",
      accent: process.env.THEME_ACCENT || "#00c16e",
      success: process.env.THEME_SUCCESS || "#00c16e",
      warning: process.env.THEME_WARNING || "#ffb801",
      error: process.env.THEME_ERROR || "#ff3d57"
    },
    BACKGROUND_IMAGES: process.env.BACKGROUND_IMAGES ? 
      process.env.BACKGROUND_IMAGES.split(',') : [
        "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1800&q=80",
        "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1800&q=80",
        "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1800&q=80",
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1800&q=80"
      ]
  }
};

// Genera il file config.js dinamicamente dalle variabili d'ambiente
function generateConfigFile() {
  const configContent = `/**
 * DROP Application Configuration
 * Generato automaticamente dal server basato su .env
 * ${new Date().toISOString()}
 */

const AppConfig = ${JSON.stringify(baseConfig, null, 2)};`;

  fs.writeFileSync(path.join(__dirname, 'config.js'), configContent);
  console.log('File config.js generato con successo');
}

// Genera il file config.js all'avvio del server
generateConfigFile();

// Configurazione CORS per evitare errori di connessione
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Rispondi subito alle richieste OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Middleware per servire file statici
app.use(express.static(__dirname));

// Route principale che serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Route per drop.html
app.get('/drop', (req, res) => {
  res.sendFile(path.join(__dirname, 'drop.html'));
});

// Avvia il server
app.listen(PORT, () => {
  console.log(`Server DROP avviato su http://localhost:${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Per accedere all'app, apri http://localhost:${PORT} nel browser`);
}); 