import Gun from 'gun';
import { SERVER_CONFIG, logger } from '../config';

class GunService {
  private gunInstance: any;

  constructor() {
    this.initialize();
  }

  initialize(): void {
    try {
      logger.info('Initializing Gun instance');
      
      // Get the server URL from configuration
      const serverUrl = SERVER_CONFIG.apiUrl;
      const gunUrl = `${serverUrl}/gun`;
      
      logger.info(`Connecting to Gun at: ${gunUrl}`);
      
      // Create Gun instance with server peer
      this.gunInstance = Gun({
        peers: [gunUrl],
        localStorage: false,
        radisk: false
      });
      
      // Make Gun available globally
      window.gun = this.gunInstance;
      
      // Add connection status logging
      this.gunInstance.on('hi', (peer) => {
        logger.info(`Connected to Gun peer: ${peer}`);
      });
      
      this.gunInstance.on('bye', (peer) => {
        logger.warn(`Disconnected from Gun peer: ${peer}`);
      });
      
      logger.info('Gun instance initialized');
    } catch (error) {
      logger.error('Error initializing Gun:', error);
      this.gunInstance = null;
    }
  }

  getGun(): any {
    return this.gunInstance;
  }

  isInitialized(): boolean {
    return !!this.gunInstance;
  }
}

// Export a singleton instance
const gunService = new GunService();
export default gunService; 