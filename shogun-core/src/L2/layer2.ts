import Gun from 'gun';
import { ethers } from 'ethers';

// Minimal ABI for GunL2 contract
const GunL2ABI = [
  "function balanceGT(address user) external view returns (uint256)",
  "function contractBalance() public view returns (uint256)",
  "function deposit() external payable",
  "function requestWithdraw(uint256 amount) external",
  "function processWithdraw() external",
  "function pendingWithdrawals(address user) external view returns (uint256)"
];

/**
 * Layer2 class for handling GunToken (GT) operations
 * This class provides functionality for managing token balances and transactions
 * using GunDB as a distributed database and Ethereum for authentication.
 */
export class Layer2 {
  private gun: any;
  private GT_DB: any;
  private TX_DB: any;
  
  // FROZEN SPACE implementation
  private FROZEN_GT_DB: any; // Frozen balances that can only be updated by chain sync
  private SYNC_METADATA_DB: any; // Metadata about syncs (timestamp, block, etc.)

  /**
   * Initialize Layer2 with GunDB connection
   * @param gunPeers Array of Gun peer URLs to connect to
   */
  constructor(gunPeers: string[] = ['http://localhost:8765/gun']) {
    this.gun = Gun(gunPeers);
    this.GT_DB = this.gun.get('gunTokenBalances'); // Legacy database for token balances
    this.TX_DB = this.gun.get('gunTransactions'); // Database for transactions
    
    // FROZEN SPACE databases
    this.FROZEN_GT_DB = this.gun.get('frozenGTBalances'); // Authorized balances synced from chain
    this.SYNC_METADATA_DB = this.gun.get('syncMetadata'); // Sync metadata
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
    return new Promise(async (resolve, reject) => {
      try {
        // IMPROVED: First check the FROZEN balance (source of truth)
        const frozenBalance = await this.getFrozenBalance(sender);
        const legacyBalance = await this.getLegacyBalance(sender);
        
        // Use the frozen balance if available, fall back to legacy
        const senderBalance = frozenBalance !== null ? frozenBalance : legacyBalance;
        
        if (senderBalance < amount) {
          const error = "Error: Insufficient GT balance";
          console.log(error);
          reject(new Error(error));
          return;
        }

        // Sign transaction with Ethereum for authentication
        const wallet = new ethers.Wallet(privateKey);
        const message = `${sender}->${receiver}: ${amount} GT`;
        const signature = await wallet.signMessage(message);
        
        // Record transaction in GunDB
        this.TX_DB.set({
          from: sender,
          to: receiver,
          amount,
          timestamp: Date.now(),
          signature
        });

        // Update balances in both legacy and frozen spaces
        // Legacy balance update
        this.GT_DB.get(sender).once((currentBalance: number) => {
          this.GT_DB.get(sender).put((currentBalance || 0) - amount);
          
          this.GT_DB.get(receiver).once((receiverBalance: number) => {
            this.GT_DB.get(receiver).put((receiverBalance || 0) + amount);
            
            // Also update the frozen balances to stay in sync
            this.updateFrozenBalances(sender, (frozenBalance || 0) - amount);
            this.updateFrozenBalances(receiver, (await this.getFrozenBalance(receiver) || 0) + amount);
            
            console.log(`✅ Transaction completed: ${amount} GT from ${sender} to ${receiver}`);
            resolve();
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get GT balance of a user from the legacy database
   * @param user User's address
   * @returns Promise resolving with the user's balance
   * @private For internal use, prefer getBalance() for external calls
   */
  private async getLegacyBalance(user: string): Promise<number> {
    return new Promise((resolve) => {
      this.GT_DB.get(user).once((balance: number) => {
        resolve(balance || 0);
      });
    });
  }

  /**
   * Get GT balance of a user from the frozen space (verified balances)
   * @param user User's address 
   * @returns Promise resolving with verified balance, or null if not synced
   * @private For internal use
   */
  private async getFrozenBalance(user: string): Promise<number | null> {
    return new Promise((resolve) => {
      this.FROZEN_GT_DB.get(user).once((data: any) => {
        if (data && typeof data.balance === 'number') {
          console.log(`Found frozen balance for ${user}: ${data.balance} GT`);
          resolve(data.balance);
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Update frozen balance with metadata
   * @param user User's address
   * @param balance New balance
   * @param metadata Optional sync metadata
   * @private For internal use only
   */
  private async updateFrozenBalances(user: string, balance: number, metadata?: any): Promise<void> {
    const timestamp = Date.now();
    const syncData = {
      balance,
      lastSyncTime: timestamp,
      ...(metadata || {})
    };
    
    console.log(`Updating frozen balance for ${user}: ${balance} GT`);
    this.FROZEN_GT_DB.get(user).put(syncData);
    
    // Also record sync metadata
    this.SYNC_METADATA_DB.get(user).set({
      timestamp,
      balance,
      type: metadata?.syncType || 'manual',
      ...(metadata || {})
    });
  }

  /**
   * Synchronize balances with the blockchain (source of truth)
   * @param userAddress User's address
   * @param provider Ethereum provider
   * @param contractAddress GunL2 contract address
   * @returns Promise resolving with the synchronized balance
   */
  async syncBalanceWithChain(
    userAddress: string, 
    provider: ethers.JsonRpcProvider, 
    contractAddress: string
  ): Promise<number> {
    try {
      console.log(`Syncing on-chain balance for ${userAddress}`);
      
      // Create contract instance to read on-chain balance
      const contract = new ethers.Contract(
        contractAddress,
        GunL2ABI,
        provider
      );
      
      // Get current block
      const block = await provider.getBlock('latest');
      const blockNumber = block ? block.number : 0;
      
      // Get on-chain balance
      const balanceWei = await contract.balanceGT(userAddress);
      const balance = parseFloat(ethers.formatEther(balanceWei));
      
      console.log(`On-chain balance for ${userAddress}: ${balance} GT (block ${blockNumber})`);
      
      // Update both legacy and frozen balances
      await this.updateLegacyAndFrozenBalances(userAddress, balance, {
        syncType: 'blockchain',
        blockNumber,
        timestamp: block?.timestamp || Math.floor(Date.now() / 1000)
      });
      
      return balance;
    } catch (error) {
      console.error("Error syncing balance with chain:", error);
      throw error;
    }
  }

  /**
   * Update both legacy and frozen balances with consistent values
   * @param user User's address
   * @param balance New balance
   * @param metadata Sync metadata
   * @private For internal use
   */
  private async updateLegacyAndFrozenBalances(user: string, balance: number, metadata?: any): Promise<void> {
    return new Promise((resolve) => {
      // Update legacy balance first
      this.GT_DB.get(user).put(balance);
      
      // Then update frozen balance with metadata
      this.updateFrozenBalances(user, balance, metadata);
      
      resolve();
    });
  }

  /**
   * Get GT balance of a user
   * @param user User's address
   * @returns Promise resolving with the user's balance
   */
  async getBalance(user: string): Promise<number> {
    try {
      // First try getting the frozen balance (source of truth)
      const frozenBalance = await this.getFrozenBalance(user);
      
      // If frozen balance exists, use it
      if (frozenBalance !== null) {
        console.log(`Balance of ${user} (from frozen space): ${frozenBalance} GT`);
        return frozenBalance;
      }
      
      // Fall back to legacy balance
      const legacyBalance = await this.getLegacyBalance(user);
      console.log(`Balance of ${user} (from legacy space): ${legacyBalance} GT`);
      return legacyBalance;
    } catch (error) {
      console.error("Error getting balance:", error);
      return 0;
    }
  }

  /**
   * Get balance sync status including last sync time
   * @param user User's address
   * @returns Promise resolving with sync status
   */
  async getBalanceSyncStatus(user: string): Promise<{
    balance: number;
    lastSyncTime?: number;
    blockNumber?: number;
    syncType?: string;
  }> {
    return new Promise((resolve) => {
      this.FROZEN_GT_DB.get(user).once((data: any) => {
        if (data && typeof data.balance === 'number') {
          resolve({
            balance: data.balance,
            lastSyncTime: data.lastSyncTime,
            blockNumber: data.blockNumber,
            syncType: data.syncType
          });
        } else {
          resolve({ balance: 0 });
        }
      });
    });
  }

  /**
   * Update GT balance for a user - sync on-chain and off-chain
   * @param user User's address
   * @param newBalance New balance to set or amount to add
   * @param isIncrement If true, adds the amount to current balance; if false, sets balance to newBalance
   * @returns Promise resolving with the updated balance
   */
  async updateBalance(user: string, newBalance: number, isIncrement: boolean = false): Promise<number> {
    return new Promise(async (resolve, reject) => {
      try {
        if (isIncrement) {
          // Add to existing balance
          const currentBalance = await this.getBalance(user);
          const updatedBalance = (currentBalance || 0) + newBalance;
          
          // Update both legacy and frozen balances
          await this.updateLegacyAndFrozenBalances(user, updatedBalance, {
            syncType: 'manual_increment',
            incrementAmount: newBalance
          });
          
          console.log(`✅ Balance updated for ${user}: added ${newBalance} GT, new total: ${updatedBalance} GT`);
          resolve(updatedBalance);
        } else {
          // Set to specific balance
          await this.updateLegacyAndFrozenBalances(user, newBalance, {
            syncType: 'manual_set'
          });
          
          console.log(`✅ Balance set for ${user}: ${newBalance} GT`);
          resolve(newBalance);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get sync history for a user
   * @param user User's address
   * @param limit Maximum number of events to retrieve
   * @returns Promise resolving with sync history
   */
  async getSyncHistory(user: string, limit: number = 10): Promise<any[]> {
    return new Promise((resolve) => {
      const history: any[] = [];
      
      this.SYNC_METADATA_DB.get(user).map((data: any) => {
        if (data) {
          history.push(data);
        }
      });
      
      setTimeout(() => {
        // Sort by timestamp descending and limit results
        const sortedHistory = history
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
          .slice(0, limit);
          
        resolve(sortedHistory);
      }, 500); // Give Gun time to collect results
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
      const receipt = await tx.wait();
      console.log(`✅ Withdrawal request sent: ${amount} ETH`);
      
      // After successful withdrawal request, sync the balance from chain
      await this.syncBalanceWithChain(userAddress, provider, contractAddress);
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
