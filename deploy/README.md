# Deployment Guide

This guide explains how to deploy the BYAC Portal application.

## Prerequisites

1. Environment Variables
   Make sure you have the following environment variables set in your `.env` file:

   ```
   VITE_ALCHEMY_API_KEY=your_alchemy_api_key
   PRIVATE_KEY=your_private_key
   DEPLOYER_ADDRESS=your_deployer_address
   BRAIDS_TOKEN_ADDRESS=your_braids_token_address
   ```

2. Node.js and npm installed
3. Access to the Ronin mainnet
4. Sufficient RON balance for deployment

## Deployment Steps

1. **Prepare for Deployment**
   ```bash
   npm run deploy
   ```
   This will:
   - Validate your environment
   - Build the project
   - Generate deployment configuration

2. **Deploy Smart Contracts**
   ```bash
   npx hardhat run scripts/deploy.cjs --network ronin
   ```
   This will:
   - Deploy the StakingPool contract
   - Output the contract address
   - Provide verification instructions

3. **Update Environment Variables**
   After deploying the contracts, update your `.env` file with the new contract addresses.

4. **Verify Smart Contracts**
   ```bash
   npx hardhat verify --network ronin <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
   ```

## Contract Addresses

- BRAIDS Token: `0xD144A6466aA76Cc3A892Fda9602372dd884a2C90`
- StakingPool: `0x7262035c2f5c2032e5247e6dd095fc02c889d5d6`

## Security Considerations

1. Never commit your `.env` file
2. Keep your private keys secure
3. Use a dedicated deployer account
4. Always verify contract source code
5. Test thoroughly on testnet first

## Troubleshooting

If you encounter issues:

1. Check your environment variables
2. Ensure sufficient RON balance
3. Verify network connectivity
4. Check contract verification status

## Support

For support, please:
1. Check the documentation
2. Review deployment logs
3. Contact the development team