/**
 * ShogunMiniRelay - Server example
 * This example shows how to use the ShogunMiniRelay class to create a relay server
 */

const ShogunMiniRelay = require('../ShogunMiniRelay');

// Create a new relay server
const relay = new ShogunMiniRelay({
  isServer: true,
  port: 8765,
  dbPath: 'data/gundata.db',
  peers: ['http://localhost:8765/gun']
});

// Listen for new messages
relay.onMessage((message, id) => {
  console.log(`[SERVER] ${message.user}: ${message.text} (${new Date(message.timestamp).toLocaleString()})`);
});

console.log('Shogun Mini Relay server running on http://localhost:8765');
console.log('Press Ctrl+C to stop');

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  relay.close();
  process.exit(0);
}); 