const express = require("express");
const Gun = require("gun");
require("gun/sea");
require("gun/axe");
const path = require("path");

const app = express();
const port = process.env.PORT || 8765;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Funzione per avviare il server su una porta specificata
function startServer(portNumber) {
  const server = app.listen(portNumber, () => {
    console.log(`Server started with GunDB on port ${portNumber}`);
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.log(`Port ${portNumber} is already in use, trying with port ${portNumber + 1}`);
      startServer(portNumber + 1);
    } else {
      console.error('Server error:', e);
    }
  });

  // Inizializza Gun
  const gun = Gun({
    web: server,
    multicast: false
  });
}

// Avvia il server sulla porta principale
startServer(port);

// Use Gun middleware
app.use(Gun.serve);

app.get("/gun", (req, res) => {
  res.send("Hello World");
});

console.log("Server started with GunDB");
