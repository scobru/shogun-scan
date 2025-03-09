import React, { useState, useEffect } from 'react';
import { MOMMessage, MOMDraftMessage } from 'shogun-sdk';
import MessageInput from './MessageInput';
import { formatAddress, formatDate } from '../utils/formatters';
import { sdk } from '../App';

interface MOMSectionProps {
  wallet: any;
  address: string;
}

const MOMSection: React.FC<MOMSectionProps> = ({ wallet, address }) => {
  const [messages, setMessages] = useState<MOMMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const [newMessage, setNewMessage] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<MOMMessage | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Carica i messaggi quando cambia l'indirizzo
  useEffect(() => {
    if (address) {
      loadMessages();
    }
  }, [address]);

  // Carica i messaggi dal blockchain
  const loadMessages = async () => {
    if (!sdk || !sdk.mom) {
      setError('SDK non inizializzato correttamente');
      return;
    }

    try {
      setLoadingMessages(true);
      // Recupera i messaggi per l'indirizzo corrente
      const rawMessages = await sdk.getMOMMessages(address);
      
      // Recupera il contenuto dei messaggi
      if (rawMessages.length > 0) {
        const messagesWithContent = await sdk.getMOMMessagesWithContent(rawMessages);
        setMessages(messagesWithContent);
      } else {
        setMessages([]);
      }
    } catch (error: any) {
      console.error('Errore nel caricamento dei messaggi:', error);
      setError(`Errore nel caricamento dei messaggi: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Pubblica un nuovo messaggio
  const publishMessage = async () => {
    if (!sdk || !sdk.mom) {
      setError('SDK non inizializzato correttamente');
      return;
    }

    if (!wallet) {
      setError('Wallet non disponibile');
      return;
    }

    if (!newMessage.trim()) {
      setError('Il messaggio non può essere vuoto');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Crea il messaggio
      const draftMessage: MOMDraftMessage = {
        content: newMessage,
        contentType: 'text/markdown'
      };

      // Se stiamo rispondendo a un messaggio, aggiungi il riferimento
      if (replyingTo) {
        draftMessage.replyTo = replyingTo.multihash;
      }

      // Pubblica il messaggio
      let operation: number | undefined = undefined; // Usa l'operazione predefinita (ADD)
      
      // Se è una risposta, usa l'operazione REPLY (0x02)
      if (replyingTo) {
        operation = 0x02; // MOMCoreOperation.REPLY
      }
      
      const txHash = await sdk.publishMOMMessage(wallet, draftMessage, operation);
      
      setSuccess(`Messaggio pubblicato con successo! Hash transazione: ${txHash.slice(0, 10)}...`);
      setNewMessage('');
      setReplyingTo(null);
      
      // Ricarica i messaggi dopo un breve ritardo
      setTimeout(() => {
        loadMessages();
      }, 2000);
    } catch (error: any) {
      console.error('Errore nella pubblicazione del messaggio:', error);
      setError(`Errore nella pubblicazione del messaggio: ${error.message || 'Errore sconosciuto'}`);
    } finally {
      setLoading(false);
    }
  };

  // Gestisce l'inizio di una risposta
  const handleReply = (message: MOMMessage) => {
    setReplyingTo(message);
    // Focus sull'input del messaggio
    const input = document.getElementById('message-input');
    if (input) {
      input.focus();
    }
  };

  // Cancella lo stato di risposta
  const cancelReply = () => {
    setReplyingTo(null);
  };

  // Formatta il contenuto del messaggio per la visualizzazione
  const formatContent = (content: string | undefined) => {
    if (!content) return 'Contenuto non disponibile';
    
    // Potremmo aggiungere qui la formattazione Markdown se necessario
    return content;
  };

  // Renderizza un singolo messaggio
  const renderMessage = (message: MOMMessage, isReply: boolean = false) => {
    return (
      <div 
        key={message.multihash}
        className={`p-4 mb-3 rounded-lg ${isReply ? 'ml-8 bg-gray-900' : 'bg-gray-800'}`}
      >
        <div className="flex justify-between mb-2">
          <div className="text-sm text-gray-400">
            Da: {formatAddress(message.author)}
          </div>
          <div className="text-xs text-gray-500">
            {formatDate(new Date(message.timestamp * 1000))}
          </div>
        </div>
        
        <div className="text-white whitespace-pre-wrap mb-3">
          {formatContent(message.content)}
        </div>
        
        {!isReply && (
          <div className="flex space-x-2">
            <button 
              onClick={() => handleReply(message)}
              className="text-xs px-2 py-1 bg-blue-900 hover:bg-blue-800 text-blue-200 rounded"
            >
              Rispondi
            </button>
            
            {/* Altri bottoni per azioni come "Mi piace", ecc. */}
          </div>
        )}
        
        {/* Visualizza le risposte */}
        {message.replies && message.replies.length > 0 && (
          <div className="mt-3">
            {message.replies.map(reply => renderMessage(reply, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white mb-2">I Miei Messaggi</h2>
        <p className="text-gray-400 text-sm">
          Pubblica messaggi sulla blockchain, rispondi e interagisci con altri utenti.
        </p>
      </div>
      
      {/* Form per la pubblicazione dei messaggi */}
      <div className="mb-4 bg-gray-800 p-4 rounded-lg">
        {replyingTo && (
          <div className="mb-3 p-2 bg-gray-700 rounded-md flex justify-between items-center">
            <div className="text-sm text-gray-300">
              In risposta a: <span className="text-blue-300">{formatContent(replyingTo.content)?.substring(0, 50)}...</span>
            </div>
            <button 
              onClick={cancelReply}
              className="text-gray-400 hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        )}
        
        <MessageInput
          id="message-input"
          value={newMessage}
          onChange={setNewMessage}
          placeholder="Scrivi il tuo messaggio..."
          rows={3}
          onSendMessage={async (text) => {
            // Usa la funzione pubblicaMessaggio esistente
            await publishMessage();
            return Promise.resolve();
          }}
        />
        
        <div className="flex justify-between mt-2">
          <div>
            {error && <div className="text-xs text-red-400">{error}</div>}
            {success && <div className="text-xs text-green-400">{success}</div>}
          </div>
          <button
            onClick={publishMessage}
            disabled={loading || !newMessage.trim()}
            className={`px-4 py-2 rounded-md text-white ${
              loading || !newMessage.trim()
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Pubblicazione...' : 'Pubblica'}
          </button>
        </div>
      </div>
      
      {/* Lista dei messaggi */}
      <div className="flex-grow overflow-auto">
        {loadingMessages ? (
          <div className="text-center text-gray-400 py-8">Caricamento messaggi...</div>
        ) : messages.length > 0 ? (
          <div>
            {messages.map(message => renderMessage(message))}
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">
            Non ci sono messaggi da visualizzare.
            <br />
            Sii il primo a pubblicare un messaggio!
          </div>
        )}
      </div>
    </div>
  );
};

export default MOMSection; 