// Basic example of nodom-node.js
// Shows initialization, signals and effects
// Run with: node node-basic.js

import Gun from 'gun';
import { init, setSignal, setEffect } from '../nodom-node.js';

const server = Gun.serve()

// Gun initialization
const gun = Gun({
  web: server
});

// Shogun NoDom initialization
init(gun);

console.log('🔫 Shogun NoDom - Basic Example');
console.log('==============================');

// Create a signal with an initial value
// The key 'counter' will be used to save the value in GunDB
const [getCount, setCount] = setSignal(0, { key: 'counter' });

// Create an effect that reacts to signal changes
setEffect(() => {
  console.log(`The counter is: ${getCount()}`);
});

// Modify the signal value (this will trigger the effect)
console.log('Incrementing the counter...');
setCount(1);

// Wait a bit and then increment again
setTimeout(() => {
  console.log('Incrementing the counter again...');
  setCount(prev => prev + 1);
}, 1000);

// Close Gun after another 2 seconds
setTimeout(() => {
  console.log('Example completed!');
  process.exit(0);
}, 3000); 