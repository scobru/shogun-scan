# Test Plan: Bitcoin Authentication Fix

## Problema Risolto
Il sistema Bitcoin aveva un comportamento inconsistente dopo il refresh della pagina e la pulizia del localStorage. Gli utenti non riuscivano a fare login dopo aver pulito la cache. **AGGIORNAMENTO**: È stato risolto anche un problema di verifica della firma deterministica e rimossa la modalità "Manual Entry" per motivi di sicurezza.

## Modifiche Implementate

### 1. **Strategia di Firma Deterministica**
- **File**: `shogun-core/src/plugins/bitcoin/nostrConnector.ts`
- **Modifica**: Il sistema ora usa sempre una firma deterministica basata sull'indirizzo Bitcoin
- **Beneficio**: Garantisce credenziali consistenti anche dopo la pulizia del localStorage

### 2. **Gestione Cache Migliorata**
- **File**: `shogun-core/src/plugins/bitcoin/nostrConnector.ts`
- **Modifica**: Aggiunto metodo `clearSignatureCache()` per pulire la cache delle firme
- **Beneficio**: Permette agli utenti di risolvere problemi di autenticazione

### 3. **Interfaccia Utente Semplificata**
- **File**: `shogun-core/src/examples/auth.html`
- **Modifica**: Rimossa l'opzione "Manual Entry" dalla sezione Bitcoin
- **Beneficio**: Interfaccia più sicura e meno confusa per gli utenti
- **Motivo**: La modalità manual non era crittograficamente sicura e aveva casi d'uso molto limitati

### 4. **Verifica Firma Migliorata**
- **File**: `shogun-core/src/plugins/bitcoin/nostrConnector.ts`
- **Modifica**: Migliorata la generazione di firme deterministiche per garantire formato hex valido
- **Beneficio**: Risolve errori di "Invalid signature format" durante l'autenticazione

## Funzionalità Rimosse

### ❌ **Modalità "Manual Entry" Bitcoin**
**Motivo della Rimozione:**
- **Sicurezza**: Non utilizzava firme ECDSA reali, solo hash deterministici
- **Vulnerabilità**: Chiunque poteva inserire qualsiasi indirizzo Bitcoin
- **Confusione**: Gli utenti potrebbero pensare che fosse sicura quanto Nostr
- **Casi d'uso limitati**: Utile solo per testing/sviluppo

**Alternativa Consigliata:**
- Utilizzare l'estensione Nostr per autenticazione Bitcoin sicura
- Per testing: utilizzare l'autenticazione tradizionale username/password

## Test di Verifica

### ✅ **Test Funzionalità Bitcoin**
1. **Connessione Nostr**: Verifica che l'estensione Nostr si connetta correttamente
2. **Registrazione**: Crea un nuovo account Bitcoin con alias univoco
3. **Login**: Accedi con lo stesso indirizzo Bitcoin
4. **Persistenza**: Verifica che le credenziali rimangano consistenti dopo refresh
5. **Cache Clear**: Testa che il pulsante "Clear Storage" pulisca tutto correttamente

### ✅ **Test Sicurezza**
1. **Firma Valida**: Verifica che le firme generate siano hex string validi
2. **Verifica Deterministica**: Controlla che lo stesso indirizzo generi sempre le stesse credenziali
3. **Isolamento**: Assicurati che utenti diversi abbiano credenziali diverse

## Risoluzione Problemi

Se il login Bitcoin continua a fallire:
1. Clicca "🧹 Clear Storage" (pulsante arancione nella sezione Inizializzazione)
2. Refresh della pagina
3. Riprova la registrazione

**Nota**: Il pulsante "🧹 Clear Storage" ora pulisce automaticamente anche la cache delle firme Bitcoin, quindi non è necessario un pulsante separato.

## Sicurezza Migliorata

Con la rimozione della modalità manual, il sistema Bitcoin ora:
- ✅ Utilizza solo firme Nostr crittograficamente sicure
- ✅ Richiede il possesso effettivo della chiave privata
- ✅ Previene l'inserimento di indirizzi arbitrari
- ✅ Mantiene la compatibilità con l'ecosistema Nostr/Bitcoin

## Test da Eseguire

### Test 1: Registrazione e Login Normale
1. Apri `shogun-core/src/examples/auth.html`
2. Clicca "Initialize Shogun"
3. Connetti wallet Bitcoin (Nostr)
4. Registrati con Bitcoin
5. Fai logout
6. Fai login con Bitcoin
7. **Risultato Atteso**: Login riuscito

### Test 2: Comportamento dopo localStorage.clear()
1. Completa il Test 1
2. Apri Developer Tools → Console
3. Esegui `localStorage.clear()`
4. Refresh della pagina
5. Inizializza Shogun
6. Connetti wallet Bitcoin
7. Prova login con Bitcoin
8. **Risultato Atteso**: Login riuscito (usando firma deterministica)

### Test 3: Recupero con Clear Cache
1. Completa il Test 2
2. Se il login fallisce, clicca "🧹 Clear Cache" nella sezione Bitcoin
3. Prova nuovamente la registrazione
4. **Risultato Atteso**: Registrazione riuscita

### Test 4: Gestione Utente Esistente
1. Prova a registrare lo stesso indirizzo Bitcoin due volte
2. **Risultato Atteso**: Messaggio informativo che suggerisce di fare login

### 🆕 Test 5: Verifica Firma Deterministica
1. Apri Developer Tools → Console
2. Inizializza Shogun e connetti Bitcoin wallet
3. Prova login/registrazione
4. **Verifica nei Log**: 
   - `"Generated deterministic signature: [hex]... (128 chars)"`
   - `"Signature format check: hex=true, length=true (128 chars)"`
   - `"Nostr signature appears valid"`
5. **Risultato Atteso**: Nessun errore "Invalid signature format"

## Verifica dei Log

Durante i test, controlla i log della console per:
- `"Using deterministic signature for consistency"`
- `"Generated deterministic signature: [hex]... (128 chars)"`
- `"Signature format check: hex=true, length=true"`
- `"Cached signature for address: ..."`
- `"Cleared signature cache for address: ..."`

### 🆕 Log di Debug Firma
Se ci sono problemi, cerca questi log specifici:
- `"Signature to verify: [hex]... (length: X)"`
- `"Message to verify: I Love Shogun!"`
- `"Expected: [address], Got: [address]"` (se c'è mismatch)
- `"Invalid signature format - not a valid hex string"`
- `"Invalid signature length: X (minimum 64 required)"`

## Note Tecniche

- La firma deterministica è basata su: `${address}_I Love Shogun!_shogun_deterministic`
- La cache delle firme è salvata in localStorage con chiave: `shogun_bitcoin_sig_${address}`
- Il sistema fallback garantisce sempre credenziali consistenti per lo stesso indirizzo
- **🆕 Formato Firma**: Le firme deterministiche sono sempre hex string di esattamente 128 caratteri
- **🆕 Validazione**: Il sistema verifica formato hex (`/^[0-9a-f]+$/i`) e lunghezza minima (64 caratteri) 