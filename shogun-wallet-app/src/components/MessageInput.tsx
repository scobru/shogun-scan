import React, { useState } from 'react';

interface MessageInputProps {
  id?: string;                                   // ID per il riferimento DOM
  value?: string;                                // Valore controllato dal componente padre
  onChange?: (value: string) => void;            // Funzione per aggiornare il valore controllato
  onSendMessage?: (text: string) => Promise<void>; // Funzione chiamata quando si invia il messaggio
  placeholder?: string;                          // Placeholder per l'input
  rows?: number;                                 // Numero di righe per la textarea
}

const MessageInput: React.FC<MessageInputProps> = ({ 
  id,
  value,
  onChange,
  onSendMessage,
  placeholder = "Scrivi un messaggio...",
  rows = 1
}) => {
  // Usa lo stato interno solo quando non c'è un valore controllato dall'esterno
  const [internalMessage, setInternalMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  
  // Determina se usare il valore interno o quello controllato dall'esterno
  const isControlled = value !== undefined && onChange !== undefined;
  const message = isControlled ? value : internalMessage;
  
  // Gestisce il cambiamento del messaggio
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isControlled) {
      onChange!(e.target.value);
    } else {
      setInternalMessage(e.target.value);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verifica che ci sia un messaggio e una funzione onSendMessage
    if (!message.trim() || sending || !onSendMessage) return;
    
    const messageToSend = message; // Conserva il messaggio originale
    
    // Pulisci l'input immediatamente per un feedback più rapido
    if (!isControlled) {
      setInternalMessage('');
    } else {
      onChange!('');
    }
    
    setSending(true);
    setError('');
    
    // Usa un timeout in caso la Promise non si risolva mai
    const sendTimeout = setTimeout(() => {
      console.error('Timeout durante l\'invio del messaggio');
      setSending(false);
      setError('Timeout durante l\'invio del messaggio');
      
      // Ripristina il messaggio
      if (!isControlled) {
        setInternalMessage(messageToSend);
      } else {
        onChange!(messageToSend);
      }
    }, 20000); // 20 secondi di timeout
    
    try {
      console.log("Invio messaggio:", messageToSend);
      await onSendMessage(messageToSend);
      clearTimeout(sendTimeout);
    } catch (err: any) {
      console.error('Errore invio messaggio:', err);
      setError(err.message || 'Errore nell\'invio del messaggio');
      
      // Ripristina il messaggio originale
      if (!isControlled) {
        setInternalMessage(messageToSend);
      } else {
        onChange!(messageToSend);
      }
      
      clearTimeout(sendTimeout);
    } finally {
      setSending(false); // Assicurati che lo stato di invio venga reimpostato
    }
  };
  
  return (
    <div className="w-full">
      {error && (
        <div className="bg-red-900/30 border border-red-500/30 text-red-300 text-sm rounded-lg p-2 mb-2">
          {error}
        </div>
      )}
      
      <form 
        onSubmit={handleSubmit} 
        className="w-full"
      >
        <textarea
          id={id}
          className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white resize-none outline-none focus:border-blue-500 transition-colors"
          placeholder={sending ? "Invio in corso..." : placeholder}
          value={message}
          onChange={handleMessageChange}
          disabled={sending}
          rows={rows}
        />
        
        {onSendMessage && (
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              className={`px-4 py-2 rounded ${
                !message.trim() || sending
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              } text-white transition-colors`}
              disabled={!message.trim() || sending}
            >
              {sending ? "Invio..." : "Invia"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default MessageInput; 