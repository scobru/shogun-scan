# Shogun Music

Shogun Music è una piattaforma di self-hosting musicale ispirata a Bandcamp, creata con tecnologie web moderne e supporta sia GunDB che PocketBase come database.

## Caratteristiche

- 🎵 Carica e condividi tracce musicali (singoli o EP)
- 🖼️ Aggiungi artwork alle tue release
- 👤 Sistema di autenticazione per artisti
- 💬 Sistema di commenti per le release
- 📱 Design responsive adattabile a tutti i dispositivi
- 🔄 Supporto per database decentralizzato (GunDB) o strutturato (PocketBase)

## Tecnologie

- Frontend: HTML, CSS, JavaScript vanilla
- Backend: Node.js, Express
- Database: 
  - GunDB (database decentralizzato)
  - PocketBase (database SQL con interfaccia REST)

## Installazione

```bash
# Clona il repository
git clone https://github.com/tuousername/shogun-music.git
cd shogun-music

# Installa le dipendenze
npm install

# Per utilizzare PocketBase (opzionale)
# 1. Scarica PocketBase da https://pocketbase.io/docs/
# 2. Estrai e avvia il server PocketBase
./pocketbase serve

# Avvia il server con GunDB (default)
npm start

# OPPURE avvia il server con PocketBase
npm run dev:pb
```

Il server sarà in ascolto sulla porta 3000 per impostazione predefinita. Accedi a `http://localhost:3000` per visualizzare l'applicazione.

## Configurazione Database

### GunDB (Default)
Se non configuri nulla, l'applicazione utilizzerà GunDB che salverà i dati nella cartella `radata`.

### PocketBase
Per utilizzare PocketBase:

1. Scarica PocketBase dal sito ufficiale: https://pocketbase.io/docs/
2. Estrai e avvia il server PocketBase (di default sulla porta 8090)
3. Avvia Shogun Music con l'opzione PocketBase:
   ```
   npm run dev:pb
   ```
4. Opzionalmente, puoi configurare l'URL di PocketBase:
   ```
   POCKETBASE_URL=http://localhost:8090 npm run dev:pb
   ```

## Utilizzo

1. **Registrazione/Login**: Crea un account o accedi per iniziare a caricare musica
2. **Dashboard**: Usa la dashboard per caricare le tue release musicali
3. **Homepage**: Visualizza e ascolta le release disponibili
4. **Pagina Release**: Ascolta le tracce e lascia commenti

## API Endpoints

L'applicazione espone i seguenti endpoint API:

- `GET /status` - Stato del server e tipo di database in uso
- `POST /api/pb/admin-login` - Login admin PocketBase (quando PocketBase è attivo)
- `GET /api/pb/records/:collection` - Ottieni records da una collezione PocketBase

## Struttura del Progetto

```
shogun-music/
├── public/             # File statici (HTML, CSS, JS)
│   ├── index.html      # Homepage
│   ├── dashboard.html  # Dashboard artista
│   ├── release.html    # Pagina dettaglio release
│   ├── login.html      # Pagina login/registrazione
│   ├── style.css       # Stili CSS
│   └── auth.js         # Gestione autenticazione
├── radata/             # Directory per i dati GunDB
├── server.js           # Server Express e configurazione database
├── package.json        # Dipendenze npm
└── README.md           # Documentazione
```

## Roadmap

- [x] Supporto per PocketBase come alternativa a GunDB
- [ ] Supporto per album completi
- [ ] Playlist personalizzate
- [ ] Sistema di acquisto/download
- [ ] Statistiche di ascolto
- [ ] Integrazione con Shogun

## Contribuire

Siamo aperti a contributi! Sentiti libero di aprire issues o pull requests.

## Licenza

MIT 