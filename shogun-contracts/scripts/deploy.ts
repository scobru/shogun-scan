import { ethers } from "hardhat";

async function main() {
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy Channel contract
  const challengePeriod = 3600; // 1 hour in seconds
  const depositAmount = ethers.parseEther("1.0"); // 1 ETH deposit

  const Channel = await ethers.getContractFactory("Channel");
  const channel = await Channel.deploy(deployer.address, challengePeriod, {
    value: depositAmount
  });

  await channel.waitForDeployment();
  
  console.log("Channel deployed to:", await channel.getAddress());
  console.log("Challenge period:", challengePeriod, "seconds");
  console.log("Initial deposit:", ethers.formatEther(depositAmount), "ETH");
}

// Handle errors
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
