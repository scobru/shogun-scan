import { ShogunButton, ShogunButtonProvider, useShogun } from './components/ShogunButton.js';
import { shogunConnector } from './connectors/shogun.js';
import { ShogunConnectorOptions, ShogunConnectorResult } from './types/connector-options';
import { ShogunGunProvider } from './ShogunGunProvider.js';
import { ShogunGunProviderOptions } from './types/gun-provider-options';

// Export components
export { 
  ShogunGunProvider,
  ShogunGunProviderOptions,
  ShogunButton, 
  ShogunButtonProvider, 
  useShogun 
};

// Export connector
export { shogunConnector };

// Export all types
export * from './types.js';

// Export specific connector types for backward compatibility
export { ShogunConnectorOptions, ShogunConnectorResult };
