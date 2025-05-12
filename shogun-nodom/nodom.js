let currentObserver = null;
let gun = null; // non è subito istanziato!
let currentUser = null; // riferimento all'utente attualmente autenticato
let currentNamespace = null; // namespace corrente
let namespaceContext = []; // stack di namespace per gestire il contesto nidificato

export const Fragment = Symbol("Fragment");

export function init(gunInstance) {
  gun = gunInstance;
}

/**
 * Risolve una chiave in base al namespace corrente o al contesto
 * @param {string} key - La chiave originale
 * @param {Element} [element] - Elemento DOM opzionale da cui leggere l'attributo namespace
 * @returns {string} - La chiave con il namespace applicato se necessario
 */
function resolveKey(key, element) {
  if (!key) return key;

  // Se la chiave inizia già con ~, è già un namespace completo
  if (key.startsWith("~")) return key;

  // 1. Prima priorità: controllo se l'elemento ha un attributo namespace
  if (element) {
    try {
      let currentElement = element;

      // Risaliamo l'albero DOM cercando l'attributo namespace
      while (currentElement) {
        if (
          currentElement.getAttribute &&
          currentElement.getAttribute("namespace")
        ) {
          const elementNamespace = currentElement.getAttribute("namespace");
          // Debug: console.log(`[resolveKey] Trovato attributo namespace: ${elementNamespace} per chiave: ${key}`);
          return `${elementNamespace}.${key}`;
        }
        currentElement = currentElement.parentNode;
      }
    } catch (err) {
      console.warn(
        `[resolveKey] Errore nella ricerca dell'attributo namespace:`,
        err
      );
    }
  }

  // 2. Seconda priorità: utilizziamo il namespace di contesto se disponibile
  const nsToUse =
    namespaceContext.length > 0
      ? namespaceContext[namespaceContext.length - 1]
      : null;
  if (nsToUse) {
    // Debug: console.log(`[resolveKey] Usando namespace di contesto: ${nsToUse} per chiave: ${key}`);
    return `${nsToUse}.${key}`;
  }

  // 3. Terza priorità: utilizziamo il namespace globale se disponibile
  if (currentNamespace) {
    // Debug: console.log(`[resolveKey] Usando namespace globale: ${currentNamespace} per chiave: ${key}`);
    return `${currentNamespace}.${key}`;
  }

  // Nessun namespace trovato, ritorniamo la chiave originale
  return key;
}

