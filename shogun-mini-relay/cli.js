#!/usr/bin/env node

const readline = require("readline");
const Gun = require("gun");
require("gun/sea");
const path = require("path");
const fs = require("fs");
const { createNodeClient } = require("shogun-create");

let messageModule = require("./index.js");

// Parse command line arguments
const args = process.argv.slice(2);
let username = null;
let password = null;
let peerList = ["http://localhost:8765/gun"]; // Default peer
let pairPath = null;
let createUser = false;
let channel = "shogun_message"; // Default channel

// Parse command line arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--peers" || args[i] === "-p") {
    // Format: --peers http://peer1/gun,http://peer2/gun
    if (args[i + 1] && !args[i + 1].startsWith("-")) {
      peerList = args[i + 1].split(",");
      i++;
    }
  } else if (args[i] === "--export-pair" || args[i] === "-e") {
    // Format: --export-pair ./path/to/export.json
    if (args[i + 1] && !args[i + 1].startsWith("-")) {
      pairPath = args[i + 1];
      i++;
    }
  } else if (args[i] === "--pair" || args[i] === "-P") {
    // Format: --pair ./path/to/pair.json
    if (args[i + 1] && !args[i + 1].startsWith("-")) {
      pairPath = args[i + 1];
      i++;
    }
  } else if (args[i] === "--channel" || args[i] === "-ch") {
    // Format: --channel channel_name
    if (args[i + 1] && !args[i + 1].startsWith("-")) {
      channel = args[i + 1];
      i++;
    }
  } else if (args[i] === "--create-user" || args[i] === "-c") {
    createUser = true;
  } else if (!args[i].startsWith("-") && !username) {
    username = args[i];
  } else if (!args[i].startsWith("-") && !password) {
    password = args[i];
  }
}

console.log(`Connecting to peers: ${peerList.join(", ")}`);
console.log(`Using channel: ${channel}`);

