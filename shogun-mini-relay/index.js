// relay.js (Node.js)
const Gun = require("gun");
const http = require("http");

// Lista degli altri relay
const peers = ["http://localhost:8765/gun"];

// Create HTTP server with proper request handling
const server = http.createServer((req, res) => {
  // Set CORS headers for all responses
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );

  // Handle OPTIONS requests (CORS preflight)
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === "/" || req.url === "/index.html") {
    // Redirect to inbox.html
    res.writeHead(302, { Location: "/inbox.html" });
    res.end();
    return;
  }

  // Default response for other routes (including /gun)
  res.writeHead(200);
  res.end("Gun relay server");
});

// Start the server
server.listen(8765, () => {
  console.log("Server listening on http://localhost:8765/");
});

// Initialize Gun with proper configuration
const gun = new Gun({
  web: server,
  peers, // mesh con gli altri relay
  file: "data/gundata.db", // LevelDB locale per la persistenza
  multicast: false, // Disable multicast for more reliable networking
  localStorage: false, // Disable localStorage in Node.js environment
  wire: true,
  axe: true,
});

const messages = gun.get("shogun_message");
let lastLoggedTimestamp = 0; // Stores the timestamp of the latest message logged by this relay

// Listen for messages and log them to the console
messages.map().on((message, id) => {
  // Ensure the message object and its critical properties (text, timestamp) are valid
  if (!message || typeof message.text !== 'string' || typeof message.timestamp !== 'number') {
    return;
  }

  const currentMessageTimestamp = message.timestamp;

  // Log only if this message is newer than the last one logged by this handler
  if (currentMessageTimestamp > lastLoggedTimestamp) {
    lastLoggedTimestamp = currentMessageTimestamp;
    console.log(`${message.user} - ${message.text} - ${new Date(currentMessageTimestamp).toISOString()}`);
  }
});

// Function to send a message
function sendMessage(user, text) {
  gun.get('shogun_message').set({
    user,
    text,
    timestamp: Date.now()
  });
}

// Expose Gun and sendMessage for external modules
module.exports = { gun, sendMessage };

