// protocol.js
(function () {
    // Token di autenticazione
    const METADATA_AUTH_TOKEN = "myMetadataToken123"; // Token per l'autenticazione dei metadati
    const SECRET_TOKEN = "mySecretToken123"; // Token per storage
    
    // Inizializzazione di Shogun Core
    let shogun = null;
    try {
      shogun = initShogunBrowser({
        gundb: {
          peers: ['http://localhost:8765/gun', 'http://localhost:8766/gun'],
          websocket: false,
          localStorage: false,
          radisk: false,
          authToken: METADATA_AUTH_TOKEN
        },
        webauthn: {
          enabled: true,
          rpName: 'Shogun Music App',
          rpId: window.location.hostname
        },
        metamask: {
          enabled: true
        },
        logging: {
          enabled: true,
          level: 'debug',
          prefix: '[Shogun Music]'
        }
      });
    } catch (error) {
      console.error("Errore nell'inizializzazione di Shogun Core:", error);
    }
    
    // Variabili e configurazione iniziale
    let peers = ['http://localhost:8765/gun', 'http://localhost:8766/gun']; // Relay di default
    let gun = null;
    let user = null;
    let musicProtocol = null;
    let songsRef = null;
    let tokensRef = null;
    let nftsRef = null;
    let cachedSongs = {}; // Cache locale per le canzoni
    let cachedNFTs = {}; // Cache locale per gli NFT
    let userTokenBalance = 0; // Bilancio token dell'utente
    let isInitialLoad = true;
    let renderTimeout;
    let lastUpdateTime = 0;
    let updatesSinceLastCheck = 0;
    let loopDetectionTimer = null;
    let isSyncPaused = false;
    let isUserAuthenticated = false; // Traccia lo stato di autenticazione dell'utente
    let reconnectAttempts = 0;
    let maxReconnectAttempts = 5;
    let reconnectTimer = null;
    
    // Costanti per token e NFT
    const MAX_DAILY_CLAIM = 100; // Numero massimo di token che possono essere richiesti giornalmente
    const SECONDS_IN_DAY = 86400; // Secondi in un giorno (per calcolo del prossimo claim)
  
    // Inizializza Gun con gestione errori
    function initGun() {
      try {
        if (shogun) {
          gun = shogun.gun;
        } else {
          gun = Gun({
            peers: peers,
            localStorage: false,
            radisk: false,
            retry: 3000, // Aumenta il tempo di retry
            headers: {
              'Authorization': METADATA_AUTH_TOKEN
            }
          });
        }
        
        // Imposta listeners per gli errori di connessione
        gun.on('hi', peer => {
          console.log(`Connesso al peer: ${peer}`);
          reconnectAttempts = 0; // Reset counter on successful connection
        });
        
        gun.on('bye', peer => {
          console.log(`Disconnesso dal peer: ${peer}`);
        });
        
        // Inizializza le reference
        user = gun.user();
        musicProtocol = gun.get('music-protocol');
        songsRef = musicProtocol.get('songs');
        tokensRef = musicProtocol.get('tokens');
        nftsRef = musicProtocol.get('nfts');
        
        return true;
      } catch (error) {
        console.error("Errore nell'inizializzazione di Gun:", error);
        return false;
      }
    }
    
    // Inizializzazione iniziale
    initGun();
    
    // Funzione di riconnessione
    function attemptReconnect() {
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.error("Numero massimo di tentativi di riconnessione raggiunto.");
        return;
      }
      
      reconnectAttempts++;
      console.log(`Tentativo di riconnessione ${reconnectAttempts}/${maxReconnectAttempts}...`);
      
      // Pulizia cache 
      clearTimeout(reconnectTimer);
      clearTimeout(renderTimeout);
      
      // Tenta di reinizializzare Gun
      if (initGun()) {
        console.log("Riconnessione a Gun completata");
        
        // Verifica lo stato di autenticazione
        checkAuthState();
        
        // Reinizializza dati
        if (isUserAuthenticated) {
          initSongCache();
          initSongSubscription();
          initUserTokens();
          initUserNFTs();
        }
      } else {
        // Pianifica un altro tentativo
        reconnectTimer = setTimeout(attemptReconnect, 5000);
      }
    }
    
    // Verifica se l'utente è già autenticato al caricamento
    function checkAuthState() {
      if (shogun) {
        isUserAuthenticated = shogun.isLoggedIn();
      } else {
        const pub = user && user.is && user.is.pub;
        isUserAuthenticated = !!pub;
      }
      
      if (isUserAuthenticated) {
        // Se l'utente è autenticato, inizializza i token
        initUserTokens();
      }
      
      return isUserAuthenticated;
    }
    
    // Chiamato all'inizializzazione
    checkAuthState();
    
    // Aggiorna l'istanza di Gun (ad esempio, dopo aver aggiunto nuovi relay)
    function updateGunInstance() {
      // Pulisci i timer di riconnessione precedenti
      clearTimeout(reconnectTimer);
      reconnectAttempts = 0;
      
      if (shogun) {
        // Se stiamo usando Shogun, aggiorniamo la sua configurazione
        try {
          shogun = initShogunBrowser({
            gundb: {
              peers: peers,
              websocket: false,
              localStorage: false,
              radisk: false,
              retry: 3000,
              multicast: false,
              axe: false,
              chunk: 1000,
              authToken: METADATA_AUTH_TOKEN
            },
            webauthn: {
              enabled: true,
              rpName: 'Shogun Music App',
              rpId: window.location.hostname
            },
            metamask: {
              enabled: true
            },
            logging: {
              enabled: true,
              level: 'debug',
              prefix: '[Shogun Music]'
            }
          });
          gun = shogun.getGunInstance();
        } catch (error) {
          console.error("Errore nell'aggiornamento di Shogun:", error);
          attemptReconnect();
          return;
        }
      } else {
        // Reinizializza Gun
        if (!initGun()) {
          attemptReconnect();
          return;
        }
      }
      
      // Verifica che le reference siano disponibili
      if (!gun.user || !gun.SEA) {
        console.error("GUN SEA non è disponibile. L'autenticazione potrebbe non funzionare.");
        return;
      }
      
      user = gun.user();
      musicProtocol = gun.get('music-protocol');
      songsRef = musicProtocol.get('songs');
      tokensRef = musicProtocol.get('tokens');
      nftsRef = musicProtocol.get('nfts');
      
      // Verifica lo stato di autenticazione dopo aggiornamento
      checkAuthState();
      
      if (isUserAuthenticated) {
        initSongCache();
        initSongSubscription();
        initUserTokens();
        initUserNFTs();
      }
      console.log("Gun instance aggiornata con relay:", peers);
    }
    
    // Inizializza e carica i token dell'utente
    function initUserTokens() {
      if (!isUserAuthenticated || !user.is || !user.is.pub) {
        console.log("Utente non autenticato. Impossibile inizializzare i token.");
        return;
      }
      
      const userPub = user.is.pub;
      tokensRef.get(userPub).once((userData) => {
        if (userData) {
          userTokenBalance = userData.balance || 0;
          console.log(`Token dell'utente caricati. Bilancio: ${userTokenBalance}`);
          
          // Aggiorna UI se è disponibile la funzione
          if (typeof updateTokenUI === 'function') {
            updateTokenUI(userTokenBalance);
          }
        } else {
          // Inizializza il bilancio token dell'utente se non esiste
          userTokenBalance = 0;
          tokensRef.get(userPub).put({
            balance: 0,
            lastClaim: 0
          });
          console.log("Nuovo account token creato per l'utente");
          
          // Aggiorna UI se è disponibile la funzione
          if (typeof updateTokenUI === 'function') {
            updateTokenUI(0);
          }
        }
      });
      
      // Sottoscrizione al bilancio token con debounce
      let tokenUpdateTimeout = null;
      let lastTokenBalance = userTokenBalance;
      
      tokensRef.get(userPub).on((userData) => {
        if (userData && userData.balance !== undefined && userData.balance !== lastTokenBalance) {
          // Salva il nuovo bilancio
          userTokenBalance = userData.balance;
          lastTokenBalance = userData.balance;
          
          // Annulla eventuali aggiornamenti in sospeso
          clearTimeout(tokenUpdateTimeout);
          
          // Imposta un timeout per l'aggiornamento UI (debounce)
          tokenUpdateTimeout = setTimeout(() => {
            console.log(`Bilancio token aggiornato: ${userTokenBalance}`);
            
            // Aggiorna UI se è disponibile la funzione
            if (typeof updateTokenUI === 'function') {
              updateTokenUI(userTokenBalance);
            }
          }, 300); // Aspetta 300ms prima di aggiornare l'UI
        }
      });
    }
    
    // Inizializzazione e caricamento degli NFT dell'utente
    function initUserNFTs() {
      if (!isUserAuthenticated || !user.is || !user.is.pub) {
        console.log("Utente non autenticato. Impossibile inizializzare gli NFT.");
        return;
      }
      
      const userPub = user.is.pub;
      
      // Svuota la cache NFT locale
      cachedNFTs = {};
      
      // Carica gli NFT dell'utente
      nftsRef.get(userPub).map().once((nft, id) => {
        if (nft && id) {
          cachedNFTs[id] = nft;
          console.log(`NFT caricato: ${nft.songId} #${nft.edition}`);
        }
      });
      
      // Sottoscrizione agli NFT dell'utente
      nftsRef.get(userPub).map().on((nft, id) => {
        if (nft && id) {
          cachedNFTs[id] = nft;
          console.log(`NFT aggiornato: ${nft.songId} #${nft.edition}`);
          
          // Aggiorna UI se è disponibile la funzione
          if (typeof updateNFTUI === 'function') {
            updateNFTUI();
          }
        }
      });
    }
  
    // Aggiunge un nuovo relay all'array e aggiorna l'istanza Gun
    function addRelay(relayUrl) {
      relayUrl = relayUrl.trim();
      if (!relayUrl) return;
      if (!relayUrl.startsWith('http://') && !relayUrl.startsWith('https://')) {
        relayUrl = 'http://' + relayUrl;
      }
      if (peers.includes(relayUrl)) {
        alert('Questo relay è già stato aggiunto!');
        return;
      }
      peers.push(relayUrl);
      updateGunInstance();
      alert('Relay aggiunto: ' + relayUrl);
    }
  
    // Inizializza la cache locale delle canzoni
    function initSongCache() {
      // Verifica autenticazione admin
      const adminToken = localStorage.getItem('adminToken');
      const isAdminAuthenticated = adminToken === METADATA_AUTH_TOKEN;
      
      // Solo se l'utente è autenticato o è admin
      if (!isUserAuthenticated && !isAdminAuthenticated) {
        console.log("Utente non autenticato. Skipping song cache initialization.");
        return;
      }
      
      songsRef.map().once((song, id) => {
        if (song && id && song.title) {
          cachedSongs[id] = song;
          console.log('Canzone aggiunta alla cache:', song.title);
        }
      });
    }
  
    // Sottoscrizione agli aggiornamenti dei brani con debounce per evitare loop
    function initSongSubscription() {
      console.log("Inizializzazione sottoscrizione brani...");
      
      // Verifica autenticazione admin
      const adminToken = localStorage.getItem('adminToken');
      const isAdminAuthenticated = adminToken === METADATA_AUTH_TOKEN;
      
      // Solo se l'utente è autenticato o è admin
      if (!isUserAuthenticated && !isAdminAuthenticated) {
        console.log("Utente non autenticato. Skipping song subscription.");
        return;
      }
      
      // Renderizza subito la lista
      renderSongs();
  
      // Pulizia e inizializzazione delle variabili di controllo degli aggiornamenti
      updatesSinceLastCheck = 0;
      lastUpdateTime = Date.now();
      clearTimeout(renderTimeout);
      
      if (loopDetectionTimer) {
        clearInterval(loopDetectionTimer);
      }
      
      // Timer di rilevamento loop con soglia più alta e pausa più lunga
      loopDetectionTimer = setInterval(() => {
        if (updatesSinceLastCheck > 20) {
          console.warn("Possibile loop di aggiornamenti:", updatesSinceLastCheck, "updates in breve tempo");
          clearTimeout(renderTimeout);
          isSyncPaused = true;
          setTimeout(() => {
            isSyncPaused = false;
            updatesSinceLastCheck = 0;
            lastUpdateTime = Date.now();
            console.log("Sincronizzazione ripresa dopo pausa");
          }, 10000); // Pausa più lunga (10 secondi)
        }
        updatesSinceLastCheck = 0;
      }, 5000);
  
      // Rimuove eventuali listener precedenti per evitare duplicati
      songsRef.map().off();
  
      // Imposta un timer di debounce più lungo per gli aggiornamenti
      let debounceTime = 1000; // 1 secondo di debounce
      
      songsRef.map().on((song, id) => {
        // Ignora aggiornamenti durante la pausa
        if (isSyncPaused) return;
        
        // Ignora oggetti non validi o vuoti
        if (!song || typeof song !== "object" || Object.keys(song).length === 0) return;
        
        // Ignora canzoni eliminate
        if (song.deleted) return;
        
        const now = Date.now();
        // Aumenta la soglia minima tra aggiornamenti
        if (now - lastUpdateTime < 200) {
          updatesSinceLastCheck++;
          // Aumenta la soglia prima di ignorare un aggiornamento
          if (updatesSinceLastCheck > 10) {
            console.warn("Troppi aggiornamenti ravvicinati, ignoro questo:", id);
            return;
          }
        }
        lastUpdateTime = now;
        updatesSinceLastCheck++;
  
        const cachedSong = cachedSongs[id];
        let hasChanged = false;
        
        // Determina se il brano è cambiato
        if (!cachedSong) {
          hasChanged = true;
        } else {
          // Confronto più profondo dei campi chiave
          hasChanged =
            song.title !== cachedSong.title ||
            song.artist !== cachedSong.artist ||
            song.fileUrl !== cachedSong.fileUrl ||
            song.artworkUrl !== cachedSong.artworkUrl ||
            song.mintPrice !== cachedSong.mintPrice ||
            song.totalEditions !== cachedSong.totalEditions ||
            song.mintedEditions !== cachedSong.mintedEditions;
        }
        
        if (hasChanged) {
          // Aggiorna la cache con i nuovi dati
          cachedSongs[id] = song;
          
          // Debounce per il rendering
          clearTimeout(renderTimeout);
          renderTimeout = setTimeout(() => {
            console.log("Aggiornamento rilevato, rendering...");
            renderSongs();
          }, debounceTime);
        }
      });
    }
  
    // Renderizza la lista dei brani nell'elemento con id "songList"
    function renderSongs() {
      // Determina l'ID dell'elemento lista in base alla pagina corrente
      let songListId = "songList"; // Default per index.html (player)
      
      // Controlla se siamo nella pagina admin.html
      const isAdminPage = window.location.href.indexOf("admin.html") > -1;
      if (isAdminPage) {
        songListId = "adminSongList"; // Per admin.html
      }
      
      const songList = document.getElementById(songListId);
      if (!songList) {
        console.error(`Elemento '${songListId}' non trovato in pagina.`);
        return;
      }
      
      // Verifica autenticazione standard o amministrativa
      const adminToken = localStorage.getItem('adminToken');
      const isAdminAuthenticated = adminToken === METADATA_AUTH_TOKEN;
      
      // Verifica stato autenticazione corrente
      checkAuthState();
      
      // Solo se l'utente è autenticato o ha token admin valido
      if (!isUserAuthenticated && !isAdminAuthenticated) {
        songList.innerHTML = '<div class="alert alert-info text-center">Effettua il login per visualizzare i brani</div>';
        return;
      }
      
      // Carica i brani se non sono stati ancora caricati (usa la cache esistente qui)
      if (Object.keys(cachedSongs).length === 0) {
        console.log("Nessuna canzone in cache, caricamento iniziale...");
        let songsLoaded = false;
        songsRef.map().once((song, id) => {
          if (song && id && song.title && !song.deleted) {
            cachedSongs[id] = song;
            songsLoaded = true;
          }
        });
        
        if (!songsLoaded) {
          console.log("Caricamento iniziale terminato, nessun brano trovato.");
          songList.innerHTML = '<div class="alert alert-info text-center">Nessun brano trovato</div>';
          return;
        } else {
           console.log(`Caricamento iniziale terminato, ${Object.keys(cachedSongs).length} brani in cache.`);
        }
      }
      
      const songIds = Object.keys(cachedSongs);
      const songCount = songIds.length;
      
      // Se non ci sono brani, mostra messaggio
      if (songCount === 0) {
        songList.innerHTML = '<div class="alert alert-info text-center">Nessun brano trovato</div>';
        return;
      }

      // Array per contenere le promise (per le letture asincrone in admin)
      const renderPromises = [];

      // Cicla attraverso gli ID delle canzoni dalla cache
      songIds.forEach(id => {
        const cachedSong = cachedSongs[id];
          
        // Se la canzone nella cache non è valida o è marcata come eliminata, salta
        if (!cachedSong || !cachedSong.title || !cachedSong.artist || cachedSong.deleted) {
          return; // Salta questa iterazione
        }

        // Funzione interna per generare l'HTML di una singola canzone
        const generateSongHTML = (songData, songId) => {
          let currentHTML = '';
          let artworkHTML = "";
          if (songData.artworkUrl) {
            artworkHTML = `<img src="${songData.artworkUrl}" class="artwork-img" alt="Artwork: ${songData.title}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjZGRkZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMTIiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGFsaWdubWVudC1iYXNlbGluZT0ibWlkZGxlIiBmaWxsPSIjOTk5OTk5Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4='" />`;
          } else {
            artworkHTML = `<div class="artwork-img" style="background-color:#ddd; display:inline-block;"></div>`;
          }
          let durationHTML = "";
          if (songData.duration) {
            const minutes = Math.floor(songData.duration / 60);
            const seconds = songData.duration % 60;
            durationHTML = `<div class="text-muted small">${minutes}:${seconds.toString().padStart(2, "0")}</div>`;
          }
        
          // Informazioni sulle edizioni NFT
          let editionsHTML = "";
          // **Determina hasEditions basandosi sui dati forniti (che possono essere live o cached)**
          const hasEditions = songData.mintPrice !== undefined && songData.totalEditions !== undefined;
          let mintedCount = songData.mintedEditions || 0;
          let availableEditions = 0;
          let canMint = false;

          if (hasEditions) {
            availableEditions = songData.totalEditions - mintedCount;
            canMint = availableEditions > 0;

            if (isAdminPage) {
              // Mostra solo le info se hasEditions è true
              editionsHTML = `
                <div class="mt-1 small">
                  <span class="badge bg-info me-1">Prezzo: ${songData.mintPrice} token</span>
                  <span class="badge bg-secondary me-1">Edizioni: ${mintedCount}/${songData.totalEditions}</span>
                </div>`;
            } else {
              // Per la pagina player, aggiungi pulsante per mintare
              // AGGIUNTA LOGGING PER DEBUG ISSUE 2
              console.log(`Player Render Check (Song ID: ${songId}): Price=${songData.mintPrice}, Total=${songData.totalEditions}, Minted=${mintedCount}, Available=${availableEditions}, CanMint=${canMint}`);
              
              editionsHTML = `
                <div class="mt-1">
                  <span class="badge bg-info me-1">Prezzo: ${songData.mintPrice} token</span>
                  <span class="badge bg-secondary me-1">Edizioni: ${mintedCount}/${songData.totalEditions}</span>
                  ${canMint ? 
                    `<button class="btn btn-sm btn-outline-success mint-btn ms-2" onclick="event.stopPropagation(); Protocol.mintEdition('${songId}', function(err, msg){ if(err) alert('Errore Mint: ' + err); else alert(msg || \'Edizione mintata!\'); })">
                      Minta edizione
                    </button>` : 
                    '<span class="badge bg-danger ms-2">Sold out</span>'}
                </div>`;
            }
          }
        
          // Personalizza il template in base alla pagina (admin o player)
          if (isAdminPage) {
            // Template per admin page con pulsante di eliminazione e campi edizione
            let editionSettingsHTML = "";
            
            // Mostra i campi input SOLO se le edizioni NON sono state impostate/frozen
            if (!hasEditions) {
               console.log(`Admin Render Check (Song ID: ${songId}): Rendering inputs, hasEditions=false`);
               editionSettingsHTML = `
                <div class="mt-2 edition-settings">
                  <div class="input-group input-group-sm">
                    <input type="number" class="form-control" placeholder="Prezzo (token)" id="mintPrice-${songId}" min="1" value="">
                    <input type="number" class="form-control" placeholder="Edizioni totali" id="totalEditions-${songId}" min="1" value="">
                    <button class="btn btn-outline-primary" onclick="setEditionDetails('${songId}')">
                      Imposta
                    </button>
                  </div>
                </div>`;
            } else {
               console.log(`Admin Render Check (Song ID: ${songId}): Rendering display, hasEditions=true`);
               // Se le edizioni sono impostate, mostra solo le informazioni (già in editionsHTML)
               editionSettingsHTML = ""; 
            }
            
            currentHTML = `
              <li class="list-group-item">
                <div class="d-flex justify-content-between align-items-center">
                  <div class="d-flex align-items-center">
                    ${artworkHTML}
                    <div class="ms-2">
                       <strong>${songData.title}</strong>
                       <div class="small text-muted">${songData.artist}</div>
                       ${editionsHTML} 
                    </div>
                  </div>
                  <div>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteSong('${songId}')">
                      Elimina
                    </button>
                  </div>
                </div>
                ${editionSettingsHTML} 
              </li>`;
          } else {
            // Template per player page
            currentHTML = `
              <li class="list-group-item" data-song-id="${songId}">
                <div class="d-flex align-items-center" onclick="Protocol.playSong('${songId}')" style="cursor:pointer;">
                   ${artworkHTML}
                   <div class="ms-2 flex-grow-1">
                     <strong>${songData.title}</strong>
                     <div class="small text-muted">${songData.artist}</div>
                     ${durationHTML}
                   </div>
                </div>
                 ${editionsHTML} 
              </li>`;
          }
          return currentHTML;
        }; // Fine generateSongHTML

        // MODIFICA PER ISSUE 1: Se siamo in admin, forza lettura da GunDB per lo stato hasEditions
        if (isAdminPage) {
           // Aggiungi una promise che recupera i dati live e poi genera l'HTML
           const promise = new Promise((resolve, reject) => {
             songsRef.get(id).once(liveSongData => {
               // Usa i dati live da GunDB se disponibili e validi, altrimenti usa la cache
               // Questo assicura che `hasEditions` sia basato sui dati più recenti
               const songToRender = (liveSongData && liveSongData.title && !liveSongData.deleted) ? liveSongData : cachedSong;
               
               // Aggiorna la cache se i dati live sono diversi (opzionale, ma buona pratica)
               if (liveSongData && JSON.stringify(liveSongData) !== JSON.stringify(cachedSong)) {
                  cachedSongs[id] = liveSongData; 
               }

               try {
                 resolve(generateSongHTML(songToRender, id));
               } catch (e) {
                 console.error(`Errore generazione HTML per admin song ${id}:`, e);
                 resolve(''); // Risolve con stringa vuota in caso di errore
               }
             }, {wait: 500}); // Aggiungi un piccolo timeout per dare tempo a Gun di rispondere
           });
           renderPromises.push(promise);
        } else {
           // Per la pagina player, usa la cache per performance. Aggiungi a promises come valore risolto.
           renderPromises.push(Promise.resolve(generateSongHTML(cachedSong, id)));
        }

      }); // Fine forEach

      // Aspetta che tutte le promise (soprattutto le letture GunDB per admin) siano risolte
      Promise.all(renderPromises).then(htmlChunks => {
        // Filtra eventuali chunk vuoti (da errori o canzoni saltate)
        const validHtmlChunks = htmlChunks.filter(chunk => chunk !== '');
        if (validHtmlChunks.length > 0) {
           songList.innerHTML = validHtmlChunks.join('');
        } else {
           // Se tutti i chunk sono vuoti (nessuna canzone valida trovata/renderizzata)
           songList.innerHTML = '<div class="alert alert-info text-center">Nessun brano valido da visualizzare</div>';
        }
        console.log(`Rendering completato per ${songListId}. Brani renderizzati: ${validHtmlChunks.length}/${songCount}`);
      }).catch(error => {
        console.error("Errore durante il rendering dei brani:", error);
        songList.innerHTML = '<div class="alert alert-danger">Errore nel caricamento dei brani.</div>';
      });
    } // Fine renderSongs
  
    // Riproduce la traccia cliccata (utilizzata inline dal markup)
    function playSong(songId) {
      if (!songId) {
        console.error("ID del brano non valido");
        return;
      }

      const song = cachedSongs[songId];
      if (!song || !song.fileUrl) {
        console.error("Brano non trovato o URL file non valido", songId);
        return;
      }

      const audioPlayer = document.getElementById("audioPlayer");
      if (!audioPlayer) {
        console.error("Elemento 'audioPlayer' non trovato in pagina.");
        return;
      }
      
      // Verifica che l'URL del file sia valido
      if (typeof song.fileUrl !== 'string' || !song.fileUrl.startsWith('http')) {
        console.error("URL del file non valido:", song.fileUrl);
        return;
      }
      
      // Rimuove eventuali classi attive da altri elementi
      document.querySelectorAll("#songList li").forEach((li) => li.classList.remove("active", "bg-light"));
      const li = document.querySelector(`#songList li[data-song-id="${songId}"]`);
      if (li) li.classList.add("active", "bg-light");
      
      // Imposta e riproduce la traccia
      audioPlayer.src = song.fileUrl;
      audioPlayer.play().catch(err => {
        console.error("Errore riproduzione:", err.message);
      });
    }
    
    // Funzione per reclamare token giornalieri
    async function claimDailyTokens(callback) {
      if (!isUserAuthenticated || !user.is || !user.is.pub) {
        if (callback) callback("Utente non autenticato", null);
        return;
      }
      
      const userPub = user.is.pub;
      
      // Ottieni i dati correnti dell'utente
      tokensRef.get(userPub).once(async (userData) => {
        if (!userData) {
          // Inizializza l'utente se non esiste
          userData = { balance: 0, lastClaim: 0 };
        }
        
        const now = Math.floor(Date.now() / 1000); // Timestamp corrente in secondi
        const lastClaimTime = userData.lastClaim || 0;
        const timeSinceLastClaim = now - lastClaimTime;
        
        // Verifica se è passato abbastanza tempo dall'ultimo claim (1 giorno)
        if (timeSinceLastClaim < SECONDS_IN_DAY) {
          const timeRemaining = SECONDS_IN_DAY - timeSinceLastClaim;
          const hours = Math.floor(timeRemaining / 3600);
          const minutes = Math.floor((timeRemaining % 3600) / 60);
          
          if (callback) callback(`Puoi reclamare altri token tra ${hours} ore e ${minutes} minuti`, null);
          return;
        }
        
        // Aggiorna il bilancio e il timestamp dell'ultimo claim
        const newBalance = (userData.balance || 0) + MAX_DAILY_CLAIM;
        
        // Aggiorna i dati dell'utente
        tokensRef.get(userPub).put({
          balance: newBalance,
          lastClaim: now
        });
        
        userTokenBalance = newBalance;
        
        if (callback) callback(null, `Hai reclamato con successo ${MAX_DAILY_CLAIM} token!`);
        
        // Aggiorna UI se è disponibile la funzione
        if (typeof updateTokenUI === 'function') {
          updateTokenUI(newBalance);
        }
      });
    }
    
    // Funzione per ottenere il bilancio token dell'utente
    function getTokenBalance() {
      return userTokenBalance;
    }
    
    // Funzione per impostare i dettagli di minting per un brano (admin)
    function setMintingDetails(songId, mintPrice, totalEditions, callback) {
      // Verifica l'autenticazione admin tramite localStorage o autenticazione utente standard
      const adminToken = localStorage.getItem('adminToken');
      const isAdminAuthenticated = adminToken === METADATA_AUTH_TOKEN;
      
      if (!isUserAuthenticated && !isAdminAuthenticated) {
        if (callback) callback("Utente non autenticato", null);
        return;
      }
      
      if (!songId || !cachedSongs[songId]) {
        if (callback) callback("ID brano non valido", null);
        return;
      }
      
      if (isNaN(mintPrice) || mintPrice <= 0 || isNaN(totalEditions) || totalEditions <= 0) {
        if (callback) callback("Prezzo e numero di edizioni devono essere numeri positivi", null);
        return;
      }
      
      // Ottieni la canzone corrente
      const song = cachedSongs[songId];
      
      // Verifica se i dettagli di minting sono già stati impostati (frozen space)
      if (song.mintPrice !== undefined && song.totalEditions !== undefined) {
        if (callback) callback("I dettagli di minting sono già stati impostati e non possono essere modificati", null);
        return;
      }
      
      // Utilizzare once() per garantire l'immutabilità
      songsRef.get(songId).once((existingSong) => {
        if (!existingSong) {
          if (callback) callback("Brano non trovato nel database", null);
          return;
        }
        
        if (existingSong.mintPrice !== undefined || existingSong.totalEditions !== undefined) {
          if (callback) callback("I dettagli di minting sono già stati impostati in un altro client e non possono essere modificati", null);
          return;
        }
        
        // Crea l'oggetto con i dettagli aggiornati
        const updatedSong = {
          ...song,
          mintPrice: parseInt(mintPrice),
          totalEditions: parseInt(totalEditions),
          mintedEditions: 0,
          frozenAt: Date.now() // Timestamp di quando è stato congelato
        };
        
        // Aggiungi la cache prima - strategia optimistic update
        cachedSongs[songId] = updatedSong;
        
        // Imposta i dettagli di minting con retry
        const maxRetries = 3;
        let retryCount = 0;
        
        function tryPut() {
          retryCount++;
          console.log(`Tentativo di salvataggio minting details (${retryCount}/${maxRetries})`);
          
          // Imposta i dettagli di minting una sola volta (frozen)
          songsRef.get(songId).put(updatedSong, (ack) => {
            if (ack.err) {
              console.error("Errore durante il salvataggio:", ack.err);
              
              if (retryCount < maxRetries) {
                // Riprova dopo un breve ritardo
                setTimeout(tryPut, 500);
              } else {
                if (callback) callback(ack.err, null);
              }
            } else {
              // Aggiorna la cache locale immediatamente
              console.log("Dettagli di minting salvati con successo:", songId, updatedSong);
              
              // Verifica che i dati siano stati salvati correttamente
              setTimeout(() => {
                songsRef.get(songId).once((savedSong) => {
                  if (!savedSong || !savedSong.mintPrice || !savedSong.totalEditions) {
                    console.warn("⚠️ I dettagli di minting potrebbero non essere stati salvati correttamente:", savedSong);
                    
                    // Riprova se siamo ancora entro il numero massimo di tentativi
                    if (retryCount < maxRetries) {
                      setTimeout(tryPut, 500);
                    } else {
                      if (callback) callback("Impossibile verificare il salvataggio dei dettagli dopo multipli tentativi", null);
                    }
                  } else {
                    console.log("✅ Dettagli di minting verificati nel database:", savedSong);
                    
                    // Aggiorna la cache una seconda volta per sicurezza
                    cachedSongs[songId] = savedSong;
                    
                    if (callback) callback(null, "Dettagli di minting impostati con successo e congelati");
                  }
                });
              }, 1000);
            }
          });
        }
        
        // Avvia il primo tentativo
        tryPut();
      });
    }
    
    // Funzione per ottenere i dati di una canzone specifica
    function getSong(songId) {
      return cachedSongs[songId] || null;
    }
    
    // Funzione per mintare un'edizione del brano
    async function mintEdition(songId, callback) {
      if (!isUserAuthenticated || !user.is || !user.is.pub) {
        if (callback) callback("Utente non autenticato", null);
        return;
      }
      
      if (!songId || !cachedSongs[songId]) {
        if (callback) callback("ID brano non valido", null);
        return;
      }
      
      const userPub = user.is.pub;
      const song = cachedSongs[songId];
      
      // Verifica se il brano ha impostazioni di minting
      if (!song.mintPrice || !song.totalEditions) {
        if (callback) callback("Questo brano non è disponibile per il minting", null);
        return;
      }
      
      // Verifica se ci sono edizioni disponibili
      const mintedEditions = song.mintedEditions || 0;
      if (mintedEditions >= song.totalEditions) {
        if (callback) callback("Tutte le edizioni sono già state mintate", null);
        return;
      }
      
      // Verifica se l'utente ha abbastanza token
      if (userTokenBalance < song.mintPrice) {
        if (callback) callback(`Token insufficienti. Hai ${userTokenBalance}, ma servono ${song.mintPrice} token`, null);
        return;
      }
      
      // Crea un ID unico per l'NFT
      const nftId = `nft_${songId}_${Date.now()}`;
      
      // Crea l'oggetto NFT
      const nft = {
        songId: songId,
        title: song.title,
        artist: song.artist,
        edition: mintedEditions + 1,
        totalEditions: song.totalEditions,
        mintDate: Date.now(),
        artworkUrl: song.artworkUrl,
        owner: userPub
      };
      
      // Salva l'NFT nell'area frozen di Gun (simulate)
      nftsRef.get(userPub).get(nftId).put(nft);
      
      // Aggiorna il bilancio token dell'utente
      const newBalance = userTokenBalance - song.mintPrice;
      tokensRef.get(userPub).put({
        balance: newBalance,
        lastClaim: tokensRef.get(userPub).lastClaim
      });
      
      // Distribuisci i token del minting
      // 70% all'autore del brano, 15% a ciascun relay
      const creatorPub = song.createdBy;
      if (creatorPub) {
        // Verifica che il creatore non sia l'acquirente (evita auto-pagamenti)
        if (creatorPub === userPub) {
          console.log("Nessun token distribuito: l'acquirente è anche il creatore");
        } else {
          // Assegna i token all'autore (70%)
          const creatorShare = Math.floor(song.mintPrice * 0.7);
          
          // Usa una transazione atomica per aggiornare il bilancio dell'autore
          tokensRef.get(creatorPub).once((creatorData) => {
            const currentBalance = creatorData && creatorData.balance ? creatorData.balance : 0;
            
            // Aggiorna il bilancio solo se l'utente esiste
            if (creatorData) {
              tokensRef.get(creatorPub).put({
                balance: currentBalance + creatorShare,
                lastClaim: creatorData.lastClaim || 0
              });
              console.log(`${creatorShare} token assegnati all'autore ${creatorPub}`);
            }
          });
        }
        
        // Il resto (30%) viene assegnato ai nodi relay
        // Aggiungiamo una traccia della distribuzione per trasparenza
        const relayShare = Math.floor(song.mintPrice * 0.15); // 15% per tipo di relay (storage e metadata)
        
        // Aggiungiamo un record della transazione con ID univoco per evitare duplicati
        const transactionId = `tx_${Date.now()}_${songId}_${userPub}`;
        const transactionData = {
          type: "mint",
          songId: songId,
          edition: mintedEditions + 1,
          price: song.mintPrice,
          buyer: userPub,
          creator: creatorPub,
          creatorShare: creatorPub === userPub ? 0 : Math.floor(song.mintPrice * 0.7),
          relayShare: relayShare * 2, // Totale per i relay
          timestamp: Date.now()
        };
        
        // Verifica se la transazione esiste già prima di salvarla
        musicProtocol.get('transactions').get(transactionId).once((existingTx) => {
          if (!existingTx) {
            // Salviamo la transazione in un nodo transazioni solo se non esiste già
            musicProtocol.get('transactions').get(transactionId).put(transactionData);
            console.log(`Transazione registrata: ${song.mintPrice} token distribuiti`);
          }
        });
      }
      
      // Aggiorna il conteggio delle edizioni mintate
      songsRef.get(songId).put({
        ...song,
        mintedEditions: mintedEditions + 1
      });
      
      // Aggiorna la cache locale
      userTokenBalance = newBalance;
      cachedNFTs[nftId] = nft;
      cachedSongs[songId] = {
        ...song,
        mintedEditions: mintedEditions + 1
      };
      
      // Renderizza brani aggiornati
      renderSongs();
      
      // Aggiorna UI se le funzioni sono disponibili
      if (typeof updateTokenUI === 'function') {
        updateTokenUI(newBalance);
      }
      
      if (typeof updateNFTUI === 'function') {
        updateNFTUI();
      }
      
      if (callback) callback(null, `Hai mintato con successo l'edizione #${nft.edition} di ${song.title}`);
    }
    
    // Funzione per ottenere gli NFT dell'utente
    function getUserNFTs() {
      return cachedNFTs;
    }
  
    // Esegue un fetch una tantum delle tracce (non real-time)
    function fetchTracks(callback) {
      // Verifica stato autenticazione corrente
      checkAuthState();
      
      // Solo se l'utente è autenticato
      if (!isUserAuthenticated) {
        if (callback) callback([]);
        return;
      }
      
      const tracks = [];
      songsRef.map().once((song, id) => {
        if (song) {
          tracks.push({ id: id, song: song });
        }
      });
      if (callback) callback(tracks);
    }
  
    // NUOVE FUNZIONALITÀ:
  
    // 1. Integrazione con Identity Service - RIMOSSA PER ORA
    /* 
    async function getAuthToken() {
      const username = localStorage.getItem('username');
      const response = await fetch('http://localhost:3002/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const data = await response.json();
      localStorage.setItem('jwt_token', data.token);
      return data.token;
    }
    */
  
    // 2. Ricerca avanzata tramite Discovery Node
    async function searchTracks(query, options = {}) {
      try {
        // Verifica che l'utente sia autenticato
        if (!checkAuthState()) {
          console.error("Ricerca non possibile: utente non autenticato");
          return [];
        }
        
        console.log("Esecuzione ricerca:", query, options);
        
        // Per ora, implementiamo la ricerca localmente utilizzando la cache delle canzoni
        // invece di fare chiamate esterne al discovery node
        const results = [];
        
        // Ricerca nella cache locale
        for (const id in cachedSongs) {
          const song = cachedSongs[id];
          if (!song) continue;
          
          // Aggiungi un flag per il campo ID
          song.id = id;
          
          // Controlla se la query corrisponde a titolo, artista o album
          const matchesQuery = !query || 
            (song.title && song.title.toLowerCase().includes(query.toLowerCase())) || 
            (song.artist && song.artist.toLowerCase().includes(query.toLowerCase())) || 
            (song.album && song.album.toLowerCase().includes(query.toLowerCase()));
          
          // Controlla se corrisponde al genere specificato
          const matchesGenre = !options.genre || 
            (song.genre && song.genre.toLowerCase() === options.genre.toLowerCase());
          
          // Controlla se corrisponde all'artista specificato
          const matchesArtist = !options.artist || 
            (song.artist && song.artist.toLowerCase() === options.artist.toLowerCase());
          
          // Se corrisponde a tutti i criteri, aggiungilo ai risultati
          if (matchesQuery && matchesGenre && matchesArtist) {
            results.push(song);
          }
        }
        
        console.log("Risultati ricerca:", results.length);
        return results;
      } catch (error) {
        console.error('Errore durante la ricerca locale:', error);
        return [];
      }
    }
  
    // 3. Support per replicazione contenuti
    async function ensureContentAvailability(fileId) {
      // Funzionalità rimossa per ora
      console.log("Verifica disponibilità contenuto:", fileId);
      return true; // Assume sempre che il contenuto sia disponibile
    }
  
    // Esporta API pubbliche
    window.Protocol = {
      addRelay,
      getActiveRelays: () => peers,
      removeRelay: (index) => {
        if (peers[index]) {
          peers.splice(index, 1);
          updateGunInstance();
        }
      },
      registerUser: (username, password, callback) => {
        if (!username || !password) {
          if (callback) callback("Username e password sono richiesti", null);
          return;
        }

        user.create(username, password, (createUserAck) => {
          if (createUserAck.err) {
            if (callback) callback(createUserAck.err, null);
                return;
              }

          user.auth(username, password, (authAck) => {
            if (authAck.err) {
              if (callback) callback(authAck.err, null);
                  return;
                }

                isUserAuthenticated = true;
            
            // Inizializza i dati dell'utente dopo la registrazione
            initUserTokens();
            initUserNFTs();
                  initSongCache();
                  initSongSubscription();
            
            if (callback) callback(null, "Registrazione completata con successo!");
              });
            });
      },
      loginUser: (username, password, callback) => {
        if (!username || !password) {
          if (callback) callback("Username e password sono richiesti", null);
          return;
        }

        user.auth(username, password, (ack) => {
          if (ack.err) {
            if (callback) callback(ack.err, null);
                return;
              }

              isUserAuthenticated = true;
          
          // Inizializza i dati dell'utente dopo il login
          initUserTokens();
          initUserNFTs();
                initSongCache();
                initSongSubscription();
          
          if (callback) callback(null, "Login completato con successo!");
        });
      },
      isAuthenticated: () => isUserAuthenticated,
      logout: () => {
        user.leave();
        isUserAuthenticated = false;
        cachedSongs = {};
        cachedNFTs = {};
        userTokenBalance = 0;
      },
      getUser: () => user,
      saveSong: (songData, callback) => {
        // Verifica l'autenticazione admin tramite localStorage o autenticazione utente standard
        const adminToken = localStorage.getItem('adminToken');
        const isAdminAuthenticated = adminToken === METADATA_AUTH_TOKEN;
        
        if (!isUserAuthenticated && !isAdminAuthenticated) {
          if (callback) callback("Utente non autenticato", null);
          return;
        }
        
        if (!songData.title || !songData.artist) {
          if (callback) callback("Titolo e artista sono obbligatori", null);
          return;
        }
        
        // Aggiungi timestamp di creazione e userRef (o adminRef per admin)
        const fullSongData = {
          ...songData,
          createdAt: new Date().toISOString(),
          createdBy: isAdminAuthenticated ? 'admin' : user.is.pub
        };
        
        // Salva nella struttura GUN
        const songNode = songsRef.set(fullSongData);
        songNode.once((data, key) => {
          console.log("Brano salvato con ID:", key);
          if (callback) callback(null, "Brano salvato con successo!");
        });
      },
      deleteSong: (songId, callback) => {
        // Verifica l'autenticazione admin tramite localStorage o autenticazione utente standard
        const adminToken = localStorage.getItem('adminToken');
        const isAdminAuthenticated = adminToken === METADATA_AUTH_TOKEN;
        
        if (!isUserAuthenticated && !isAdminAuthenticated) {
          if (callback) callback("Utente non autenticato", null);
          return;
        }
        
        if (!songId) {
          if (callback) callback("ID brano non valido", null);
          return;
        }
        
        // In GUN non c'è una vera "cancellazione", quindi impostiamo
        // un valore nullo o un flag "deleted"
        songsRef.get(songId).put({ deleted: true }, (ack) => {
          if (ack.err) {
            if (callback) callback(ack.err, null);
          } else {
            if (callback) callback(null, "Brano eliminato con successo");
            delete cachedSongs[songId];
            renderSongs();
          }
        });
      },
      renderSongs,
      playSong,
      subscribeSongs: (callback) => {
        songsRef.map().on((song, id) => {
          if (song && id && !song.deleted) {
            callback(song, id);
          }
        });
      },
      fetchTracks,
      searchTracks,
      // Nuove funzioni per token e NFT
      claimDailyTokens,
      getTokenBalance,
      setMintingDetails,
      getSong,
      mintEdition,
      getUserNFTs,
      loginWithMetaMask: async (callback) => {
        if (shogun && shogun.metamask) {
          try {
            // Prima ottieni l'indirizzo da MetaMask
          if (!window.ethereum) {
              throw new Error("MetaMask non è installato");
          }

          // Richiedi l'accesso agli account
          const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
          });
          
          if (!accounts || accounts.length === 0) {
            throw new Error('Nessun account MetaMask disponibile');
          }

          const address = accounts[0];
          
            // Ora usa la funzione corretta con l'indirizzo
            const result = await shogun.loginWithMetaMask(address);

          if (result.success) {
            isUserAuthenticated = true;
              initUserTokens();
              initUserNFTs();
            initSongCache();
            initSongSubscription();
              if (callback) callback(null, "Login con MetaMask completato con successo!");
          } else {
              if (callback) callback(result.error || "Login con MetaMask fallito", null);
          }
        } catch (error) {
            if (callback) callback(error.message, null);
          }
        } else {
          if (callback) callback("Supporto MetaMask non disponibile", null);
        }
      },
      loginWithWebAuthn: async (username, callback) => {
        if (shogun && shogun.webauthn) {
          try {
            // Corretto: Usa loginWithWebAuthn invece di login
          const result = await shogun.loginWithWebAuthn(username);
          if (result.success) {
            isUserAuthenticated = true;
              initUserTokens();
              initUserNFTs();
            initSongCache();
            initSongSubscription();
              if (callback) callback(null, "Login con WebAuthn completato con successo!");
          } else {
              if (callback) callback(result.error || "Login con WebAuthn fallito", null);
          }
        } catch (error) {
            if (callback) callback(error.message, null);
          }
        } else {
          if (callback) callback("Supporto WebAuthn non disponibile", null);
        }
      },
      signUpWithWebAuthn: async (username, callback) => {
        if (shogun && shogun.webauthn) {
          try {
          const result = await shogun.signUpWithWebAuthn(username);
          if (result.success) {
            isUserAuthenticated = true;
              initUserTokens();
              initUserNFTs();
            initSongCache();
            initSongSubscription();
              if (callback) callback(null, "Registrazione con WebAuthn completata con successo!");
          } else {
              if (callback) callback(result.error || "Registrazione con WebAuthn fallita", null);
          }
        } catch (error) {
            if (callback) callback(error.message, null);
          }
                  } else {
          if (callback) callback("Supporto WebAuthn non disponibile", null);
        }
      },
      loginWithToken: (token, callback) => {
        // Login semplificato per admin
        if (token === METADATA_AUTH_TOKEN) {
          isUserAuthenticated = true;
          
          // Inizializza le cache e sottoscrizioni
          initSongCache();
          initSongSubscription();
          
          // Log di debug
          console.log("Login admin completato. Verifica cache brani:", Object.keys(cachedSongs).length);
          
          if (callback) callback(null, "Login admin completato con successo!");
        } else {
          if (callback) callback("Token non valido", null);
        }
      }
    };
    
  })();
  