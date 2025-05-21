const SEA = require("gun/sea");
const { createNodeClient } = require("shogun-create");

/**
 * Encrypts a message for a channel using either a shared secret or a pair
 * @param {Object} data - Data to encrypt
 * @param {string|Object} encryptionKey - Encryption key or pair
 * @returns {Promise<Object>} Encrypted data
 */
async function encryptData(data, encryptionKey) {
  try {
    // If data is not an object, convert it to one
    let messageData = data;
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      messageData = {
        text: typeof data === 'object' ? JSON.stringify(data) : String(data),
        timestamp: Date.now()
      };
    }
    
    // Ensure timestamp exists
    if (!messageData.timestamp) {
      messageData.timestamp = Date.now();
    }

    // Ensure proper serialization
    const dataToEncrypt = JSON.stringify(messageData);
    
    // Encrypt the data with the provided key or pair
    const encryptedData = await SEA.encrypt(dataToEncrypt, encryptionKey);
    
    // Return encrypted data with metadata
    return {
      enc: encryptedData,
      timestamp: messageData.timestamp || Date.now(),
      type: 'encrypted'
    };
  } catch (err) {
    console.error("Error encrypting data:", err);
    return null;
  }
}

/**
 * Decrypts a message from a channel using either a shared secret or a pair
 * @param {Object} encryptedData - Encrypted data
 * @param {string|Object} decryptionKey - Decryption key or pair
 * @returns {Promise<Object>} Decrypted data
 */
async function decryptData(encryptedData, decryptionKey) {
  try {
    if (!encryptedData || !encryptedData.enc) {
      console.error("Invalid encrypted data format");
      return null;
    }
    
    // Decrypt the data
    const decrypted = await SEA.decrypt(encryptedData.enc, decryptionKey);
    if (!decrypted) {
      console.error("Failed to decrypt data");
      return null;
    }
    
    // Parse the decrypted JSON if it's a string
    if (typeof decrypted === 'string') {
      try {
        return JSON.parse(decrypted);
      } catch (parseErr) {
        console.error("Error parsing decrypted data:", parseErr);
        // Return the string as is if it can't be parsed as JSON
        return decrypted;
      }
    }
    
    // If it's already an object, return it directly
    return decrypted;
  } catch (err) {
    console.error("Error decrypting data:", err);
    return null;
  }
}

/**
 * Sends an encrypted message to the specified channel
 * @param {Object} gun - Gun instance
 * @param {string} channel - Channel name
 * @param {Object|string|Array} data - Message data
 * @param {string|Object} encryptionKey - Encryption key or pair to use
 * @returns {Promise<boolean>} Success status
 */
async function sendEncrypted(gun, channel, data, encryptionKey) {
  if (!gun) {
    console.error("send: Gun instance is required");
    return false;
  }

  if (!gun.user().is) {
    console.error("send: User not authenticated");
    return false;
  }

  try {
    const user = gun.user();
    const username = user.is ? user.is.alias : "anonymous";
    const userPub = user.is.pub;
    
    console.log(`[DEBUG] Sending encrypted message to channel ${channel} as ${username}`);
    
    // Encrypt the data
    const encryptedData = await encryptData(data, encryptionKey);
    if (!encryptedData) {
      console.error("Failed to encrypt data");
      return false;
    }
    
    // Store message with a specific ID to be more reliable
    const msgId = `msg_${encryptedData.timestamp}`;
    
    // Store in user space first
    console.log(`[DEBUG] Storing encrypted message in user space at ~${userPub}/${channel}`);
    await new Promise((resolve) => {
      user.get(channel).get(msgId).put(encryptedData, (ack) => {
        console.log(`[DEBUG] Message storage ack:`, ack);
        resolve(ack);
      });
    });
    
    // Get the full path for this data
    const soul = `~${userPub}/${channel}/${msgId}`;
    console.log(`[DEBUG] Creating reference at #${channel} with soul: ${soul}`);
    
    // Create a hash of the soul
    const hash = await SEA.work(soul, null, null, { name: "SHA-256" });
    console.log(`[DEBUG] Hash for reference: ${hash}`);
    
    // Store the reference in the channel index
    gun.get('#' + channel).get(hash).put(soul, (ack) => {
      console.log(`[DEBUG] Reference storage ack:`, ack);
    });
    
    // Update last activity
    const lastActivity = {
      timestamp: encryptedData.timestamp,
      user: username,
      userPub: userPub,
      channel: channel,
      type: 'encrypted-message'
    };
    
    // Create a hash for the activity to avoid duplicates
    const activityHash = await SEA.work(
      `${userPub}:${lastActivity.timestamp}`, 
      null, null, 
      { name: "SHA-256" }
    );
    
    // Store last activity
    gun.get('#last_activity').get(activityHash).put(lastActivity);
    
    return true;
  } catch (error) {
    console.error("Error sending encrypted message:", error);
    return false;
  }
}

