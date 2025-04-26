const express = require("express");
const bodyParser = require("body-parser");
const Gun = require("gun");
const SEA = require("gun/sea");
const Ajv = require("ajv");
const crypto = require("crypto");
const { ethers } = require("ethers");
const { LocalStorage } = require("node-localstorage");
const messageSchema = require("./message-schema.json");

const app = express();
app.use(bodyParser.json());

// 1. GunDB Simple Node bootstrap
const gun = Gun({
  peers: ["gun-seed-1.auti.sm/gun"],
  web: app.listen(8080),
  file: "data/gundb",
});
const relay = gun.get("message");

// 2. Setup Ethereum provider e registry contract
const provider = new ethers.providers.JsonRpcProvider("https://your-rpc");
const registry = new ethers.Contract(
  "0x...",
  ["function getKey(address) view returns (bytes)"],
  provider
);

// 3. Setup JSON Schema validator
const ajv = new Ajv();
const validate = ajv.compile(messageSchema);

// 4. LocalStorage per salvare i messaggi
const localStorage = new LocalStorage("./storage");

// 5. Funzione per ricostruire messageId (come nel client)
async function computeMessageId(message) {
  // ... implementazione identica a quella del client ...
}

// 6. Deserializzazione del messaggio
const {
  Post,
  Profile,
  Connection,
  Moderation,
  File: FileMsg,
} = require("./message-classes");

/**
 * Deserializza un record GunDB in un'istanza della classe Message.
 * @param {{ message: any, signature: string }} data
 * @returns {{ instance: import('./message-classes').Message, signature: string }}
 */
function deserializeMessage(data) {
  const { message, signature } = data;
  const { type, subtype, creator, createdAt, payload } = message;
  const date = new Date(createdAt);
  let instance;
  switch (type) {
    case "POST":
      instance = new Post({ type, subtype, creator, createdAt: date, payload });
      break;
    case "PROFILE":
      instance = new Profile({
        type,
        subtype,
        creator,
        createdAt: date,
        payload,
      });
      break;
    case "CONNECTION":
      instance = new Connection({
        type,
        subtype,
        creator,
        createdAt: date,
        payload,
      });
      break;
    case "MODERATION":
      instance = new Moderation({
        type,
        subtype,
        creator,
        createdAt: date,
        payload,
      });
      break;
    case "FILE":
      instance = new FileMsg({
        type,
        subtype,
        creator,
        createdAt: date,
        payload,
      });
      break;
    default:
      throw new Error(`Tipo di messaggio sconosciuto: ${type}`);
  }
  return { instance, signature };
}

// 7. Subscribe ai messaggi in arrivo con deserializzazione
relay.map().on(async (data, id) => {
  if (!data) return;
  try {
    // 7.1: Deserializza il messaggio in oggetto tipizzato
    const { instance, signature } = deserializeMessage(data);

    // 7.2: Validazione schema (eseguita già nel client, ma confermiamo struttura)
    const json = instance.toJSON();
    if (!validate(json)) throw new Error("Schema non valido al server");

    // 7.3: Verifica messageId e firma SEA
    const msgId = await computeMessageId(json);
    if (msgId !== json.id) throw new Error("ID messaggio non corrispondente");
    const pubKey = await registry.getKey(json.creator);
    const valid = await SEA.verify(signature, pubKey, JSON.stringify(json));
    if (!valid) throw new Error("Firma non valida");

    // 7.4: Salvataggio nel local storage del server come JSON
    localStorage.setItem(id, JSON.stringify({ message: json, signature }));
    console.log("Messaggio deserializzato e salvato con chiave:", id);
  } catch (e) {
    console.error("Errore processing message", id, e);
  }
});

console.log(
  "Express + GunDB relay in ascolto sulla porta 8080 e salvando messaggi deserializzati in localStorage"
);
