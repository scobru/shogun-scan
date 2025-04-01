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

// Inizializziamo Gun con configurazione ottimizzata
const gun = Gun({
  peers: [`${apiBaseUrl}/gun`],
  localStorage: false,
  radisk: false,
  file: false,
  timeout: 15000,    // Aumentiamo il timeout a 15 secondi
  retry: 1500,       // Riduciamo l'intervallo di retry
  axe: false,        // Disabilitiamo AXE per debug
  super: false,      // Disabilitiamo super per performance
  WebSocket: window.WebSocket // Forziamo l'uso di WebSocket
});

console.log('[DASHBOARD] Gun inizializzato con configurazione:', {
  peers: gun._.opt.peers,
  url: apiBaseUrl
});

// Miglioriamo il monitoraggio della connessione
let isGunConnected = false;
gun.on('hi', peer => {
  console.log('[GUN] Connesso al peer:', peer);
  isGunConnected = true;
});

gun.on('bye', peer => {
  console.log('[GUN] Disconnesso dal peer:', peer);
  isGunConnected = false;
});

gun.on('put', msg => {
  // Limitiamo il logging per evitare sovraccarichi
  if (msg.put && Object.keys(msg.put)[0] !== '#') {
    console.log('[GUN] Messaggio PUT:', {
      key: Object.keys(msg.put)[0],
      msgId: msg['#']
    });
  }
});

// Funzione per verificare la connessione
async function checkGunConnection(timeout = 5000) {
  if (!isGunConnected) {
    throw new Error('Gun non connesso');
  }
  
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout verifica connessione'));
    }, timeout);
    
    gun.get('connection_test').put({ timestamp: Date.now() }, ack => {
      clearTimeout(timer);
      if (ack.err) {
        reject(new Error(ack.err));
      } else {
        resolve(true);
      }
    });
  });
}

