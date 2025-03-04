/**
 * Gestisce la logica stealth usando Gun e SEA
 */
import { ethers } from 'ethers';
import { IGunInstance, IGunUserInstance } from 'gun/types';
import { GunDB } from '../gun/Gun';

// Estendere l'interfaccia Window per includere StealthChain
declare global {
  interface Window {
    Stealth?: typeof Stealth;
  }
}

declare global {
  namespace NodeJS {
    interface Global {
      Stealth?: typeof Stealth;
    }
  }
}

// Definiamo un'interfaccia per i dati stealth
interface StealthData {
  recipientPublicKey: string;
  ephemeralKeyPair: any;
  timestamp: number;
  method?: string;
  sharedSecret?: string;
}

interface StealthKeyPair {
  pub: string;
  priv: string;
  epub: string;
  epriv: string;
}

interface StealthAddressResult {
  stealthAddress: string;
  ephemeralPublicKey: string;
  recipientPublicKey: string;
}


class Stealth {
  private gun: IGunInstance<any>;
  private user: IGunUserInstance | null;
  private readonly STEALTH_DATA_TABLE: string;
  private lastEphemeralKeyPair: any = null;
  private lastMethodUsed: string = "unknown";

  constructor(gundb: GunDB) {
    this.gun = gundb.gun;
    this.user = null;
    this.STEALTH_DATA_TABLE = "Stealth";
  }

  /**
   * Rimuove il tilde (~) iniziale dalla chiave pubblica se presente
   */
  formatPublicKey(publicKey: string | null): string | null {
    if (!publicKey) {
      return null;
    }

    const trimmedKey = publicKey.trim();

    if (!trimmedKey) {
      return null;
    }

    if (!/^[~]?[\w+/=\-_.]+$/.test(trimmedKey)) {
      return null;
    }

    return trimmedKey.startsWith("~") ? trimmedKey.slice(1) : trimmedKey;
  }

  /**
   * Genera le chiavi stealth se non esistono, altrimenti restituisce quelle esistenti
   */
  async createAccount(): Promise<StealthKeyPair> {
    try {
      // Verifica se esistono già delle chiavi
      const existingKeys = await this.getPair();
      if (existingKeys) {
        console.log("Chiavi stealth esistenti trovate");
        return existingKeys;
      }
      
      console.log("Creazione nuove chiavi stealth...");

      // Verifica che l'utente sia disponibile
      if (!this.gun.user().is) {
        this.user = this.gun.user().recall({ sessionStorage: true });
        
        if (!this.gun.user().is) {
          throw new Error("User not authenticated");
        }
      }

      return new Promise((resolve, reject) => {
        (Gun as any).SEA.pair((pair: any) => {
          if (!pair?.pub || !pair?.priv || !pair?.epub || !pair?.epriv) {
            reject(new Error("Generated keys are invalid"));
            return;
          }

          const stealthKeyPair: StealthKeyPair = {
            pub: pair.pub,
            priv: pair.priv,
            epub: pair.epub,
            epriv: pair.epriv,
          };
          
          console.log("Nuove chiavi stealth generate");

          this.save(stealthKeyPair)
            .then(() => {
              console.log("Chiavi stealth salvate con successo");
              resolve(stealthKeyPair);
            })
            .catch(error => {
              console.error("Errore nel salvataggio delle chiavi stealth:", error);
              reject(error);
            });
        });
      });
    } catch (error) {
      console.error("Errore in createAccount:", error);
      throw error;
    }
  }

