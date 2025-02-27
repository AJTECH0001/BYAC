require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Validate environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY || !PRIVATE_KEY.startsWith('0x') || PRIVATE_KEY.length !== 66) {
  console.error("❌ Invalid or missing PRIVATE_KEY environment variable!");
  process.exit(1);
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    ronin: {
      url: "https://api.roninchain.com/rpc",
      accounts: [PRIVATE_KEY],
      chainId: 2020,
      timeout: 60000,
      gasPrice: "auto",
      gas: "auto",
      verify: {
        etherscan: {
          apiUrl: 'https://app.roninchain.com/api'
        }
      }
    },
    saigon: {
      url: "https://saigon-testnet.roninchain.com/rpc",
      accounts: [PRIVATE_KEY],
      chainId: 2021,
      timeout: 60000,
      gasPrice: "auto",
      gas: "auto",
      verify: {
        etherscan: {
          apiUrl: 'https://saigon-explorer.roninchain.com/api'
        }
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};