export function setSignal(initialValue, options = {}) {
  const { key, element } = options || {};
  const subscribers = new Set();
  let value = initialValue;

  // Risolviamo la chiave con il namespace se necessario
  const resolvedKey = key ? resolveKey(key, element) : null;

  // Debug: console.log(`[setSignal] Chiave originale: ${key}, Chiave risolta: ${resolvedKey}, Elemento:`, element);

  if (resolvedKey && gun) {
    // Store per chiave risolta, per recuperare le istanze esistenti di signal con la stessa chiave
    if (!window._nodomSignalStore) {
      window._nodomSignalStore = new Map();
    }

    // Verifichiamo se esiste già un signal con questa chiave
    if (window._nodomSignalStore.has(resolvedKey)) {
      const existingSignal = window._nodomSignalStore.get(resolvedKey);
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
      // Debug: console.log(`[setSignal] Impostato valore in GunDB: ${newValue} per chiave: ${resolvedKey}`);
    }
    subscribers.forEach((fn) => fn());
  };

  const signal = [read, write];

  // Memorizziamo il signal per riutilizzarlo
  if (resolvedKey && gun) {
    window._nodomSignalStore.set(resolvedKey, signal);
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

const SVG_NS = "http://www.w3.org/2000/svg";
const isSvg = (tag) =>
  /^(svg|path|circle|rect|line|polygon|polyline|ellipse|g|text|defs|use)$/.test(
    tag
  );

function insertChildren(parent, children) {
  if (!children) return;
  const childArray = Array.isArray(children) ? children.flat() : [children];
  for (const child of childArray) {
    if (child == null || typeof child === "boolean") continue;
    if (typeof child === "function") {
      const marker = document.createComment("");
      let lastNode = null;
      parent.appendChild(marker);
      setEffect(() => {
        const value = child();
        if (lastNode) {
          if (typeof last === "object" && lastNode.nodeType) {
            lastNode.remove();
          } else {
            const next = marker.nextSibling;
            if (next && next.nodeType === 3) next.remove();
          }
        }
        if (value != null) {
          const newNode =
            typeof value === "object" && value.nodeType
              ? value
              : document.createTextNode(String(value));
          if (marker.parentNode) {
            marker.parentNode.insertBefore(newNode, marker.nextSibling);
            lastNode = newNode;
          }
        } else {
          lastNode = null;
        }
      });
    } else {
      parent.appendChild(
        typeof child === "object" && child.nodeType
          ? child
          : document.createTextNode(String(child))
      );
    }
  }
}

export function jsx(type, props = {}) {
  // Gestione del namespace di contesto
  let oldNamespaceContext = null;
  if (props && props.namespace) {
    oldNamespaceContext = [...namespaceContext];
    namespaceContext.push(props.namespace);
    // Rimuoviamo la proprietà namespace per non aggiungerla come attributo
    delete props.namespace;
  }

  if (type === Fragment) {
    const fragment = document.createDocumentFragment();
    insertChildren(fragment, props.children);

    // Ripristina il contesto del namespace
    if (oldNamespaceContext !== null) {
      namespaceContext = oldNamespaceContext;
    }

    return fragment;
  }

  if (typeof type === "function") {
    const result = type(props);

    // Ripristina il contesto del namespace
    if (oldNamespaceContext !== null) {
      namespaceContext = oldNamespaceContext;
    }

    return result;
  }

  const el = isSvg(type)
    ? document.createElementNS(SVG_NS, type)
    : document.createElement(type);

  for (const key in props) {
    if (key === "children" || key === "ref" || key === "namespace") continue;
    if (key.startsWith("on") && typeof props[key] === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), props[key]);
    } else if (key === "style" && typeof props[key] === "object") {
      Object.assign(el.style, props[key]);
    } else if (key === "className" || key === "class") {
      el.setAttribute("class", props[key]);
    } else if (typeof props[key] !== "function") {
      el.setAttribute(key, props[key]);
    }
  }

  // ** Automatic input binding **
  if (props.name && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
    // Utilizziamo la chiave risolta con il namespace di contesto o attributo
    const resolvedKey = resolveKey(props.name, el);

    // Creiamo un signal con il valore attuale dell'input
    const initialValue = el.value || "";
    const [get, set] = setSignal(initialValue, {
      key: resolvedKey,
      element: el,
    });

    // Sincronizziamo l'input col valore dal DB
    el.value = get();

    // Aggiorniamo l'input quando cambia il valore in Gun
    setEffect(() => {
      const currentValue = get();
      if (el.value !== currentValue) {
        el.value = currentValue;
      }
    });

    // Aggiorniamo Gun quando cambia l'input
    el.addEventListener("input", (e) => {
      set(e.target.value);
    });
  }

  if (props.ref && typeof props.ref === "function") {
    props.ref(el);
  }

  insertChildren(el, props.children);

  // Ripristina il contesto del namespace
  if (oldNamespaceContext !== null) {
    namespaceContext = oldNamespaceContext;
  }

  return el;
}

export function h(type, props, ...children) {
  props = props || {};
  if (children.length)
    props.children = children.length === 1 ? children[0] : children;
  return jsx(type, props);
}

/**
 * Autentica un utente con Gun e imposta il namespace corrente
 * @param {string} username - Username
 * @param {string} password - Password
 * @param {boolean} createIfNeeded - Se true, crea l'utente se non esiste
 * @returns {Promise<object>} - Risultato dell'autenticazione
 */
export async function auth(username, password, createIfNeeded = true) {
  if (!gun)
    throw new Error(
      "joy-lite: Gun instance not initialized. Call init(gun) first."
    );

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
                console.log(
                  `Your namespace is publicly available at ${currentNamespace}`
                );
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
        console.log(
          `Your namespace is publicly available at ${currentNamespace}`
        );
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

  // Formato del namespace: ~[pubKey].[pubKey-hash]
  const pubKey = currentUser.is.pub;
  if (!pubKey) {
    currentNamespace = null;
    return;
  }

  // In JOY, usa un hash del pub key come seconda parte del namespace
  // Per semplicità, utilizzeremo solo il pub key direttamente
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
 * Crea un componente contenitore con namespace applicato
 * @param {string} namespace - Il namespace da applicare
 * @param {Function|Node} component - Il componente da renderizzare
 * @returns {Function} - Un componente con il namespace applicato
 */
export function withNamespace(namespace, component) {
  return (props = {}) => {
    // Se component è già un nodo DOM, lo avvolgiamo in un div con namespace
    if (component instanceof Node) {
      const wrapper = document.createElement("div");
      wrapper.setAttribute("namespace", namespace);
      wrapper.appendChild(component);
      return wrapper;
    }

    // Altrimenti, creiamo un nuovo componente con il namespace applicato
    return jsx("div", { namespace, ...props }, component);
  };
}

export default {
  setSignal,
  setEffect,
  setMemo,
  jsx,
  h,
  Fragment,
  auth,
  getNamespace,
  logout,
  setNamespace,
  withNamespace,
};
