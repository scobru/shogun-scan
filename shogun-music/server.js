const express = require('express');
const Gun = require('gun');
const path = require('path');

const app = express();
const port = 3000;

require('gun')



// Serviamo i file sgun/lib/yson.js`tatici dalla cartella "public"
app.use(express.static(path.join(__dirname, 'public')));

// Avviamo il server
const server = app.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}`);
});

// Inizializziamo GunDB collegandolo al server Express
Gun({ web: server,
    radisk: true,
    file: 'radata'
 });
