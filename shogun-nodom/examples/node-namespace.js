// Esempio di namespace in nodom-node.js
// Mostra autenticazione, gestione namespace e persistenza dei dati
// Esegui con: node node-namespace.js <username> <password>

import Gun from 'gun';
import { 
  init, 
  auth, 
  setSignal, 
  getNamespace, 
  withNamespaceContext 
} from '../nodom-node.js';

// Gestione argomenti della riga di comando
const username = process.argv[2] || 'testuser';
const password = process.argv[3] || 'password123';

// Inizializzazione del server Gun
const server = Gun.serve(8765);
console.log('Server Gun avviato sulla porta 8765');

// Inizializzazione di Gun
const gun = Gun({
  web: server
});

// Inizializzazione di Shogun NoDom
init(gun);

console.log('🔫 Shogun NoDom - Esempio Namespace');
console.log('==================================');

async function run() {
  try {
    // Autenticazione dell'utente
    console.log(`Autenticazione come ${username}...`);
    await auth(username, password, true);
    
    // Ottenere il namespace dell'utente
    const namespace = getNamespace();
    console.log(`Autenticato! Namespace: ${namespace}`);
    
    // Creare un segnale con namespace utente (automatico)
    console.log('\n--- Dati Privati (Namespace Utente) ---');
    const [getUserNote, setUserNote] = setSignal('', { key: 'private-note' });
    
    // Impostare un valore privato
    setUserNote(`Nota privata di ${username}: ${new Date().toISOString()}`);
    console.log(`Nota salvata: ${getUserNote()}`);
    console.log(`Chiave effettiva: ${namespace}.private-note`);
    
    // Utilizzo di withNamespaceContext per creare un contesto di namespace diverso
    // NOTA: In GunDB con SEA, non puoi scrivere direttamente in un namespace personalizzato
    // a meno che non possiedi quel namespace (hai creato un utente con quelle credenziali)
    console.log('\n--- Contesto Namespace Personalizzato ---');
    withNamespaceContext('~customNS', () => {
      // Questo segnale userà il namespace ~customNS
      const [getSharedNote, setSharedNote] = setSignal('', { key: 'shared-note' });
      
      // Impostare un valore in un namespace condiviso
      // NOTA: Questa operazione potrebbe generare un errore "Signature did not match"
      // quando Gun tenta di verificare la firma dei dati
      setSharedNote(`Nota condivisa da ${username}: ${new Date().toISOString()}`);
      console.log(`Nota condivisa (valore locale): ${getSharedNote()}`);
      console.log('Chiave effettiva: ~customNS.shared-note');
    });
    
    // Dimostrare la persistenza leggendo i dati salvati
    console.log('\n--- Lettura Dati Salvati ---');
    
    // Leggiamo la nota privata
    console.log(`Nota privata: ${getUserNote()}`);
    
    // Leggiamo la nota condivisa con un nuovo segnale
    withNamespaceContext('~customNS', () => {
      const [getSharedAgain] = setSignal('', { key: 'shared-note' });
      console.log(`Nota condivisa (lettura): ${getSharedAgain()}`);
    });
    
    console.log('\nEsempio completato!');
    console.log('\nNOTA: È normale vedere un errore "Signature did not match" o "Unverified data"');
    console.log('quando si tenta di scrivere in un namespace non posseduto dall\'utente corrente.');
    console.log('Per condividere dati correttamente tra utenti, usa le funzionalità di condivisione di Gun/SEA.');
    
    // Termina l'applicazione dopo 1 secondo
    setTimeout(() => {
      console.log('Terminazione applicazione...');
      process.exit(0)
    }, 1000);
  } catch (err) {
    console.error('Errore:', err);
    process.exit(1);
  }
}

run(); 