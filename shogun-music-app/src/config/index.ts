/**
 * Configurazione centralizzata dell'applicazione
 */

// Utility per leggere variabili d'ambiente con valori di default
const getEnv = (key: string, defaultValue: string): string => {
  return process.env[key] || defaultValue;
};

// Utility per leggere variabili d'ambiente numeriche con valori di default
const getEnvAsNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

// Impostazioni del server
export const SERVER_CONFIG = {
  // Indirizzo del server API
  apiUrl: getEnv('REACT_APP_API_URL', 'http://localhost:3001'),
  
  // Path di base per le API
  apiBasePath: '/api',
  
  // Timeout per le richieste HTTP (in ms)
  requestTimeout: {
    default: getEnvAsNumber('REACT_APP_REQUEST_TIMEOUT', 10000),     // 10 secondi di default
    upload: getEnvAsNumber('REACT_APP_UPLOAD_TIMEOUT', 60000),       // 60 secondi per upload file
    healthcheck: getEnvAsNumber('REACT_APP_HEALTHCHECK_TIMEOUT', 5000) // 5 secondi per healthcheck
  },
  
  // Token di autenticazione per l'ambiente di sviluppo
  devToken: getEnv('REACT_APP_DEV_TOKEN', 'thisIsTheTokenForReals2'),
  
  // Livello di log
  logLevel: getEnv('REACT_APP_LOG_LEVEL', 'error'),
  
  // Endpoint specifici
  endpoints: {
    healthcheck: '/healthcheck',
    tracks: '/tracks',
    upload: '/upload',
    adminValidate: '/admin/validate',
    deleteTrack: '/tracks' // aggiungeremo l'ID come parametro: `/tracks/${id}`
  }
};

// Utility per costruire URL API completi
export const buildApiUrl = (endpoint: string): string => {
  return `${SERVER_CONFIG.apiBasePath}${endpoint}`;
};

// Utility per ottenere il base URL completo del server API
export const getApiServerUrl = (): string => {
  return SERVER_CONFIG.apiUrl;
};

// Utility per ottenere l'URL completo per un endpoint API
export const getFullApiUrl = (endpoint: string): string => {
  return `${SERVER_CONFIG.apiUrl}${SERVER_CONFIG.apiBasePath}${endpoint}`;
};

// Configurazione per il fallback
export const FALLBACK_CONFIG = {
  // Tempo minimo tra i refresh dei dati (ms)
  refreshCooldown: getEnvAsNumber('REACT_APP_REFRESH_COOLDOWN', 5000),
  
  // Tempo di validità della cache dello stato del server (ms)
  serverStatusCacheTime: getEnvAsNumber('REACT_APP_SERVER_CACHE_TIME', 30000)
};

// Utility di logging configurabile
export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (['debug'].includes(SERVER_CONFIG.logLevel)) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    if (['debug', 'info'].includes(SERVER_CONFIG.logLevel)) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (['debug', 'info', 'warn'].includes(SERVER_CONFIG.logLevel)) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: any[]) => {
    if (['debug', 'info', 'warn', 'error'].includes(SERVER_CONFIG.logLevel)) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
};

export default {
  SERVER_CONFIG,
  FALLBACK_CONFIG,
  buildApiUrl,
  getApiServerUrl,
  getFullApiUrl,
  logger
}; 