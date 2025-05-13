// Example of Shogun NoDom in standalone mode (without GunDB)
// This example shows how to use the reactivity mechanisms of Shogun NoDom
// without the persistence and synchronization of GunDB
// Run with: node nodom-standalone.js

// We import only the basic reactivity features
// We don't import Gun or call init()
import { setSignal, setEffect, setMemo } from '../nodom-node.js';

console.log('🔫 Shogun NoDom - Standalone Example (without GunDB)');
console.log('=================================================');

// 1. Creating simple signals (without key for persistence)
console.log('\n--- Simple Signals ---');
const [getName, setName] = setSignal('Mario');
const [getAge, setAge] = setSignal(30);

// Show initial values
console.log(`Name: ${getName()}, Age: ${getAge()}`);

// 2. Using setEffect to react to changes
console.log('\n--- Reactive Effects ---');
setEffect(() => {
  console.log(`EFFECT: The name has changed to ${getName()}`);
});

setEffect(() => {
  console.log(`EFFECT: The age has changed to ${getAge()}`);
});

// 3. Using setMemo for derived calculations
console.log('\n--- Derived Values (Memo) ---');
const getGreeting = setMemo(() => {
  return `Hello ${getName()}, you are ${getAge()} years old`;
});

setEffect(() => {
  console.log(`MEMO: ${getGreeting()}`);
});

// 4. Modifying signals to demonstrate reactivity
console.log('\n--- Reactivity Demonstration ---');

console.log('Modifying the name...');
setName('Luigi');

setTimeout(() => {
  console.log('\nModifying the age...');
  setAge(31);
}, 1000);

// 5. More advanced functions
setTimeout(() => {
  console.log('\n--- Advanced Features ---');
  
  // Using functions to update state
  console.log('Incrementing age by 5 years...');
  setAge(current => current + 5);
  
  // Using multiple signals in a single effect
  setTimeout(() => {
    console.log('\nModifying both values simultaneously...');
    setName('Giovanni');
    setAge(25);
  }, 1000);
}, 2000);

// 6. Dynamic signal creation
setTimeout(() => {
  console.log('\n--- Dynamic Signals ---');
  
  // List of users with signals for each property
  const users = [];
  
  function createUser(name, age) {
    const [getName, setName] = setSignal(name);
    const [getAge, setAge] = setSignal(age);
    
    // Create a reactive object
    const user = {
      getName,
      setName,
      getAge,
      setAge,
      // Using setMemo for a derived property
      getDescription: setMemo(() => `${getName()} (${getAge()})`)
    };
    
    users.push(user);
    return user;
  }
  
  // Create two users
  const user1 = createUser('Alice', 28);
  const user2 = createUser('Bob', 32);
  
  // Show user data
  console.log('Users created:');
  users.forEach(user => {
    console.log(`- ${user.getDescription()}`);
  });
  
  // Modify a user
  setTimeout(() => {
    console.log('\nModifying a user...');
    user1.setName('Alicia');
    user1.setAge(29);
    
    // Show updated data
    console.log('Updated users:');
    users.forEach(user => {
      console.log(`- ${user.getDescription()}`);
    });
    
    console.log('\nExample completed!');
    
    // Terminate the application
    setTimeout(() => process.exit(0), 500);
  }, 1000);
}, 4000); 