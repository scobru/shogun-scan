// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const GunL2 = buildModule("GunL2", (m) => {

  const layer2 = m.contract("GunL2");

  return { layer2 };
});

export default GunL2;
