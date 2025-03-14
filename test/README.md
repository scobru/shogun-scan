# Bugout/Bugoff Messageboard Demo

Questa è una demo che mostra due implementazioni di una messageboard P2P:

1. **Versione Standard**: Utilizza [Bugout](https://github.com/chr15m/bugout) per la comunicazione P2P senza crittografia
2. **Versione Sicura**: Utilizza [Bugoff](https://github.com/draeder/bugoff), un'estensione di Bugout che aggiunge crittografia end-to-end

## Come Funziona

### Versione Standard (Bugout)
- La comunicazione avviene tramite WebRTC e WebTorrent
- I messaggi sono trasmessi in chiaro
- Semplice da usare ma non sicura per informazioni sensibili

### Versione Sicura (Bugoff)
- Aggiunge crittografia end-to-end tramite SEA (Signal Elliptic-curve Alliance)
- I messaggi sono crittografati prima di essere inviati
- Ogni peer genera una coppia di chiavi per la crittografia
- Offre maggiore sicurezza ma richiede una fase di setup delle chiavi

## Come Eseguire

1. Apri `index.html` per scegliere quale versione utilizzare
2. Per ogni versione puoi:
   - Avviare un server (pagina *-server.html)
   - Connetterti a un server esistente (pagina principale)

## Problemi Comuni e Soluzioni

### Errore "not seen - no public key"
Questo errore si verifica quando le chiamate RPC vengono eseguite prima che lo scambio delle chiavi tra i peer sia completato. Per risolvere questo problema:

1. Abbiamo aggiunto un sistema di gestione dello stato dei peer per tracciare quali peer sono pronti
2. Le chiamate RPC vengono effettuate solo dopo che lo scambio delle chiavi è stato completato
3. Il client attende che il server sia pronto prima di richiedere messaggi o inviare messaggi

### Errore di connessione WebSocket
Se ricevi errori del tipo `WebSocket connection to 'wss://hub.bugout.link/' failed`, potrebbe essere dovuto a:

1. Problemi di connessione alla rete
2. Blocco dei WebSocket da parte di firewall o proxy
3. Il server tracker di Bugout potrebbe essere temporaneamente non disponibile

L'applicazione tenterà comunque di stabilire connessioni peer-to-peer tramite canali alternativi.

## Implementazione Tecnica

Il passaggio da Bugout a Bugoff ha richiesto diverse modifiche:

1. Inizializzazione della crittografia con `b.SEA()`
2. Utilizzo di `b.send()` invece di `b.bugout.send()` per inviare messaggi crittografati
3. Ascolto degli eventi `decrypted` invece di `message` per ricevere i messaggi decrittati
4. Gestione delle chiavi pubbliche degli altri peer
5. Controllo dello stato dei peer prima di eseguire chiamate RPC
6. Gestione migliorata degli errori per una maggiore robustezza

## Dettagli dell'Implementazione Bugoff-Browser

La nostra implementazione di `bugoff-browser.js` include diversi miglioramenti:

1. **Gestione Robusta degli Errori**: Tutti i punti critici sono protetti da blocchi try-catch
2. **Timeout per le Chiamate RPC**: Previene situazioni di blocco se un peer non risponde
3. **Verifica delle Chiavi**: I messaggi vengono inviati solo a peer con cui è avvenuto lo scambio delle chiavi
4. **Segnalazione Dettagliata**: Messaggi di log dettagliati per facilitare il debug
5. **Gestione di Situazioni Anomale**: Comportamento graceful in caso di errori di connessione o crittografia

## File principali:

- `messageboard.html` e `messageboard-server.html`: Versione standard con Bugout
- `messageboard-secure.html` e `messageboard-secure-server.html`: Versione sicura con Bugoff
- `bugoff-browser.js`: Versione adattata di Bugoff per il browser
- `index.html`: Pagina di selezione della versione 