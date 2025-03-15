# Chat Decentralizzata P2P Multi-Stanza con Crittografia

Questa applicazione dimostra una chat decentralizzata dove ogni client agisce come un nodo peer-to-peer (P2P) con GunDB, supporta la creazione di stanze multiple e include crittografia end-to-end sia per i messaggi della stanza che per i messaggi privati tra utenti.

## Architettura

L'architettura è completamente decentralizzata:

- **Server Tracker**: Funziona principalmente come punto di incontro iniziale per i client, simile a un "tracker" in una rete BitTorrent. Non memorizza permanentemente i dati.
- **Client P2P**: Ogni browser client avvia un "server" GunDB locale e si connette direttamente agli altri client tramite WebRTC.
- **Storage Locale**: I dati vengono memorizzati localmente in ogni client usando IndexedDB.
- **Sincronizzazione**: I dati vengono sincronizzati direttamente tra i client connessi.
- **Stanze Multiple**: Ogni sessione di chat ha un ID univoco, permettendo di creare e unirsi a stanze separate.
- **Crittografia End-to-End**: I messaggi sono crittografati utilizzando Gun SEA (Security, Encryption & Authorization) e solo i client con la chiave corretta possono decifrare i messaggi.
- **Messaggi Privati**: Gli utenti possono scambiarsi messaggi privati crittografati direttamente, indipendentemente dalla chat generale della stanza.

## Caratteristiche

- Creazione e gestione di stanze di chat multiple
- Condivisione di link per invitare altri a una stanza specifica
- **Crittografia end-to-end dei messaggi della stanza**
- **Messaggi privati crittografati tra utenti**
- Lista degli utenti attivi nella stanza
- Indicatore di stato online/offline degli utenti
- La chiave di crittografia è incorporata nel link di invito
- Indicatore visivo per i messaggi crittografati
- Chat in tempo reale tra utenti nella stessa stanza
- Connessioni P2P tramite WebRTC
- Memorizzazione locale dei dati
- Funzionamento anche in presenza di interruzioni del server tracker
- Visualizzazione del numero di peer connessi

## Come funziona la crittografia

1. Quando viene creata una nuova stanza, viene generata automaticamente una chiave di crittografia casuale
2. La chiave viene aggiunta all'URL come parametro `key`
3. Quando un utente invia un messaggio (sia nella chat della stanza che in quella privata), questo viene crittografato con la chiave prima di essere salvato
4. Quando un client riceve un messaggio, tenta di decrittarlo usando la sua chiave locale
5. Solo i client che hanno l'URL completo con la chiave corretta possono leggere i messaggi

## Come funzionano i messaggi privati

1. Ogni utente imposta un nome utente all'ingresso nella stanza
2. La lista degli utenti presenti nella stanza viene mostrata nella tab "Messaggi Privati"
3. Per inviare un messaggio privato, si seleziona un utente dalla lista
4. I messaggi privati vengono crittografati con la stessa chiave della stanza
5. I messaggi privati sono visibili solo agli utenti coinvolti nella conversazione
6. Le conversazioni private persistono anche se il server va offline

## Come avviare

1. Assicurati di avere Node.js installato
2. Installa le dipendenze:
   ```
   npm install express gun
   ```
3. Avvia il server tracker:
   ```
   node server.js
   ```
4. Apri il browser all'indirizzo `http://localhost:8765`
5. Scegli se creare una nuova stanza o unirti a una esistente

## Come funziona

### Creazione di una stanza
1. Seleziona "Crea Nuova Stanza"
2. Il sistema genera un ID univoco per la stanza e una chiave di crittografia
3. Viene visualizzato un link da condividere con altri per invitarli alla stanza
4. Il link contiene sia l'ID della stanza che la chiave di crittografia
5. Ora puoi impostare un nome utente e iniziare a chattare nella stanza appena creata

### Partecipazione a una stanza
1. Seleziona "Unisciti a Stanza" e inserisci l'ID della stanza
   - oppure -
   Clicca su un link di invito condiviso da un altro utente
2. Il sistema ti connette automaticamente alla stanza richiesta
3. Se il link contiene una chiave di crittografia, potrai leggere i messaggi crittografati
4. Senza la chiave corretta, i messaggi crittografati non potranno essere visualizzati

### Utilizzo dei messaggi privati
1. Seleziona la tab "Messaggi Privati"
2. Clicca su un utente dalla lista per iniziare una conversazione privata
3. I messaggi scambiati saranno visibili solo a te e all'altro utente
4. Puoi passare facilmente tra la chat della stanza e le conversazioni private

### Funzionamento P2P
1. Quando un client si connette, contatta prima il server "tracker"
2. Tramite il tracker, il client scopre altri client nella stessa stanza
3. I client stabiliscono connessioni dirette tra loro usando WebRTC
4. I messaggi e i dati vengono sincronizzati direttamente tra i client
5. Anche se il server tracker viene disconnesso, i client già connessi possono continuare a comunicare

## Considerazioni sulla sicurezza

- La chat utilizza crittografia end-to-end tramite Gun SEA
- La chiave di crittografia è inclusa nell'URL, quindi devi condividere il link solo con persone fidate
- I messaggi appaiono crittografati nel database locale e durante la trasmissione
- Anche il server tracker non può decifrare i messaggi
- I messaggi privati utilizzano la stessa chiave di crittografia della stanza
- In una versione di produzione, considerare ulteriori meccanismi di autenticazione e controllo degli accessi 