// common.js
const Gun = require('gun');
// For Node.js server with Radisk file persistence, Gun typically auto-loads necessary modules.
// If issues arise, you might need to explicitly require them:
// e.g., require('gun/lib/radisk'); require('gun/lib/store'); require('gun/lib/rfs');

/**
 * Creates a Gun client instance for Node.js environments.
 * @param {string[]} peers - Array of peer URLs.
 * @param {object} [options={}] - Configuration options.
 * @param {boolean} [options.useRadisk=false] - Whether to enable Radisk persistence.
 * @param {string} [options.radiskPath=''] - Path for Radisk data store if useRadisk is true.
 *                                           If empty and useRadisk is true, Gun's default ('radata') is used and a warning is issued.
 *                                           In Node.js, this translates to a file/directory path.
 * @returns {Gun} A Gun instance.
 */
function createNodeClient(peers, options = {}) {
  const { useRadisk = false, radiskPath = '' } = options;
  const config = {
    peers,
    localStorage: false, // localStorage is not available/used in Node.js
    radisk: useRadisk,
  };
  if (useRadisk) {
    if (!radiskPath) {
      console.warn('NodeClient: useRadisk is true, but radiskPath is not provided. Using Gun default path (e.g., "radata").');
      config.file = 'radata'; // Gun's default for client-side Radisk if path is not specified
    } else {
      config.file = radiskPath; // In Node.js, 'file' option configures Radisk path
    }
  }
  return Gun(config);
}

/**
 * Creates a Gun client instance for Browser environments.
 * @param {string[]} peers - Array of peer URLs.
 * @param {object} [options={}] - Configuration options.
 * @param {boolean} [options.useLocalStorage=true] - Whether to enable localStorage persistence. Gun uses this by default in browsers.
 * @param {boolean} [options.useRadisk=false] - Whether to enable Radisk persistence.
 * @param {string} [options.radiskPath=''] - Name/path for Radisk store if useRadisk is true.
 *                                           If empty and useRadisk is true, Radisk uses its default name (e.g., 'radata').
 *                                           In browsers, Radisk often uses localStorage or IndexedDB.
 * @returns {Gun} A Gun instance.
 */
function createBrowserClient(peers, options = {}) {
  const {
    useLocalStorage = true,
    useRadisk = false,
    radiskPath = ''
  } = options;

  const config = {
    peers,
    localStorage: useLocalStorage,
    radisk: useRadisk,
  };

  if (useRadisk) {
    // In browsers, if 'file' is set, Radisk uses it as a namespace/key for its storage.
    // If radiskPath is empty, Radisk will use its default behavior (e.g. 'radata' in localStorage).
    if (radiskPath) {
      config.file = radiskPath;
    }
    // If radiskPath is not provided but useRadisk is true, Gun's Radisk will use its default naming (often 'radata').
  }
  // Note: If useLocalStorage is false and useRadisk is true, Radisk will attempt to use IndexedDB or other means if available.
  // If both useLocalStorage and useRadisk are false, data is in-memory for the session.
  return Gun(config);
}

/**
 * Creates a Gun server instance for Node.js environments.
 * Attaches Gun to an HTTP server.
 * @param {number} port - The port for the HTTP server.
 * @param {string[]} peers - Array of peer URLs for meshing.
 * @param {object} [options={}] - Configuration options.
 * @param {string} [options.persistencePath=''] - Path for file-based persistence. Enables Radisk.
 *                                                If empty and enableRadisk is true, Gun's default ('data') is used and a warning is issued.
 * @param {boolean} [options.enableRadisk=true] - Controls Radisk. If persistencePath is set, Radisk is typically active.
 * @returns {Gun} A Gun instance.
 */
function createNodeServer(port, peers, options = {}) {
  const http = require('http');
  const {
    persistencePath = '',
    enableRadisk = true
  } = options;

  // Create an HTTP server instance and start listening.
  // Gun will attach its WebSocket handlers to this server.
  const server = http.createServer().listen(port);
  // Gun itself will log messages like "Relay on port XXXX" or "Server listening..."

  const config = {
    web: server, // Attach Gun to the HTTP server
    peers,
    localStorage: false, // Not applicable for Node.js server
    radisk: enableRadisk,
  };

  if (enableRadisk) {
    if (!persistencePath) {
      console.warn(`NodeServer on port ${port}: Radisk is enabled but no persistencePath is provided. Using Gun default path (e.g., "data").`);
      config.file = 'data'; // Gun's default for server-side persistence if path is not specified
    } else {
      config.file = persistencePath; // 'file' option enables Radisk with file system storage
    }
  }
  // If enableRadisk is false, config.file is not set, so file-based persistence is disabled.
  // Gun will operate in-memory unless other persistence options are configured.

  return Gun(config);
}

module.exports = {
  createNodeClient,
  createBrowserClient,
  createNodeServer,
};
