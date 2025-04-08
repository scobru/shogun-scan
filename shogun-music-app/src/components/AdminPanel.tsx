import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { Track } from '../types';
import { SERVER_CONFIG } from '../config';

const AdminPanel: React.FC = () => {
  const { state, uploadTrack, refreshData, validateToken } = useApp();
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [tokenValidationInProgress, setTokenValidationInProgress] = useState(false);
  const [trackData, setTrackData] = useState<Partial<Track>>({
    title: '',
    artist: '',
    album: '',
    duration: 0
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);
  const tokenValidationTimerRef = useRef<number | null>(null);

  const handleAuthenticate = async () => {
    if (tokenValidationInProgress) {
      console.log('Autenticazione già in corso, attendere...');
      return;
    }
    
    if (!token.trim()) {
      setUploadStatus({ success: false, message: 'Token è richiesto' });
      return;
    }

    setTokenValidationInProgress(true);
    setUploadStatus({ success: false, message: 'Autenticazione in corso...' });
    
    try {
      // In sviluppo, verifichiamo se corrisponde al token di sviluppo
      if (process.env.NODE_ENV === 'development' && token === SERVER_CONFIG.devToken) {
        setIsAuthenticated(true);
        setUploadStatus({ success: true, message: 'Autenticazione locale completata (modalità sviluppo)' });
        localStorage.setItem('admin_token', token);
        return;
      }
      
      // Validate token with the server using validateToken from props
      const isValid = await validateToken(token);

      if (isValid) {
        setIsAuthenticated(true);
        setUploadStatus({ success: true, message: 'Autenticazione completata' });
        localStorage.setItem('admin_token', token);
      } else {
        setUploadStatus({ success: false, message: 'Token non valido' });
      }
    } catch (error) {
      let errorMessage = 'Errore durante l\'autenticazione';
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }
      setUploadStatus({ success: false, message: errorMessage });
    } finally {
      setTokenValidationInProgress(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'duration') {
      // Convert minutes:seconds to seconds
      if (value.includes(':')) {
        const [min, sec] = value.split(':').map(Number);
        setTrackData(prev => ({ ...prev, [name]: (min * 60) + sec }));
      } else {
        setTrackData(prev => ({ ...prev, [name]: Number(value) }));
      }
    } else {
      setTrackData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isUploading) {
      console.log('Caricamento già in corso, attendere...');
      return;
    }
    
    setIsUploading(true);
    setUploadStatus(null);

    // Verifica che il token sia ancora valido prima di tentare l'upload
    try {
      const isTokenValid = await validateToken(token);
      if (!isTokenValid) {
        setUploadStatus({ 
          success: false, 
          message: 'Il token non è più valido, effettua nuovamente l\'accesso'
        });
        handleLogout();
        setIsUploading(false);
        return;
      }
    } catch (error) {
      console.error('Error validating token:', error);
      setUploadStatus({ 
        success: false, 
        message: 'Errore durante la verifica del token'
      });
      setIsUploading(false);
      return;
    }

    if (!trackData.title || !trackData.artist || !trackData.album) {
      setUploadStatus({ success: false, message: 'Titolo, artista e album sono richiesti' });
      setIsUploading(false);
      return;
    }

    const artworkFile = fileInputRef.current?.files?.[0];
    const audioFile = audioFileRef.current?.files?.[0];

    if (!audioFile) {
      setUploadStatus({ success: false, message: 'File audio è richiesto' });
      setIsUploading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('title', trackData.title || '');
      formData.append('artist', trackData.artist || '');
      formData.append('album', trackData.album || '');
      
      if (artworkFile) {
        formData.append('artworkFile', artworkFile);
      }
      
      formData.append('audioFile', audioFile);

      setUploadStatus({ success: false, message: 'Caricamento in corso...' });
      const result = await uploadTrack(formData, token);
      
      if (result.success) {
        setUploadStatus({ success: true, message: 'Traccia caricata con successo' });
        setTrackData({
          title: '',
          artist: '',
          album: '',
          duration: 0
        });
        
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (audioFileRef.current) audioFileRef.current.value = '';
        
        // Refresh track list ma solo dopo un breve ritardo per permettere al server di elaborare
        setTimeout(() => {
          refreshData();
        }, 1000);
      } else {
        setUploadStatus({ success: false, message: result.message || 'Errore durante il caricamento' });
      }
    } catch (error) {
      setUploadStatus({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Errore sconosciuto durante il caricamento' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Check for saved token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
      setToken(savedToken);
      // Invece di autenticare automaticamente, imposta solo lo stato visivo
      setIsAuthenticated(true);
      
      // Pianifichiamo una validazione del token in background per non bloccare il rendering
      tokenValidationTimerRef.current = window.setTimeout(() => {
        validateSavedToken();
      }, 2000); // Attendi 2 secondi per non sovraccaricare l'avvio dell'app
    }
    
    return () => {
      // Pulizia del timer quando il componente viene smontato
      if (tokenValidationTimerRef.current !== null) {
        clearTimeout(tokenValidationTimerRef.current);
      }
    };
  }, []);

  // Validate token only when needed, not on every mount
  const validateSavedToken = async () => {
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken && !tokenValidationInProgress) {
      setTokenValidationInProgress(true);
      
      try {
        console.log('Validazione token in background...');
        const isValid = await validateToken(savedToken);
        if (!isValid) {
          // Se il token non è più valido, fai logout
          console.log('Token non più valido, logout automatico');
          handleLogout();
          setUploadStatus({ 
            success: false, 
            message: 'La sessione è scaduta, effettua nuovamente l\'accesso' 
          });
        } else {
          console.log('Token ancora valido');
        }
      } catch (error) {
        console.error('Error validating saved token:', error);
      } finally {
        setTokenValidationInProgress(false);
      }
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setToken('');
    localStorage.removeItem('admin_token');
  };

  // Format seconds to MM:SS for display
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>Pannello di Amministrazione</h2>
        {isAuthenticated && (
          <button 
            className="admin-logout-btn"
            onClick={handleLogout}
          >
            <i className="fas fa-sign-out-alt"></i> Logout
          </button>
        )}
      </div>

      {!isAuthenticated ? (
        <div className="admin-auth-form">
          <p>Inserisci il token di autenticazione per accedere al pannello di amministrazione</p>
          <div className="admin-form-row">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Token di accesso"
              className="admin-input"
              disabled={tokenValidationInProgress}
            />
            <button 
              onClick={handleAuthenticate}
              className="admin-auth-btn"
              disabled={tokenValidationInProgress}
            >
              {tokenValidationInProgress ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Autenticazione...
                </>
              ) : (
                <>
                  <i className="fas fa-key"></i> Autentica
                </>
              )}
            </button>
          </div>
          
          {uploadStatus && (
            <div className={`upload-status ${uploadStatus.success ? 'success' : 'error'}`}>
              <i className={`fas ${uploadStatus.success ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
              <span>{uploadStatus.message}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="admin-content">
          <div className="admin-track-upload">
            <h3>Carica Nuova Traccia</h3>
            <form onSubmit={handleSubmit} className="upload-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Titolo*</label>
                  <input
                    type="text"
                    name="title"
                    value={trackData.title}
                    onChange={handleInputChange}
                    required
                    className="admin-input"
                  />
                </div>
                <div className="form-group">
                  <label>Artista*</label>
                  <input
                    type="text"
                    name="artist"
                    value={trackData.artist}
                    onChange={handleInputChange}
                    required
                    className="admin-input"
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Album*</label>
                  <input
                    type="text"
                    name="album"
                    value={trackData.album}
                    onChange={handleInputChange}
                    required
                    className="admin-input"
                  />
                </div>
                <div className="form-group">
                  <label>Durata (MM:SS o secondi)</label>
                  <input
                    type="text"
                    name="duration"
                    value={trackData.duration ? formatDuration(trackData.duration) : ''}
                    onChange={handleInputChange}
                    className="admin-input"
                    placeholder="3:45"
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Artwork (Immagine di copertina)</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="admin-file-input"
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>File Audio*</label>
                  <input
                    type="file"
                    ref={audioFileRef}
                    accept="audio/*"
                    required
                    className="admin-file-input"
                  />
                </div>
              </div>
              
              <div className="form-actions">
                <button 
                  type="submit" 
                  className="admin-upload-btn"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <i className="fas fa-spinner fa-spin"></i> Caricamento...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-upload"></i> Carica Traccia
                    </>
                  )}
                </button>
              </div>

              {uploadStatus && (
                <div className={`upload-status ${uploadStatus.success ? 'success' : 'error'}`}>
                  <i className={`fas ${uploadStatus.success ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                  <span>{uploadStatus.message}</span>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel; 