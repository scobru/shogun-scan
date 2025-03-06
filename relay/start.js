import express from "express";
import Gun from "gun";
import fs from "fs";


//remove all files in the folder
fs.readdirSync("./relay/radata").forEach((file) => {
  fs.unlinkSync(`./relay/radata/${file}`);
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
  file: "./relay/radata",
  radisk: true, // Abilita il salvataggio su disco
});

// Endpoint di base per verificare che il server sia in funzione
app.get("/status", (req, res) => {
  res.json({ status: "Server GUN attivo" });
});