  /**
   * Genera un indirizzo stealth per la chiave pubblica del destinatario
   */
  async generateStealthAddress(recipientPublicKey: string): Promise<StealthAddressResult> {
    if (!recipientPublicKey) {
      throw new Error("Invalid keys: missing or invalid parameters");
    }

    // Prima creiamo le chiavi stealth se non esistono
    const stealthKeys = await this.createAccount();
    if (!stealthKeys) {
      throw new Error("Failed to create stealth keys");
    }

    console.log("Generazione indirizzo stealth con chiavi:", {
      userPub: stealthKeys.pub,
      userEpub: stealthKeys.epub,
      recipientPub: recipientPublicKey
    });

    return new Promise((resolve, reject) => {
      // Genera una coppia di chiavi effimere
      (Gun as any).SEA.pair((ephemeralKeyPair: any) => {
        if (!ephemeralKeyPair?.epub || !ephemeralKeyPair?.epriv) {
          reject(new Error("Invalid ephemeral keys"));
          return;
        }

        console.log("Chiavi effimere generate:", ephemeralKeyPair);

        // Memorizza l'intero pair per debug
        this.lastEphemeralKeyPair = ephemeralKeyPair;

        // MODIFICA CRUCIALE: Usiamo l'interfaccia definita
        const stealthData: StealthData = {
          recipientPublicKey,
          ephemeralKeyPair: ephemeralKeyPair,
          timestamp: Date.now()
        };

        // Usa questo formato specifico per il parametro di SEA.secret
        const keyForSecret = {
          epub: ephemeralKeyPair.epub,
          epriv: ephemeralKeyPair.epriv
        };
        
        // Memorizza il formato esatto usato per generare il segreto
        console.log("Formato chiave per segreto (generazione):", JSON.stringify(keyForSecret));
        
        (Gun as any).SEA.secret(recipientPublicKey, keyForSecret, async (sharedSecret: string) => {
          if (!sharedSecret) {
            // Prova con un metodo alternativo
            console.log("Metodo principale fallito, tentativo alternativo...");
            (Gun as any).SEA.secret(recipientPublicKey, ephemeralKeyPair.epub, async (altSecret: string) => {
              if (!altSecret) {
                reject(new Error("Shared secret generation failed with all methods"));
                return;
              }
              
              try {
                const stealthPrivateKey = ethers.keccak256(ethers.toUtf8Bytes(altSecret));
                const stealthWallet = new ethers.Wallet(stealthPrivateKey);
                
                console.log("Indirizzo stealth generato (metodo alt):", {
                  address: stealthWallet.address,
                  ephemeralPubKey: ephemeralKeyPair.epub,
                  recipientPublicKey,
                  method: "alternative"
                });
                
                // Salva il metodo utilizzato e le chiavi complete
                this.lastMethodUsed = "alternative";
                stealthData.method = "alternative";
                stealthData.sharedSecret = altSecret;
                
                // Salva i dati nella memoria locale per consentire l'apertura
                this.saveStealthHistory(stealthWallet.address, stealthData);
                
                resolve({
                  stealthAddress: stealthWallet.address,
                  ephemeralPublicKey: ephemeralKeyPair.epub,
                  recipientPublicKey
                });
              } catch (error) {
                reject(new Error(`Error creating stealth address: ${error instanceof Error ? error.message : "unknown error"}`));
              }
            });
            return;
          }

          console.log("Segreto condiviso generato correttamente con le chiavi del destinatario");
          console.log("Formato di input usato:", {
            recipientPublicKey,
            ephemeralKeyObject: keyForSecret
          });

          try {
            // Genera l'indirizzo stealth usando il segreto condiviso
            const stealthPrivateKey = ethers.keccak256(
              ethers.toUtf8Bytes(sharedSecret)
            );
            const stealthWallet = new ethers.Wallet(stealthPrivateKey);

            console.log("Indirizzo stealth generato:", {
              address: stealthWallet.address,
              ephemeralPubKey: ephemeralKeyPair.epub,
              recipientPublicKey
            });
            
            // Salva il metodo utilizzato e il segreto condiviso
            this.lastMethodUsed = "standard";
            stealthData.method = "standard";
            stealthData.sharedSecret = sharedSecret;
            
            // Salva i dati nella memoria locale per consentire l'apertura
            this.saveStealthHistory(stealthWallet.address, stealthData);

            resolve({
              stealthAddress: stealthWallet.address,
              ephemeralPublicKey: ephemeralKeyPair.epub,
              recipientPublicKey
            });
          } catch (error) {
            reject(
              new Error(
                `Error creating stealth address: ${error instanceof Error ? error.message : "unknown error"}`
              )
            );
          }
        });
      });
    });
  }

