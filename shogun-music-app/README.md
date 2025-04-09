# Shogun Music App

Piattaforma musicale decentralizzata con architettura ispirata ad Audius.

## Componenti dell'Architettura

Il sistema è composto da diversi servizi che lavorano insieme:

1. **Frontend (UI)** - Interfaccia web per interagire con la piattaforma
2. **Storage Relay** - Gestisce lo storage di file MP3 e artwork
3. **Metadata Relay** - Gestisce i metadati delle canzoni utilizzando GunDB
4. **Identity Relay** - Gestisce autenticazione e identità degli utenti

## Requisiti

- Node.js v14+ e npm/yarn
- GunDB (installato come dipendenza)

## Installazione

```bash
# Clona il repository
git clone [url-repository]
cd shogun-music-app

# Installa le dipendenze
npm install
# oppure
yarn install
```

## Avvio Rapido

Il modo più semplice per avviare l'intera applicazione è utilizzare il comando:

```bash
npm start
```

Questo comando avvierà contemporaneamente tutti i servizi:
- Storage Relay (porta 3000)
- Metadata Relay (porta 8765)
- Identity Relay (porta 3002)
- Frontend (porta 8080)

## Avvio dei Singoli Componenti

È possibile avviare i componenti individualmente:

```bash
# Avvia solo il frontend
npm run start:app

# Avvia solo il storage relay
npm run start:storage

# Avvia solo il metadata relay
npm run start:metadata

# Avvia solo l'identity relay
npm run start:identity

# Avvia tutti i servizi backend senza il frontend
npm run start:all
```

## Navigazione

Una volta avviati i servizi, puoi accedere all'applicazione frontend nel browser:

- Frontend UI: [http://localhost:8080](http://localhost:8080)

## Funzionalità Principali

- **Upload di MP3 e Artwork**: Carica i tuoi file audio e immagini
- **Gestione Metadati**: Aggiungi titolo, artista, album e genere
- **Riproduzione**: Ascolta brani dalla libreria
- **Ricerca Avanzata**: Cerca brani per titolo, artista, album o genere
- **Verifica di Disponibilità**: Controlla automaticamente se i file sono disponibili

## Architettura

L'applicazione implementa un'architettura distribuita ispirata ad Audius:

- **Storage-Relay → Metadata-Relay**: Notifica automatica quando nuovi file vengono caricati
- **Metadata-Relay → Storage-Relay**: Verifica dell'esistenza dei file
- **Identity-Relay**: Gestione autenticazione utenti e autorizzazioni

## Sviluppo e Contributi

Il progetto è in fase di sviluppo attivo. Per contribuire:

1. Crea un fork del repository
2. Crea un branch per le tue modifiche (`git checkout -b feature/nome-feature`)
3. Fai commit delle tue modifiche (`git commit -m 'Aggiungi feature'`)
4. Esegui push al branch (`git push origin feature/nome-feature`)
5. Apri una Pull Request 