/**
 * Generate a shared channel key between two users
 * @param {Object} user1Pair - First user's keypair
 * @param {Object|string} user2PubKey - Second user's public key or keypair
 * @returns {Promise<string>} Shared secret for the channel
 */
async function generateChannelKey(user1Pair, user2PubKey) {
  try {
    // Extract epub if a full keypair was provided for user2
    const user2Epub = typeof user2PubKey === 'object' ? user2PubKey.epub : user2PubKey;
    
    // Generate secret using ECDH
    const secret = await SEA.secret(user2Epub, user1Pair);
    return secret;
  } catch (err) {
    console.error("Error generating channel key:", err);
    return null;
  }
}

/**
 * Listen for encrypted messages from a channel
 * @param {Object} gun - Gun instance
 * @param {string} channel - Channel name
 * @param {string|Object} decryptionKey - Key to decrypt messages
 * @param {Function} callback - Callback for decrypted messages
 */
function listenEncrypted(gun, channel, decryptionKey, callback) {
  if (!gun) {
    console.error("listen: Gun instance is required");
    return;
  }
  
  if (!decryptionKey) {
    console.error("listen: Decryption key is required");
    return;
  }
  
  // Track messages we've already seen to prevent duplicates
  const seenMessages = new Set();
  
  console.log(`[DEBUG] Setting up encrypted listener for #${channel}`);
  
  gun.get('#' + channel).map().on((soul, key) => {
    if (!soul) {
      console.log(`[DEBUG] Empty soul received for key: ${key}`);
      return;
    }
    
    console.log(`[DEBUG] Encrypted message reference received: ${soul}, key: ${key}`);
    
    // Use the full soul as the message ID to detect duplicates
    if (seenMessages.has(soul)) {
      console.log(`[DEBUG] Already displayed message: ${soul}`);
      return;
    }
    
    gun.get(soul).on(async (msgData) => {
      try {
        if (!msgData || typeof msgData !== 'object' || !msgData.enc) {
          console.log(`[DEBUG] Not an encrypted message:`, msgData);
          return;
        }
        
        console.log(`[DEBUG] Attempting to decrypt message`);
        
        // Attempt to decrypt the message
        const decrypted = await decryptData(msgData, decryptionKey);
        if (!decrypted) {
          console.log(`[DEBUG] Could not decrypt message, wrong key or format`);
          return;
        }
        
        // Parse the user public key from the soul
        let userPub = null;
        if (typeof soul === 'string' && soul.startsWith('~')) {
          const parts = soul.split('/');
          if (parts.length >= 1) {
            userPub = parts[0].substring(1); // Remove the ~ prefix
          }
        }
        
        // Add to seen messages
        seenMessages.add(soul);
        
        // Look up username if we have a public key
        if (userPub) {
          gun.user(userPub).once((profile) => {
            const username = profile?.alias || userPub.slice(0, 8);
            
            // Add user info to the decrypted message
            decrypted.user = username;
            decrypted.userPub = userPub;
            
            // Call the callback with the decrypted message
            if (callback && typeof callback === 'function') {
              callback(decrypted, msgData);
            } else {
              console.log(`Decrypted message from ${username}:`, decrypted);
            }
          });
        } else {
          // No user info available
          if (callback && typeof callback === 'function') {
            callback(decrypted, msgData);
          } else {
            console.log(`Decrypted message from unknown:`, decrypted);
          }
        }
      } catch (err) {
        console.error("Error processing encrypted message:", err);
      }
    });
  });
}