  /**
   * Apre un indirizzo stealth derivando la chiave privata
   */
  async openStealthAddress(stealthAddress: string, ephemeralPublicKey: string): Promise<ethers.Wallet> {
    console.log(`Tentativo di apertura dell'indirizzo stealth ${stealthAddress}`);
    
    // Prima controlla se abbiamo i dati salvati in locale
    try {
      const stealthHistory = localStorage.getItem('stealthHistory') || '{}';
      const history = JSON.parse(stealthHistory);
      
      if (history[stealthAddress]) {
        console.log("Trovati dati stealth salvati localmente:", history[stealthAddress]);
        const data = history[stealthAddress];
        
        // Se abbiamo il segreto condiviso, possiamo derivare direttamente il wallet
        if (data.sharedSecret) {
          console.log("Derivazione diretta dal segreto condiviso salvato");
          const stealthPrivateKey = ethers.keccak256(ethers.toUtf8Bytes(data.sharedSecret));
          return new ethers.Wallet(stealthPrivateKey);
        }
      }
    } catch (e) {
      console.log("Nessun dato stealth trovato in locale, tentativo con i metodi standard");
    }
    
    // Se non abbiamo dati salvati, procedi con il metodo normale
    if (!stealthAddress || !ephemeralPublicKey) {
      throw new Error("Missing parameters: stealthAddress or ephemeralPublicKey");
    }

    console.log(`Tentativo di apertura dell'indirizzo stealth ${stealthAddress}`);
    
    // Recupera le chiavi stealth dell'utente
    let keys = await this.getPair();
    
    if (!keys) {
      console.log("Chiavi stealth non trovate, tentativo di creazione...");
      try {
        keys = await this.createAccount();
        if (!keys) {
          throw new Error("Stealth keys not found and creation failed");
        }
      } catch (error) {
        console.error("Errore nella creazione delle chiavi stealth:", error);
        throw new Error("Stealth keys not found and creation failed");
      }
    }
    
    console.log("Apertura indirizzo stealth con chiavi recuperate:", {
      stealthAddress,
      ephemeralPublicKey,
      userKeysFound: !!keys
    });

    return new Promise((resolve, reject) => {
      // Prova tutte le possibili combinazioni di parametri per SEA.secret
      const attempts = [
        // Tentativo 1: Metodo standard - ephemeral keys first
        () => {
          console.log("Tentativo 1: Metodo standard con chiavi effimere");
          return new Promise((res) => {
            (Gun as any).SEA.secret(ephemeralPublicKey, keys, async (secret: string) => {
              try {
                if (!secret) {
                  return res(null);
                }
                const wallet = this.deriveWalletFromSecret(secret);
                if (wallet.address.toLowerCase() === stealthAddress.toLowerCase()) {
                  return res(wallet);
                }
                return res(null);
              } catch (e) {
                return res(null);
              }
            });
          });
        },
        
        // Tentativo 2: Metodo standard - forma esplicita
        () => {
          console.log("Tentativo 2: Metodo standard con forma esplicita");
      const keyForSecret = {
        epub: keys.epub,
        epriv: keys.epriv
      };
          return new Promise((res) => {
            (Gun as any).SEA.secret(ephemeralPublicKey, keyForSecret, async (secret: string) => {
              try {
                if (!secret) {
                  return res(null);
                }
                const wallet = this.deriveWalletFromSecret(secret);
                if (wallet.address.toLowerCase() === stealthAddress.toLowerCase()) {
                  return res(wallet);
                }
                return res(null);
              } catch (e) {
                return res(null);
              }
            });
          });
        },
        
        // Tentativo 3: Metodo invertito - chiavi utente first
        () => {
          console.log("Tentativo 3: Metodo invertito con chiavi utente first");
          return new Promise((res) => {
            (Gun as any).SEA.secret(keys.epub, ephemeralPublicKey, async (secret: string) => {
              try {
                if (!secret) {
                  return res(null);
                }
                const wallet = this.deriveWalletFromSecret(secret);
                if (wallet.address.toLowerCase() === stealthAddress.toLowerCase()) {
                  return res(wallet);
                }
                return res(null);
              } catch (e) {
                return res(null);
              }
            });
          });
        },
        
        // Tentativo 4: Metodo più alternativo - pub invece di epub
        () => {
          console.log("Tentativo 4: Metodo con pub invece di epub");
          return new Promise((res) => {
            (Gun as any).SEA.secret(keys.pub, ephemeralPublicKey, async (secret: string) => {
              try {
                if (!secret) {
                  return res(null);
                }
                const wallet = this.deriveWalletFromSecret(secret);
                if (wallet.address.toLowerCase() === stealthAddress.toLowerCase()) {
                  return res(wallet);
                }
                return res(null);
              } catch (e) {
                return res(null);
              }
            });
          });
        }
      ];
      
      // Funzione helper per derivare il wallet dal secret
      this.deriveWalletFromSecret = (secret: string) => {
        const stealthPrivateKey = ethers.keccak256(ethers.toUtf8Bytes(secret));
        return new ethers.Wallet(stealthPrivateKey);
      };
      
      // Esegui tutti i tentativi in sequenza
      const tryNextAttempt = async (index = 0) => {
        if (index >= attempts.length) {
          return reject(new Error("Tutti i metodi di derivazione dell'indirizzo stealth hanno fallito"));
        }
        
        const wallet = await attempts[index]();
        if (wallet) {
          console.log(`Metodo ${index + 1} ha funzionato!`);
          return resolve(wallet as ethers.Wallet);
        }
        
        tryNextAttempt(index + 1);
      };
      
      tryNextAttempt();
    });
  }

