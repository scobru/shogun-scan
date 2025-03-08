import React, { useState } from 'react';

interface MessageInputProps {
  onSendMessage: (text: string) => Promise<void>;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verifiche più stringenti
    if (!message.trim() || sending) return;
    
    const messageToSend = message; // Conserva il messaggio originale
    setMessage(''); // Pulisci l'input immediatamente per un feedback più rapido
    setSending(true);
    setError('');
    
    // Usa un timeout in caso la Promise non si risolva mai
    const sendTimeout = setTimeout(() => {
      console.error('Timeout durante l\'invio del messaggio');
      setSending(false);
      setError('Timeout durante l\'invio del messaggio');
      setMessage(messageToSend); // Ripristina il messaggio
    }, 20000); // 20 secondi di timeout
    
    try {
      console.log("Invio messaggio:", messageToSend);
      await onSendMessage(messageToSend);
      clearTimeout(sendTimeout);
    } catch (err: any) {
      console.error('Errore invio messaggio:', err);
      setError(err.message || 'Errore nell\'invio del messaggio');
      setMessage(messageToSend); // Ripristina il messaggio originale
      clearTimeout(sendTimeout);
    } finally {
      setSending(false); // Assicurati che lo stato di invio venga reimpostato
    }
  };
  
  return (
    <div className="mt-4">
      {error && (
        <div className="bg-error/10 border border-error/20 text-error text-sm rounded-lg p-2 mb-2">
          {error}
        </div>
      )}
      
      <form 
        onSubmit={handleSubmit} 
        className="bg-card rounded-xl p-2 flex items-center"
      >
        <input
          type="text"
          className="flex-1 bg-transparent border-none outline-none p-2"
          placeholder={sending ? "Invio in corso..." : "Scrivi un messaggio..."}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={sending}
        />
        <button
          type="submit"
          className={`${sending ? 'bg-gray-500' : 'bg-primary'} text-white p-2 rounded-lg hover:bg-primary/80 transition-colors`}
          disabled={!message.trim() || sending}
        >
          {sending ? (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
};

export default MessageInput; 