// AUTENTICAZIONE DISABILITATA TEMPORANEAMENTE
// Impostiamo un username di default per test
const username = "artista_test";

// Simulazione delle funzioni di autenticazione per test
function requireAuth() { return true; }
function getCurrentUsername() { return username; }
function logout() { window.location.href = 'index.html'; }

// Determiniamo la porta del server in base all'URL corrente
const currentPort = window.location.port || '80';
const serverPort = currentPort === '3001' ? '3000' : currentPort; // Se il client è su 3001, usiamo 3000, altrimenti usiamo la porta corrente
console.log(`[DASHBOARD] Porta corrente: ${currentPort}, usando porta server: ${serverPort}`);

// Adattiamo l'URL base per le chiamate API
const apiBaseUrl = `${window.location.protocol}//${window.location.hostname}:${serverPort}`;
console.log(`[DASHBOARD] URL base API: ${apiBaseUrl}`);

// Inizializziamo Gun con configurazione esplicita
const gun = Gun({
  peers: [`${apiBaseUrl}/gun`],
  localStorage: false,
  radisk: false,
  file: false,
  timeout: 30000 // Timeout più lungo per operazioni Gun (30 secondi)
});

console.log('[DASHBOARD] Gun inizializzato con peer:', gun._.opt.peers);

// Verifica connessione
setTimeout(() => {
  console.log('[DASHBOARD] Verifica connessione Gun...');
  
  // Test connettività generale con il server
  fetch(`${apiBaseUrl}/api/test`)
    .then(response => response.json())
    .then(data => {
      console.log('[DASHBOARD] Test connettività server:', data);
    })
    .catch(error => {
      console.error('[DASHBOARD] Errore connettività server:', error);
    });
  
  // Test salvataggio semplice per verificare connessione
  gun.get('test').put({
    message: 'Test connessione',
    timestamp: Date.now()
  }, (ack) => {
    if (ack.err) {
      console.error('[DASHBOARD] Errore connessione Gun:', ack.err);
    } else {
      console.log('[DASHBOARD] Connessione Gun confermata!');
      
      // Leggiamo il dato appena salvato per verificare il funzionamento completo
      gun.get('test').once((data) => {
        console.log('[DASHBOARD] Test lettura Gun:', data);
      });
    }
  });
}, 1000);

document.querySelector('header p').textContent = 
  `Bentornato! Crea e gestisci le tue release musicali`;

const releaseForm = document.getElementById("releaseForm");
const releaseType = document.getElementById("releaseType");
const releaseTitle = document.getElementById("releaseTitle");
const releaseDate = document.getElementById("releaseDate");
const artworkFile = document.getElementById("artworkFile");
const logoutBtn = document.getElementById("logoutBtn");
const submitBtn = document.getElementById("submitBtn");

const trackContainer = document.getElementById("trackContainer");
const addTrackBtn = document.getElementById("addTrackBtn");
const feedback = document.getElementById("feedback");
const loadingSpinner = document.getElementById("loadingSpinner");
const userReleases = document.getElementById("userReleases");

// Assicuriamoci che il pulsante di submit sia correttamente referenziato
if (!submitBtn) {
  console.error("Pulsante di submit non trovato!");
  // Prova a cercare per classe come fallback
  const createReleaseBtn = document.querySelector(".create-release-btn");
  if (createReleaseBtn) {
    createReleaseBtn.id = "submitBtn";
  }
}

// Gestione logout
logoutBtn.addEventListener('click', (e) => {
  e.preventDefault();
  window.location.href = 'index.html';
});

// Mostra o nasconde il pulsante "Aggiungi Traccia" a seconda del tipo di release
releaseType.addEventListener("change", () => {
  if (releaseType.value === "ep") {
    addTrackBtn.style.display = "block";
  } else {
    addTrackBtn.style.display = "none";

    // Se passiamo da EP a Single, lasciamo solo la prima traccia
    const trackForms =
      trackContainer.querySelectorAll(".track-item-form");
    trackForms.forEach((form, index) => {
      if (index > 0) form.remove();
    });
  }
});

// Evita l'invio del form quando si preme invio in un campo di input
releaseForm.addEventListener("keypress", function(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    return false;
  }
});

