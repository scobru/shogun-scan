API
Bugoff follows the Bugout API, with this primary exception:

Every message is encrypted using the Gun SEA suite, so the bugoff.on() and bugoff.once() methods require a new listener for decryption: bugoff.on('decrypted', (address, pubkeys, message)) & bugoff.once('decrypted', (address, pubkeys, message))
Bugoff will be further expanded / tested for Gun chaining methods in later versions.

Properties
bugoff.identifier
Returns the Bugoff swarm identifier, a SHA256 hash of the identifier that is passed in to create the swarm.

bugoff.address
Returns this instance's Bugoff address. This can be used by other peers to directly send messages to this instance.

bugoff.sea
Return the Gun SEA pair this instance is using.

This is an asychronous call and must be used with await.

Example
console.log('Bugoff swarm ID:', bugoff.identifier)
console.log('My address:', bugoff.address)
console.log('Insance encryption keys:', await bugoff.sea)
Methods
bugoff.SEA([pair])
Generate or pass in a Gun SEA pair. If pair is not specified, Bugoff will generate and use its own pair for this instance.

This is an asychronous call and must be used with await.

Events
'decrypted', (address, pubkeys, message)
Returns decrypted messages on the target Bugoff instance.

Example
bugoff.on('decrypted', (address, pubkeys, message) => {
  console.log('From address:', address)
  console.log('Sender pubkeys:', pubkeys)
  console.log('Message:', message)
})
'message', (address, message)
Returns encrypted messages on the target Bugoff instance. This may be useful for storing encrypted messages somewhere else, or for debugging.