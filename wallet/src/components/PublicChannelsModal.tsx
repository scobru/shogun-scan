import React, { useState, useEffect } from 'react';

interface Channel {
  key: string;
  name: string;
  hash?: string;
  isPrivate: boolean;
  userCount: number;
  owner?: string;
}

interface PublicChannelsModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicChannels: Channel[];
  onJoinChannel: (channel: Channel) => Promise<void>;
  loadPublicChannels: () => void;
}

const PublicChannelsModal: React.FC<PublicChannelsModalProps> = ({
  isOpen,
  onClose,
  publicChannels,
  onJoinChannel,
  loadPublicChannels
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    if (isOpen) {
      loadPublicChannels();
    }
  }, [isOpen, loadPublicChannels]);
  
  if (!isOpen) return null;
  
  const filteredChannels = publicChannels.filter(channel => 
    channel.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handleJoinChannel = async (channel: Channel) => {
    setIsLoading(true);
    setError('');
    
    try {
      await onJoinChannel(channel);
      onClose();
    } catch (err: any) {
      console.error('Errore nell\'unione al canale:', err);
      setError(err.message || 'Errore nell\'unione al canale');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 max-w-md w-full max-h-[80vh] flex flex-col">
        <h2 className="text-xl font-semibold mb-4">Canali pubblici</h2>
        
        <div className="mb-4">
          <input
            type="text"
            placeholder="Cerca canali..."
            className="w-full bg-black/20 border border-white/10 rounded-lg p-2"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {filteredChannels.length === 0 ? (
            <div className="text-center text-gray-400 p-4">
              Nessun canale pubblico trovato
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filteredChannels.map((channel) => (
                <div key={channel.key} className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{channel.name}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {channel.userCount} {channel.userCount === 1 ? 'membro' : 'membri'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoinChannel(channel)}
                      className="px-3 py-1 bg-primary text-white rounded-lg text-sm hover:bg-primary/80"
                      disabled={isLoading}
                    >
                      Unisciti
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {error && (
          <div className="mt-4 text-error text-sm">
            {error}
          </div>
        )}
        
        <div className="mt-4 flex justify-end">
          <button
            className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
            onClick={onClose}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};

export default PublicChannelsModal; 