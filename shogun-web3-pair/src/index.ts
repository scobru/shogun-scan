// metamask-auth.js
import * as Gun from "gun";
import "gun/sea";
const SEA = Gun.SEA;
import { ethers } from "ethers";

declare global {
  interface Window {
    ethereum: any;
    ShogunWeb3Pair: typeof ShogunWeb3Pair;
  }
}

class ShogunWeb3Pair {
  private messageToSign: string;

  constructor(messageToSign = "I Love Shogun!") {
    this.messageToSign = messageToSign;
  }

  /**
   * Controlla se MetaMask è disponibile
   */
  isAvailable() {
    return (
      typeof window !== "undefined" && typeof window?.ethereum !== "undefined"
    );
  }

  /**
   * Connette a MetaMask e ritorna l'indirizzo
   */
  async connect() {
    if (!this.isAvailable()) throw new Error("MetaMask non disponibile");

    const provider = new ethers.BrowserProvider(window?.ethereum);
    await window?.ethereum?.request({ method: "eth_requestAccounts" });

    const signer = await provider.getSigner();
    const address = await signer.getAddress();

    return { provider, signer, address };
  }

  /**
   * Firma un messaggio e genera username/password per GunDB
   */
  async getCredentials(signer: ethers.JsonRpcSigner, address: string) {
    const signature = await signer.signMessage(this.messageToSign);
    const username = `mm_${address.toLowerCase()}`;
    const password = ethers.keccak256(
      ethers.toUtf8Bytes(`${signature}:${address.toLowerCase()}`)
    );
    return { username, password, signature, message: this.messageToSign };
  }

  /**
   * Genera una coppia deterministica SEA da una firma
   */
  async generateSEAKeyPair(signature: any) {
    if (!signature) throw new Error("Firma non valida");
    return await SEA.pair(
      (data: any) => {
        localStorage.setItem("sea", JSON.stringify(data));
      },
      { seed: signature }
    );
  }

  /**
   * Flusso completo: connect + firma + SEA
   */
  async login() {
    const { signer, address } = await this.connect();
    const credentials = await this.getCredentials(signer, address);
    const seaPair = await this.generateSEAKeyPair(credentials.signature);
    return {
      address,
      credentials,
      seaPair,
    };
  }
}

// Esponi la classe globalmente per l'uso in browser
if (typeof window !== "undefined") {
  window.ShogunWeb3Pair = ShogunWeb3Pair;
}

export default ShogunWeb3Pair;
