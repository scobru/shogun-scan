// nodom-node.js

let currentObserver = null;
let gun = null;
let currentUser = null; // reference to the currently authenticated user
let currentNamespace = null; // current namespace
let namespaceContext = []; // namespace stack to manage nested context

export function init(gunInstance) {
  gun = gunInstance;
}

/**
 * Resolves a key based on the current namespace or context
 * @param {string} key - The original key
 * @returns {string} - The key with namespace applied if necessary
 */
function resolveKey(key) {
  if (!key) return key;
  
  // If the key already starts with ~, it's already a complete namespace
  if (key.startsWith("~")) return key;
  
  // 1. First priority: use context namespace if available
  const nsToUse = namespaceContext.length > 0 ? namespaceContext[namespaceContext.length - 1] : null;
  if (nsToUse) {
    return `${nsToUse}.${key}`;
  }
  
  // 2. Second priority: use global namespace if available
  if (currentNamespace) {
    return `${currentNamespace}.${key}`;
  }
  
  // No namespace found, return the original key
  return key;
}

export function setSignal(initialValue, options = {}) {
  const { key } = options || {};
  const subscribers = new Set();
  let value = initialValue;

  // Resolve the key with namespace if necessary
  const resolvedKey = key ? resolveKey(key) : null;

  if (resolvedKey && gun) {
    // Store for resolved key, to retrieve existing signal instances with the same key
    if (!global._nodomSignalStore) {
      global._nodomSignalStore = new Map();
    }
    
    // Check if a signal with this key already exists
    if (global._nodomSignalStore.has(resolvedKey)) {
      const existingSignal = global._nodomSignalStore.get(resolvedKey);
      // Add observers to the existing instance
      return existingSignal;
    }
    
    const node = gun.get(resolvedKey);
    
    // Retrieve the initial value
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
    
    // Listen for changes
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
  
  // Store the signal for reuse
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
 * Authenticates a user with Gun and sets the current namespace
 * @param {string} username - Username
 * @param {string} password - Password
 * @param {boolean} createIfNeeded - If true, creates the user if it doesn't exist
 * @returns {Promise<object>} - Authentication result
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
                // Set current user and get namespace
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
        // Set current user and get namespace
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
 * Updates the current namespace based on the authenticated user
 */
function updateNamespace() {
  if (!currentUser || !currentUser.is) {
    currentNamespace = null;
    return;
  }
  
  // Namespace format: ~[pubKey]
  const pubKey = currentUser.is.pub;
  if (!pubKey) {
    currentNamespace = null;
    return;
  }
  
  currentNamespace = `~${pubKey}`;
}

/**
 * Gets the current namespace of the authenticated user
 * @returns {string|null} - The current namespace or null if not authenticated
 */
export function getNamespace() {
  return currentNamespace;
}

/**
 * Logs out the current user
 */
export function logout() {
  if (!gun) return;
  
  gun.user().leave();
  currentUser = null;
  currentNamespace = null;
  console.log("User logged out");
}

/**
 * Manually sets a specific namespace
 * @param {string} namespace - The namespace to use
 */
export function setNamespace(namespace) {
  if (!namespace) {
    currentNamespace = null;
    return;
  }
  
  // Verify that the namespace has the correct format
  if (!namespace.startsWith("~")) {
    console.warn("Namespace should start with ~");
    namespace = `~${namespace}`;
  }
  
  currentNamespace = namespace;
  console.log(`Namespace set to: ${currentNamespace}`);
}

/**
 * Creates a context with namespace
 * @param {string} namespace - The namespace to apply
 * @param {Function} callback - The function to execute in the context
 * @returns {*} - The result of the callback
 */
export function withNamespaceContext(namespace, callback) {
  // Save the current context
  const oldContext = [...namespaceContext];
  
  // Add the new namespace to the context
  namespaceContext.push(namespace);
  
  // Execute the callback in the new context
  const result = callback();
  
  // Restore the previous context
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