/**
 * Sends a message to the specified channel
 * @param {Object} gun - Gun instance
 * @param {string} channel - Channel name
 * @param {Object|string|Array} data - Message data
 * @returns {Promise<boolean>} Success status
 */
async function send(gun, channel, data) {
  if (!gun) {
    console.error("send: Gun instance is required");
    return false;
  }

  if (!gun.user().is) {
    console.error("send: User not authenticated");
    return false;
  }

  try {
    const user = gun.user();
    const username = user.is ? user.is.alias : "anonymous";
    const userPub = user.is.pub;
    
    console.log(`[DEBUG] Sending message to channel ${channel} as ${username} (${userPub}):`);
    console.log(`[DEBUG] Message data:`, data);
    
    // Prepare data for storing
    let messageData = data;
    
    // If data is not already an object, wrap it
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      messageData = {
        text: typeof data === 'object' ? JSON.stringify(data) : String(data),
        timestamp: Date.now()
      };
      console.log(`[DEBUG] Converted data to:`, messageData);
    } else if (!messageData.timestamp) {
      // Ensure timestamp exists
      messageData.timestamp = Date.now();
    }
    
    // Store message in user space - using put instead of set for more reliable behavior
    console.log(`[DEBUG] Storing message in user space at ~${userPub}/${channel}`);
    await new Promise((resolve) => {
      user.get(channel).put(messageData, (ack) => {
        console.log(`[DEBUG] Message storage ack:`, ack);
        resolve(ack);
      });
    });
    
    // The issue might be in how we're referencing the message
    // Let's use the timestamp as part of our referencing strategy
    const msgId = `msg_${messageData.timestamp}`;
    console.log(`[DEBUG] Using message ID: ${msgId}`);
    
    // Store with a specific key to make retrieval more reliable
    user.get(channel).get(msgId).put(messageData, (ack) => {
      console.log(`[DEBUG] Message storage with key ack:`, ack);
    });
    
    // Get the full path for this data
    const soul = `~${userPub}/${channel}/${msgId}`;
    console.log(`[DEBUG] Creating reference at #${channel} with soul: ${soul}`);
    
    // Create a hash of the soul
    const hash = await SEA.work(soul, null, null, { name: "SHA-256" });
    console.log(`[DEBUG] Hash for reference: ${hash}`);
    
    // Store the reference in the channel index
    gun.get('#' + channel).get(hash).put(soul, (ack) => {
      console.log(`[DEBUG] Reference storage ack:`, ack);
    });
    
    // Update last activity
    const lastActivity = {
      timestamp: messageData.timestamp,
      user: username,
      userPub: userPub,
      channel: channel,
      type: 'message'
    };
    
    // Create a hash for the activity to avoid duplicates
    const activityHash = await SEA.work(
      `${userPub}:${lastActivity.timestamp}`, 
      null, null, 
      { name: "SHA-256" }
    );
    
    // Store last activity
    gun.get('#last_activity').get(activityHash).put(lastActivity, (ack) => {
      console.log(`[DEBUG] Last activity updated:`, ack);
    });
    
    return true;
  } catch (error) {
    console.error("Error sending message:", error);
    return false;
  }
}

/**
 * Log messages from a channel
 * @param {Object} gun - Gun instance
 * @param {Object} options - Optional configuration
 */
