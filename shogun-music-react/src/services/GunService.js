/**
 * Service for handling Gun.js database interactions
 * Versione temporanea semplificata che non dipende da shogun-core
 */
class GunService {
  constructor() {
    this.initialized = false;
    this.clientId = this._generateClientId();
    console.log("GunService (versione semplificata) initialized with client ID:", this.clientId);
  }

  /**
   * Generate a unique client ID
   * @private
   * @returns {string} Unique client ID
   */
  _generateClientId() {
    // Reuse existing ID if present
    if (window.uniqueClientId) {
      return window.uniqueClientId;
    }
    
    // Generate a new ID and save it globally
    const id = 'client_' + Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    window.uniqueClientId = id;
    
    console.log("Generated new client ID:", id);
    return id;
  }
}

// Export singleton instance
const gunService = new GunService();
export default gunService;
