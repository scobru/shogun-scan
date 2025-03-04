import express from "express";
import Gun from "gun";
import fs from "fs";


//remove all files in the folder
fs.readdirSync("relay-data").forEach((file) => {
  fs.unlinkSync(`relay-data/${file}`);
});

const app = express();
const port = process.env.PORT || 8765;

// Configura Gun
app.use(Gun.serve);

// Avvia il server
const server = app.listen(port, () => {
  console.log(`Server GUN in esecuzione su http://localhost:${port}`);
});

// Inizializza Gun
const gun = Gun({
  web: server,
  file: "relay-data", // Salva i dati in una cartella chiamata 'data'
  radisk: true, // Abilita il salvataggio su disco
});

// Gestisci gli errori
gun.on("error", (err) => {
  console.error("Errore GUN:", err);
});

// Endpoint di base per verificare che il server sia in funzione
app.get("/status", (req, res) => {
  res.json({ status: "Server GUN attivo" });
});