function listen(gun, channel) {
  if (!gun) {
    console.error("listen: Gun instance is required");
    return;
  }
  
  // Track messages we've already seen to prevent duplicates
  const seenMessages = new Set();
  
  console.log(`[DEBUG] Setting up listener for #${channel}`);
  
  gun.get('#' + channel).map().on((soul, key) => {
    if (!soul) {
      console.log(`[DEBUG] Empty soul received for key: ${key}`);
      return;
    }
    
    console.log(`[DEBUG] Message reference received: ${soul}, key: ${key}`);
    
    // Parse the soul to extract user and message info
    // Expected format: ~userPub/channel/msgId
    let userPub = null;
    if (typeof soul === 'string' && soul.startsWith('~')) {
      const parts = soul.split('/');
      if (parts.length >= 1) {
        userPub = parts[0].substring(1); // Remove the ~ prefix
      }
    }
    
    if (!userPub) {
      console.log(`[DEBUG] Could not parse userPub from soul: ${soul}`);
    } else {
      console.log(`[DEBUG] Extracted userPub: ${userPub}`);
    }
    
    // Use the full soul as the message ID to detect duplicates
    if (seenMessages.has(soul)) {
      console.log(`[DEBUG] Already displayed message: ${soul}`);
      return;
    }
    
    gun.get(soul).on((msgData) => {
      try {
        console.log(`[DEBUG] Message data received:`, msgData);
        
        if (!msgData || typeof msgData !== 'object') {
          console.log(`[DEBUG] Invalid message data:`, msgData);
          return;
        }
        
        // Check if this is an encrypted message
        if (msgData.type === 'encrypted' && msgData.enc) {
          console.log(`[DEBUG] Encrypted message detected, skipping in non-encrypted listener`);
          return;
        }
        
        // Extract message text and timestamp
        let messageText = null;
        let messageTimestamp = null;
        
        // Case 1: Direct format with text and timestamp properties
        if (msgData.text && msgData.timestamp) {
          messageText = msgData.text;
          messageTimestamp = typeof msgData.timestamp === 'number' 
            ? msgData.timestamp 
            : parseInt(msgData.timestamp);
        }
        // Case 2: GunDB metadata format
        else if (msgData._ && msgData._[">"] && 
                (msgData._[">"].text || msgData._[">"].timestamp)) {
          
          if (msgData._[">"].text) {
            messageText = msgData.text;
          }
          
          if (msgData._[">"].timestamp) {
            messageTimestamp = typeof msgData.timestamp === 'number'
              ? msgData.timestamp
              : parseInt(msgData.timestamp);
          }
        }
        
        if (!messageText || !messageTimestamp) {
          console.log(`[DEBUG] Missing text or timestamp in message:`, msgData);
          return;
        }
        
        // Look up the username from the public key
        if (userPub) {
          gun.user(userPub).once((userProfile) => {
            const username = userProfile?.alias || userPub.slice(0, 8);
            const time = new Date(messageTimestamp).toLocaleTimeString();
            
            // Compute a unique ID for deduplication
            const messageId = `${userPub}:${messageTimestamp}:${messageText}`;
            
            if (seenMessages.has(messageId)) {
              console.log(`[DEBUG] Duplicate message detected: ${messageId}`);
              return;
            }
            
            seenMessages.add(messageId);
            seenMessages.add(soul); // Also mark the soul as seen
            
            console.log(`[${time}] ${username}: ${messageText}`);
          });
        } else {
          // If we couldn't extract the user
          const time = new Date(messageTimestamp).toLocaleTimeString();
          console.log(`[${time}] unknown-user: ${messageText}`);
        }
      } catch (err) {
        console.error("Error processing message in listen:", err);
      }
    });
  });
  
  console.log(`[DEBUG] Listener setup complete for #${channel}`);
}

/**
 * Get the messages node from the gun instance
 * @param {Object} gun - Gun instance
 * @param {string} channel - Channel name
 * @returns {Object} Gun node for messages
 */
function list(gun, channel) {
  if (!gun) {
    console.error("list: Gun instance is required");
    return null;
  }

  return gun.get("#" + channel);
}

/**
 * Create a simple server for hosting the Gun relay
 * @param {number} port - Port number for the server
 * @returns {Object} Server instance
 */
function createServer(port = 8765, peers = ["http://localhost:8765/gun"]) {
  try {
    const server = createNodeClient(peers, {
      useRadisk: false,
      radiskPath: "",
    });
    console.log(`Shogun Mini Relay server started on port ${port}`);

    return server;
  } catch (err) {
    console.error("Error creating server:", err);
    return null;
  }
}

