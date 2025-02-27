const { ethers } = require("hardhat");

async function main() {
  // Get the deployer's signer
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Get the contract factory
  const StakingPool = await ethers.getContractFactory("StakingPool");

  // Get configuration from environment variables
  const BRAIDS_TOKEN = process.env.BRAIDS_TOKEN_ADDRESS;
  const ADMIN_ADDRESS = process.env.DEPLOYER_ADDRESS;

  if (!BRAIDS_TOKEN || !ADMIN_ADDRESS) {
    throw new Error("Missing required environment variables");
  }

  console.log("Deployment configuration:");
  console.log("  - BRAIDS Token:", BRAIDS_TOKEN);
  console.log("  - Admin Address:", ADMIN_ADDRESS);
  console.log("\nDeploying StakingPool...");
}