# Shogun Mini Relay

Shogun Mini Relay è una piccola implementazione di un relay di messaggistica basato su [Gun.js](https://gun.eco/), un database decentralizzato in tempo reale.

## Caratteristiche

- Comunicazione in tempo reale tra client
- Supporto per autenticazione utenti
- Funziona sia come server (relay) che come client (web o CLI)
- Deduplicazione automatica dei messaggi
- API semplice e intuitiva
- Supporto per peer multipli
- Esportazione e importazione di chiavi utente (pair)
- Creazione di nuovi utenti direttamente dalla CLI

## Componenti del Sistema

Shogun Mini Relay è composto da diversi componenti che lavorano insieme:

1. **Server Relay** (`server.js`) - Un server Node.js che funge da relay per i messaggi
2. **Client CLI** (`cli.js`) - Un'interfaccia a riga di comando per interagire con il relay
3. **Client Web** (`inbox.html`) - Un'interfaccia web per interagire con il relay
4. **Core API** (`index.js`) - Un modulo che fornisce funzioni di base per interagire con Gun.js

## Installazione

```bash
npm install gun
```

## Utilizzo

### Avviare il Server Relay

```bash
# Avviare il server con la porta predefinita (8765)
node server.js

# Avviare il server su una porta specifica
node server.js 9000
```

### Avviare il Client CLI

```bash
node cli.js [username] [password] [options]
```

#### Opzioni CLI avanzate

Il client CLI supporta diverse opzioni per casi d'uso avanzati:

```bash
# Utilizzo base
node cli.js <username> <password>

# Specificare peer personalizzati
node cli.js <username> <password> --peers http://peer1.com/gun,http://peer2.com/gun

# Esportare il pair dell'utente (dopo il login)
node cli.js <username> <password> --export-pair ./my-user-pair.json

# Autenticarsi con un pair precedentemente esportato
node cli.js --pair ./my-user-pair.json

# Creare un nuovo utente
node cli.js <username> <password> --create-user

# Creare un nuovo utente ed esportare il pair
node cli.js <username> <password> --create-user --export-pair ./new-user-pair.json

# Opzioni brevi
node cli.js <username> <password> -p http://peer1.com/gun,http://peer2.com/gun
node cli.js <username> <password> -e ./my-user-pair.json
node cli.js -P ./my-user-pair.json
node cli.js <username> <password> -c
```

### Avviare il Client Web

Per utilizzare il client web, apri il file `inbox.html` in un browser. Assicurati che il server relay sia in esecuzione.

### Utilizzare l'API Core

L'API Core può essere utilizzata per integrare Shogun Mini Relay in altre applicazioni:

```javascript
// Importare il modulo
const miniRelay = require('./index.js');

// Creare un'istanza Gun
const Gun = require('gun');
const gun = new Gun({
  peers: ['http://localhost:8765/gun']
});

// Inviare un messaggio
miniRelay.sendMessage(gun, 'Hello world', {
  username: 'CustomUser'
});

// Ascoltare i messaggi
miniRelay.logMessages(gun, {
  since: Date.now() // Solo messaggi dal momento attuale
});

// Ottenere il nodo dei messaggi
const messagesNode = miniRelay.getMessages(gun);

// Creare un server
const server = miniRelay.createServer(8765);
```

## Architettura del Sistema

Shogun Mini Relay utilizza Gun.js per creare un sistema di messaggistica decentralizzato:

1. **Relay Server**: Funge da punto di sincronizzazione per i client
2. **Gun.js**: Gestisce la sincronizzazione dei dati in tempo reale
3. **SEA (Security, Encryption, Authorization)**: Fornisce autenticazione e sicurezza
4. **WebSockets**: Utilizzati per le comunicazioni in tempo reale

I messaggi sono memorizzati nel nodo `shogun_message` e contengono:
- `user`: Nome utente o ID
- `text`: Testo del messaggio
- `timestamp`: Data e ora del messaggio

## Personalizzazione

Shogun Mini Relay può essere personalizzato in vari modi:
- Modificando l'interfaccia web in `inbox.html`
- Aggiungendo nuove funzionalità al client CLI
- Estendendo l'API Core in `index.js`
- Configurando il server per usi specifici

## Licenza

MIT 