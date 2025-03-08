import 'https://cdn.jsdelivr.net/npm/ipfs-core/dist/index.min.js';

// Flag per tenere traccia se il callback è già stato chiamato
let callbackCalled = false;

export const initializeIpfs = async (window, callback) => {
  console.log('Initializing IPFS');
  
  // Funzione per chiamare il callback una sola volta
  const safeCallback = () => {
    if (!callbackCalled && callback) {
      console.log('Chiamata callback di inizializzazione IPFS');
      callbackCalled = true;
      callback();
    }
  };
  
  // Timeout principale - garantisce che l'applicazione proceda dopo 1 secondo
  setTimeout(() => {
    console.log('IPFS initialization timeout - proceeding anyway');
    safeCallback();
  }, 1000);
  
  try {
    // Verifica se IpfsCore è disponibile globalmente
    if (!window.IpfsCore) {
      console.error('IpfsCore non disponibile globalmente');
      safeCallback();
      return;
    }
    
    // Tenta di inizializzare IPFS con un timeout molto breve
    try {
      console.log('Tentativo di creazione nodo IPFS...');
      const node = await Promise.race([
        window.IpfsCore.create({
          repo: 'ipfs-' + Math.random(),
          start: true
        }),
        // Timeout interno per la creazione del nodo (1 secondo)
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout creazione nodo IPFS')), 1000)
        )
      ]);
      
      if (node) {
        window.ipfs = node;
        const nodeStatus = node.isOnline() ? 'online' : 'offline';
        console.log('Node status:', nodeStatus);
      }
      
      // Chiamiamo il callback dopo aver inizializzato con successo
      safeCallback();
    } catch (ipfsError) {
      console.error('Error creating IPFS node:', ipfsError);
      // Chiamiamo il callback anche in caso di errore
      safeCallback();
    }
  } catch (error) {
    console.error('Error in IPFS initialization process:', error);
    safeCallback();
  } finally {
    console.log('Initialized IPFS (finally block)');
    // Assicuriamo che il callback venga chiamato in ogni caso
    setTimeout(safeCallback, 100);
  }
};
