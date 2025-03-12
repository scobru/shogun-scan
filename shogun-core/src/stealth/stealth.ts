/**
 * Gestisce la logica stealth usando Gun e SEA
 */
import { ethers } from "ethers";

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

// Definiamo le interfacce con tipi standard
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
  public readonly STEALTH_DATA_TABLE: string;
  private lastEphemeralKeyPair: any = null;
  private lastMethodUsed: string = "unknown";
  private deriveWalletFromSecret!: (secret: string) => ethers.Wallet;

  constructor() {
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
   * Crea un nuovo account stealth
   */
  async createAccount(): Promise<StealthKeyPair> {
    try {
      // Genera una nuova coppia di chiavi
      const keyPair = await (Gun as any).SEA.pair();

      if (
        !keyPair ||
        !keyPair.pub ||
        !keyPair.priv ||
        !keyPair.epub ||
        !keyPair.epriv
      ) {
        throw new Error("Failed to generate stealth key pair");
      }

      return {
        pub: keyPair.pub,
        priv: keyPair.priv,
        epub: keyPair.epub,
        epriv: keyPair.epriv,
      };
    } catch (error) {
      console.error("Error creating stealth account:", error);
      throw error;
    }
  }

  /**
   * Genera un indirizzo stealth per la chiave pubblica del destinatario
   */
  async generateStealthAddress(
    recipientPublicKey: string
  ): Promise<StealthAddressResult> {
    if (!recipientPublicKey) {
      throw new Error("Invalid keys: missing or invalid parameters");
    }

    // Prima creiamo le chiavi stealth
    const stealthKeys = await this.createAccount();

    if (!stealthKeys) {
      throw new Error("Failed to create stealth keys");
    }

    console.log("Generazione indirizzo stealth con chiavi:", {
      userPub: stealthKeys.pub,
      userEpub: stealthKeys.epub,
      recipientPub: recipientPublicKey,
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

        // Creiamo i dati stealth
        const stealthData: StealthData = {
          recipientPublicKey: recipientPublicKey,
          ephemeralKeyPair: ephemeralKeyPair,
          timestamp: Date.now(),
        };

        // Usa questo formato specifico per il parametro di SEA.secret
        const keyForSecret = {
          epub: ephemeralKeyPair.epub,
          epriv: ephemeralKeyPair.epriv,
        };

        console.log(
          "Formato chiave per segreto (generazione):",
          JSON.stringify(keyForSecret)
        );

        (Gun as any).SEA.secret(
          recipientPublicKey,
          keyForSecret,
          async (sharedSecret: string) => {
            console.log(
              "Segreto condiviso generato correttamente con le chiavi del destinatario"
            );
            console.log("Formato di input usato:", {
              recipientPublicKey: recipientPublicKey,
              ephemeralKeyObject: keyForSecret,
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
                recipientPublicKey: recipientPublicKey,
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
                recipientPublicKey: recipientPublicKey,
              });
            } catch (error) {
              reject(
                new Error(
                  `Error creating stealth address: ${error instanceof Error ? error.message : "unknown error"}`
                )
              );
            }
          }
        );
      });
    });
  }

  /**
   * Apre un indirizzo stealth derivando la chiave privata
   */
  async openStealthAddress(
    stealthAddress: string,
    ephemeralPublicKey: string,
    pair: StealthKeyPair
  ): Promise<ethers.Wallet> {
    console.log(
      `Tentativo di apertura dell'indirizzo stealth ${stealthAddress}`
    );

    // Prima controlla se abbiamo i dati salvati in locale
    try {
      const stealthHistory = localStorage.getItem("stealthHistory") || "{}";
      const history = JSON.parse(stealthHistory);

      console.log(
        `Controllo se esistono dati per l'indirizzo ${stealthAddress} in localStorage`
      );

      const data = history[stealthAddress];
      if (data) {
        console.log("Trovati dati stealth salvati localmente:", data);

        // Se abbiamo il segreto condiviso, possiamo derivare direttamente il wallet
        if (data.sharedSecret) {
          console.log("Derivazione diretta dal segreto condiviso salvato");
          const stealthPrivateKey = ethers.keccak256(
            ethers.toUtf8Bytes(data.sharedSecret)
          );
          return new ethers.Wallet(stealthPrivateKey);
        }

        // Se abbiamo il metodo e le chiavi effimere complete, proviamo a rigenerare il segreto
        if (data.method && data.ephemeralKeyPair) {
          console.log(
            "Tentativo di rigenerazione del segreto con il metodo:",
            data.method
          );

          if (data.method === "standard") {
            // Usa il formato specifico che abbiamo usato durante la generazione
            const keyForSecret = {
              epub: data.ephemeralKeyPair.epub,
              epriv: data.ephemeralKeyPair.epriv,
            };

            console.log(
              "Rigenerazione con formato esplicito:",
              JSON.stringify(keyForSecret)
            );

            return new Promise((resolve, reject) => {
              (Gun as any).SEA.secret(
                data.recipientPublicKey,
                keyForSecret,
                async (secret: string) => {
                  if (!secret) {
                    reject(
                      new Error("Impossibile rigenerare il segreto condiviso")
                    );
                    return;
                  }

                  try {
                    const stealthPrivateKey = ethers.keccak256(
                      ethers.toUtf8Bytes(secret)
                    );
                    const wallet = new ethers.Wallet(stealthPrivateKey);

                    // Verifica che il wallet generato corrisponda all'indirizzo
                    if (
                      wallet.address.toLowerCase() ===
                      stealthAddress.toLowerCase()
                    ) {
                      console.log(
                        "Rigenerazione riuscita! Indirizzo corrispondente:",
                        wallet.address
                      );
                      return resolve(wallet);
                    }

                    console.log(
                      "Indirizzo generato non corrispondente:",
                      wallet.address
                    );
                    // Continua con i metodi standard
                    throw new Error("Indirizzo non corrispondente"); // Per uscire e continuare
                  } catch (e) {
                    console.error("Errore durante la derivazione:", e);
                    // Continua con i metodi standard
                    throw new Error("Errore di derivazione"); // Per uscire e continuare
                  }
                }
              );
            });
          }
          throw new Error("Metodo non supportato"); // Per uscire e continuare
        }
        throw new Error("Dati insufficienti"); // Per uscire e continuare
      }

      console.log(
        "Nessun dato stealth trovato in localStorage per questo indirizzo"
      );
      throw new Error("Nessun dato trovato"); // Per continuare con i metodi standard
    } catch (e) {
      console.log("Errore nel recupero dei dati da localStorage:", e);
      // Procedi con il metodo normale
      return this.openStealthAddressStandard(
        stealthAddress,
        ephemeralPublicKey,
        pair
      );
    }
  }

  /**
   * Metodo standard per aprire un indirizzo stealth (usato come fallback)
   */
  private async openStealthAddressStandard(
    stealthAddress: string,
    ephemeralPublicKey: string,
    pair: StealthKeyPair
  ): Promise<ethers.Wallet> {
    if (!stealthAddress || !ephemeralPublicKey) {
      throw new Error(
        "Missing parameters: stealthAddress or ephemeralPublicKey"
      );
    }

    // Recupera le chiavi stealth dell'utente
    console.log("Apertura indirizzo stealth con chiavi recuperate:", {
      stealthAddress: stealthAddress,
      ephemeralPublicKey: ephemeralPublicKey,
      userKeysFound: !!pair,
    });

    return new Promise((resolve, reject) => {
      // Prova tutte le possibili combinazioni di parametri per SEA.secret
      const attempts = [
        // Tentativo 1: Metodo standard - ephemeral keys first
        () => {
          console.log("Tentativo 1: Metodo standard con chiavi effimere");
          return new Promise((res) => {
            (Gun as any).SEA.secret(
              ephemeralPublicKey,
              pair,
              async (secret: string) => {
                try {
                  if (!secret) {
                    return res(null);
                  }
                  const wallet = this.deriveWalletFromSecret(secret);
                  if (
                    wallet.address.toLowerCase() ===
                    stealthAddress.toLowerCase()
                  ) {
                    return res(wallet);
                  }
                  return res(null);
                } catch (e) {
                  return res(null);
                }
              }
            );
          });
        },
      ];

      // Funzione helper per derivare il wallet dal secret
      this.deriveWalletFromSecret = (secret: string) => {
        const stealthPrivateKey = ethers.keccak256(ethers.toUtf8Bytes(secret));
        return new ethers.Wallet(stealthPrivateKey);
      };

      // Esegui tutti i tentativi in sequenza
      const tryNextAttempt = async (index = 0) => {
        if (index >= attempts.length) {
          return reject(
            new Error(
              "Tutti i metodi di derivazione dell'indirizzo stealth hanno fallito"
            )
          );
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
   * Ottiene la chiave pubblica da un indirizzo
   */
  async getPublicKey(publicKey: string): Promise<string | null> {
    // Formatta la chiave pubblica
    return this.formatPublicKey(publicKey);
  }

  /**
   * Salva le chiavi stealth nel profilo utente
   * @returns Le chiavi stealth da salvare
   */
  prepareStealthKeysForSaving(stealthKeyPair: StealthKeyPair): StealthKeyPair {
    if (
      !stealthKeyPair?.pub ||
      !stealthKeyPair?.priv ||
      !stealthKeyPair?.epub ||
      !stealthKeyPair?.epriv
    ) {
      throw new Error("Invalid stealth keys: missing or incomplete parameters");
    }

    return stealthKeyPair;
  }

  /**
   * Deriva un wallet dal segreto condiviso
   */
  deriveWalletFromSecret(secret: string): ethers.Wallet {
    const stealthPrivateKey = ethers.keccak256(ethers.toUtf8Bytes(secret));
    return new ethers.Wallet(stealthPrivateKey);
  }

  /**
   * Salva i dati stealth nella localStorage
   */
  saveStealthHistory(address: string, data: any) {
    // Salva nella localStorage
    try {
      const stealthHistory = localStorage.getItem("stealthHistory") || "{}";
      const history = JSON.parse(stealthHistory);
      history[address] = data;
      localStorage.setItem("stealthHistory", JSON.stringify(history));
      console.log(`Dati stealth salvati per l'indirizzo ${address}`);
    } catch (e) {
      console.error("Errore nel salvataggio dei dati stealth:", e);
    }
  }
}

// Rendi disponibile globalmente
if (typeof window !== "undefined") {
  window.Stealth = Stealth;
} else if (typeof global !== "undefined") {
  (global as any).Stealth = Stealth;
}

export { Stealth, StealthKeyPair, StealthAddressResult };
