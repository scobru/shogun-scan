# DROP - Sistema di condivisione file decentralizzato

DROP è un'applicazione per la condivisione di file in modo decentralizzato, privato e sicuro, basata su tecnologie P2P e IPFS.

## Caratteristiche

- Caricamento e condivisione di file semplice e intuitiva
- Crittografia end-to-end dei file
- Autenticazione tramite password, WebAuthn e MetaMask
- Interfaccia moderna e responsive
- Configurazione flessibile tramite file `.env`

## Installazione

1. Clona il repository
   ```
   git clone https://github.com/tuo-username/shogun-drop.git
   cd shogun-drop
   ```

2. Installa le dipendenze
   ```
   npm install
   ```

3. Configura l'ambiente
   ```
   cp env.example .env
   ```
   Modifica il file `.env` secondo le tue necessità

## Avvio dell'applicazione

### Modalità di sviluppo

```
npm run dev
```

L'applicazione sarà disponibile all'indirizzo `http://localhost:3000` (o la porta specificata nel file `.env`). Il server si riavvierà automaticamente quando modifichi i file sorgente.

### Modalità di produzione

```
npm start
```

## Configurazione

Puoi configurare l'applicazione modificando le variabili nel file `.env`:

### Configurazioni server
- `PORT`: Porta su cui avviare il server (default: 3000)
- `NODE_ENV`: Ambiente di esecuzione (development/production)

### Limiti dei file
- `FILE_SIZE_LIMIT_MB`: Dimensione massima dei file in MB (default: 10)
- `MAX_USER_DROPS`: Numero massimo di file per utente (default: 5)

### Configurazione API e GunDB
- `API_URL`: URL del server API
- `API_TOKEN`: Token di autenticazione per le API
- `GUNDB_PEERS`: Peer GunDB (separati da virgola se più di uno)

### Configurazione UI
- `APP_NAME`: Nome dell'applicazione
- `APP_DESCRIPTION`: Descrizione dell'applicazione
- `THEME_PRIMARY`: Colore primario (hex)
- `BACKGROUND_IMAGES`: Immagini di sfondo (URL separati da virgola)

## Come funziona

1. **Carica** - Carica il tuo file e ricevi un link univoco e sicuro
2. **Cripta** - Il file viene criptato automaticamente end-to-end
3. **Condividi** - Invia il link a chi desideri, solo loro potranno accedervi

## Licenza

MIT 