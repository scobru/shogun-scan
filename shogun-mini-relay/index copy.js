// Function to send a message
const SEA = require('gun/sea');


function sendMessage(gun, text) {
  
  if(!gun.user().is) {
    console.log('User not authenticated');
    return;
  }

  gun.get('shogun_message').set({
    gun.user().is,
    text,
    timestamp: Date.now()
  });
}

function messages(gun) {
  return gun.get('shogun_message');
}

// Expose Gun and sendMessage for external modules
module.exports = { sendMessage, messages };

