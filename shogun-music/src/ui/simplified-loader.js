// Script loader semplificato
document.addEventListener('DOMContentLoaded', function() {
  console.log('Caricamento script semplificato');
  
  // Rileva percorso base
  function detectBasePath() {
    const path = window.location.pathname;
    if (path.includes('/shogun-music/')) return '/shogun-music';
    if (path.includes('/shogun-core/')) return '/shogun-core';
    return '..';
  }
  
  const basePath = detectBasePath();
  console.log('Percorso base rilevato:', basePath);
  
  // Carica script in sequenza
  function loadNextScript(scripts, index) {
    if (index >= scripts.length) {
      console.log('Tutti gli script caricati');
      document.dispatchEvent(new CustomEvent('player:loaded'));
      return;
    }
    
    const script = document.createElement('script');
    script.src = scripts[index];
    console.log('Caricamento:', scripts[index]);
    
    script.onload = function() {
      console.log('Caricato:', scripts[index]);
      loadNextScript(scripts, index + 1);
    };
    
    script.onerror = function() {
      console.error('Errore caricamento:', scripts[index]);
      
      // Prova percorso alternativo se è shogun-core
      if (scripts[index].includes('shogun-core.js')) {
        const alternativePath = '/js/shogun-core.js';
        console.log('Tentativo percorso alternativo:', alternativePath);
        
        const altScript = document.createElement('script');
        altScript.src = alternativePath;
        
        altScript.onload = function() {
          console.log('Caricato da percorso alternativo:', alternativePath);
          loadNextScript(scripts, index + 1);
        };
        
        altScript.onerror = function() {
          showError('Impossibile caricare shogun-core.js');
        };
        
        document.head.appendChild(altScript);
      } else {
        showError('Errore caricamento: ' + scripts[index].split('/').pop());
      }
    };
    
    document.head.appendChild(script);
  }
  
  // Mostra messaggi di errore
  function showError(message) {
    console.error(message);
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.top = '10px';
    div.style.left = '50%';
    div.style.transform = 'translateX(-50%)';
    div.style.backgroundColor = 'rgba(255,0,0,0.8)';
    div.style.color = 'white';
    div.style.padding = '15px';
    div.style.borderRadius = '5px';
    div.style.zIndex = '9999';
    div.innerHTML = message + ' <button onclick="location.reload()" style="margin-left:10px;padding:5px 10px;border:none;cursor:pointer">Ricarica</button>';
    document.body.appendChild(div);
  }
  
  // Lista di script da caricare in ordine
  const scripts = [
    `${basePath}/js/shogun-core.js`,
    'https://cdnjs.cloudflare.com/ajax/libs/wavesurfer.js/2.0.4/wavesurfer.min.js',
    `${basePath}/js/app.js`,
    `${basePath}/js/api.js`,
    `${basePath}/js/player.js`
  ];
  
  // Avvia il caricamento
  loadNextScript(scripts, 0);
});

// Quando tutto è caricato
document.addEventListener('player:loaded', function() {
  console.log('Player caricato con successo');
  setTimeout(function() {
    if (typeof initUserContent === 'function') {
      console.log('Inizializzazione contenuti utente');
      initUserContent();
    }
  }, 1000);
}); 