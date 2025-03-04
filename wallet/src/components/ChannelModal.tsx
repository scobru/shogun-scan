import React, { useState } from 'react';

interface ChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateChannel: (name: string, isPrivate: boolean) => Promise<void>;
}

const ChannelModal: React.FC<ChannelModalProps> = ({ isOpen, onClose, onCreateChannel }) => {
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  if (!isOpen) return null;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (name.length < 3) {
      setError('Il nome del canale deve contenere almeno 3 caratteri');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      console.log(`Tentativo di creazione canale: ${name} (${isPrivate ? 'privato' : 'pubblico'})`);
      
      // Imposta un timeout per mostrare un messaggio se la creazione sta impiegando troppo tempo
      const timeoutId = setTimeout(() => {
        setError('La creazione del canale sta impiegando più tempo del previsto...');
      }, 5000);
      
      await onCreateChannel(name, isPrivate);
      
      clearTimeout(timeoutId);
      
      // La creazione è avvenuta con successo, chiudi il modale
      onClose();
    } catch (err: any) {
      console.error('Errore nella creazione del canale:', err);
      setError(err.message || 'Errore nella creazione del canale');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Crea nuovo canale</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm mb-1">Nome del canale</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-lg p-2"
              placeholder="Inserisci il nome del canale"
            />
          </div>
          
          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="mr-2"
              />
              <span>Canale privato</span>
            </label>
            <p className="text-xs text-gray-400 mt-1">
              I canali privati sono visibili solo agli utenti invitati.
            </p>
          </div>
          
          {error && (
            <div className="mb-4 text-error text-sm">
              {error}
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/80"
            >
              {isLoading ? "Creazione..." : "Crea canale"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChannelModal; 