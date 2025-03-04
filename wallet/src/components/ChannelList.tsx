import React, { useState, useEffect } from 'react';
import ChannelModal from './ChannelModal';
import ChannelInvites from './ChannelInvites';

interface Channel {
  key: string;
  name: string;
  notifCount?: number;
  isPrivate: boolean;
  userCount: number;
}

interface ChannelInvite {
  key: string;
  name: string;
  isPrivate: boolean;
  owner: string;
  invitedBy: string;
  invitedByName: string;
  timestamp: number;
}

interface ChannelListProps {
  channels: Channel[];
  channelInvites: ChannelInvite[];
  activeChannel: string | null;
  onSelectChannel: (channelKey: string) => void;
  onCreateChannel: (name: string, isPrivate: boolean) => Promise<void>;
  onAcceptInvite: (invite: ChannelInvite) => Promise<void>;
  onRejectInvite: (invite: ChannelInvite) => Promise<void>;
  onSearchPublicChannels: () => void;
}

const ChannelList: React.FC<ChannelListProps> = ({
  channels,
  channelInvites,
  activeChannel,
  onSelectChannel,
  onCreateChannel,
  onAcceptInvite,
  onRejectInvite,
  onSearchPublicChannels
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'channels' | 'invites'>('channels');
  
  // Apre il modale invece di usare prompt/confirm
  const handleOpenModal = () => {
    setIsModalOpen(true);
  };
  
  // Chiude il modale
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };
  
  // Gestisce la creazione del canale tramite il modale
  const handleCreateChannel = async (name: string, isPrivate: boolean) => {
    setError('');
    
    try {
      console.log(`Creazione canale: ${name} (${isPrivate ? 'privato' : 'pubblico'})`);
      await onCreateChannel(name, isPrivate);
      console.log('Canale creato con successo');
    } catch (err: any) {
      console.error('Errore nella creazione del canale:', err);
      setError(err.message || 'Errore nella creazione del canale');
      throw err; // Rilancia l'errore per gestirlo nel modale
    }
  };
  
  // Aggiungi questa funzione per gestire la ricerca dei canali pubblici
  const handleSearchPublicChannels = () => {
    console.log("Ricerca canali pubblici...");
    onSearchPublicChannels();
  };

  useEffect(() => {
    // Carica i canali solo al mount del componente
    handleSearchPublicChannels();
  }, []); // Rimuovi handleSearchPublicChannels dalle dipendenze se non necessario
  
  return (
    <div className="bg-card rounded-xl overflow-hidden h-full flex flex-col">
      <div className="p-4 border-b border-white/5">
        <h2 className="text-lg font-semibold">Canali</h2>
      </div>
      
      {/* Tabs per canali e inviti */}
      <div className="flex bg-black/20 p-1 mx-4 mt-4 rounded-lg">
        <button
          className={`flex-1 py-2 rounded ${activeTab === 'channels' ? 'bg-primary text-white' : 'text-gray-400'}`}
          onClick={() => setActiveTab('channels')}
        >
          Canali
        </button>
        <button
          className={`flex-1 py-2 rounded ${activeTab === 'invites' ? 'bg-primary text-white' : 'text-gray-400'}`}
          onClick={() => setActiveTab('invites')}
        >
          Inviti {Array.isArray(channelInvites) && channelInvites.length > 0 ? `(${channelInvites.length})` : ''}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'channels' ? (
          channels.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              Nessun canale disponibile
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {channels.map((channel, index) => (
                <div 
                  key={`channel-${channel.key}-${index}`}
                  className={`p-4 cursor-pointer hover:bg-white/5 transition-colors ${
                    activeChannel === channel.key ? 'bg-white/10' : ''
                  }`}
                  onClick={() => onSelectChannel(channel.key)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium flex items-center gap-1">
                        {channel.name}
                        {channel.isPrivate && (
                          <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
                            Privato
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {channel.userCount} {channel.userCount === 1 ? 'membro' : 'membri'}
                      </div>
                    </div>
                    {channel.notifCount && channel.notifCount > 0 && (
                      <div className="bg-primary text-white rounded-full h-6 w-6 flex items-center justify-center text-xs">
                        {channel.notifCount}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <ChannelInvites 
            invites={channelInvites}
            onAccept={onAcceptInvite}
            onReject={onRejectInvite}
          />
        )}
      </div>
      
      <div className="p-4 border-t border-white/5">
        <div className="flex flex-col gap-2">
          <button 
            className="w-full p-2 bg-primary rounded-lg text-white hover:bg-primary/80 transition-colors flex justify-center items-center"
            onClick={handleOpenModal}
          >
            Crea nuovo canale
          </button>
          
          <button 
            className="w-full p-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-colors flex justify-center items-center"
            onClick={handleSearchPublicChannels}
          >
            Cerca canali pubblici
          </button>
        </div>
        
        {error && (
          <div className="mt-2 text-error text-sm text-center">
            {error}
          </div>
        )}
      </div>
      
      {/* Modale per la creazione del canale */}
      <ChannelModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onCreateChannel={handleCreateChannel}
      />
    </div>
  );
};

export default ChannelList; 