# Shogun Music - PocketBase

Server di storage file per l'applicazione Shogun Music.

## Introduzione

PocketBase viene utilizzato per la gestione e lo storage dei file audio e delle immagini dell'applicazione Shogun Music, mentre GunDB si occupa dei metadati e della sincronizzazione in tempo reale.

## Istruzioni di avvio

1. Esegui `start-pocketbase.bat` in questa cartella
2. Al primo avvio, PocketBase scaricherà automaticamente l'eseguibile
3. Quando richiesto, crea un account amministratore
4. Il server PocketBase sarà disponibile all'indirizzo http://127.0.0.1:8090
5. L'interfaccia di amministrazione è accessibile all'indirizzo http://127.0.0.1:8090/_/

## Installazione manuale (alternativa)

Se lo script automatico non funziona:

1. Scarica PocketBase da https://pocketbase.io/docs/
2. Estrai l'eseguibile in questa cartella
3. Avvia con il comando `pocketbase serve`

## Configurazione collezioni

Le seguenti collezioni verranno create automaticamente dal sistema Shogun Music:

- `tracks`: File audio delle tracce
- `releases`: Informazioni sulle release
- `artwork`: Immagini di copertina

## Risoluzione problemi

- **Errore porta in uso**: Verifica che non ci siano altre istanze di PocketBase in esecuzione
- **Errore permessi**: Esegui come amministratore se necessario
- **File non visibili**: Controlla che il server sia in esecuzione quando carichi nuovi file 