// Aggiunge un nuovo blocco di input per la traccia
addTrackBtn.addEventListener("click", () => {
  const div = document.createElement("div");
  div.className = "track-item-form";
  div.innerHTML = `
  <input type="text" placeholder="Titolo Traccia" class="track-title" required />
  <input type="file" accept="audio/*" class="track-file" required />
  <button type="button" class="remove-track">Rimuovi</button>
`;
  trackContainer.appendChild(div);

  // Aggiungi event listener per il pulsante di rimozione
  div.querySelector('.remove-track').addEventListener('click', function() {
    div.remove();
  });
});

// Funzione per leggere un file come Base64 (immagini o audio)
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    // Controlla la dimensione del file
    const MAX_SIZE_MB = 20; // Dimensione massima 10MB
    const MAX_SIZE = MAX_SIZE_MB * 1024 * 1024; // 10MB in bytes
    
    if (file.size > MAX_SIZE) {
      reject(new Error(`Il file è troppo grande. La dimensione massima è ${MAX_SIZE_MB}MB.`));
      return;
    }
    
    // Controlla i formati supportati per i file audio
    if (file.type.startsWith('audio/')) {
      const supportedFormats = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac'];
      const isSupported = supportedFormats.some(format => file.type === format || file.type.includes(format.split('/')[1]));
      
      if (!isSupported) {
        console.warn('Formato audio non ideale:', file.type);
        feedback.textContent = `Avviso: il formato ${file.type} potrebbe non essere supportato da tutti i browser. Consigliati: MP3, WAV, OGG.`;
        setTimeout(() => {
          feedback.textContent = "";
        }, 5000);
      }
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // Verifica che il risultato sia una stringa valida e inizi con data:
      if (typeof result !== 'string' || !result.startsWith('data:')) {
        reject(new Error('Errore nella codifica del file. Formato non valido.'));
        return;
      }
      resolve(result);
    };
    reader.onerror = (error) => {
      console.error("Errore lettura file:", error);
      reject(new Error("Errore nella lettura del file. Prova con un altro file."));
    };
    reader.readAsDataURL(file);
  });
}

