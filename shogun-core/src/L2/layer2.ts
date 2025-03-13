import Gun from 'gun';
import { ethers } from 'ethers';

/**
 * Layer2 class for handling GunToken (GT) operations
 * This class provides functionality for managing token balances and transactions
 * using GunDB as a distributed database and Ethereum for authentication.
 */
export class Layer2 {
  private gun: any;
  private GT_DB: any;
  private TX_DB: any;

  /**
   * Initialize Layer2 with GunDB connection
   * @param gunPeers Array of Gun peer URLs to connect to
   */
  constructor(gunPeers: string[] = ['http://localhost:8765/gun']) {
    this.gun = Gun(gunPeers);
    this.GT_DB = this.gun.get('gunTokenBalances'); // Database for token balances
    this.TX_DB = this.gun.get('gunTransactions'); // Database for transactions
  }

  /**
   * Send GunTokens (GT) from one user to another
   * @param sender Sender's address
   * @param receiver Receiver's address
   * @param amount Amount of GT to send
   * @param privateKey Sender's private key for transaction signature
   * @returns Promise resolving when transaction is complete
   */
  async sendGT(sender: string, receiver: string, amount: number, privateKey: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get current balance from database
      this.GT_DB.get(sender).once((senderBalance: number) => {
        if (senderBalance < amount) {
          const error = "Error: Insufficient GT balance";
          console.log(error);
          reject(new Error(error));
          return;
        }

        // Sign transaction with Ethereum for authentication
        const wallet = new ethers.Wallet(privateKey);
        const message = `${sender}->${receiver}: ${amount} GT`;
        wallet.signMessage(message).then(signature => {
          // Record transaction in GunDB
          this.TX_DB.set({
            from: sender,
            to: receiver,
            amount,
            timestamp: Date.now(),
            signature
          });

          // Update balances in GunDB
          this.GT_DB.get(sender).put(senderBalance - amount);
          this.GT_DB.get(receiver).once((receiverBalance: number) => {
            this.GT_DB.get(receiver).put((receiverBalance || 0) + amount);
            console.log(`✅ Transaction completed: ${amount} GT from ${sender} to ${receiver}`);
            resolve();
          });
        }).catch(error => reject(error));
      });
    });
  }

  /**
   * Get GT balance of a user
   * @param user User's address
   * @returns Promise resolving with the user's balance
   */
  async getBalance(user: string): Promise<number> {
    return new Promise((resolve) => {
      this.GT_DB.get(user).once((balance: number) => {
        console.log(`Balance of ${user}: ${balance || 0} GT`);
        resolve(balance || 0);
      });
    });
  }

  /**
   * Request withdrawal of tokens (interacts with smart contract)
   * @param amount Amount to withdraw in ETH
   * @param userAddress User's Ethereum address
   * @param privateKey User's private key
   * @param providerUrl URL of the Ethereum provider
   * @param contractAddress Address of the smart contract
   * @param contractABI ABI of the smart contract
   * @returns Promise resolving when withdrawal request is sent
   */
  async requestWithdrawGT(
    amount: number, 
    userAddress: string, 
    privateKey: string, 
    providerUrl: string, 
    contractAddress: string,
    contractABI: string | any[]
  ): Promise<void> {
    // Create provider from URL
    const provider = new ethers.JsonRpcProvider(providerUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Create contract instance
    const contract = new ethers.Contract(
      contractAddress,
      typeof contractABI === 'string' ? JSON.parse(contractABI) : contractABI,
      wallet
    );

    try {
      const tx = await contract.requestWithdraw(ethers.parseEther(amount.toString()));
      await tx.wait();
      console.log(`✅ Withdrawal request sent: ${amount} ETH`);
    } catch (error) {
      console.error("Error in withdrawal:", error);
      throw error;
    }
  }

  /**
   * Get transaction history for a user
   * @param userAddress User's address
   * @returns Promise resolving with user's transactions
   */
  async getTransactionHistory(userAddress: string): Promise<any[]> {
    return new Promise((resolve) => {
      const transactions: any[] = [];
      this.TX_DB.map().once((tx: any) => {
        if (tx.from === userAddress || tx.to === userAddress) {
          transactions.push(tx);
        }
      });
      
      setTimeout(() => {
        resolve(transactions);
      }, 500); // Give Gun time to collect results
    });
  }
}

// Example usage:
/*
const layer2 = new Layer2();
const sender = "0xABC123";
const receiver = "0xDEF456";
const senderPrivateKey = "YOUR_PRIVATE_KEY";

// Execute transactions and checks
async function test() {
  await layer2.sendGT(sender, receiver, 5, senderPrivateKey); // Transfer 5 GT
  await layer2.getBalance(receiver); // Show updated balance
  await layer2.requestWithdrawGT(2, sender, senderPrivateKey, "https://eth-rpc-url", "0xContractAddress", "0xContractABI"); // Request 2 ETH withdrawal
}

test().catch(console.error);
*/
