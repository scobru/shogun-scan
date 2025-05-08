/**
 * Configuration Loader for DROP Application
 * 
 * Questo script:
 * 1. Carica il file config.js generato dal server
 * 2. Imposta le variabili CSS globali dai colori configurati
 * 3. Applica le configurazioni all'interfaccia
 */

(function() {
  // Default configuration in case config.js is not loaded properly
  window.DropConfig = window.AppConfig || {
    FILE_SIZE_LIMIT_MB: 10,
    MAX_USER_DROPS: 5,
    RATE_LIMIT: {
      uploads: { max: 5, period: 3600000 },
      downloads: { max: 20, period: 3600000 }
    },
    API: {
      URL: "http://localhost:8765",
      TOKEN: "defaultToken"
    },
    GUNDB: {
      PEERS: ["http://localhost:8765/gun"],
      LOCAL_STORAGE: false,
      RADISK: false
    },
    AUTH: {
      WEBAUTHN_NAME: "Shogun DROP",
      WEBAUTHN_ID: null,
      METAMASK_ENABLED: false
    },
    IPFS: {
      GATEWAY: "http://localhost:8080/ipfs"
    },
    UI: {
      APP_NAME: "DROP",
      APP_DESCRIPTION: "Sistema di condivisione file decentralizzato",
      GITHUB_REPO: "https://github.com/your-repo",
      THEME: {
        primary: "#0078ff",
        accent: "#00c16e",
        success: "#00c16e",
        warning: "#ffb801",
        error: "#ff3d57"
      },
      BACKGROUND_IMAGES: [
        "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1800&q=80",
        "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1800&q=80",
        "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?auto=format&fit=crop&w=1800&q=80",
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1800&q=80"
      ]
    }
  };

  // Apply configurations to CSS variables
  function applyThemeToCSS() {
    const theme = window.DropConfig.UI.THEME;
    
    // Get root element to apply CSS variables
    const root = document.documentElement;
    
    // Apply theme colors to CSS variables
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--primary-light', adjustColor(theme.primary, 30));
    root.style.setProperty('--primary-dark', adjustColor(theme.primary, -30));
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--success', theme.success);
    root.style.setProperty('--warning', theme.warning);
    root.style.setProperty('--error', theme.error);
  }

  // Helper to lighten or darken a color
  function adjustColor(color, amount) {
    return '#' + color.replace(/^#/, '').replace(/../g, color => 
      ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2)
    );
  }

  // Set dynamic background
  function setRandomBackground() {
    const bgImages = window.DropConfig.UI.BACKGROUND_IMAGES;
    const randomBg = bgImages[Math.floor(Math.random() * bgImages.length)];
    const bgElement = document.getElementById('dynamic-bg');
    
    if (bgElement) {
      bgElement.style.backgroundImage = `url('${randomBg}')`;
    }
  }

  // Apply app-specific configurations
  function applyAppConfig() {
    // Set document title
    document.title = `${window.DropConfig.UI.APP_NAME} - File Sharing Decentralizzato`;
    
    // Set size limits for file uploads
    const fileSizeLimitElements = document.querySelectorAll('#fileSizeLimit');
    fileSizeLimitElements.forEach(el => {
      if (el) el.textContent = window.DropConfig.FILE_SIZE_LIMIT_MB;
    });
    
    // Set max drops per user
    const maxDropsElements = document.querySelectorAll('#maxDrops');
    maxDropsElements.forEach(el => {
      if (el) el.textContent = window.DropConfig.MAX_USER_DROPS;
    });

    // Apply app name to elements with id appName
    const appNameElements = document.querySelectorAll('[id*="appName"], [id*="footerAppName"]');
    appNameElements.forEach(el => {
      if (el) el.textContent = window.DropConfig.UI.APP_NAME;
    });
    
    // Set GitHub repo link
    const githubLinkElements = document.querySelectorAll('#githubLink');
    githubLinkElements.forEach(el => {
      if (el) el.href = window.DropConfig.UI.GITHUB_REPO;
    });
  }

  // Initialize when DOM is loaded
  document.addEventListener('DOMContentLoaded', function() {
    // Apply the theme to CSS
    applyThemeToCSS();
    
    // Set random background
    setRandomBackground();
    
    // Apply configuration to app elements
    applyAppConfig();
    
    console.log('DROP configuration applied successfully');
  });
})(); 