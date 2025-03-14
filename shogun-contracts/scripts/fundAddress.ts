import { ethers } from "hardhat";

async function main() {
  // Get signers from hardhat
  const [sender] = await ethers.getSigners();

  // Address to fund
  const receiverAddress = "0x83efFda20a7bd11717345dF4fF7759814317D90a";
  
  // checksum the address 
  const checksumAddress = ethers.getAddress(receiverAddress);
  
  // Amount to send in ETH
  const amountInEth = "1.0";
  
  console.log("Funding address...");
  console.log("From:", sender.address);
  console.log("To:", receiverAddress); 
  console.log("Amount:", amountInEth, "ETH");

  // Convert ETH to wei
  const amountInWei = ethers.parseEther(amountInEth);

  // Send transaction
  const tx = await sender.sendTransaction({
    to: checksumAddress,
    value: amountInWei
  });

  // Wait for confirmation
  await tx.wait();

  console.log("Transaction successful!");
  console.log("Transaction hash:", tx.hash);
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
