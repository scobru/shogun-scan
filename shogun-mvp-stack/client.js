import Gun from "gun";
import SEA from "gun/sea";
import Ajv from "ajv";
import messageSchema from "./message-schema.json";

// 1. Configurazione ZKitter Simple Node (bootstrap peers globali)
const gun = Gun({
  peers: ["gun-seed-1.auti.sm/gun"],
});

// 2. Autenticazione utente (chiavi ECDSA registrate on-chain)
const user = gun.user();
await user.auth({ pub: MY_PUBLIC_KEY, priv: MY_PRIVATE_KEY });

// 3. Setup validazione JSON Schema
const ajv = new Ajv();
const validate = ajv.compile(messageSchema);

// 4. Funzione per generare messageId secondo Schema ZKitter
import crypto from "crypto";
async function computeMessageId(message) {
  // 4.1: Serializza campi in esadecimale come da spec
  const typeHex = Buffer.from(message.type.toUpperCase()).toString("hex");
  const subtypeHex = Buffer.from(message.subtype.toUpperCase()).toString("hex");
  const creatorHex = Buffer.from(message.creator).toString("hex");
  const tsBuf = Buffer.alloc(8);
  tsBuf.writeBigUInt64BE(BigInt(message.createdAt));
  const createdHex = tsBuf.toString("hex");
  const payloadHex = Buffer.from(JSON.stringify(message.payload)).toString(
    "hex"
  );

  // 4.2: Componi buffer secondo lunghezze prefissate
  const parts = [];
  const pushWithLen = (h, lenBytes) => {
    const hBuf = Buffer.from(h, "hex");
    const len = Buffer.alloc(lenBytes);
    len.writeUIntBE(hBuf.length, 0, lenBytes);
    parts.push(len, hBuf);
  };
  pushWithLen(typeHex, 1);
  pushWithLen(subtypeHex, 1);
  pushWithLen(creatorHex, 2);
  parts.push(Buffer.from(createdHex, "hex"));
  parts.push(Buffer.from(payloadHex, "hex"));

  const encodeBuf = Buffer.concat(parts);
  const hash = crypto.createHash("sha256").update(encodeBuf).digest("hex");
  return `${message.creator}/${hash}`;
}

// 5. Invio messaggio con validazione e firma SEA
async function sendMessage({ type, subtype, payload }) {
  const message = {
    id: "", // calcolato in seguito
    type, // es. "POST"
    subtype, // es. "" | "REPLY"
    creator: MY_DOMAIN, // es. "alice.eth"
    createdAt: Math.floor(Date.now() / 1000),
    payload, // oggetto dipendente dal tipo
  };

  // 5.1: Validazione schema
  if (!validate(message))
    throw new Error("Schema non valido: " + ajv.errorsText(validate.errors));

  // 5.2: Calcola messageId e aggiorna `id`
  const messageId = await computeMessageId(message);
  message.id = messageId;

  // 5.3: Firma digitale del JSON completo
  const sig = await SEA.sign(JSON.stringify(message), user._.sea);

  // 5.4: Pubblicazione in user-space
  await user.get("message").get(messageId).put({ message, signature: sig });
  console.log(`Messaggio inviato con ID ${messageId}`);
}
