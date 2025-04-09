// app-server.js - Server per l'applicazione frontend
const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 9000;

// Abilita CORS per tutte le richieste
app.use(cors());

// Middleware per logging delle richieste
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Servi i file statici dalla cartella app
app.use(express.static(path.join(__dirname, 'app')));

// Rotta principale - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'app', 'index.html'));
});

// Gestisci tutte le altre richieste reindirizzandole a index.html
// Utile se in futuro aggiungerai routing sul client
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'app', 'index.html'));
});

// Avvia il server
app.listen(PORT, () => {
  console.log(`
  ┌───────────────────────────────────────────────┐
  │                                               │
  │   Shogun Music App Server                     │
  │                                               │
  │   • Frontend:  http://localhost:${PORT}       │
  │                                               │
  │   Altri servizi (da avviare separatamente):   │
  │   • Storage:   http://localhost:3000          │
  │   • Metadata:  http://localhost:8765          │
  │                                               │
  └───────────────────────────────────────────────┘
  `);
}); 