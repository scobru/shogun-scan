// Esempio base di nodom-node.js
// Mostra l'inizializzazione, i segnali e gli effetti
// Esegui con: node node-basic.js

import Gun from 'gun';
import { init, setSignal, setEffect } from '../nodom-node.js';

const server = Gun.serve()

// Inizializzazione di Gun
const gun = Gun({
  web: server
});

// Inizializzazione di Shogun NoDom
init(gun);

console.log('🔫 Shogun NoDom - Esempio Base');
console.log('==============================');

// Creare un segnale con un valore iniziale
// La chiave 'counter' sarà usata per salvare il valore in GunDB
const [getCount, setCount] = setSignal(0, { key: 'counter' });
const [effectCount] = setEffect)
// Creare un effetto che reagisce ai cambiamenti del segnale
setEffect(() => {
  console.log(`Il contatore è: ${getCount()}`);
});

// Modificare il valore del segnale (questo farà scattare l'effetto)
console.log('Incremento il contatore...');
setCount(1);

// Attendere un po' e poi incrementare di nuovo
setTimeout(() => {
  console.log('Incremento di nuovo il contatore...');
  setCount(prev => prev + 1);
}, 1000);

// Chiudere Gun dopo altri 2 secondi
setTimeout(() => {
  console.log('Esempio completato!');
  process.exit(0);
}, 3000); 