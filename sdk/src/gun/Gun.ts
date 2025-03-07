/**
 * The GunDB class provides an interface to interact with the Gun decentralized database.
 * It handles user authentication, data storage, and retrieval operations.
 */
import Gun from "gun";
import "gun/sea";
import { IGunInstance, IGunUserInstance } from "gun/types";

interface WalletPathsData {
  paths?: string[] | Record<string, string>;
  [key: string]: any;
}

class GunDB {
  public gun: IGunInstance<any>;
  public hedgehog: any;

  /**
   * Initializes the GunDB instance.
   * @constructor
   */
  constructor(peers: string[] = ["http://localhost:8765/gun"]) {
    console.log("Initializing GunDB...");
    // Initialize GUN
    this.gun = new Gun({
      peers: peers, // You can modify this with your peers
      localStorage: false,
      radisk: false,
    });
    console.log("GunDB initialized");
  }

  async createGunUser(username: string, password: string) {
    console.log("Creating Gun user:", username);
    return new Promise((resolve, reject) => {
      
      this.gun.user().create(username, password, (ack) => {
        console.log("Response to Gun user creation:", ack);
        if ("err" in ack) {
          console.error("Error creating Gun user:", ack.err);
          
          // Se l'errore è "User is already being created or authenticated!", riprova dopo un breve ritardo
          if (ack.err === "User is already being created or authenticated!") {
            console.log("Riprovo la creazione dell'utente dopo un breve ritardo...");
            setTimeout(() => {
              this.createGunUser(username, password)
                .then(resolve)
                .catch(reject);
            }, 1500); // Riprova dopo 1.5 secondi
            return;
          }
          
          // Se l'errore è "User already created", prova ad autenticare l'utente
          if (ack.err === "User already created") {
            console.log("Utente già esistente, tentativo di autenticazione...");
            this.authenticateGunUser(username, password)
              .then(resolve)
              .catch(reject);
            return;
          }
          
          reject(new Error(ack.err));
        } else {
          console.log("Gun user created, proceeding with authentication");
          // After creation, perform login
          this.gun.user().auth(username, password, (ack) => {
            console.log("Response to Gun user authentication:", ack);
            if ("err" in ack) {
              console.error("Error authenticating Gun user:", ack.err);
              reject(new Error(ack.err));
            } else {
              console.log("Gun user created and authenticated successfully");
              resolve(ack);
            }
          });
        }
      });
    });
  }

  async authenticateGunUser(username: string, password: string) {
    console.log("Authenticating Gun user:", username);
    
    return new Promise((resolve, reject) => {
      // Verifica se c'è già un'operazione di creazione o autenticazione in corso
      // if ((this.gun.user() as any)._?.tag?.auth) {
      //   console.log("Un'operazione di autenticazione è già in corso, attendere...");
      //   setTimeout(() => {
      //     this.authenticateGunUser(username, password)
      //       .then(resolve)
      //       .catch(reject);
      //   }, 1000); // Riprova dopo 1 secondo
      //   return;
      // }

      // Verifica se l'utente è già autenticato
      const currentUser = this.gun.user().is;
      if (currentUser && currentUser.alias === username) {
        console.log("Utente già autenticato:", username);
        resolve({ alias: username, pub: currentUser.pub });
        return;
      }

      // Esegui il logout prima di autenticare un nuovo utente
      if (currentUser && currentUser.alias !== username) {
        console.log("Logout dell'utente corrente prima di autenticare:", username);
        this.gun.user().leave();
      }

      this.gun.user().auth(username, password, (ack) => {
        console.log("Response to Gun user authentication:", ack);
        if ("err" in ack) {
          console.error("Error authenticating Gun user:", ack.err);
          
          // Se l'errore è "User is already being created or authenticated!", riprova dopo un breve ritardo
          if (ack.err === "User is already being created or authenticated!") {
            console.log("Riprovo l'autenticazione dell'utente dopo un breve ritardo...");
            setTimeout(() => {
              this.authenticateGunUser(username, password)
                .then(resolve)
                .catch(reject);
            }, 1500); // Riprova dopo 1.5 secondi
            return;
          }
          
          reject(new Error(ack.err));
        } else {
          console.log("Gun user authenticated successfully");
          resolve(ack);
        }
      });
    });
  }

  /**
   * Creates a Gun user with a key pair for MetaMask or WebAuthn.
   * @param {string} username - The username for the new user.
   * @returns {Promise<{pair: any, ack: GunAck}>} A promise that resolves with the key pair and authentication acknowledgment.
   */
  async createGunUserWithPair(
    username: string
  ): Promise<{ pair: any; ack: any }> {
    console.log("Creating Gun user with key pair for:", username);
    return new Promise(async (resolve, reject) => {
      // Generate a random key pair for Gun
      const pair = await Gun.SEA.pair();
      console.log("Generated key pair:", pair);

      this.gun.user().auth(pair, (ack: any) => {
        console.log("Response to authentication with key pair:", ack);
        if (ack.err) {
          console.error("Error authenticating with key pair:", ack.err);
          reject(new Error(ack.err));
        } else {
          console.log("Gun user created with key pair");
          const user = this.gun.user() as any;
          console.log("Gun user status after authentication with key pair:", {
            is: user.is,
            pair: user._.sea,
          });
          resolve({ pair, ack });
        }
      });
    });
  }