/**
 * Creates a new encrypted channel with a shared secret
 * @param {Object} gun - Gun instance
 * @param {string} channelName - Base name for the channel
 * @param {string} sharedSecret - Secret password or phrase for encryption
 * @returns {Promise<Object>} Channel information
 */
async function createSharedChannel(gun, channelName, sharedSecret) {
  if (!gun) {
    console.error("createSharedChannel: Gun instance is required");
    return null;
  }
  
  if (!channelName || !sharedSecret) {
    console.error("createSharedChannel: Channel name and shared secret are required");
    return null;
  }
  
  try {
    // Create a unique channel ID by hashing the channel name
    const channelId = await SEA.work(channelName, null, null, { name: "SHA-256" });
    const fullChannelName = `encrypted_${channelId.substring(0, 12)}`;
    
    // We'll create a hash of the shared secret as our encryption key
    const encryptionKey = await SEA.work(sharedSecret, null, null, { name: "SHA-256" });
    
    // Store channel metadata (encrypted with the shared secret)
    const metadata = {
      name: channelName,
      created: Date.now(),
      type: "shared_encrypted"
    };
    
    const encryptedMetadata = await encryptData(metadata, encryptionKey);
    
    // Store the channel metadata and wait for confirmation
    console.log(`[DEBUG] Creating shared encrypted channel: ${fullChannelName}`);
    await new Promise((resolve, reject) => {
      gun.get("#encrypted_channels").get(fullChannelName).put(encryptedMetadata, ack => {
        if (ack.err) {
          console.error(`[DEBUG] Error storing channel metadata:`, ack.err);
          reject(new Error(ack.err));
        } else {
          console.log(`[DEBUG] Channel metadata stored successfully`);
          resolve(ack);
        }
      });
    });
    
    // Verify that the channel was actually created by reading it back
    const savedData = await new Promise(resolve => {
      gun.get("#encrypted_channels").get(fullChannelName).once(data => {
        console.log(`[DEBUG] Verification read of channel data:`, data);
        resolve(data);
      });
    });
    
    if (!savedData || !savedData.enc) {
      console.error(`[DEBUG] Channel verification failed, data not found`);
      throw new Error("Channel creation verification failed");
    }
    
    console.log(`[DEBUG] Created shared encrypted channel: ${fullChannelName}`);
    
    return {
      channelId: fullChannelName,
      encryptionKey,
      metadata
    };
  } catch (error) {
    console.error("Error creating shared channel:", error);
    return null;
  }
}

/**
 * Join an existing encrypted channel using a shared secret
 * @param {Object} gun - Gun instance
 * @param {string} channelId - The channel ID to join
 * @param {string} sharedSecret - Secret password or phrase for encryption
 * @returns {Promise<Object>} Channel information
 */
async function joinSharedChannel(gun, channelId, sharedSecret) {
  if (!gun || !channelId || !sharedSecret) {
    console.error("joinSharedChannel: Missing required parameters");
    return null;
  }
  
  try {
    // Generate the encryption key from the shared secret
    const encryptionKey = await SEA.work(sharedSecret, null, null, { name: "SHA-256" });
    
    // Try to read and decrypt the channel metadata to verify the secret is correct
    console.log(`[DEBUG] Attempting to join channel: ${channelId}`);
    
    // Use a timeout promise to prevent hanging indefinitely
    const timeout = ms => new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout exceeded')), ms));
    
    // Add retry logic to handle possible data sync delays
    let attempts = 0;
    const maxAttempts = 3;
    let encryptedMetadata = null;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`[DEBUG] Join channel attempt ${attempts}/${maxAttempts}`);
      
      try {
        // Try to get the channel data with a timeout
        encryptedMetadata = await Promise.race([
          new Promise(resolve => {
            gun.get('#encrypted_channels').get(channelId).once(data => {
              console.log(`[DEBUG] Channel data received:`, data);
              resolve(data);
            });
          }),
          timeout(2000) // 2 second timeout
        ]);
        
        if (encryptedMetadata && encryptedMetadata.enc) {
          break; // Successfully got the data
        } else {
          console.log(`[DEBUG] Channel data not found or invalid on attempt ${attempts}`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
        }
      } catch (err) {
        console.log(`[DEBUG] Error in attempt ${attempts}:`, err.message);
        if (attempts >= maxAttempts) throw err;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
      }
    }
    
    if (!encryptedMetadata || !encryptedMetadata.enc) {
      console.error("Channel not found or not encrypted");
      return null;
    }
    
    // Try to decrypt the metadata
    const metadata = await decryptData(encryptedMetadata, encryptionKey);
    
    if (!metadata) {
      console.error("Could not decrypt channel metadata. Incorrect shared secret.");
      return null;
    }
    
    console.log(`[DEBUG] Successfully joined encrypted channel: ${channelId}`);
    
    return {
      channelId,
      encryptionKey,
      metadata
    };
  } catch (error) {
    console.error("Error joining shared channel:", error);
    return null;
  }
}