const gun = createNodeClient(peerList, {
  useRadisk: false,
  radiskPath: "",
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

let lastmessage = null;
let lastActivity = new Map();

// Function to show last activity information
function showLastActivity() {
  console.log("\n===== LAST ACTIVITY =====");
  
  if (lastActivity.size === 0) {
    console.log("No activity recorded yet.");
    return;
  }
  
  // Convert Map to array and sort by timestamp (most recent first)
  const activities = Array.from(lastActivity.values())
    .sort((a, b) => b.timestamp - a.timestamp);
  
  activities.forEach(activity => {
    const time = new Date(activity.timestamp).toLocaleTimeString();
    const username = activity.user || "unknown";
    console.log(`[${time}] ${username} (${activity.userPub.substring(0, 8)}...)`);
  });
  
  console.log("========================\n");
}

// Track last activity from the #last_activity node
function trackLastActivity() {
  gun.get('#last_activity').map().on((data) => {
    try {
      if (!data || typeof data !== 'object') return;
      
      // Skip if no timestamp or userPub
      if (!data.timestamp || !data.userPub) return;
      
      // Use userPub as key to avoid duplicate entries from the same user
      const activityKey = data.userPub;
      
      // Skip if we already have a more recent activity for this user
      if (lastActivity.has(activityKey) && 
          lastActivity.get(activityKey).timestamp >= data.timestamp) {
        return;
      }
      
      // Store the activity data
      lastActivity.set(activityKey, data);
      
      // Only show notification if this is a new entry (not during initial load)
      if (lastActivity.size > 1) {
        console.log(`\n${data.user || "A user"} was active at ${new Date(data.timestamp).toLocaleTimeString()}`);
      }
    } catch (err) {
      console.error("Error tracking last activity:", err);
    }
  });
}

// Start tracking last activity
trackLastActivity();

async function createNewUser(username, password) {
  return new Promise((resolve, reject) => {
    console.log(`Creating new user: ${username}`);
    gun.user().create(username, password, (ack) => {
      if (ack.err) {
        console.log(`User creation failed: ${ack.err}`);
        resolve(false);
      } else {
        console.log(`User created successfully: ${username}`);

        // After creating, we need to authenticate
        gun.user().auth(username, password, (authAck) => {
          if (authAck.err) {
            console.log(`Login after creation failed: ${authAck.err}`);
            resolve(false);
          } else {
            console.log(
              `Successfully logged in as newly created user: ${username}`
            );

            // Export pair if requested
            if (pairPath && pairPath.includes(".json")) {
              exportUserPair();
            }

            resolve(true);
          }
        });
      }
    });
  });
}

async function authenticateUser() {
  return new Promise((resolve, reject) => {
    // If pair file is provided, authenticate with the pair
    if (pairPath) {
      try {
        const pairData = fs.readFileSync(pairPath, "utf8");
        const pair = JSON.parse(pairData);

        console.log(`Authenticating with pair from: ${pairPath}`);
        gun.user().auth(pair, (ack) => {
          if (ack.err) {
            console.log(`Login with pair failed: ${ack.err}`);
            resolve(false);
          } else {
            console.log(
              `Successfully logged in with pair as: ${ack.put.alias}`
            );
            resolve(true);
          }
        });
        return;
      } catch (err) {
        console.log(`Error loading pair file: ${err.message}`);
        if (!username || !password) {
          resolve(false);
          return;
        }
        // Continue with username/password if pair fails
      }
    }

    // Check if we need to create a new user
    if (createUser) {
      if (!username || !password) {
        console.log("Username and password are required to create a new user.");
        console.log(
          "Usage: node cli.js <username> <password> --create-user [other options]"
        );
        resolve(false);
        return;
      }
      return resolve(createNewUser(username, password));
    }

    // Standard username/password authentication
    if (!username || !password) {
      console.log(
        "Usage: node cli.js <username> <password> [--peers peer1,peer2] [--export-pair path/to/export.json] [--pair path/to/pair.json] [--create-user]"
      );
      console.log("No credentials provided. Running in anonymous mode.");
      resolve(false);
      return;
    }

    console.log(`Attempting to login as: ${username}`);
    gun.user().auth(username, password, (ack) => {
      if (ack.err) {
        console.log(`Login failed: ${ack.err}`);
        resolve(false);
      } else {
        console.log(`Successfully logged in as: ${username}`);

        // Export pair if requested
        if (pairPath && pairPath.includes(".json")) {
          exportUserPair();
        }

        resolve(true);
      }
    });
  });
}

function exportUserPair() {
  if (!gun.user().is) {
    console.log("Cannot export pair: User not authenticated");
    return;
  }

  const pair = gun.user()._.sea;
  if (pair) {
    try {
      fs.writeFileSync(pairPath, JSON.stringify(pair, null, 2));
      console.log(`User pair exported to: ${pairPath}`);
    } catch (err) {
      console.log(`Error exporting user pair: ${err.message}`);
    }
  } else {
    console.log("Cannot export pair: Pair not available");
  }
}

// Listen for incoming messages
function listenForMessages() {
  // Check if we can use the new module
  if (messageModule?.listen) {
    messageModule.listen(gun, channel);
    return;
  }

  // Legacy method: listen directly on the channel node
  gun
    .get("#" + channel)
    .map()
    .on((soul) => {
      try {
        if (!soul) return;

        gun.get(soul).once((msgData) => {
          try {
            if (!msgData) return;

            // Extract message data from Gun metadata
            const messageId = msgData._["#"];

            // For each field in the message (like 'text', 'timestamp')
            let message = {};

            // Extract fields from the message
            if (msgData._[">"] && msgData._[">"].text) {
              message.text = msgData._[">"].text;
            } else {
              return; // No text, not a valid message
            }

            if (msgData._[">"] && msgData._[">"].timestamp) {
              message.timestamp = parseInt(msgData._[">"].timestamp);
            } else {
              message.timestamp = Date.now(); // Default timestamp
            }

            // Get user information from soul
            const userPub = messageId.split("~")[1]?.split(".")[0];
            if (userPub) {
              gun.user(userPub).once((userProfile) => {
                const username = userProfile?.alias || "unknown-user";

                // Format the timestamp as a readable date
                const date = new Date(message.timestamp).toLocaleTimeString();

                // Check for duplicates using messageId
                if (lastmessage === messageId) {
                  return;
                }

                console.log(`[${date}] ${username}: ${message.text}`);
                lastmessage = messageId;
              });
            }
          } catch (err) {
            console.error("Error processing message data:", err);
          }
        });
      } catch (err) {
        console.error("Error processing message:", err);
      }
    });
}

// Start listening for messages
listenForMessages();

function sendMessage(text) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    console.error("Cannot send empty message");
    return;
  }
  
  console.log(`Sending message: "${text}"`);
  
  // Create a message object with text and timestamp
  const messageData = {
    text: text.trim(),
    timestamp: Date.now()
  };
  
  // Check if the user is authenticated
  if (!gun.user().is) {
    console.log("Warning: Not authenticated. Message may not be indexed properly.");
    // For unauthenticated users, we'll use an alternative approach
    gun.get(channel).set(messageData);
    return;
  }
  
  // Use the send function from the module
  messageModule
    .send(gun, channel, messageData)
    .then((success) => {
      if (!success) {
        console.error("Failed to send message");
      }
    }).catch(err => {
      console.error("Error sending message:", err);
    });
}

async function main() {
  // Try to authenticate
  const r = await authenticateUser();
  console.log(r);

  console.log("Shogun Mini-Relay CLI - Connected");
  console.log(
    'Type your message and press Enter to send. Type "exit" to quit.'
  );

  // Process user input
  rl.on("line", (input) => {
    if (input.toLowerCase() === "exit") {
      console.log("Disconnecting from relay. Goodbye!");
      rl.close();
      process.exit(0);
    } else if (input.toLowerCase() === "activity") {
      // Show the last activity when the user types "activity"
      showLastActivity();
    } else if (input.trim() !== "") {
      sendMessage(input);
    }
  });

  // Handle CTRL+C
  rl.on("SIGINT", () => {
    console.log("\nDisconnecting from relay. Goodbye!");
    rl.close();
    process.exit(0);
  });
}

main();
