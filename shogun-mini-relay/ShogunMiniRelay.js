/**
 * ShogunMiniRelay - Class implementation for Shogun Mini Relay protocol
 * This class can be used in both Node.js (for relay servers) and browser environments (for clients)
 */
class ShogunMiniRelay {
  /**
   * Create a new ShogunMiniRelay instance
   * @param {Object} options - Configuration options
   * @param {Array<string>} options.peers - Array of peer URLs to connect to
   * @param {boolean} options.isServer - Whether this instance is a server or client
   * @param {number} options.port - Port to listen on (server only)
   * @param {string} options.dbPath - Path to database (server only)
   * @param {Object} options.server - HTTP server instance (server only)
   * @param {string} options.username - Username for this client (client only)
   */
  constructor(options = {}) {
    // Load Gun based on environment
    this.Gun = typeof window !== 'undefined' ? window.Gun : require('gun');
    
    // Default options
    this.options = {
      peers: ['http://localhost:8765/gun'],
      isServer: false,
      port: 8765,
      dbPath: 'data/gundata.db',
      server: null,
      username: 'user-' + Math.floor(Math.random() * 1000),
      ...options
    };

    // Server-specific setup
    if (this.options.isServer) {
      this._setupServer();
    }
    
    // Gun initialization with appropriate config
    const gunConfig = {
      peers: this.options.peers,
      localStorage: false,
      radisk: this.options.isServer, // Only use radisk on server
      multicast: false, // More reliable networking
      wire: true,
      axe: true
    };
    
    // Add server-specific config
    if (this.options.isServer) {
      gunConfig.web = this.server;
      gunConfig.file = this.options.dbPath;
    }
    
    // Initialize Gun
    this.gun = this.options.isServer ? 
      new this.Gun(gunConfig) : 
      (typeof window !== 'undefined' && window.gun) || new this.Gun(gunConfig);
      
    // Message node reference
    this.messages = this.gun.get('shogun_message');
    
    // User setup
    this.user = this.gun.user();
    this.username = this.options.username;
    
    // For deduplication of messages
    this.lastProcessedTimestamp = 0;
  }

  /**
   * Set up HTTP server for relay mode
   * @private
   */
  _setupServer() {
    if (!this.options.server) {
      const http = require('http');
      
      // Create HTTP server
      this.server = http.createServer((req, res) => {
        // Set CORS headers for all responses
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Origin, X-Requested-With, Content-Type, Accept'
        );

        // Handle OPTIONS requests (CORS preflight)
        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        if (req.url === '/' || req.url === '/index.html') {
          // Redirect to inbox.html
          res.writeHead(302, { Location: '/inbox.html' });
          res.end();
          return;
        }

        // Default response for other routes (including /gun)
        res.writeHead(200);
        res.end('Gun relay server');
      });

      // Start the server
      this.server.listen(this.options.port, () => {
        console.log(`Server listening on http://localhost:${this.options.port}/`);
      });
    } else {
      this.server = this.options.server;
    }
  }

  /**
   * Send a message
   * @param {string} text - Message text
   * @param {string} [user] - Optional username override
   * @returns {Object} The message object that was sent
   */
  sendMessage(text, user = null) {
    const sender = user || this.username;
    const timestamp = Date.now();
    
    const message = {
      user: sender,
      text: text,
      timestamp: timestamp
    };
    
    this.messages.set(message);
    return message;
  }

  /**
   * Subscribe to messages with a callback
   * @param {Function} callback - Function to call for each message (message, id) => void
   * @returns {Function} Unsubscribe function
   */
  onMessage(callback) {
    // The listener function
    const listener = (message, id) => {
      // Ensure the message is valid
      if (!message || typeof message.text !== 'string' || typeof message.timestamp !== 'number') {
        return;
      }

      // Skip messages we've already processed based on timestamp
      if (this.lastProcessedTimestamp >= message.timestamp) {
        return;
      }
      
      // Update last processed timestamp
      this.lastProcessedTimestamp = message.timestamp;
      
      // Call the callback with the message
      callback(message, id);
    };
    
    // Set up the listener
    const off = this.messages.map().on(listener);
    
    // Return unsubscribe function
    return () => {
      off();
    };
  }

  /**
   * Authenticate a user with the Gun user system
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise} Promise resolving to the user object
   */
  login(username, password) {
    return new Promise((resolve, reject) => {
      this.user.auth(username, password, (ack) => {
        if (ack.err) {
          reject(new Error(ack.err));
          return;
        }
        
        this.username = username;
        resolve(this.user);
      });
    });
  }

  /**
   * Create a new user
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise} Promise resolving to the user object
   */
  createUser(username, password) {
    return new Promise((resolve, reject) => {
      this.user.create(username, password, (ack) => {
        if (ack.err) {
          reject(new Error(ack.err));
          return;
        }
        
        // Auto login
        this.login(username, password)
          .then(resolve)
          .catch(reject);
      });
    });
  }

  /**
   * Log out the current user
   */
  logout() {
    this.user.leave();
    this.username = this.options.username;
  }
  
  /**
   * Get the current user if logged in
   * @returns {Object|null} The current user or null if not logged in
   */
  getCurrentUser() {
    return this.user.is ? this.user : null;
  }
  
  /**
   * Close the connection and server if running
   */
  close() {
    if (this.options.isServer && this.server) {
      this.server.close();
    }
  }
}

// Export for Node.js or make globally available in browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ShogunMiniRelay;
} else if (typeof window !== 'undefined') {
  window.ShogunMiniRelay = ShogunMiniRelay;
} 