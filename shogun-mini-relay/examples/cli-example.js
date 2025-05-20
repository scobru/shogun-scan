#!/usr/bin/env node
/**
 * ShogunMiniRelay - CLI client example
 * This example shows how to use the ShogunMiniRelay class to create a command line client
 */

const readline = require('readline');
const ShogunMiniRelay = require('../ShogunMiniRelay');

// Parse command line arguments
const username = process.argv[2] || 'cli-user';

// Create a new client instance
const client = new ShogunMiniRelay({
  isServer: false,
  peers: ['http://localhost:8765/gun'],
  username: username
});

// Create readline interface for CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log(`Shogun Mini-Relay CLI - Connected as: ${username}`);
console.log('Type your message and press Enter to send. Type "exit" to quit.');

// Listen for messages from the relay and display them
client.onMessage((message) => {
  // Format the timestamp as a readable date
  const date = new Date(message.timestamp).toLocaleTimeString();
  console.log(`[${date}] ${message.user}: ${message.text}`);
});

// Process user input
rl.on('line', (input) => {
  if (input.toLowerCase() === 'exit') {
    console.log('Disconnecting from relay. Goodbye!');
    rl.close();
    process.exit(0);
  } else if (input.trim() !== '') {
    client.sendMessage(input);
  }
});

// Handle CTRL+C
rl.on('SIGINT', () => {
  console.log('\nDisconnecting from relay. Goodbye!');
  rl.close();
  process.exit(0);
}); 