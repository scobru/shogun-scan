import { ShogunCore } from 'shogun-core';
import { ShogunConnectorOptions } from 'shogun-button-react';

// Initialize SDK
export const sdk = new ShogunCore({
  providerUrl: process.env.REACT_APP_PROVIDER_URL,
  logging: {
    enabled: process.env.NODE_ENV === 'development',
    level: 'debug',
  },
  gundb: {
    peers: [process.env.REACT_APP_PEERS || ''],
    radisk: false,
    multicast: false,
    axe: false,
    localStorage: false,
    authToken: process.env.REACT_APP_AUTH_TOKEN,
  },
  metamask: {
    enabled: true,
  },
  webauthn: {
    enabled: true,
    
  }
});

// Configure options
export const options: ShogunConnectorOptions = {
  appName: 'Shogun Music',
  appDescription: "Un'app musicale decentralizzata",
  appUrl: window.location.origin,
  appIcon: '/logo192.png', // Make sure this exists in your public folder
  
  // Feature toggles
  showMetamask: true,
  showWebauthn: true,
  darkMode: true,
  
  // Network configuration (inherited from SDK config)
  websocketSecure: process.env.NODE_ENV === 'production',
  providerUrl: process.env.REACT_APP_PROVIDER_URL || 'http://localhost:8545',
  didRegistryAddress: process.env.REACT_APP_DID_REGISTRY_ADDRESS || null,
  peers: process.env.REACT_APP_PEERS?.split(',') || [],
  
  // Advanced options
  logging: {
    enabled: process.env.NODE_ENV === 'development',
    level: 'debug',
  },
  timeouts: {
    login: 30000,    // 30 seconds
    signup: 60000,   // 1 minute
    operation: 15000 // 15 seconds
  }
};

// Esporta l'istanza Gun per comodità
export const gun = sdk ? sdk.gun : null;

// Helper per verificare se l'SDK è disponibile
export const withSdk = <T,>(callback: (sdk: any) => T, fallback: T): T => {
  if (!sdk) {
    console.error("SDK Shogun non disponibile");
    return fallback;
  }
  return callback(sdk);
}; 