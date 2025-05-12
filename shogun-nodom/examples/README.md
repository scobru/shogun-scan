# Esempi di Shogun NoDom

Questa cartella contiene esempi pratici per imparare a usare Shogun NoDom nelle sue diverse versioni e scenari.

## Esempi Browser

### 1. [basic.html](./basic.html)
Un esempio minimo di Shogun NoDom che mostra come funzionano i segnali e gli effetti in un'applicazione web semplice.

**Caratteristiche:**
- Inizializzazione base di Gun
- Creazione di segnali reattivi
- Aggiornamenti UI automatici

### 2. [namespace.html](./namespace.html)
Un esempio più complesso che dimostra l'uso dei namespace per isolare i dati utente.

**Caratteristiche:**
- Autenticazione utente
- Namespace automatico
- Form con campi dati isolati
- Persistenza dei dati tra sessioni

## Esempi Node.js

### 1. [node-basic.js](./node-basic.js)
Esempio base di utilizzo di nodom-node.js che dimostra la reattività lato server.

**Caratteristiche:**
- Inizializzazione di Gun in Node.js
- Creazione di segnali reattivi
- Effetti che rispondono ai cambiamenti

**Esecuzione:**
```bash
node node-basic.js
```

### 2. [node-namespace.js](./node-namespace.js)
Esempio che mostra l'autenticazione e la gestione dei namespace in un ambiente Node.js.

**Caratteristiche:**
- Autenticazione utente
- Gestione namespace automatico
- Contesti namespace personalizzati
- Persistenza dei dati

**Nota importante:**
L'esempio mostra anche i limiti di sicurezza di Gun/SEA quando si tenta di scrivere in un namespace personalizzato senza possedere le credenziali appropriate. Un errore "Signature did not match" è atteso e viene spiegato nei commenti.

**Esecuzione:**
```bash
node node-namespace.js <username> <password>
```

## Struttura generale

Tutti gli esempi seguono questi passi comuni:

1. **Inizializzazione**: Configurazione di Gun e Shogun NoDom
2. **Creazione di segnali**: Definizione di dati reattivi
3. **Creazione di effetti**: Risposta automatica ai cambiamenti
4. **Manipolazione dei dati**: Aggiornamento dei valori dei segnali

## Suggerimenti

- Assicurati di avere Gun installato: `npm install gun`
- Per gli esempi browser, puoi usare un server statico come `serve` o `http-server`
- Per gli esempi Node.js, puoi eseguirli direttamente con Node.js
- Gli esempi avviano automaticamente un server Gun locale per la sincronizzazione dei dati 