/**
 * Send a message to a shared encrypted channel
 * @param {Object} gun - Gun instance
 * @param {string} channelId - The channel ID
 * @param {string} encryptionKey - The encryption key derived from shared secret
 * @param {Object|string} message - The message to send
 * @returns {Promise<boolean>} Success status
 */
async function sendToSharedChannel(gun, channelId, encryptionKey, message) {
  if (!gun || !channelId || !encryptionKey) {
    console.error("sendToSharedChannel: Missing required parameters");
    return false;
  }
  
  if (!gun.user().is) {
    console.error("sendToSharedChannel: User not authenticated");
    return false;
  }
  
  try {
    const user = gun.user();
    const username = user.is ? user.is.alias : "anonymous";
    const userPub = user.is.pub;
    
    console.log(`[DEBUG] Sending encrypted message to shared channel ${channelId}`);
    
    // Prepare the message data
    let messageData = message;
    if (typeof message !== 'object' || message === null || Array.isArray(message)) {
      messageData = {
        text: typeof message === 'object' ? JSON.stringify(message) : String(message),
        timestamp: Date.now(),
        user: username,
        userPub: userPub
      };
    } else if (!messageData.timestamp) {
      messageData.timestamp = Date.now();
      messageData.user = username;
      messageData.userPub = userPub;
    }
    
    // Encrypt the message using the shared encryption key
    const encryptedData = await encryptData(messageData, encryptionKey);
    if (!encryptedData) {
      console.error("Failed to encrypt message");
      return false;
    }
    
    // Create a unique ID for the message
    const msgId = `msg_${messageData.timestamp}`;
    
    // Store in user space first
    await new Promise((resolve) => {
      user.get(channelId).get(msgId).put(encryptedData, (ack) => {
        console.log(`[DEBUG] Encrypted message storage ack:`, ack);
        resolve(ack);
      });
    });
    
    // Get the full path for this data
    const soul = `~${userPub}/${channelId}/${msgId}`;
    
    // Create a hash of the soul
    const hash = await SEA.work(soul, null, null, { name: "SHA-256" });
    
    // Store the reference in the channel index
    gun.get('#' + channelId).get(hash).put(soul, (ack) => {
      console.log(`[DEBUG] Encrypted message reference storage ack:`, ack);
    });
    
    return true;
  } catch (error) {
    console.error("Error sending to shared channel:", error);
    return false;
  }
}

/**
 * Listen for messages in a shared encrypted channel
 * @param {Object} gun - Gun instance
 * @param {string} channelId - The channel ID
 * @param {string} encryptionKey - The encryption key derived from shared secret
 * @param {Function} callback - Callback for decrypted messages
 */
