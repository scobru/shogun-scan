const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

// Recupera la directory da servire da args, default: test
let testDirName = 'test-project';
const dirArg = process.argv.find(arg => arg.startsWith('--dir='));
if (dirArg) {
  testDirName = dirArg.split('=')[1];
}

// Percorso assoluto della directory da servire
const testDir = path.join(__dirname, testDirName);

// Verifica che la directory esista
if (!fs.existsSync(testDir)) {
  console.error(`ERROR: Directory "${testDirName}" non esiste in ${__dirname}`);
  console.log('Usa --dir=nomecartella per specificare una directory diversa');
  process.exit(1);
}

// Servi i file dalla directory specificata
app.use(express.static(testDir));

// Serve index.html per le rotte non trovate (fallback per SPA)
app.get('*', (req, res) => {
  const indexPath = path.join(testDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`File index.html non trovato in ${testDirName}`);
  }
});

app.listen(port, () => {
  console.log(`Server in ascolto su http://localhost:${port}`);
  console.log(`Servendo files da: ${testDir}`);
}); 