  /**
   * Authenticates a Gun user with an existing key pair.
   * @param {Object} pair - The key pair to use for authentication.
   * @returns {Promise<GunAck>} A promise that resolves with the authentication acknowledgment.
   */
  async authenticateGunUserWithPair(pair: any): Promise<any> {
    console.log("Authenticating Gun user with key pair");
    return new Promise<any>((resolve, reject) => {
      this.gun.user().auth(pair, (ack: any) => {
        console.log("Response to authentication with key pair:", ack);
        if (ack.err) {
          console.error("Error authenticating with key pair:", ack.err);
          reject(new Error(ack.err));
        } else {
          console.log("Gun user authenticated with key pair");
          // Verify that the user is actually authenticated
          const user = this.gun.user() as any;
          console.log("Gun user status after authentication with key pair:", {
            is: user.is,
            pair: user._.sea,
          });
          resolve(ack);
        }
      });
    });
  }

  /**
   * Logs out the current Gun user.
   */
  logout(): void {
    console.log("Logging out Gun user");
    this.gun.user().leave();
    console.log("Gun logout completed");
  }

  /**
   * Writes data to Gun under a specified table and primary key.
   * @param {string} tableName - The name of the table to write to.
   * @param {string} primaryKey - The primary key for the data.
   * @param {Object} data - The data to be written.
   * @returns {Promise<any>} A promise that resolves with the written data including a timestamp.
   */
  async writeToGun(
    tableName: string,
    primaryKey: string,
    data: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!primaryKey) {
        reject(new Error("Invalid primary key"));
        return;
      }

      // Add a timestamp to avoid conflicts
      const dataWithTimestamp = {
        ...data,
        _timestamp: Date.now(),
      };

      this.gun
        .get(tableName)
        .get(primaryKey)
        .put(dataWithTimestamp, (ack: any) => {
          if (ack.err) {
            reject(ack.err);
          } else {
            console.log("Document written successfully!");
            resolve(dataWithTimestamp);
          }
        });
    });
  }

  /**
   * Saves wallet paths for a user.
   * @param {string} userpub - The user's public key to save the paths for.
   * @param {Array} paths - The wallet paths to save.
   * @returns {Promise<void>} A promise that resolves when the paths are saved.
   * @throws {Error} If the userpub is invalid or if there's an error saving the paths.
   */
  async saveWalletPaths(userpub: string, paths: any): Promise<void> {
    try {
      // Verify that userpub is a valid non-empty string
      if (!userpub || typeof userpub !== "string" || userpub.trim() === "") {
        throw new Error("Invalid user public key");
      }

      await this.writeToGun("WalletPaths", userpub.trim(), paths);
      console.log("Wallet paths saved successfully!");
    } catch (e) {
      console.error("Error saving paths:", e);
      throw e;
    }
  }

  /**
   * Retrieves wallet paths for a user.
   * @param {string} userpub - The user's public key to retrieve the paths for.
   * @returns {Promise<Array>} A promise that resolves with an array of wallet paths.
   * @throws {Error} If the userpub is invalid.
   */
  async getWalletPaths(userpub: string): Promise<string[]> {
    try {
      // Verify that userpub is a valid non-empty string
      if (!userpub || typeof userpub !== "string" || userpub.trim() === "") {
        throw new Error("Invalid user public key");
      }

      const data = await new Promise<WalletPathsData>((resolve, reject) => {
        this.gun
          .get("WalletPaths")
          .get(userpub.trim())
          .once((data: any) => {
            if (!data) {
              reject(new Error("No paths found for this user"));
              return;
            }
            resolve(data);
          });
      });

      // Check if data.paths exists before processing it
      if (!data || !data.paths) {
        console.log("No wallet paths found for the user");
        return [];
      }

      // Ensure paths are in a valid format
      const paths = Array.isArray(data.paths)
        ? data.paths
        : Object.values(data.paths);
      return paths.length ? (paths as string[]) : [];
    } catch (e) {
      console.error("Error retrieving paths:", e);
      return [];
    }
  }

  /**
   * Saves wallet addresses for a user.
   * @param {string} userpub - The user's public key to save the addresses for.
   * @param {Array} addresses - The wallet addresses to save.
   * @returns {Promise<void>} A promise that resolves when the addresses are saved.
   * @throws {Error} If the userpub is invalid or if there's an error saving the addresses.
   */
  async saveWalletAddresses(
    userpub: string,
    addresses: string[]
  ): Promise<void> {
    try {
      await this.writeToGun("WalletAddresses", userpub, { addresses });
    } catch (e) {
      console.error("Error saving wallet addresses:", e);
      throw e;
    }
  }

  /**
   * Retrieves wallet addresses for a user.
   * @param {string} userpub - The user's public key to retrieve the addresses for.
   * @returns {Promise<Array>} A promise that resolves with an array of wallet addresses.
   * @throws {Error} If the userpub is invalid or if there's an error retrieving the addresses.
   */
  async getWalletAddresses(userpub: string): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      this.gun
        .get("WalletAddresses")
        .get(userpub)
        .once((data: any) => {
          if (!data) {
            reject(new Error("No wallet addresses found for this user"));
            return;
          }
          resolve(data.addresses || []);
        });
    });
  }
}

declare global {
  interface Window {
    GunDB: typeof GunDB;
  }
  namespace NodeJS {
    interface Global {
      GunDB: typeof GunDB;
    }
  }
}

if (typeof window !== "undefined") {
  window.GunDB = GunDB;
} else if (typeof global !== "undefined") {
  (global as any).GunDB = GunDB;
}

export { GunDB };