// Gestore submit del form (ora associato al pulsante invece che al form)
submitBtn.addEventListener("click", async () => {
  console.log("Pulsante Crea Release cliccato");
  
  // Verifica validità del form
  if (!releaseForm.checkValidity()) {
    // Trigger della validazione nativa del browser
    const tmpSubmit = document.createElement('button');
    releaseForm.appendChild(tmpSubmit);
    tmpSubmit.click();
    releaseForm.removeChild(tmpSubmit);
    return;
  }

  // Test connettività prima di procedere
  try {
    console.log('[SUBMIT] Verifica connettività server prima di procedere...');
    const testResponse = await fetch(`${apiBaseUrl}/api/test`);
    const testData = await testResponse.json();
    console.log('[SUBMIT] Test connettività pre-upload:', testData);
    
    if (!testData.success) {
      throw new Error('Test di connettività fallito');
    }
  } catch (connError) {
    console.error('[SUBMIT] Errore connettività:', connError);
    feedback.textContent = "Errore di connessione al server. Riprova tra poco.";
    return;
  }

  // Disabilitiamo il pulsante durante il caricamento
  submitBtn.disabled = true;
  submitBtn.textContent = "Creazione in corso...";
  document.getElementById("submitSpinner").style.display = "inline-block";
  
  feedback.textContent = "Preparazione dei file...";
  loadingSpinner.style.display = "block";

  try {
    // Preleviamo i campi principali
    const type = releaseType.value;
    const title = releaseTitle.value.trim();
    const date = releaseDate.value || "";

    // Veridica che i campi obbligatori siano presenti
    if (!title) {
      throw new Error("Il titolo della release è obbligatorio");
    }

    feedback.textContent = "Preparazione dei file...";

    // Artwork
    let artworkBase64 = "";
    if (artworkFile.files[0]) {
      try {
        artworkBase64 = await readFileAsBase64(artworkFile.files[0]);
        if (!artworkBase64 || !artworkBase64.startsWith('data:')) {
          console.warn("Problema con l'artwork, proseguiamo senza");
          artworkBase64 = "";
        }
      } catch (artworkErr) {
        console.error("Errore caricamento artwork:", artworkErr);
        // Non blocchiamo per l'artwork, proseguiamo senza
        artworkBase64 = "";
      }
    }

    // Mostriamo una barra di progresso
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-bar';
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar-inner';
    progressContainer.appendChild(progressBar);
    feedback.appendChild(progressContainer);

    const statusMsg = document.createElement('div');
    statusMsg.className = 'status-message';
    feedback.appendChild(statusMsg);

    // Raccogliamo le tracce in un array
    const trackForms = trackContainer.querySelectorAll(".track-item-form");
    const tracks = [];

    // Verifica che ci sia almeno una traccia
    if (trackForms.length === 0) {
      throw new Error("Devi aggiungere almeno una traccia");
    }

    feedback.textContent = "Verifica dei file audio...";

    // Prima verifichiamo tutti i file senza caricarli
    for (let i = 0; i < trackForms.length; i++) {
      const trackTitleInput = trackForms[i].querySelector(".track-title");
      const trackFileInput = trackForms[i].querySelector(".track-file");

      const tTitle = trackTitleInput.value.trim();
      const tFile = trackFileInput.files[0];

      if (!tTitle) {
        throw new Error(`La traccia #${i+1} non ha un titolo`);
      }
      
      if (!tFile) {
        throw new Error(`La traccia #${i+1} non ha un file audio`);
      }

      // Verifica preliminare del file
      if (!tFile.type.startsWith('audio/')) {
        throw new Error(`Il file "${tFile.name}" non sembra essere un file audio (tipo: ${tFile.type})`);
      }

      // Verifica delle dimensioni
      const MAX_SIZE_MB = 20;
      const MAX_SIZE = MAX_SIZE_MB * 1024 * 1024;
      if (tFile.size > MAX_SIZE) {
        throw new Error(`Il file "${tFile.name}" è troppo grande (${(tFile.size/1024/1024).toFixed(1)}MB). Il limite è ${MAX_SIZE_MB}MB`);
      }
    }

    // Ora procediamo con il caricamento uno per uno
    for (let i = 0; i < trackForms.length; i++) {
      progressBar.style.width = `${(i / trackForms.length) * 100}%`;
      statusMsg.textContent = `Elaborazione traccia ${i+1}/${trackForms.length}...`;
      
      const trackTitleInput = trackForms[i].querySelector(".track-title");
      const trackFileInput = trackForms[i].querySelector(".track-file");

      const tTitle = trackTitleInput.value.trim();
      const tFile = trackFileInput.files[0];
      
      // Log dettagliato
      console.log(`Elaborazione file: "${tFile.name}" (${tFile.type}, ${(tFile.size/1024).toFixed(1)}KB)`);
      
      try {
        const tData = await readFileAsBase64(tFile);
        
        // Verifica che i dati siano stati caricati correttamente
        if (!tData || typeof tData !== 'string' || !tData.startsWith('data:')) {
          throw new Error(`Errore nel caricamento del file "${tFile.name}". Formato non valido.`);
        }
        
        // Log di debug
        console.log(`File audio caricato con successo (${tFile.type}): ${tData.substring(0, 30)}...`);
        
        tracks.push({
          title: tTitle,
          data: tData,
          mimeType: tFile.type,
          fileSize: tFile.size,
          lastModified: tFile.lastModified
        });
      } catch (error) {
        console.error(`Errore caricamento traccia "${tTitle}":`, error);
        throw new Error(`Errore nella traccia "${tTitle}": ${error.message}`);
      }
    }

    // Update progress
    progressBar.style.width = '100%';
    statusMsg.textContent = 'Salvataggio della release...';

    // Generiamo un ID univoco (qui usiamo il timestamp)
    const releaseId = Date.now().toString();

    // Creiamo l'oggetto release utilizzando l'oggetto per le tracce
    const releaseObj = {
      id: releaseId,
      type: type,
      title: title,
      date: date,
      creator: username,
      artwork: artworkBase64,
      createdAt: Date.now(),
      trackCount: tracks.length
    };

    console.log("Salvataggio release con ID:", releaseId, "con", tracks.length, "tracce");

    // Prima salviamo la release senza tracce
    console.log("[RELEASE] Inizio salvataggio release principale");
    
    // Test salvataggio semplice con miglior gestione degli errori
    gun.get("releases").get("test").put({test: "ok", timestamp: Date.now()}, (testAck) => {
      console.log("[RELEASE] Test salvataggio Gun:", testAck);
      
      if (testAck.err) {
        console.error("[RELEASE] Errore nel test di salvataggio:", testAck.err);
        feedback.textContent = "Errore di connessione a Gun: " + testAck.err;
        resetForm();
        return;
      }
      
      console.log("[RELEASE] Test di salvataggio riuscito, procedo con il salvataggio della release");
      
      try {
        // Salvataggio release vera
        saveRelease().catch(err => {
          console.error("Errore promessa saveRelease:", err);
          feedback.textContent = "Errore: " + err.message;
          resetForm();
        });
      } catch (err) {
        console.error("Errore nel salvataggio release:", err);
        feedback.textContent = "Errore: " + err.message;
        resetForm();
      }
    });
    
    // Funzione per salvare la release
    async function saveRelease() {
      return new Promise((resolve, reject) => {
        console.log("[RELEASE] Avvio salvataggio release con ID:", releaseId);
        
        gun.get("releases").get(releaseId).put(releaseObj, (ack) => {
          console.log("[RELEASE] Risultato salvataggio release:", ack);
          
          if (ack.err) {
            console.error("[RELEASE] Errore salvataggio release:", ack.err);
            reject(new Error("Errore durante la creazione della release: " + ack.err));
            return;
          }
          
          console.log("[RELEASE] Salvataggio release riuscito, procedo con le tracce");
          
          try {
            // Procediamo con il salvataggio delle tracce
            saveAllTracks().then(resolve).catch(reject);
          } catch (trackError) {
            console.error("[RELEASE] Errore avvio salvataggio tracce:", trackError);
            reject(trackError);
          }
        });
      });
    }
    
    // Funzione per salvare tutte le tracce
    async function saveAllTracks() {
      console.log("[TRACKS] Inizio salvataggio di", tracks.length, "tracce");
      const tracksNode = gun.get("releases").get(releaseId).get("tracks");
      
      // Salviamo ogni traccia una per una
      for (let i = 0; i < tracks.length; i++) {
        progressBar.style.width = `${((i) / tracks.length) * 100}%`;
        statusMsg.textContent = `Salvataggio traccia ${i+1}/${tracks.length}...`;
        
        // Salviamo la traccia
        try {
          await saveTrack(i, tracksNode);
          console.log(`[TRACKS] Traccia ${i+1}/${tracks.length} salvata con successo`);
        } catch (trackError) {
          console.error(`[TRACKS] Errore salvataggio traccia ${i+1}:`, trackError);
          throw trackError; // Rilanciamo per gestione superiore
        }
      }
      
      // Successo completo
      statusMsg.textContent = 'Release creata con successo!';
      feedback.textContent = "Release creata con successo!";
      
      // Resettiamo il form e ricarichiamo le release
      releaseForm.reset();
      resetTrackContainer();
      loadUserReleases();
      resetForm();
    }
    
    // Funzione per salvare una singola traccia
    async function saveTrack(i, tracksNode) {
      return new Promise((resolve, reject) => {
        const trackIndex = i.toString();
        console.log(`[TRACKS] Salvataggio traccia ${i+1} (${tracks[i].title}) nel nodo ${trackIndex}`);
        
        // Creiamo i metadati
        const trackMetadata = {
          title: tracks[i].title,
          index: i,
          mimeType: tracks[i].mimeType,
          fileSize: tracks[i].fileSize,
          lastModified: tracks[i].lastModified
        };
        
        console.log(`[TRACKS] Salvataggio metadati traccia ${i+1}`);
        
        // Salviamo i metadati
        tracksNode.get(trackIndex).put(trackMetadata, async (metaAck) => {
          if (metaAck.err) {
            console.error(`[TRACKS] Errore nel salvare i metadati traccia ${i+1}:`, metaAck.err);
            reject(new Error(`Errore nel salvare i metadati traccia ${i+1}: ${metaAck.err}`));
            return;
          }
          
          console.log(`[TRACKS] Metadati traccia ${i+1} salvati con successo`);
          
          // Ora carichiamo il file audio
          try {
            console.log(`[TRACKS] Inizio caricamento file audio per traccia ${i+1} (${tracks[i].mimeType}, ${(tracks[i].fileSize/1024).toFixed(1)}KB)`);
            const audioUrl = await uploadAudioFile(tracks[i].data, `${releaseId}_${trackIndex}`);
            
            console.log(`[TRACKS] File audio caricato con successo, URL: ${audioUrl}`);
            
            // Salviamo l'URL nei metadati
            console.log(`[TRACKS] Salvataggio URL audio nei metadati della traccia ${i+1}`);
            
            // Utilizziamo Promise per gestire il salvataggio dell'URL
            const saveUrlPromise = new Promise((resolveUrl, rejectUrl) => {
              const maxRetries = 3; // Numero massimo di tentativi
              let currentRetry = 0;
              
              function attemptSave() {
                currentRetry++;
                console.log(`[TRACKS] Tentativo ${currentRetry}/${maxRetries} di salvataggio URL per traccia ${i+1}`);
                
                tracksNode.get(trackIndex).get('audioUrl').put(audioUrl, (audioUrlAck) => {
                  if (audioUrlAck.err) {
                    console.error(`[TRACKS] Errore nel salvare URL audio traccia ${i+1} (tentativo ${currentRetry}):`, audioUrlAck.err);
                    
                    if (currentRetry < maxRetries) {
                      console.log(`[TRACKS] Tentativo ${currentRetry+1}/${maxRetries} tra 1 secondo...`);
                      setTimeout(attemptSave, 1000); // Riprova dopo 1 secondo
                    } else {
                      // Se tutti i tentativi falliscono, proviamo una alternativa diretta tramite PocketBase
                      console.log(`[TRACKS] Tutti i tentativi Gun falliti, utilizzo soluzione alternativa...`);
                      
                      // Creiamo un oggetto che contiene sia i metadati che l'URL audio
                      const trackData = {
                        ...trackMetadata,
                        audioUrl: audioUrl,
                        releaseId: releaseId
                      };
                      
                      // Salviamo direttamente tramite un endpoint REST
                      fetch(`${apiBaseUrl}/api/track_data`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(trackData)
                      })
                      .then(response => response.json())
                      .then(data => {
                        if (data.success) {
                          console.log(`[TRACKS] Salvataggio alternativo riuscito per traccia ${i+1}`);
                          resolveUrl();
                        } else {
                          console.error(`[TRACKS] Errore nel salvataggio alternativo:`, data.error);
                          rejectUrl(new Error(`Errore nel salvataggio alternativo: ${data.error}`));
                        }
                      })
                      .catch(err => {
                        console.error(`[TRACKS] Errore nella chiamata REST alternativa:`, err);
                        rejectUrl(err);
                      });
                    }
                  } else {
                    console.log(`[TRACKS] URL audio traccia ${i+1} salvato con successo`);
                    resolveUrl();
                  }
                });
              }
              
              // Inizia il primo tentativo
              attemptSave();
            });
            
            // Attendi che il salvataggio dell'URL sia completato
            await saveUrlPromise;
            resolve();
            
          } catch (uploadError) {
            console.error(`[TRACKS] Errore caricamento file audio traccia ${i+1}:`, uploadError);
            statusMsg.textContent = `Errore caricamento traccia ${i+1}: ${uploadError.message}`;
            reject(uploadError);
          }
        });
      });
    }
    
    // Funzione per caricare un file audio
    async function uploadAudioFile(fileData, trackId) {
      return new Promise((resolve, reject) => {
        try {
          console.log(`[UPLOAD] Inizio elaborazione file audio (lunghezza data URI: ${fileData.length} caratteri)`);
          
          const blob = dataURItoBlob(fileData);
          console.log(`[UPLOAD] Preparazione file audio per il server (${(blob.size/1024).toFixed(1)}KB, trackId: ${trackId})...`);
          
          if (!blob || blob.size === 0) {
            console.error('[UPLOAD] Errore nella preparazione del blob');
            reject(new Error('Errore nella preparazione del file audio'));
            return;
          }
          
          // Creiamo un FormData
          const formData = new FormData();
          formData.append('trackId', trackId);
          formData.append('audioFile', blob, `track_${trackId}.mp3`);
          
          // Log per verificare che FormData sia corretto
          console.log(`[UPLOAD] FormData creato con trackId: ${trackId}, filename: track_${trackId}.mp3`);
          
          // Impostiamo il timeout più lungo per file grandi
          const uploadTimeout = Math.max(60000, blob.size / 10); // 60 secondi o più per file grandi
          console.log(`[UPLOAD] Timeout impostato a ${uploadTimeout/1000} secondi per file di ${(blob.size/1024/1024).toFixed(2)}MB`);
          
          // Prima facciamo un test di connettività
          console.log('[UPLOAD] Test connettività prima di caricare il file...');
          
          fetch(`${apiBaseUrl}/api/test`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
              fileSize: blob.size, 
              trackId: trackId, 
              action: 'pre-upload test' 
            })
          })
          .then(response => response.json())
          .then(testData => {
            console.log('[UPLOAD] Test connettività pre-upload completato:', testData);
            
            // Se il test è riuscito, procediamo con l'upload
            console.log(`[UPLOAD] Avvio upload effettivo a ${apiBaseUrl}/upload/audio`);
            
            // Inviamo la richiesta
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
              console.error(`[UPLOAD] Timeout raggiunto dopo ${uploadTimeout/1000} secondi`);
              controller.abort();
            }, uploadTimeout);
            
            return fetch(`${apiBaseUrl}/upload/audio`, {
              method: 'POST',
              body: formData,
              signal: controller.signal
            })
            .then(response => {
              clearTimeout(timeoutId);
              console.log(`[UPLOAD] Risposta server: status ${response.status}`);
              
              if (!response.ok) {
                return response.text().then(text => {
                  console.error(`[UPLOAD] Errore server (${response.status}):`, text);
                  throw new Error(`Errore server: ${response.status} - ${text}`);
                });
              }
              return response.json();
            })
            .then(data => {
              console.log(`[UPLOAD] Risposta upload completa:`, data);
              if (data.success) {
                console.log(`[UPLOAD] Audio file caricato con successo:`, data.fileUrl);
                resolve(data.fileUrl);
              } else {
                console.error(`[UPLOAD] Errore nel caricare audio:`, data.error);
                reject(new Error(`Errore nel caricare audio: ${data.error}`));
              }
            })
            .catch(error => {
              clearTimeout(timeoutId);
              if (error.name === 'AbortError') {
                console.error(`[UPLOAD] Upload interrotto per timeout dopo ${uploadTimeout/1000} secondi`);
                reject(new Error(`Timeout durante l'upload del file. Prova con un file più piccolo o verifica la connessione.`));
              } else {
                console.error(`[UPLOAD] Errore di rete nel caricare audio:`, error);
                reject(new Error(`Errore di rete nel caricare audio: ${error.message}`));
              }
            });
          })
          .catch(testError => {
            console.error('[UPLOAD] Errore nel test di connettività pre-upload:', testError);
            reject(new Error('Errore di connessione al server. Verifica che il server sia attivo.'));
          });
        } catch (generalError) {
          console.error('[UPLOAD] Errore generale:', generalError);
          reject(new Error(`Errore generale durante l'upload: ${generalError.message}`));
        }
      });
    }
    
    // Utility per reset del form
    function resetForm() {
      submitBtn.disabled = false;
      submitBtn.textContent = "Crea Release";
      document.getElementById("submitSpinner").style.display = "none";
      loadingSpinner.style.display = "none";
    }
    
    // Utility per reset del container tracce
    function resetTrackContainer() {
      addTrackBtn.style.display = "none";
      trackContainer.innerHTML = `
        <div class="track-item-form">
          <input type="text" placeholder="Titolo Traccia" class="track-title" required />
          <input type="file" accept="audio/*" class="track-file" required />
        </div>
      `;
    }
    
  } catch (err) {
    console.error("Errore generale:", err);
    feedback.textContent = "Errore: " + err.message;
    loadingSpinner.style.display = "none";
    
    // Riabilitiamo il pulsante
    submitBtn.disabled = false;
    submitBtn.textContent = "Crea Release";
    document.getElementById("submitSpinner").style.display = "none";
  }
});

