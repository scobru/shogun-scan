/**
 * DROP Application Configuration
 * Generato automaticamente dal server basato su .env
 * 2025-05-07T23:01:43.020Z
 */

const AppConfig = {
  "FILE_SIZE_LIMIT_MB": 10,
  "MAX_USER_DROPS": 5,
  "RATE_LIMIT": {
    "uploads": {
      "max": 5,
      "period": 3600000
    },
    "downloads": {
      "max": 20,
      "period": 3600000
    }
  },
  "API": {
    "URL": "http://localhost:8765",
    "TOKEN": "thisIsTheTokenForReals"
  },
  "GUNDB": {
    "PEERS": [
      "http://localhost:8765/gun"
    ],
    "LOCAL_STORAGE": false,
    "RADISK": false
  },
  "AUTH": {
    "WEBAUTHN_NAME": "Shogun DROP",
    "WEBAUTHN_ID": null,
    "METAMASK_ENABLED": true
  },
  "IPFS": {
    "GATEWAY": "http://localhost:8080/ipfs"
  },
  "UI": {
    "APP_NAME": "DROP",
    "APP_DESCRIPTION": "Sistema di condivisione file decentralizzato",
    "GITHUB_REPO": "https://github.com/your-repo",
    "THEME": {
      "primary": "#0078ff",
      "accent": "#00c16e",
      "success": "#00c16e",
      "warning": "#ffb801",
      "error": "#ff3d57"
    },
    "BACKGROUND_IMAGES": [
      "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1800&q=80"
    ]
  }
};