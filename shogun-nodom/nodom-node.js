// nodom-node.js

let currentObserver = null;
let gun = null;
let currentUser = null; // riferimento all'utente attualmente autenticato
let currentNamespace = null; // namespace corrente
let namespaceContext = []; // stack di namespace per gestire il contesto nidificato

export function init(gunInstance) {
  gun = gunInstance;
}

/**
 * Risolve una chiave in base al namespace corrente o al contesto
 * @param {string} key - La chiave originale
 * @returns {string} - La chiave con il namespace applicato se necessario
 */
function resolveKey(key) {
  if (!key) return key;
  
  // Se la chiave inizia già con ~, è già un namespace completo
  if (key.startsWith("~")) return key;
  
  // 1. Prima priorità: utilizziamo il namespace di contesto se disponibile
  const nsToUse = namespaceContext.length > 0 ? namespaceContext[namespaceContext.length - 1] : null;
  if (nsToUse) {
    return `${nsToUse}.${key}`;
  }
  
  // 2. Seconda priorità: utilizziamo il namespace globale se disponibile
  if (currentNamespace) {
    return `${currentNamespace}.${key}`;
  }
  
  // Nessun namespace trovato, ritorniamo la chiave originale
  return key;
}

export function setSignal(initialValue, options = {}) {
  const { key } = options || {};
  const subscribers = new Set();
  let value = initialValue;

  // Risolviamo la chiave con il namespace se necessario
  const resolvedKey = key ? resolveKey(key) : null;

  if (resolvedKey && gun) {
    // Store per chiave risolta, per recuperare le istanze esistenti di signal con la stessa chiave
    if (!global._nodomSignalStore) {
      global._nodomSignalStore = new Map();
    }
    
    // Verifichiamo se esiste già un signal con questa chiave
    if (global._nodomSignalStore.has(resolvedKey)) {
      const existingSignal = global._nodomSignalStore.get(resolvedKey);
      // Aggiungiamo gli observer all'istanza esistente
      return existingSignal;
    }
    
    const node = gun.get(resolvedKey);
    
    // Recuperiamo il valore iniziale
    let initializing = true;
    node.once((data) => {
      if (data && data.value !== undefined) {
        value = data.value;
        if (!initializing) {
          subscribers.forEach((fn) => fn());
        }
      }
    });
    initializing = false;
    
    // Ascoltiamo i cambiamenti
    node.on((data) => {
      if (data && data.value !== undefined) {
        value = data.value;
        subscribers.forEach((fn) => fn());
      }
    });
  }

  const read = () => {
    if (currentObserver) subscribers.add(currentObserver);
    return value;
  };

  const write = (newValue) => {
    value = typeof newValue === "function" ? newValue(value) : newValue;
    if (resolvedKey && gun) {
      gun.get(resolvedKey).put({ value });
    }
    subscribers.forEach((fn) => fn());
  };

  const signal = [read, write];
  
  // Memorizziamo il signal per riutilizzarlo
  if (resolvedKey && gun) {
    global._nodomSignalStore.set(resolvedKey, signal);
  }
  
  return signal;
}

export function setEffect(fn) {
  const execute = () => {
    currentObserver = execute;
    fn();
    currentObserver = null;
  };
  execute();
}

export function setMemo(fn) {
  const [get, set] = setSignal();
  setEffect(() => set(fn()));
  return get;
}

/**
 * Autentica un utente con Gun e imposta il namespace corrente
 * @param {string} username - Username
 * @param {string} password - Password
 * @param {boolean} createIfNeeded - Se true, crea l'utente se non esiste
 * @returns {Promise<object>} - Risultato dell'autenticazione
 */
export async function auth(username, password, createIfNeeded = true) {
  if (!gun) throw new Error("nodom: Gun instance not initialized. Call init(gun) first.");

  return new Promise((resolve, reject) => {
    gun.user().auth(username, password, (ack) => {
      if (ack.err && createIfNeeded) {
        gun.user().create(username, password, (createAck) => {
          if (createAck.err) {
            console.error("Failed to create user:", createAck.err);
            reject(createAck.err);
          } else {
            console.log("User created, logging in...");
            gun.user().auth(username, password, (loginAck) => {
              if (loginAck.err) {
                console.error("Failed to login after create:", loginAck.err);
                reject(loginAck.err);
              } else {
                // Imposta l'utente corrente e ottieni il namespace
                currentUser = gun.user();
                updateNamespace();
                console.log("User logged in successfully!");
                console.log(`Your namespace is publicly available at ${currentNamespace}`);
                resolve({ success: true, namespace: currentNamespace });
              }
            });
          }
        });
      } else if (ack.err) {
        console.error("Authentication error:", ack.err);
        reject(ack.err);
      } else {
        // Imposta l'utente corrente e ottieni il namespace
        currentUser = gun.user();
        updateNamespace();
        console.log("User logged in successfully!");
        console.log(`Your namespace is publicly available at ${currentNamespace}`);
        resolve({ success: true, namespace: currentNamespace });
      }
    });
  });
}

/**
 * Aggiorna il namespace corrente in base all'utente autenticato
 */
function updateNamespace() {
  if (!currentUser || !currentUser.is) {
    currentNamespace = null;
    return;
  }
  
  // Formato del namespace: ~[pubKey]
  const pubKey = currentUser.is.pub;
  if (!pubKey) {
    currentNamespace = null;
    return;
  }
  
  currentNamespace = `~${pubKey}`;
}

/**
 * Ottieni il namespace corrente dell'utente autenticato
 * @returns {string|null} - Il namespace corrente o null se non autenticato
 */
export function getNamespace() {
  return currentNamespace;
}

/**
 * Logout dell'utente corrente
 */
export function logout() {
  if (!gun) return;
  
  gun.user().leave();
  currentUser = null;
  currentNamespace = null;
  console.log("User logged out");
}

/**
 * Imposta manualmente un namespace specifico
 * @param {string} namespace - Il namespace da utilizzare
 */
export function setNamespace(namespace) {
  if (!namespace) {
    currentNamespace = null;
    return;
  }
  
  // Verifichiamo che il namespace abbia il formato corretto
  if (!namespace.startsWith("~")) {
    console.warn("Namespace should start with ~");
    namespace = `~${namespace}`;
  }
  
  currentNamespace = namespace;
  console.log(`Namespace set to: ${currentNamespace}`);
}

/**
 * Crea un contesto con namespace
 * @param {string} namespace - Il namespace da applicare
 * @param {Function} callback - La funzione da eseguire nel contesto
 * @returns {*} - Il risultato della callback
 */
export function withNamespaceContext(namespace, callback) {
  // Salviamo il contesto attuale
  const oldContext = [...namespaceContext];
  
  // Aggiungiamo il nuovo namespace al contesto
  namespaceContext.push(namespace);
  
  // Eseguiamo la callback nel nuovo contesto
  const result = callback();
  
  // Ripristiniamo il contesto precedente
  namespaceContext = oldContext;
  
  return result;
}

export default { 
  init, 
  setSignal, 
  setEffect, 
  setMemo, 
  auth, 
  getNamespace, 
  logout, 
  setNamespace, 
  withNamespaceContext 
};