function listenToSharedChannel(gun, channelId, encryptionKey, callback) {
  if (!gun || !channelId || !encryptionKey) {
    console.error("listenToSharedChannel: Missing required parameters");
    return;
  }
  
  // Track messages we've already seen to prevent duplicates
  const seenMessages = new Set();
  
  console.log(`[DEBUG] Setting up listener for shared encrypted channel #${channelId}`);
  
  gun.get('#' + channelId).map().on((soul, key) => {
    if (!soul) return;
    
    console.log(`[DEBUG] Encrypted message reference received: ${soul}`);
    
    // Skip if we've already seen this soul
    if (seenMessages.has(soul)) {
      console.log(`[DEBUG] Already processed message: ${soul}`);
      return;
    }
    
    // Mark this soul as seen
    seenMessages.add(soul);
    
    gun.get(soul).on(async (encryptedData) => {
      try {
        if (!encryptedData || !encryptedData.enc) {
          console.log(`[DEBUG] Not an encrypted message:`, encryptedData);
          return;
        }
        
        // Try to decrypt the message with our shared key
        const decrypted = await decryptData(encryptedData, encryptionKey);
        if (!decrypted) {
          console.log(`[DEBUG] Could not decrypt message with shared key`);
          return;
        }
        
        // Extract user info from soul if available
        let userPub = null;
        if (typeof soul === 'string' && soul.startsWith('~')) {
          const parts = soul.split('/');
          if (parts.length >= 1) {
            userPub = parts[0].substring(1); // Remove the ~ prefix
          }
        }
        
        // Look up user if we have their public key
        if (userPub && !decrypted.user) {
          gun.user(userPub).once((profile) => {
            const username = profile?.alias || userPub.slice(0, 8);
            
            // Add user info if not already in the decrypted data
            decrypted.user = decrypted.user || username;
            decrypted.userPub = decrypted.userPub || userPub;
            
            // Pass to callback
            if (callback && typeof callback === 'function') {
              callback(decrypted, soul);
            } else {
              console.log(`Decrypted message from ${decrypted.user}:`, decrypted.text);
            }
          });
        } else {
          // User info might be already included in decrypted data
          if (callback && typeof callback === 'function') {
            callback(decrypted, soul);
          } else {
            console.log(`Decrypted message from ${decrypted.user || 'unknown'}:`, decrypted.text);
          }
        }
      } catch (err) {
        console.error("Error processing encrypted message:", err);
      }
    });
  });
}

/**
 * List available encrypted channels
 * @param {Object} gun - Gun instance
 * @returns {Promise<Array>} List of channel IDs
 */
async function listEncryptedChannels(gun) {
  if (!gun) {
    console.error("listEncryptedChannels: Gun instance is required");
    return [];
  }
  
  return new Promise((resolve) => {
    const channels = [];
    let resolved = false;
    
    // Set a timeout to resolve after 2 seconds
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        console.log(`[DEBUG] listEncryptedChannels timeout reached, returning ${channels.length} channels`);
        resolved = true;
        resolve(channels);
      }
    }, 2000);
    
    console.log(`[DEBUG] Listing encrypted channels from #encrypted_channels`);
    
    // Use map().once() to get all channels once
    gun.get("#encrypted_channels").map().once((data, id) => {
      if (data && id) {
        console.log(`[DEBUG] Found channel: ${id}`);
        channels.push(id);
      }
    });
    
    // Use on.off to detect when data loading is done
    // Note: This may not be reliable in all GUN versions
    const onData = () => {
      console.log(`[DEBUG] listEncryptedChannels received ${channels.length} channels`);
      if (!resolved && channels.length > 0) {
        clearTimeout(timeoutId);
        resolved = true;
        resolve(channels);
      }
    };
    
    // This will run once data loading is done
    gun.get("#encrypted_channels").on(onData);
    
    // Backup resolution after 500ms if we got any channels
    setTimeout(() => {
      if (!resolved && channels.length > 0) {
        console.log(`[DEBUG] listEncryptedChannels early resolution with ${channels.length} channels`);
        clearTimeout(timeoutId);
        resolved = true;
        resolve(channels);
      }
    }, 500);
  });
}

module.exports = {
  listen,
  send,
  list,
  createServer,
  // Export encryption functions
  encryptData,
  decryptData,
  sendEncrypted,
  listenEncrypted,
  generateChannelKey,
  // Export shared channel functions
  createSharedChannel,
  joinSharedChannel,
  sendToSharedChannel,
  listenToSharedChannel,
  listEncryptedChannels
};
