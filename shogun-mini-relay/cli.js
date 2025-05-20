#!/usr/bin/env node

const readline = require('readline');
const Gun = require('gun');
const path = require('path');

// Check if index.js is running
let relayModule;
try {
  // First try to import the module
  relayModule = require('./index.js');
  console.log('Connected to running relay server');
} catch (err) {
  console.log('Could not connect to existing relay, running in standalone mode');
}

// Initialize Gun with connection to the local relay
const gun = relayModule?.gun || Gun({
  peers: ['http://localhost:8765/gun'],
  localStorage: false,
  radisk: false
});

// Create readline interface for CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Default username if not provided
let username = process.argv[2] || 'cli-user';

console.log(`Shogun Mini-Relay CLI - Connected as: ${username}`);
console.log('Type your message and press Enter to send. Type "exit" to quit.');

let lastmessage = null;

// Listen for messages from the relay and display them
gun.get('shogun_message').map().on((message) => {
  if (message && message.text && message.user && message.timestamp) {
    // Format the timestamp as a readable date
    const date = new Date(message.timestamp).toLocaleTimeString();
    
    if (lastmessage && lastmessage.timestamp === message.timestamp) {
      return;
    }
    
    console.log(`[${date}] ${message.user}: ${message.text}`);
    lastmessage = message;
  }
});

// Function to send a message
function sendMessage(text) {
  if (relayModule?.sendMessage) {
    // Use the function from index.js if available
    relayModule.sendMessage(username, text);
  } else {
    // Fallback to local implementation
    gun.get('shogun_message').set({
      user: username,
      text: text,
      timestamp: Date.now()
    });
  }
}

// Process user input
rl.on('line', (input) => {
  if (input.toLowerCase() === 'exit') {
    console.log('Disconnecting from relay. Goodbye!');
    rl.close();
    process.exit(0);
  } else if (input.trim() !== '') {
    sendMessage(input);
  }
});

// Handle CTRL+C
rl.on('SIGINT', () => {
  console.log('\nDisconnecting from relay. Goodbye!');
  rl.close();
  process.exit(0);
});
