/**
 * Shogun Music - App Functions
 * Functions for loading and managing tracks
 */

// Array to store all tracks
window.tracks = [];
window.allTracks = [];

/**
 * Load tracks from server API
 */
window.loadTracks = async function() {
  try {
    console.log("Caricamento di tutte le tracce dal server...");
    
    // Mostra il messaggio di caricamento
    const songsLoading = document.getElementById("songsLoading");
    if (songsLoading) {
      songsLoading.style.display = "block";
    }
    
    // Nascondi altri messaggi di errore o "vuoto"
    const songsError = document.getElementById("songsError");
    const songsEmpty = document.getElementById("songsEmpty");
    if (songsError) songsError.style.display = "none";
    if (songsEmpty) songsEmpty.style.display = "none";
    
    // URL dell'API
    const tracksURL = "http://localhost:3000/api/tracks";
    
    // Array di tracce di fallback
    const fallbackTracks = [
      {
        id: "1",
        title: "Esempio Brano 1",
        artist: "Artista Esempio",
        album: "Album Esempio",
        duration: 180,
        artwork_path: "/assets/default-artwork.jpg"
      },
      {
        id: "2",
        title: "Esempio Brano 2",
        artist: "Artista Esempio",
        album: "Album Esempio",
        duration: 210,
        artwork_path: "/assets/default-artwork.jpg"
      }
    ];
    
    let loadedTracks = [];
    
    try {
      // Carica le tracce dall'API
      const response = await fetch(tracksURL);
      if (response.ok) {
        const data = await response.json();
        
        if (Array.isArray(data)) {
          loadedTracks = data;
        } else if (data && typeof data === 'object') {
          if (data.tracks && Array.isArray(data.tracks)) {
            loadedTracks = data.tracks;
          } else if (data.data && Array.isArray(data.data)) {
            loadedTracks = data.data;
          } else {
            const possibleTracks = Object.values(data).filter(item => 
              item && typeof item === 'object' && 'title' in item && 'artist' in item
            );
            
            if (possibleTracks.length > 0) {
              loadedTracks = possibleTracks;
            } else {
              throw new Error("Formato dei dati ricevuti non valido");
            }
          }
        } else {
          throw new Error("Formato dei dati ricevuti non valido");
        }
        
        console.log("API ha restituito " + loadedTracks.length + " elementi");
      } else {
        throw new Error(`Errore nella risposta API: ${response.status}`);
      }
    } catch (apiError) {
      console.warn("Errore nel caricamento tracce dall'API:", apiError.message);
      console.log("Utilizzo tracce di esempio");
      loadedTracks = fallbackTracks;
    }
    
    // Assegna alle variabili globali
    window.tracks = loadedTracks;
    window.allTracks = [...loadedTracks];
    
    console.log("Ricevute " + loadedTracks.length + " tracce dal server API");

    // Carica in localStorage come backup
    try {
      localStorage.setItem('cached_tracks', JSON.stringify(loadedTracks));
      console.log("Tracce salvate in localStorage");
    } catch (e) {
      console.warn("Impossibile salvare le tracce in localStorage:", e);
    }
    
    // Visualizza le tracce nell'interfaccia
    if (typeof displayTracks === 'function') {
      displayTracks(loadedTracks);
    } else {
      console.warn("Funzione displayTracks non disponibile");
    }
    
    console.log("Dati tracce inizializzati dal server");
    
    // Nascondi il messaggio di caricamento
    if (songsLoading) {
      songsLoading.style.display = "none";
    }
    
    // Se non ci sono tracce, mostra un messaggio
    if (loadedTracks.length === 0 && songsEmpty) {
      songsEmpty.style.display = "block";
    }
    
    // Esempio prima traccia per debug
    if (loadedTracks.length > 0) {
      console.log("Esempio prima traccia:", JSON.stringify(loadedTracks[0]));
    }
    if (loadedTracks.length > 1) {
      console.log("Esempio seconda traccia:", JSON.stringify(loadedTracks[1]));
    }
    
    return loadedTracks;
  } catch (error) {
    console.error("Errore durante il caricamento delle tracce:", error);
    
    // Carica dal localStorage come fallback
    try {
      const cachedTracks = localStorage.getItem('cached_tracks');
      if (cachedTracks) {
        const parsedTracks = JSON.parse(cachedTracks);
        console.log("Caricate " + parsedTracks.length + " tracce da localStorage");
        window.tracks = parsedTracks;
        window.allTracks = [...parsedTracks];
        
        if (typeof displayTracks === 'function') {
          displayTracks(parsedTracks);
        }
        
        return parsedTracks;
      }
    } catch (e) {
      console.error("Errore nel recupero tracce da localStorage:", e);
    }
    
    // Nascondi il messaggio di caricamento
    const songsLoading = document.getElementById("songsLoading");
    if (songsLoading) {
      songsLoading.style.display = "none";
    }
    
    // Mostra un messaggio di errore
    const songsError = document.getElementById("songsError");
    if (songsError) {
      songsError.style.display = "block";
      songsError.textContent = `Errore nel caricamento delle tracce: ${error.message}`;
    }
    
    return [];
  }
}; 