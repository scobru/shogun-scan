import React, { useState } from 'react';
import { Contact } from '../services/types';
import { unstoppableChat } from '../services';

interface ContactListProps {
  contacts: Contact[];
  contactInvites: Contact[];
  activeContact: string | null;
  onSelectContact: (pubKey: string) => void;
  onAddContact: (pubKey: string) => Promise<void>;
  onAcceptInvite: (contact: Contact) => Promise<void>;
  onRejectInvite: (pubKey: string) => Promise<void>;
  onRemoveContact: (pubKey: string) => Promise<void>;
  onReloadInvites?: () => void;
}

const ContactList: React.FC<ContactListProps> = ({ 
  contacts, 
  contactInvites,
  activeContact, 
  onSelectContact,
  onAddContact,
  onAcceptInvite,
  onRejectInvite,
  onRemoveContact,
  onReloadInvites
}) => {
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState<'contacts' | 'invites'>('contacts');
  const [newContactPubKey, setNewContactPubKey] = useState('');
  const [showAddContactForm, setShowAddContactForm] = useState(false);

  // Gestisce l'invio del form per aggiungere un nuovo contatto
  const handleNewContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newContactPubKey.trim()) {
      setIsAddingContact(true);
      try {
        await onAddContact(newContactPubKey.trim());
        setNewContactPubKey('');
        setShowAddContactForm(false);
        setErrorMessage("");
      } catch (error: any) {
        console.error("Errore nell'aggiunta del contatto:", error);
        setErrorMessage(error.message || "Errore nell'aggiunta del contatto");
      } finally {
        setIsAddingContact(false);
      }
    }
  };

  // Funzione per reinviare un invito a un contatto
  const handleResendInvite = async (contact: Contact) => {
    try {
      console.log(`Reinvio invito a ${contact.name} (${contact.pubKey})`);
      
      // Reinviamo l'invito usando solo la chiave pubblica
      await onAddContact(contact.pubKey);
      
      alert(`Invito reinviato con successo a ${contact.name}`);
    } catch (error: any) {
      console.error("Errore nel reinvio dell'invito:", error);
      alert(`Errore nel reinvio dell'invito: ${error.message || 'Errore sconosciuto'}`);
    }
  };

  return (
    <div className="bg-card rounded-xl overflow-hidden h-full flex flex-col">
      <div className="p-4 border-b border-white/5">
        <h2 className="text-lg font-semibold">Contatti</h2>
      </div>
      
      <div className="flex border-b border-white/5">
        <button
          className={`flex-1 p-2 ${activeTab === 'contacts' ? 'bg-white/10' : ''}`}
          onClick={() => setActiveTab('contacts')}
        >
          Contatti
          {contacts.length > 0 && (
            <span className="ml-1 bg-primary text-white text-xs rounded-full px-2">
              {contacts.length}
            </span>
          )}
        </button>
        <button
          className={`flex-1 p-2 ${activeTab === 'invites' ? 'bg-white/10' : ''}`}
          onClick={() => setActiveTab('invites')}
        >
          Inviti
          {contactInvites.length > 0 && (
            <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2">
              {contactInvites.length}
            </span>
          )}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'contacts' ? (
          contacts.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              Nessun contatto disponibile
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {contacts.map((contact) => (
                <div 
                  key={contact.pubKey}
                  className={`p-4 cursor-pointer hover:bg-white/5 transition-colors flex justify-between items-center ${
                    activeContact === contact.pubKey ? 'bg-white/10' : ''
                  }`}
                >
                  <div 
                    className="flex-1"
                    onClick={() => {
                      try {
                        onSelectContact(contact.pubKey);
                      } catch (error) {
                        console.error("Errore nella selezione del contatto:", error);
                      }
                    }}
                  >
                    <div className="font-medium">{contact.name}</div>
                    <div className="text-sm text-gray-400">{contact.alias}</div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {contact.notifCount && contact.notifCount > 0 && (
                      <div className="bg-primary text-white rounded-full h-6 w-6 flex items-center justify-center text-xs">
                        {contact.notifCount}
                      </div>
                    )}
                    
                    <button 
                      className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-full transition-colors"
                      onClick={(e) => {
                        e.stopPropagation(); // Previene la selezione del contatto
                        handleResendInvite(contact);
                      }}
                      title="Reinvia invito"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M7.5 3.375c0-1.036.84-1.875 1.875-1.875h.375a3.75 3.75 0 013.75 3.75v1.875C13.5 8.161 14.34 9 15.375 9h1.875A3.75 3.75 0 0121 12.75v3.375C21 17.16 20.16 18 19.125 18h-9.75A1.875 1.875 0 017.5 16.125V3.375z" />
                        <path d="M3.375 7.5c0-1.036.84-1.875 1.875-1.875h.375a3.75 3.75 0 013.75 3.75v1.875C9.375 12.286 10.214 13.125 11.25 13.125h1.875A3.75 3.75 0 0116.875 16.875v3.375c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013.375 20.25V7.5z" />
                      </svg>
                    </button>
                    
                    <button 
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                      onClick={(e) => {
                        e.stopPropagation(); // Previene la selezione del contatto
                        onRemoveContact(contact.pubKey);
                      }}
                      title="Rimuovi contatto"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          contactInvites.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              Nessun invito in attesa
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {contactInvites.map((invite) => (
                <div 
                  key={invite.pubKey}
                  className="p-4 hover:bg-white/5 border-b border-white/10"
                >
                  <div className="font-medium">{invite.name || 'Utente'}</div>
                  <div className="text-sm text-gray-400 mb-2">
                    {/* Mostra una versione abbreviata della pubKey se l'alias è troppo lungo */}
                    {invite.alias && invite.alias.length > 20 
                      ? `${invite.alias.substring(0, 10)}...${invite.alias.substring(invite.alias.length - 5)}`
                      : invite.alias}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    {invite.timestamp 
                      ? new Date(invite.timestamp).toLocaleString()
                      : 'Data sconosciuta'}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm"
                      onClick={() => onAcceptInvite(invite)}
                    >
                      Accetta
                    </button>
                    <button 
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm"
                      onClick={() => onRejectInvite(invite.pubKey)}
                    >
                      Rifiuta
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
      
      {activeTab === 'contacts' && (
        <div className="p-4 border-t border-white/5">
          {showAddContactForm ? (
            <form onSubmit={handleNewContactSubmit} className="space-y-2">
              <input
                type="text"
                value={newContactPubKey}
                onChange={(e) => setNewContactPubKey(e.target.value)}
                placeholder="Inserisci la chiave pubblica del contatto"
                className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-white"
                required
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 p-2 bg-primary rounded-lg text-white hover:bg-primary/80 transition-colors"
                  disabled={isAddingContact}
                >
                  {isAddingContact ? "Aggiunta..." : "Aggiungi"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddContactForm(false)}
                  className="flex-1 p-2 bg-gray-700 rounded-lg text-white hover:bg-gray-600 transition-colors"
                >
                  Annulla
                </button>
              </div>
            </form>
          ) : (
            <button 
              className="w-full p-2 bg-primary rounded-lg text-white hover:bg-primary/80 transition-colors"
              onClick={() => setShowAddContactForm(true)}
            >
              Aggiungi Contatto
            </button>
          )}
          
          {errorMessage && (
            <div className="mt-2 text-error text-sm text-center">
              {errorMessage}
            </div>
          )}
        </div>
      )}

      {activeTab === 'invites' && (
        <div className="p-2 text-center space-y-2">
          <button
            className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
            onClick={() => {
              console.log('Verifica manuale degli inviti');
              if (onReloadInvites) {
                onReloadInvites();
              } else {
                window.location.reload();
              }
            }}
          >
            Ricarica Inviti
          </button>
          
          <div className="mt-2">
            <button 
              className="bg-gray-600 text-white px-3 py-1 rounded text-sm"
              onClick={() => {
                if (window.debugInvites) {
                  window.debugInvites();
                } else {
                  console.log("Funzione di debug non disponibile");
                }
              }}
              title="Verifica i percorsi degli inviti nella console"
            >
              Debug Inviti
            </button>
          </div>

          <button
            className="bg-yellow-500 text-white px-2 py-1 rounded text-xs"
            onClick={() => {
              console.log('Test invito ad un indirizzo demo');
              const demoAddress = prompt("Inserisci l'indirizzo del destinatario:");
              if (demoAddress) {
                if (window.testSendInvite) {
                  window.testSendInvite(demoAddress);
                } else {
                  alert("Funzione di test non disponibile");
                }
              }
            }}
            title="Testa invio invito a indirizzo specifico"
          >
            Test Invito
          </button>

          <button
            className="bg-red-500 text-white px-2 py-1 rounded text-xs mt-2"
            onClick={() => {
              if (window.forceCheckInvites) {
                window.forceCheckInvites();
                console.log("Verifica inviti forzata attivata");
              } else {
                const userPub = window.unstoppable?.gun?.user()?.is?.pub;
                alert(`Pub: ${userPub || 'Non autenticato'}`);
                console.log("Chiave pubblica utente:", userPub);
              }
            }}
            title="Forza verifica inviti da tutte le fonti"
          >
            Forza Verifica
          </button>

          <button
            className="bg-purple-500 text-white px-2 py-1 rounded text-xs ml-2"
            onClick={() => {
              if (window.unstoppable && window.unstoppable.cleanupInvites) {
                window.unstoppable.cleanupInvites().then(() => {
                  if (onReloadInvites) onReloadInvites();
                  alert("Pulizia inviti completata");
                });
              } else {
                alert("Funzione di pulizia non disponibile");
              }
            }}
            title="Rimuove gli inviti vecchi o danneggiati"
          >
            Pulisci Inviti
          </button>
        </div>
      )}
    </div>
  );
};

export default ContactList; 