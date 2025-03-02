module.exports = {
  networks: {
    ronin: {
      // ... your existing ronin network config ...
    }
  },
  etherscan: {
    apiKey: {
      ronin: "NO_API_KEY_REQUIRED" // Ronin doesn't require an API key
    },
    customChains: [
      {
        network: "ronin",
        chainId: 2020,
        urls: {
          apiURL: "https://api.roninchain.com/api",
          browserURL: "https://app.roninchain.com",
          verifyURL: "https://api.roninchain.com/api"
        }
      }
    ]
  }
}; 