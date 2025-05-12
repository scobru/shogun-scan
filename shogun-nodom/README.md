# 🔫 **Shogun NoDom** beta

Una libreria reattiva ultraleggera basata su segnali per costruire interfacce utente dinamiche con GunDB.

## 📖 **Introduzione**

**Shogun NoDom** è una libreria JavaScript reattiva basata su segnali per costruire interfacce utente dinamiche con GunDB. Offre reattività potente con un overhead minimo.

> ⚡️ _Shogun NoDom si concentra sulla **semplicità**, **reattività** e **persistenza dei dati** senza sacrificare l'esperienza dello sviluppatore._

_Confronto con altre librerie reattive_

| Libreria | Dimensione | Backend Integrato | Punti di Forza |
|----------|------------|-------------------|----------------|
| Shogun NoDom | Leggera | GunDB (P2P) | Reattività + Storage Distribuito |
| React | ~40kb | No | Ecosistema ricco, Virtual DOM |
| Alpine.js | ~7.1kb | No | Minimalista, funziona con HTML esistente |
| Solid.js | ~7kb | No | Reattività fine, alte prestazioni |

## ⚙️ **Concetti Principali**

### 🔄 **Reattività basata su Segnali**

Shogun NoDom utilizza un sistema reattivo basato su segnali con backup persistente:

* 🧠 **Segnali** - Valori reattivi che notificano gli abbonati quando cambiano e persistono su GunDB.
* 🌀 **Effetti** - Funzioni che si eseguono automaticamente quando cambiano i segnali.
* 🧭 **Memo** - Helper per memorizzare risultati di calcoli basati su dipendenze reattive.
* 🔑 **Namespace** - Spazi di nomi automatici per isolare i dati utente.

## 🚀 **Installazione**

```bash
# Con npm
npm install shogun-nodom gun

# Con yarn
yarn add shogun-nodom gun
```

Oppure includi direttamente da CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/gun/gun.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gun/sea.js"></script>
<script type="module">
  import { init, setSignal, setEffect, h } from 'https://cdn.jsdelivr.net/npm/shogun-nodom/nodom.js';
  // ...
</script>
```

## 📚 **API Principali**

### Inizializzazione

```js
import { init } from 'shogun-nodom';
import Gun from 'gun';
import 'gun/sea'; // Per l'autenticazione

const gun = Gun(['http://localhost:8765/gun']);
init(gun);
```

### Reattività

```js
import { setSignal, setEffect, setMemo } from 'shogun-nodom';

// Crea un segnale
const [getCount, setCount] = setSignal(0, { key: 'counter' });

// Reagisci ai cambiamenti
setEffect(() => {
  console.log(`Il contatore è: ${getCount()}`);
});

// Memorizza calcoli derivati
const getDoubleCount = setMemo(() => getCount() * 2);

// Modifica il valore
setCount(1);
setCount(prev => prev + 1);
```

### Rendering DOM

```js
import { h, Fragment } from 'shogun-nodom';

function Counter() {
  const [count, setCount] = setSignal(0, { key: 'counter' });
  
  return h('div', {},
    h('h1', {}, () => `Contatore: ${count()}`),
    h('button', { 
      onclick: () => setCount(count() + 1) 
    }, 'Incrementa')
  );
}

document.body.appendChild(Counter());
```

### Autenticazione

```js
import { auth, logout, getNamespace } from 'shogun-nodom';

// Login o registrazione
async function login() {
  try {
    // Il terzo parametro (true) crea l'utente se non esiste
    await auth('username', 'password', true);
    console.log(`Namespace: ${getNamespace()}`);
  } catch (err) {
    console.error('Errore di autenticazione:', err);
  }
}

// Logout
function handleLogout() {
  logout();
  console.log('Utente disconnesso');
}
```

## 🔑 **Sistema di Namespace**

Shogun NoDom include un potente sistema di namespace che fornisce isolamento automatico dei dati per gli utenti autenticati.

### Come funzionano i Namespace

1. **Generazione automatica**: Quando un utente si autentica, viene generato un namespace univoco basato sulla sua chiave pubblica.
2. **Isolamento dei dati**: I dati vengono automaticamente salvati sotto il namespace dell'utente, creando un "spazio privato" per i dati dell'utente.
3. **Propagazione contestuale**: I namespace vengono propagati automaticamente agli elementi figli, permettendo di creare interi rami UI con dati isolati.

### Utilizzo dei Namespace

```js
import { h, auth, getNamespace, setSignal } from 'shogun-nodom';

// Dopo l'autenticazione
await auth('username', 'password');
const namespace = getNamespace(); // es: ~ABCDEF1234567890

// Metodo 1: Namespace a livello di elemento (propagato ai figli)
function PrivateForm() {
  return h('div', { namespace },
    h('input', { name: 'private-note' }), // Usa automaticamente il namespace
    h('div', {}, () => {
      // Questo segnale legge/scrive automaticamente in ~ABCDEF1234567890.private-note
      const [getNote] = setSignal('', { key: 'private-note' });
      return `Nota: ${getNote()}`;
    })
  );
}