// Funzione per salvare una release con retry
async function saveReleaseWithRetry(releaseData, maxRetries = 3) {
  console.log('[RELEASE] Tentativo salvataggio release:', releaseData.id);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Prima verifichiamo la connessione
      await checkGunConnection();
      
      // Creiamo/verifichiamo il nodo all_releases
      await new Promise((resolve, reject) => {
        gun.get('all_releases').put({ exists: true }, ack => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });
      
      // Salviamo la release
      await new Promise((resolve, reject) => {
        const releaseNode = gun.get(`release_${releaseData.id}`);
        releaseNode.put(releaseData, ack => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });
      
      // Aggiungiamo al set di release
      await new Promise((resolve, reject) => {
        gun.get('all_releases').set(
          gun.get(`release_${releaseData.id}`),
          ack => {
            if (ack.err) reject(new Error(ack.err));
            else resolve();
          }
        );
      });
      
      // Verifichiamo il salvataggio
      const saved = await new Promise((resolve) => {
        gun.get(`release_${releaseData.id}`).once((data) => {
          resolve(data);
        });
      });
      
      if (!saved) throw new Error('Verifica salvataggio fallita');
      
      console.log('[RELEASE] Release salvata con successo:', releaseData.id);
      return saved;
      
    } catch (error) {
      console.error(`[RELEASE] Tentativo ${attempt}/${maxRetries} fallito:`, error);
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Funzione per salvare una traccia con retry
async function saveTrackWithRetry(releaseId, trackIndex, trackData, maxRetries = 3) {
  console.log(`[TRACK] Tentativo salvataggio traccia ${trackIndex} per release ${releaseId}`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Verifichiamo la connessione
      await checkGunConnection();
      
      // Salviamo la traccia
      const trackNode = gun.get(`track_${releaseId}_${trackIndex}`);
      await new Promise((resolve, reject) => {
        trackNode.put({
          index: trackIndex,
          title: trackData.title,
          type: 'audio',
          mimeType: trackData.mimeType,
          data: trackData.data,
          timestamp: Date.now()
        }, ack => {
          if (ack.err) reject(new Error(ack.err));
          else resolve();
        });
      });
      
      // Colleghiamo la traccia alla release
      await new Promise((resolve, reject) => {
        gun.get(`release_${releaseId}`)
           .get('tracks')
           .set(trackNode, ack => {
             if (ack.err) reject(new Error(ack.err));
             else resolve();
           });
      });
      
      console.log(`[TRACK] Traccia ${trackIndex} salvata con successo`);
      return true;
      
    } catch (error) {
      console.error(`[TRACK] Tentativo ${attempt}/${maxRetries} fallito:`, error);
      if (attempt === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

document.querySelector('header p').textContent = 
  `Bentornato! Crea e gestisci le tue release musicali`;

// Aggiungiamo un pulsante di test nascosto per diagnostica
const testUploadBtn = document.createElement('button');
testUploadBtn.id = 'testUploadBtn';
testUploadBtn.textContent = 'Test Upload';
testUploadBtn.style.position = 'fixed';
testUploadBtn.style.bottom = '10px';
testUploadBtn.style.right = '10px';
testUploadBtn.style.zIndex = '9999';
document.body.appendChild(testUploadBtn);

// Event listener per il pulsante di test
testUploadBtn.addEventListener('click', async () => {
  console.log('[TEST] Avvio test upload...');
  
  try {
    // Creiamo un file di test
    const blob = new Blob(['Test file content'], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('testFile', blob, 'test_file.txt');
    
    console.log('[TEST] FormData creato, invio richiesta...');
    
    // Inviamo la richiesta
    const response = await fetch(`${apiBaseUrl}/upload/test`, {
      method: 'POST',
      body: formData
    });
    
    console.log('[TEST] Risposta ricevuta, status:', response.status);
    
    const data = await response.json();
    console.log('[TEST] Risposta completa:', data);
    
    alert('Test upload completato! Controlla la console per i dettagli.');
  } catch (error) {
    console.error('[TEST] Errore test upload:', error);
    alert('Errore nel test upload: ' + error.message);
  }
});

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

// Funzione per salvare una release
async function saveRelease() {
  console.log('====== INIZIO PROCESSO CREAZIONE RELEASE ======');
  
  // Troviamo il pulsante submit in modo più affidabile
  const submitButton = document.getElementById('submitBtn') || document.querySelector('.create-release-btn');
  if (!submitButton) {
    console.error('[RELEASE] Pulsante submit non trovato');
    updateStatus('Errore: Pulsante submit non trovato', 'error');
    return;
  }
  
  submitButton.disabled = true;
  submitButton.textContent = "Creazione in corso...";
  
  try {
    // Verifichiamo la connessione a Gun
    console.log('[RELEASE] Verifica connessione Gun...');
    const testKey = 'test';
    const testValue = { ping: Date.now() };
    
    // Promise per il test di connessione
    const connectionTest = new Promise((resolve, reject) => {
      gun.get(testKey).put(testValue, ack => {
        if (ack.err) {
          reject(new Error(`Errore connessione Gun: ${ack.err}`));
        } else {
          resolve();
        }
      });
    });

    // Attendiamo il test di connessione con timeout
    await Promise.race([
      connectionTest,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout connessione Gun')), 5000))
    ]);

    console.log('[RELEASE] Connessione Gun verificata');

    // Raccogliamo i dati del form
    const form = document.getElementById('releaseForm');
    const formData = new FormData(form);
    
    // Generiamo un ID univoco per la release
    const releaseId = Date.now().toString();
    
    // Creiamo l'oggetto release
    const releaseData = {
      id: releaseId,
      type: formData.get('type') || 'single',
      title: formData.get('title'),
      date: formData.get('date'),
      creator: username,
      artwork: '', // Lo gestiremo separatamente
      createdAt: Date.now(),
      trackCount: 1
    };

    console.log('[RELEASE DEBUG] ==========================================');
    console.log('[RELEASE DEBUG] Inizio salvataggio release');
    console.log('[RELEASE DEBUG] Release ID:', releaseId);
    console.log('[RELEASE DEBUG] Dati release:', releaseData);

    // Prima creiamo il nodo all_releases se non esiste
    await new Promise((resolve, reject) => {
      gun.get('all_releases').put({ exists: true }, ack => {
        if (ack.err) {
          reject(new Error(`Errore creazione nodo all_releases: ${ack.err}`));
        } else {
          resolve();
        }
      });
    });

    // Ora salviamo la release
    await new Promise((resolve, reject) => {
      gun.get('release_' + releaseId).put(releaseData, ack => {
        if (ack.err) {
          reject(new Error(`Errore salvataggio release: ${ack.err}`));
        } else {
          resolve();
        }
      });
    });

    // Aggiungiamo la release al set di tutte le release
    await new Promise((resolve, reject) => {
      gun.get('all_releases').set(gun.get('release_' + releaseId), ack => {
        if (ack.err) {
          reject(new Error(`Errore aggiunta a all_releases: ${ack.err}`));
        } else {
          resolve();
        }
      });
    });

    // Verifichiamo che la release sia stata salvata
    const savedRelease = await new Promise((resolve, reject) => {
      gun.get('release_' + releaseId).once((data, key) => {
        if (!data) {
          reject(new Error('Release non trovata dopo il salvataggio'));
        } else {
          resolve(data);
        }
      });
    });

    console.log('[RELEASE] Release salvata con successo:', savedRelease);
    
    // Aggiorniamo l'UI
    updateStatus('Release salvata con successo!', 'success');
    showProgress(100);
    
    // Reset del form
    resetForm();
    
    // Ricarica le release
    loadUserReleases();

  } catch (error) {
    console.error('[RELEASE] Errore durante il salvataggio:', error);
    updateStatus(`Errore: ${error.message}`, 'error');
  } finally {
    // Ripristiniamo il pulsante in ogni caso
    submitButton.disabled = false;
    submitButton.textContent = "Crea Release";
  }
}

// Funzione per resettare il form
function resetForm() {
  console.log('[FORM] Reset del form...');
  
  // Reset del form principale
  const form = document.getElementById('releaseForm');
  if (form) {
    form.reset();
  }
  
  // Reset del container delle tracce
  resetTrackContainer();
  
  // Reset degli elementi UI
  const submitButton = document.getElementById('submitBtn');
  if (submitButton) {
    submitButton.disabled = false;
    submitButton.textContent = "Crea Release";
  }
  
  const spinner = document.getElementById('submitSpinner');
  if (spinner) {
    spinner.style.display = "none";
  }
  
  const feedback = document.getElementById('feedback');
  if (feedback) {
    feedback.textContent = "";
  }
  
  const loadingSpinner = document.getElementById('loadingSpinner');
  if (loadingSpinner) {
    loadingSpinner.style.display = "none";
  }
}

// Funzione per resettare il container delle tracce
function resetTrackContainer() {
  console.log('[FORM] Reset del container tracce...');
  
  const trackContainer = document.getElementById('trackContainer');
  if (trackContainer) {
    // Manteniamo solo la prima traccia e resettiamo i suoi campi
    const trackForms = trackContainer.querySelectorAll('.track-item-form');
    trackForms.forEach((form, index) => {
      if (index === 0) {
        const titleInput = form.querySelector('.track-title');
        const fileInput = form.querySelector('.track-file');
        if (titleInput) titleInput.value = '';
        if (fileInput) fileInput.value = '';
      } else {
        form.remove();
      }
    });
  }
  
  // Reset del tipo di release
  const releaseType = document.getElementById('releaseType');
  if (releaseType) {
    releaseType.value = 'single';
    // Trigger dell'evento change per aggiornare la UI
    releaseType.dispatchEvent(new Event('change'));
  }
}

function updateStatus(message, type = 'info') {
  const statusDiv = document.getElementById('status') || createStatusElement();
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
}

function createStatusElement() {
  const statusDiv = document.createElement('div');
  statusDiv.id = 'status';
  document.querySelector('form').appendChild(statusDiv);
  return statusDiv;
}

function showProgress(percent) {
  const progressBar = document.getElementById('progress') || createProgressBar();
  progressBar.style.width = `${percent}%`;
}

function createProgressBar() {
  const container = document.createElement('div');
  container.className = 'progress-container';
  
  const progressBar = document.createElement('div');
  progressBar.id = 'progress';
  progressBar.className = 'progress-bar';
  
  container.appendChild(progressBar);
  document.querySelector('form').appendChild(container);
  return progressBar;
}

// Aggiungiamo stili CSS per feedback visivo
const style = document.createElement('style');
style.textContent = `
  .status {
    margin: 10px 0;
    padding: 10px;
    border-radius: 4px;
  }
  .status.success {
    background-color: #d4edda;
    color: #155724;
  }
  .status.error {
    background-color: #f8d7da;
    color: #721c24;
  }
  .progress-container {
    width: 100%;
    height: 20px;
    background-color: #f0f0f0;
    border-radius: 10px;
    margin: 10px 0;
    overflow: hidden;
  }
  .progress-bar {
    width: 0%;
    height: 100%;
    background-color: #4CAF50;
    transition: width 0.3s ease;
  }
`;
document.head.appendChild(style);

// Funzione per salvare una traccia
async function saveTrack(releaseId, trackIndex, trackData) {
  return new Promise((resolve, reject) => {
    console.log(`[TRACK DEBUG] ==========================================`);
    console.log(`[TRACK DEBUG] Salvataggio traccia ${trackIndex} per release ${releaseId}`);
    
    // Creiamo un nodo per la traccia
    const trackNode = gun.get(`track_${releaseId}_${trackIndex}`).put({
      index: trackIndex,
      title: trackData.title,
      type: 'audio',
      mimeType: trackData.mimeType,
      data: trackData.data,
      timestamp: Date.now()
    });
    
    // Aggiungiamo la traccia alla release
    gun.get(`release_${releaseId}`).get('tracks').set(trackNode, (ack) => {
      if (ack.err) {
        console.error(`[TRACK DEBUG] Errore salvataggio traccia:`, ack.err);
        reject(new Error(`Errore durante il salvataggio della traccia: ${ack.err}`));
        return;
      }
      
      console.log(`[TRACK DEBUG] Traccia salvata con successo`);
      console.log(`[TRACK DEBUG] ==========================================`);
      resolve();
    });
  });
}

// Modifichiamo il gestore del submit
submitBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  
  if (!releaseForm.checkValidity()) {
    console.error("Form non valido");
    releaseForm.reportValidity();
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.textContent = "Creazione in corso...";
  feedback.textContent = "Preparazione...";
  
  try {
    // Verifichiamo subito la connessione
    await checkGunConnection();
    
    // Raccogliamo i dati della release
    const releaseId = Date.now().toString();
    const releaseData = {
      id: releaseId,
      type: releaseType.value,
      title: releaseTitle.value.trim(),
      date: releaseDate.value || "",
      creator: username,
      artwork: artworkFile.files[0] ? await readFileAsBase64(artworkFile.files[0]) : "",
      createdAt: Date.now()
    };
    
    // Salviamo la release
    feedback.textContent = "Salvataggio release...";
    await saveReleaseWithRetry(releaseData);
    
    // Raccogliamo e salviamo le tracce
    const trackForms = trackContainer.querySelectorAll(".track-item-form");
    for (let i = 0; i < trackForms.length; i++) {
      feedback.textContent = `Salvataggio traccia ${i + 1}/${trackForms.length}...`;
      
      const trackData = {
        title: trackForms[i].querySelector(".track-title").value.trim(),
        data: await readFileAsBase64(trackForms[i].querySelector(".track-file").files[0]),
        mimeType: trackForms[i].querySelector(".track-file").files[0].type
      };
      
      await saveTrackWithRetry(releaseId, i, trackData);
    }
    
    feedback.textContent = "Release creata con successo!";
    resetForm();
    loadUserReleases();
    
  } catch (error) {
    console.error("[RELEASE] Errore:", error);
    feedback.textContent = `Errore: ${error.message}`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Crea Release";
  }
});

// Carica le release dell'utente
function loadUserReleases() {
  userReleases.innerHTML = '<p>Caricamento delle tue release...</p>';
  let found = false;

  gun.get('all_releases').map().once((release, key) => {
    if (!release || !release.id || release.creator !== username) return;
    
    found = true;
    console.log("[LOAD] Release trovata:", release);
    
    let releaseElement = document.getElementById('release-' + release.id);
    if (!releaseElement) {
      releaseElement = document.createElement('div');
      releaseElement.id = 'release-' + release.id;
      releaseElement.className = 'release-item';
      userReleases.appendChild(releaseElement);
    }

    releaseElement.innerHTML = `
      <h3>${release.title || 'Untitled'}</h3>
      <p>${release.type === 'single' ? 'Single' : 'EP'} - ${release.date || ''}</p>
      <p>
        <a href="release.html?id=${release.id}" target="_blank">Visualizza</a> | 
        <a href="#" class="delete-release" data-id="${release.id}">Elimina</a>
      </p>
    `;

    releaseElement.querySelector('.delete-release').addEventListener('click', function(e) {
      e.preventDefault();
      if (confirm('Sei sicuro di voler eliminare questa release?')) {
        const releaseId = this.getAttribute('data-id');
        gun.get(`release_${releaseId}`).put(null);
        document.getElementById('release-' + releaseId).remove();
      }
    });
  });

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
        console.error('Pulsante submitBtn non trovato, impossibile procedere');
        feedback.textContent = "Errore: Impossibile trovare il pulsante di submit. Ricarica la pagina.";
      }
    }
  }
}); 