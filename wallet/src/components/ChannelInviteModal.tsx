import React, { useState } from 'react';

interface Contact {
  pubKey: string;
  name: string;
  alias: string;
}

interface ChannelInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  onInviteContact: (contactPubKey: string, contactName: string) => Promise<void>;
  channelName: string;
}

const ChannelInviteModal: React.FC<ChannelInviteModalProps> = ({
  isOpen,
  onClose,
  contacts,
  onInviteContact,
  channelName
}) => {
  const [selectedContact, setSelectedContact] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  if (!isOpen) return null;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedContact) {
      setError('Seleziona un contatto da invitare');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const contact = contacts.find(c => c.pubKey === selectedContact);
      if (!contact) {
        throw new Error('Contatto non trovato');
      }
      
      await onInviteContact(contact.pubKey, contact.name);
      onClose();
    } catch (err: any) {
      console.error('Errore nell\'invio dell\'invito:', err);
      setError(err.message || 'Errore nell\'invio dell\'invito');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Invita contatto a {channelName}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">
              Seleziona un contatto
            </label>
            <select
              className="w-full bg-black/20 border border-white/10 rounded-lg p-2"
              value={selectedContact}
              onChange={(e) => setSelectedContact(e.target.value)}
            >
              <option value="">-- Seleziona un contatto --</option>
              {contacts.map((contact) => (
                <option key={contact.pubKey} value={contact.pubKey}>
                  {contact.name || contact.alias}
                </option>
              ))}
            </select>
          </div>
          
          {error && (
            <div className="mb-4 text-error text-sm">
              {error}
            </div>
          )}
          
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
              onClick={onClose}
              disabled={isLoading}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary rounded-lg hover:bg-primary/80 transition-colors"
              disabled={isLoading || !selectedContact}
            >
              {isLoading ? "Invio in corso..." : "Invia invito"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChannelInviteModal; 