// Metodo 2: Namespace a livello di segnale
function MixedForm() {
  // Dati privati (con namespace)
  const [getPrivate] = setSignal('', { key: 'user-data' }); // Usa namespace
  
  // Dati pubblici (senza namespace)
  const [getPublic] = setSignal('', { key: 'public-data', element: document.createElement('div') });
  
  return h('div', {},
    h('h3', {}, 'Form Misto'),
    h('div', {}, () => `Dati privati: ${getPrivate()}`),
    h('div', {}, () => `Dati pubblici: ${getPublic()}`)
  );
}
```

### Gestione Avanzata dei Namespace

```js
import { setNamespace, withNamespace } from 'shogun-nodom';

// Impostare manualmente un namespace
setNamespace('~customnamespace');

// Creare un componente con namespace specifico
const PrivateComponent = withNamespace('~customnamespace', 
  h('div', {}, 
    h('input', { name: 'special-input' })
  )
);

// Nidificazione di namespace
function NestedNamespaces() {
  return h('div', { namespace: '~user1' },
    h('div', {}, 'Area Utente 1'),
    h('div', { namespace: '~user2' },
      h('input', { name: 'shared-note' }) // Usa namespace ~user2
    )
  );
}
```

### Contesto dei Namespace

I namespace in Shogun NoDom funzionano attraverso un sistema di contesto:

1. **Risalita nel DOM**: Quando si accede a un segnale, il sistema cerca l'attributo namespace risalendo nell'albero DOM.
2. **Stack di contesto**: Durante il rendering, viene mantenuto uno stack di namespace attivi per gestire la nidificazione.
3. **Priorità**: Il namespace viene selezionato con questa priorità:
   - Attributo namespace nell'elemento o nei suoi antenati
   - Contesto corrente di rendering
   - Namespace globale dell'utente autenticato

## 🌐 **Versione Node.js**

Shogun NoDom include anche una versione per Node.js che supporta la reattività e l'autenticazione in ambienti server.

```js
// Server Node.js
import Gun from 'gun';
import { init, setSignal, auth } from 'shogun-nodom/nodom-node.js';

const gun = new Gun();
init(gun);

// Utilizzabile per reattività lato server
const [getConfig, setConfig] = setSignal({ port: 8080 }, { key: 'server-config' });

// Autenticazione disponibile anche lato server
await auth('server', 'password');
```

## 🔍 **Esempi Completi**

### Contatore Semplice

```html
<!DOCTYPE html>
<html>
<head>
  <title>Shogun NoDom Counter</title>
</head>
<body>
  <div id="app"></div>
  
  <script src="https://cdn.jsdelivr.net/npm/gun/gun.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gun/sea.js"></script>
  <script type="module">
    import { init, setSignal, setEffect, h } from './nodom.js';
    
    const gun = Gun(['http://localhost:8765/gun']);
    init(gun);
    
    function Counter() {
      const [count, setCount] = setSignal(0, { key: 'counter' });
      
      return h('div', {},
        h('h1', {}, () => `Contatore: ${count()}`),
        h('button', { 
          onclick: () => setCount(count() + 1) 
        }, 'Incrementa')
      );
    }
    
    document.getElementById('app').appendChild(Counter());
  </script>
</body>
</html>
```

### App con Autenticazione e Namespace

```html
<!DOCTYPE html>
<html>
<head>
  <title>Shogun NoDom - Note Private</title>
</head>
<body>
  <div id="auth">
    <input id="username" placeholder="Username">
    <input id="password" type="password" placeholder="Password">
    <button id="loginBtn">Login</button>
  </div>
  <div id="app"></div>
  
  <script src="https://cdn.jsdelivr.net/npm/gun/gun.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/gun/sea.js"></script>
  <script type="module">
    import { init, auth, getNamespace, setSignal, h } from './nodom.js';
    
    const gun = Gun(['http://localhost:8765/gun']);
    init(gun);
    
    document.getElementById('loginBtn').addEventListener('click', async () => {
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      
      try {
        await auth(username, password, true);
        renderApp();
      } catch (err) {
        alert(`Errore: ${err}`);
      }
    });
    
    function renderApp() {
      const namespace = getNamespace();
      
      function Notes() {
        return h('div', { namespace },
          h('h2', {}, `Note di ${document.getElementById('username').value}`),
          h('textarea', { name: 'notes', placeholder: 'Scrivi qui...' }),
          h('div', {}, () => {
            const [getNotes] = setSignal('', { key: 'notes' });
            return `Contenuto salvato: ${getNotes()}`;
          })
        );
      }
      
      const app = document.getElementById('app');
      app.innerHTML = '';
      app.appendChild(Notes());
    }
  </script>
</body>
</html>
```

## 🤝 **Contribuire**

Le contribuzioni sono benvenute! Sentiti libero di:

1. Segnalare bug o problemi
2. Proporre nuove funzionalità
3. Inviare pull request

## 📄 **Licenza**

MIT
