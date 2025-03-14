# OpenTracker per Bugoff

Questo è un tracker BitTorrent personalizzato basato su OpenTracker, configurato per funzionare con l'applicazione Bugoff.

## Requisiti

- Docker installato sul sistema
- Porta 6969 aperta

## Istruzioni per l'uso

1. Costruire l'immagine Docker:
   ```
   docker build -t opentracker .
   ```

2. Eseguire il container:
   ```
   docker run -d -p 6969:6969 --name opentracker opentracker
   ```

3. Verificare che il tracker sia in esecuzione:
   ```
   curl http://localhost:6969/stats
   ```

## Utilizzo con Bugoff

Il tracker è già configurato per essere utilizzato automaticamente con Bugoff quando l'applicazione è in esecuzione su localhost. 