// Funzione per convertire dataURI in Blob
function dataURItoBlob(dataURI) {
  try {
    // Verifico validità del dataURI
    if (!dataURI || typeof dataURI !== 'string') {
      console.error('[BLOB] DataURI non valido:', dataURI ? typeof dataURI : 'null');
      throw new Error('DataURI non valido');
    }
    
    // Controllo formato dataURI
    if (!dataURI.startsWith('data:')) {
      console.error('[BLOB] Formato dataURI non valido:', dataURI.substring(0, 30) + '...');
      throw new Error('Formato dataURI non valido');
    }
    
    const parts = dataURI.split(',');
    if (parts.length !== 2) {
      console.error('[BLOB] Divisione dataURI fallita:', parts.length);
      throw new Error('Formato dataURI non valido (divisione)');
    }
    
    // Convertiamo il dataURI in un array binario
    const byteString = atob(parts[1]);
    console.log(`[BLOB] Lunghezza byteString dopo decodifica base64: ${byteString.length} bytes`);
    
    // Estraiamo il MIME type
    const mimeString = parts[0].split(':')[1].split(';')[0];
    console.log(`[BLOB] MIME type estratto: ${mimeString}`);
    
    // Creiamo un array tipizzato
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    // Convertiamo in binario
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    
    const blob = new Blob([ab], {type: mimeString});
    console.log(`[BLOB] Blob creato con successo: ${blob.size} bytes, tipo: ${blob.type}`);
    return blob;
  } catch (error) {
    console.error('[BLOB] Errore nella conversione dataURI a Blob:', error);
    throw error;
  }
}

