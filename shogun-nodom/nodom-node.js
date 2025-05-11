// nodom-node.js
import Gun from 'gun'; // npm install gun
import 'gun/sea';      // npm install gun + supporto utenti

let currentObserver = null;
let gun = null;

export function init(gunInstance) {
  gun = gunInstance;
}

export function setSignal(initialValue, options = {}) {
  const { key } = options || {};
  const subscribers = new Set();
  let value = initialValue;

  if (key && gun) {
    const node = gun.get(key);
    node.on((data) => {
      if (data && data.value !== undefined) {
        value = data.value;
        subscribers.forEach((fn) => fn());
      }
    });
  }

  const read = () => {
    if (currentObserver) subscribers.add(currentObserver);
    return value;
  };

  const write = (newValue) => {
    value = typeof newValue === "function" ? newValue(value) : newValue;
    if (key && gun) {
      gun.get(key).put({ value });
    }
    subscribers.forEach((fn) => fn());
  };

  return [read, write];
}

export function setEffect(fn) {
  const execute = () => {
    currentObserver = execute;
    fn();
    currentObserver = null;
  };
  execute();
}

export function setMemo(fn) {
  const [get, set] = setSignal();
  setEffect(() => set(fn()));
  return get;
}

export async function auth(username, password, createIfNeeded = true) {
  if (!gun) throw new Error("nodom: Gun instance not initialized. Call init(gun) first.");

  const user = gun.user();
  return new Promise((resolve, reject) => {
    user.auth(username, password, (ack) => {
      if (ack.err && createIfNeeded) {
        user.create(username, password, (createAck) => {
          if (createAck.err) {
            reject("Failed to create user: " + createAck.err);
          } else {
            console.log("User created, logging in...");
            user.auth(username, password, (loginAck) => {
              if (loginAck.err) {
                reject("Failed to login after create: " + loginAck.err);
              } else {
                console.log("User logged in successfully!");
                resolve(loginAck);
              }
            });
          }
        });
      } else if (ack.err) {
        reject("Authentication error: " + ack.err);
      } else {
        console.log("User logged in successfully!");
        resolve(ack);
      }
    });
  });
}

export default { init, setSignal, setEffect, setMemo, auth };