  /**
   * Salva le chiavi stealth nel profilo utente
   */
  async save(stealthKeyPair: StealthKeyPair): Promise<any> {
    if (!stealthKeyPair?.pub || !stealthKeyPair?.priv || !stealthKeyPair?.epub || !stealthKeyPair?.epriv) {
      throw new Error("Invalid stealth keys: missing or incomplete parameters");
    }

    if (!this.gun.user().is) {
      this.user = this.gun.user().recall({ sessionStorage: true });
      
      if (!this.gun.user().is) {
        throw new Error("User not authenticated for saving stealth keys");
      }
    }
    
    const appKeyPair = (this.gun.user() as any)._.sea;
    if (!appKeyPair) {
      throw new Error("Gun key pair not found");
    }

    console.log("Salvataggio chiavi stealth per utente:", appKeyPair.pub);

    return new Promise(async (resolve, reject) => {
      try {
        // Prima crittografa i dati sensibili
        const encryptedPriv = await (Gun as any).SEA.encrypt(stealthKeyPair.priv, appKeyPair);
        const encryptedEpriv = await (Gun as any).SEA.encrypt(stealthKeyPair.epriv, appKeyPair);

        // Poi salva i dati crittografati
        this.gun.get(this.STEALTH_DATA_TABLE).get(appKeyPair.pub).put({
          pub: stealthKeyPair.pub,
          priv: encryptedPriv,
          epub: stealthKeyPair.epub,
          epriv: encryptedEpriv,
          timestamp: Date.now()
        }, (ack: any) => {
          if (ack.err) {
            reject(new Error(ack.err));
          } else {
            resolve(ack);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Recupera le chiavi stealth dell'utente corrente
   */
  async getPair(): Promise<StealthKeyPair | null> {
    try {
      // Assicurati che Gun sia inizializzato
      if (!this.gun) {
        console.error("Gun non è inizializzato");
        return null;
      }

      // Recupera l'utente
      this.user = this.gun.user().recall({ sessionStorage: true });
      
      // Verifica che l'utente sia autenticato
      if (!this.user || !(this.user as any).is) {
        console.error("Utente non autenticato");
        return null;
      }
      
      // Ottieni la coppia di chiavi dell'app
      const appKeyPair = (this.user as any)._.sea;
      
      // Verifica che le chiavi dell'app siano valide
      if (!appKeyPair || !appKeyPair.pub) {
        console.error("Chiavi dell'app non valide");
        return null;
      }
      
      console.log("Cercando chiavi stealth per pub:", appKeyPair.pub);

      return new Promise((resolve, reject) => {
        this.gun.get(this.STEALTH_DATA_TABLE).get(appKeyPair.pub).once(async (data: any) => {
          // Log per debug
          console.log("Dati stealth trovati:", data);
          
          if (!data) {
            console.warn("Nessun dato stealth trovato per", appKeyPair.pub);
            resolve(null);
            return;
          }

          try {
            // Verifica che i dati crittografati esistano
            if (!data.priv || !data.epriv) {
              console.error("Dati stealth incompleti");
              resolve(null);
              return;
            }
            
            // Decrittografa i dati
            console.log("Tentativo di decrittare i dati stealth...");
            const priv = await (Gun as any).SEA.decrypt(data.priv, appKeyPair);
            const epriv = await (Gun as any).SEA.decrypt(data.epriv, appKeyPair);
            
            if (!priv || !epriv) {
              console.error("Fallita la decrittazione delle chiavi stealth");
              resolve(null);
              return;
            }

            console.log("Chiavi stealth decrittate con successo");
            resolve({
              pub: data.pub,
              priv,
              epub: data.epub,
              epriv
            });
          } catch (error) {
            console.error("Errore durante la decrittazione:", error);
            reject(new Error("Failed to decrypt stealth keys"));
          }
        });
      });
    } catch (error) {
      console.error("Errore in getPair:", error);
      return null;
    }
  }

  /**
   * Recupera la chiave pubblica stealth di un utente
   */
  async getPublicKey(publicKey: string): Promise<string | null> {
    const formattedPubKey = this.formatPublicKey(publicKey);
    if (!formattedPubKey) {
      return null;
    }

    return new Promise((resolve) => {
      this.gun.get(this.STEALTH_DATA_TABLE).get(formattedPubKey).once((data: any) => {
        resolve(data?.epub || null);
      });
    });
  }

  // Aggiungere questo helper method alla classe
  private deriveWalletFromSecret(secret: string): ethers.Wallet {
    const stealthPrivateKey = ethers.keccak256(ethers.toUtf8Bytes(secret));
    return new ethers.Wallet(stealthPrivateKey);
  }

  // Aggiungi questo metodo alla classe
  private saveStealthHistory(address: string, data: any) {
    // Salva nella localStorage
    try {
      const stealthHistory = localStorage.getItem('stealthHistory') || '{}';
      const history = JSON.parse(stealthHistory);
      history[address] = data;
      localStorage.setItem('stealthHistory', JSON.stringify(history));
      console.log(`Dati stealth salvati per l'indirizzo ${address}`);
    } catch (e) {
      console.error("Errore nel salvataggio dei dati stealth:", e);
    }
  }
}

// Rendi disponibile globalmente
if (typeof window !== 'undefined') {
  window.Stealth = Stealth;
} else if (typeof global !== 'undefined') {
  (global as any).Stealth = Stealth;
}

export { Stealth };
export default Stealth;