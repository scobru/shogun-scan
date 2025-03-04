import React, { useEffect, useRef, useState } from 'react';
// import { unstoppableChat } from "../services";

interface Contact {
  pubKey: string;
  alias: string;
  name: string;
  notifCount?: number;
  pendingInvite?: boolean;
}

interface Message {
  time?: number;
  msg: any;
  owner?: string;
  userPub?: string;
  pending?: boolean;
  failed?: boolean;
  id?: string;
  from?: string;
}

interface Channel {
  key: string;
  name: string;
  isPrivate?: boolean;
  userCount?: number;
  hash?: string;
  owner?: string;
  latestMsg?: any;
  peers?: any;
  pair?: any;
}

interface ChatMessagesProps {
  messages?: Message[];
  activeContact: string | null;
  contacts: Contact[];
  activeChannel?: string;
  contactStatus?: 'online' | 'offline' | 'typing' | null;
  currentUserPub?: string;
  onInviteToChannel?: (channelKey: string) => void;
  currentChannel?: Channel;
  onLeaveChannel?: (channelKey: string) => void;
  unstoppableChat: any;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ 
  messages: initialMessages,
  activeContact, 
  contacts,
  activeChannel,
  contactStatus = null,
  currentUserPub,
  onInviteToChannel,
  currentChannel,
  onLeaveChannel,
  unstoppableChat
}) => {
  // Stato locale per i messaggi
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll automatico ai nuovi messaggi
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Debug
  useEffect(() => {
    console.log("ChatMessages - stato attuale:", {
      activeContact,
      activeChannel,
      messageCount: messages?.length || 0,
      currentChannel,
      contacts: contacts?.length
    });
  }, [messages, activeContact, activeChannel, currentChannel, contacts]);
  
  // Aggiungi un log per verificare i messaggi ricevuti
  useEffect(() => {
    console.log("ChatMessages riceve messaggi:", messages);
  }, [messages]);
  
  const getMessageDebugInfo = (message: Message) => {
    return {
      content: typeof message.msg === 'string' && message.msg.length > 50 
        ? `${message.msg.substring(0, 50)}...` 
        : message.msg,
      time: message.time,
      sender: message.userPub === currentUserPub ? 'me' : 'other',
      raw: message
    };
  };
  
  useEffect(() => {
    if (messages.length > 0) {
      console.log("Dettagli messaggi per debug:", messages.map(getMessageDebugInfo));
    }
  }, [messages, currentUserPub]);
  
  // Effetto per caricare i messaggi quando cambia il contatto attivo
  useEffect(() => {
    if (activeContact && contacts) {
      const contact = contacts.find(c => c.pubKey === activeContact);
      if (contact) {
        console.log("Caricamento messaggi per contatto:", contact);
        
        // Pulisci i vecchi messaggi
        setMessages([]);
        
        // Imposta l'abbonamento per i nuovi messaggi
        let messagesSubscription: any;
        try {
          messagesSubscription = unstoppableChat.loadMessagesOfContact(contact);
          
          if (messagesSubscription) {
            messagesSubscription.on((newMessages: any) => {
              console.log("Messaggi ricevuti:", newMessages);
              setMessages(newMessages);
            });
          }
        } catch (error) {
          console.error("Errore nel caricamento dei messaggi:", error);
        }
        
        // Pulizia quando il componente si smonta o cambia il contatto
        return () => {
          try {
            if (messagesSubscription && typeof messagesSubscription.off === 'function') {
              messagesSubscription.off();
            }
          } catch (error) {
            console.error("Errore durante il cleanup:", error);
          }
        };
      }
    }
  }, [activeContact, contacts, unstoppableChat]);
  
  // Verifica se dobbiamo usare i messaggi props o lo stato
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);
  
  console.log("ChatMessages props:", {
    activeContact,
    contacts,
    messages: initialMessages?.length || 0,
    unstoppableChat: !!unstoppableChat
  });
  
  if (!activeContact && !activeChannel) {
    return (
      <div className="bg-card rounded-xl h-full max-h-[calc(100vh-200px)] flex items-center justify-center">
        <div className="text-center text-gray-400 p-6">
          Seleziona un contatto o un canale per iniziare a chattare
        </div>
      </div>
    );
  }
  
  // Ordina i messaggi per timestamp
  const sortedMessages = [...messages].sort((a, b) => {
    const timeA = a.time || 0;
    const timeB = b.time || 0;
    return timeA - timeB;
  });
  
  // Formatta il timestamp in modo leggibile
  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    // Formato ora:minuti per oggi, altrimenti data completa
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };
  
  const messageClassName = (message: Message) => {
    let className = "message";
    
    if (message.userPub === currentUserPub) {
      className += " message-sent";
    } else {
      className += " message-received";
    }
    
    if (message.pending) {
      className += " message-pending";
    }
    
    if (message.failed) {
      className += " message-failed";
    }
    
    return className;
  };
  
  const renderMessages = () => {
    if (!messages || messages.length === 0) {
      return <div className="flex-grow flex items-center justify-center text-gray-500">Nessun messaggio</div>;
    }

    return (
      <div className="flex-grow p-4 space-y-3 overflow-y-auto pb-20">
        {messages.map((message, index) => {
          // Verifica se il messaggio è valido
          if (!message || !message.msg) {
            console.warn("Messaggio non valido:", message);
            return null;
          }

          // Determina se il messaggio è dell'utente corrente
          let isCurrentUser = false;
          
          // Prima controlla userPub se disponibile
          if (message.userPub) {
            isCurrentUser = message.userPub === currentUserPub;
          } 
          // Se userPub non è disponibile, controlla il campo 'from'
          else if (message.from) {
            isCurrentUser = message.from === 'me';
          }
          // Se non abbiamo informazioni, registra un avviso
          else {
            console.log("Messaggio senza informazioni sul mittente:", message);
            // Supponiamo che i messaggi senza informazioni sul mittente siano dell'utente corrente
            isCurrentUser = true;
          }

          // Calcola il nome del mittente
          let senderName = isCurrentUser ? "Tu" : "Contatto";
          
          // Se è un messaggio di un canale, cerca di trovare il nome del mittente
          if (activeChannel && message.userPub && contacts) {
            const contact = contacts.find(c => c.pubKey === message.userPub);
            if (contact) {
              senderName = contact.name || contact.alias;
            }
          }

          return (
            <div 
              key={index} 
              className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-xs md:max-w-md lg:max-w-lg rounded-lg p-3 ${
                  isCurrentUser ? 'bg-primary text-white' : 'bg-white/10 text-white'
                }`}
              >
                {activeChannel && !isCurrentUser && (
                  <div className="text-xs text-gray-400 mb-1">{senderName}</div>
                )}
                <div>{message.msg}</div>
                <div className="text-xs text-right mt-1 opacity-70">
                  {new Date(message.time).toLocaleTimeString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  
  return (
    <div className="bg-card rounded-xl h-full max-h-[calc(100vh-200px)] flex flex-col overflow-hidden">
      {/* Status bar del contatto o canale attivo - fissa in alto */}
      <div className="p-3 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex-1">
          <div className="font-medium">
            {activeChannel ? 
              (currentChannel ? `Canale: ${currentChannel.name}` : `Canale: ${activeChannel}`) 
              : activeContact && contacts ? 
                  contacts.find(c => c.pubKey === activeContact)?.name || activeContact
                  : activeContact}
          </div>
          {!activeChannel && (
            <div className="text-xs flex items-center gap-1">
              {contactStatus === 'online' && (
                <>
                  <span className="h-2 w-2 bg-green-500 rounded-full"></span>
                  <span className="text-green-400">Online</span>
                </>
              )}
              {contactStatus === 'typing' && (
                <>
                  <span className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></span>
                  <span className="text-blue-400">Sta scrivendo...</span>
                </>
              )}
              {contactStatus === 'offline' && (
                <>
                  <span className="h-2 w-2 bg-gray-500 rounded-full"></span>
                  <span className="text-gray-400">Offline</span>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Pulsanti azioni per il canale */}
        {activeChannel && currentChannel && (
          <div className="flex gap-2">
            {/* Pulsante invito */}
            {currentChannel.isPrivate && onInviteToChannel && (
              <button 
                onClick={() => onInviteToChannel(activeChannel)}
                className="px-3 py-1 bg-primary text-white rounded-lg text-sm hover:bg-primary/80 transition-colors"
              >
                Invita utente
              </button>
            )}
            
            {/* Pulsante per uscire dal canale */}
            <button 
              onClick={() => onLeaveChannel && onLeaveChannel(activeChannel)}
              className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
            >
              {currentChannel.owner === currentUserPub ? 'Elimina canale' : 'Esci dal canale'}
            </button>
          </div>
        )}
      </div>
      
      {/* Area messaggi - scrollabile */}
      <div className="flex-1 p-4 overflow-y-auto" id="chat-messages-container">
        {renderMessages()}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatMessages; 