// Carica le release dell'utente
function loadUserReleases() {
  userReleases.innerHTML = '<p>Caricamento delle tue release...</p>';
  let found = false;

  gun.get('releases').map().on((release, id) => {
    if (!release) return;
    if (release.creator !== username) return;

    found = true;
    
    // Controlla se l'elemento esiste già
    let releaseElement = document.getElementById('release-' + id);
    if (!releaseElement) {
      releaseElement = document.createElement('div');
      releaseElement.id = 'release-' + id;
      releaseElement.className = 'release-item';
      userReleases.appendChild(releaseElement);
    }

    releaseElement.innerHTML = `
      <h3>${release.title || 'Untitled'}</h3>
      <p>${release.type === 'single' ? 'Single' : 'EP'} - ${release.date || ''}</p>
      <p>
        <a href="release.html?id=${id}" target="_blank">Visualizza</a> | 
        <a href="#" class="delete-release" data-id="${id}">Elimina</a>
      </p>
    `;

    // Aggiungi listener per eliminazione
    releaseElement.querySelector('.delete-release').addEventListener('click', function(e) {
      e.preventDefault();
      if (confirm('Sei sicuro di voler eliminare questa release?')) {
        const releaseId = this.getAttribute('data-id');
        gun.get('releases').get(releaseId).put(null);
        document.getElementById('release-' + releaseId).remove();
      }
    });
  });

  // Se non ci sono release dopo 2 secondi, mostra un messaggio
  setTimeout(() => {
    if (!found && userReleases.innerHTML.includes('Caricamento')) {
      userReleases.innerHTML = '<p>Non hai ancora creato release. Usa il form sopra per iniziare!</p>';
    }
  }, 2000);
}

// Carica le release dell'utente all'avvio
loadUserReleases();

// Assicuriamoci che qualsiasi pulsante con il testo "Crea Release" funzioni
document.addEventListener('click', function(e) {
  if (e.target.tagName === 'BUTTON' && e.target.textContent.includes('Crea Release')) {
    // Se il pulsante cliccato è diverso da submitBtn, ma ha lo stesso testo, triggeriamo il click su submitBtn
    if (e.target.id !== 'submitBtn') {
      console.log('Pulsante alternativo "Crea Release" cliccato');
      e.preventDefault();
      
      // Se submitBtn esiste, triggeriamo un click su di esso
      if (submitBtn) {
        submitBtn.click();
      } else {
        // Altrimenti, eseguiamo direttamente la logica di submit
        alert('Implementazione di fallback: gestione diretta della creazione release');
        // Qui potremmo duplicare la logica dell'event listener di submitBtn
        // Ma per semplicità, reindiriziamo all'intera pagina per ricaricarla correttamente
        window.location.reload();
      }
    }
  }
}); 