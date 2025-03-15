# SHOGUN - Suite di Chat P2P Decentralizzate

Questo progetto è una suite di applicazioni di chat peer-to-peer (P2P) decentralizzate con diverse implementazioni. Il progetto include tre applicazioni distinte, ognuna con un approccio diverso alla comunicazione P2P e alla crittografia.

## Implementazioni Disponibili

### 1. PAN POT (Implementazione GunDB)

L'applicazione principale che utilizza **GunDB** per la comunicazione P2P con crittografia end-to-end. È la versione più moderna e completa.

Caratteristiche principali:
- Interfaccia utente avanzata e reattiva
- Crittografia end-to-end dei messaggi
- Chat di gruppo in stanze private
- Messaggi privati tra utenti
- Generazione di codici QR per condivisione facilitata
- Persistenza dei dati locale tramite IndexedDB

[Vai alla documentazione specifica di PAN POT](./src/gun/README.md)

### 2. Message Board Criptata (Implementazione Bugoff)

Versione che utilizza **Bugoff**, un'estensione di Bugout con supporto per la crittografia end-to-end.

Caratteristiche principali:
- Architettura server-client
- Basata su WebTorrent
- Crittografia dei messaggi tramite SEA
- Gestione sicura delle chiavi
- Comunicazione decentralizzata

### 3. Message Board Standard (Implementazione Bugout)

Versione base che utilizza **Bugout** senza crittografia, ideale per test e dimostrazioni.

Caratteristiche principali:
- Implementazione semplice e leggera
- Comunicazione in chiaro
- Architettura server-client
- Basata su WebTorrent

## Come Iniziare

1. Clone il repository:
   ```
   git clone https://github.com/shogun/shogun-panpot.git
   cd shogun-panpot
   ```

2. Installa le dipendenze:
   ```
   npm install
   ```

3. Avvia il server tracker (necessario per tutte le implementazioni):
   ```
   node src/gun/server.js
   ```

4. Apri nel browser l'indice principale per scegliere l'implementazione:
   ```
   http://localhost:8765
   ```

## Struttura del Progetto

```
shogun-panpot/
├── index.html                # Pagina principale per selezionare l'implementazione
├── README.md                 # Questo file
├── src/
│   ├── gun/                  # Implementazione PAN POT con GunDB
│   │   ├── client.html       # Interfaccia client principale
│   │   ├── server.js         # Server tracker per GunDB
│   │   ├── shogun-core.js    # Libreria core condivisa
│   │   └── ...
│   ├── torrent/              # Implementazioni basate su WebTorrent
│   │   ├── encrypted/        # Implementazione Bugoff (crittografata)
│   │   │   ├── messageboard-encrypted.html
│   │   │   └── messageboard-server-encrypted.html
│   │   └── public/           # Implementazione Bugout (standard)
│   │       ├── messageboard.html
│   │       └── messageboard-server.html
│   └── shogun.svg            # Logo del progetto
```

## Differenze tra le Implementazioni

### Tecnologia di Base
- **PAN POT**: Utilizza GunDB, un database grafico decentralizzato in tempo reale
- **Message Board Criptata**: Utilizza Bugoff, estensione di Bugout con crittografia
- **Message Board Standard**: Utilizza Bugout per comunicazione P2P via WebTorrent

### Approccio alla Crittografia
- **PAN POT**: Crittografia end-to-end via Gun SEA, con chiavi di stanza e supporto completo per messaggi privati
- **Message Board Criptata**: Crittografia tramite SEA, con scambio di chiavi tra peer
- **Message Board Standard**: Nessuna crittografia, messaggi in chiaro

### Interfaccia Utente
- **PAN POT**: UI moderna con supporto completo per gestione utenti, stanze e messaggi privati
- **Message Board Criptata**: UI base focalizzata sulla bacheca messaggi
- **Message Board Standard**: UI minimale per demo e test

## Scenari di Utilizzo

- **Comunicazione Sicura**: Utilizza PAN POT per chat crittografate con interfaccia completa
- **Demo o Test Semplici**: Utilizza la Message Board Standard per dimostrazioni veloci
- **Confronto Tecnologie**: Utilizza tutte le implementazioni per confrontare diversi approcci alla comunicazione P2P

## Limitazioni Comuni

- La stabilità delle connessioni dipende dalla qualità della rete dei partecipanti
- Alcune reti potrebbero bloccare le connessioni WebRTC o WebTorrent
- Il numero di partecipanti può influire sulle prestazioni