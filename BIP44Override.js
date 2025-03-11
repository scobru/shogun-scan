// BIP44Override.js
// Script per correggere la derivazione BIP-44 in Shogun SDK
// Aggiungi questo script come <script> nella tua app

(function() {
  console.log('[BIP44Override] Inizializzazione override BIP-44...');
  
  // Funzione che attende che un oggetto sia disponibile nel global scope
  function waitForObject(objectPath, callback, interval = 100, maxAttempts = 50) {
    let attempts = 0;
    
    const check = function() {
      attempts++;
      
      // Verifica se l'oggetto è disponibile
      const parts = objectPath.split('.');
      let obj = window;
      
      for (const part of parts) {
        if (!obj || !obj[part]) {
          if (attempts < maxAttempts) {
            setTimeout(check, interval);
          } else {
            console.error(`[BIP44Override] Impossibile trovare l'oggetto ${objectPath} dopo ${maxAttempts} tentativi`);
          }
          return;
        }
        obj = obj[part];
      }
      
      // Oggetto trovato, esegui il callback
      callback(obj);
    };
    
    check();
  }
  
  // Sovrascrive il metodo di derivazione BIP-44 nell'istanza SDK
  function overrideDerivation(sdk) {
    if (!sdk || !sdk.walletManager) {
      console.error('[BIP44Override] SDK non valido o mancante walletManager');
      return;
    }
    
    console.log('[BIP44Override] Sostituisco il metodo di derivazione BIP-44 nell\'SDK Shogun');
    
    // Backup del metodo originale
    const originalMethod = sdk.walletManager.derivePrivateKeyFromMnemonic;
    
    // Sovrascrive il metodo con l'implementazione corretta
    sdk.walletManager.derivePrivateKeyFromMnemonic = function(mnemonic, path) {
      console.log(`[BIP44Override] Derivazione BIP-44 standard per path: ${path}`);
      
      try {
        // Verifica che ethers sia disponibile
        if (!window.ethers) {
          console.error('[BIP44Override] ethers.js non è disponibile nel global scope');
          return originalMethod.call(this, mnemonic, path);
        }
        
        // Crea direttamente un HD wallet dalla mnemonica con il path specificato
        const wallet = window.ethers.HDNodeWallet.fromMnemonic(
          window.ethers.Mnemonic.fromPhrase(mnemonic),
          path // Passiamo il path direttamente qui
        );
        
        console.log(`[BIP44Override] Derivato wallet BIP-44 standard per ${path} con indirizzo ${wallet.address}`);
        
        return wallet;
      } catch (error) {
        console.error(`[BIP44Override] Errore nella derivazione BIP-44 del wallet: ${error}`);
        console.log('[BIP44Override] Tornando al metodo di derivazione originale');
        return originalMethod.call(this, mnemonic, path);
      }
    };
    
    // Sovrascrive anche il metodo getStandardBIP44Addresses se esiste
    if (typeof sdk.walletManager.getStandardBIP44Addresses === 'function') {
      const originalGetAddresses = sdk.walletManager.getStandardBIP44Addresses;
      
      sdk.walletManager.getStandardBIP44Addresses = function(mnemonic, count = 5) {
        console.log(`[BIP44Override] Derivazione standard BIP-44 da mnemonica per ${count} indirizzi`);
        
        try {
          if (!window.ethers) {
            console.error('[BIP44Override] ethers.js non è disponibile nel global scope');
            return originalGetAddresses.call(this, mnemonic, count);
          }
          
          const addresses = [];
          for (let i = 0; i < count; i++) {
            // Path standard BIP-44 per Ethereum: m/44'/60'/0'/0/i
            const path = `m/44'/60'/0'/0/${i}`;
            
            // Crea direttamente un HD wallet dalla mnemonica con il path
            const wallet = window.ethers.HDNodeWallet.fromMnemonic(
              window.ethers.Mnemonic.fromPhrase(mnemonic),
              path
            );
            
            addresses.push(wallet.address);
            console.log(`[BIP44Override] Indirizzo ${i}: ${wallet.address} (${path})`);
          }
          
          return addresses;
        } catch (error) {
          console.error(`[BIP44Override] Errore nel calcolo degli indirizzi BIP-44: ${error}`);
          return originalGetAddresses.call(this, mnemonic, count);
        }
      };
    }
    
    console.log('[BIP44Override] Override completato con successo!');
  }
  
  // Attende che l'SDK sia disponibile nel global scope
  console.log('[BIP44Override] In attesa dell\'SDK Shogun...');
  
  // Per prima cosa controlliamo window.shogun
  waitForObject('shogun', function(shogun) {
    console.log('[BIP44Override] Trovato shogun global object');
    overrideDerivation(shogun);
  });
  
  // Controlliamo anche altre possibili posizioni
  waitForObject('shogunSDK', function(sdk) {
    console.log('[BIP44Override] Trovato shogunSDK global object');
    overrideDerivation(sdk);
  });
  
  // Opzione per sostituire dopo l'inizializzazione tramite React hooks
  if (typeof window.overrideShogunSDK !== 'function') {
    window.overrideShogunSDK = function(sdk) {
      console.log('[BIP44Override] Override manuale di SDK');
      overrideDerivation(sdk);
      return sdk; // Restituisce l'SDK modificato
    };
  }
  
  console.log('[BIP44Override] Setup completato, in attesa dell\'SDK...');
})(); 