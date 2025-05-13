// Example of namespace in nodom-node.js
// Shows authentication, namespace management and data persistence
// Run with: node node-namespace.js <username> <password>

import Gun from 'gun';
import { 
  init, 
  auth, 
  setSignal, 
  getNamespace, 
  withNamespaceContext 
} from '../nodom-node.js';

// Command line arguments handling
const username = process.argv[2] || 'testuser';
const password = process.argv[3] || 'password123';

// Gun server initialization
const server = Gun.serve(8765);
console.log('Gun server started on port 8765');

// Gun initialization
const gun = Gun({
  web: server
});

// Shogun NoDom initialization
init(gun);

console.log('🔫 Shogun NoDom - Namespace Example');
console.log('==================================');

async function run() {
  try {
    // User authentication
    console.log(`Authenticating as ${username}...`);
    await auth(username, password, true);
    
    // Get the user's namespace
    const namespace = getNamespace();
    console.log(`Authenticated! Namespace: ${namespace}`);
    
    // Create a signal with user namespace (automatic)
    console.log('\n--- Private Data (User Namespace) ---');
    const [getUserNote, setUserNote] = setSignal('', { key: 'private-note' });
    
    // Set a private value
    setUserNote(`Private note from ${username}: ${new Date().toISOString()}`);
    console.log(`Note saved: ${getUserNote()}`);
    console.log(`Effective key: ${namespace}.private-note`);
    
    // Using withNamespaceContext to create a different namespace context
    // NOTE: In GunDB with SEA, you can't write directly to a custom namespace
    // unless you own that namespace (you created a user with those credentials)
    console.log('\n--- Custom Namespace Context ---');
    withNamespaceContext('~customNS', () => {
      // This signal will use the ~customNS namespace
      const [getSharedNote, setSharedNote] = setSignal('', { key: 'shared-note' });
      
      // Set a value in a shared namespace
      // NOTE: This operation might generate a "Signature did not match" error
      // when Gun tries to verify the data signature
      setSharedNote(`Shared note from ${username}: ${new Date().toISOString()}`);
      console.log(`Shared note (local value): ${getSharedNote()}`);
      console.log('Effective key: ~customNS.shared-note');
    });
    
    // Demonstrate persistence by reading saved data
    console.log('\n--- Reading Saved Data ---');
    
    // Read the private note
    console.log(`Private note: ${getUserNote()}`);
    
    // Read the shared note with a new signal
    withNamespaceContext('~customNS', () => {
      const [getSharedAgain] = setSignal('', { key: 'shared-note' });
      console.log(`Shared note (reading): ${getSharedAgain()}`);
    });
    
    console.log('\nExample completed!');
    console.log('\nNOTE: It\'s normal to see a "Signature did not match" or "Unverified data" error');
    console.log('when trying to write to a namespace not owned by the current user.');
    console.log('To properly share data between users, use Gun/SEA\'s sharing features.');
    
    // Terminate the application after 1 second
    setTimeout(() => {
      console.log('Terminating application...');
      process.exit(0)
    }, 1000);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run(); 