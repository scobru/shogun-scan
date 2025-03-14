// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const GunL2 = buildModule("GunL2", (m) => {

  // hardhat signer
  const layer2 = m.contract("GunL2", ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"]);

  return { layer2 };
});

export default GunL2;
