// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ChannelModule = buildModule("ChannelModule", (m) => {

  const feePercent = m.getParameter("depositAmount", 10);

  const channel = m.contract("Channel", [feePercent]);

  return { channel };
});

export default ChannelModule;
