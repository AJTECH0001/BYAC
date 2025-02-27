import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import StakingPool from '../contracts/StakingPool.sol';

// Load environment variables
dotenv.config();

// Configuration
const config = {
  distDir: 'dist',
  deploymentDir: 'deployment',
  deploymentConfigFile: 'deployment.json',
  requiredEnvVars: [
    'VITE_ALCHEMY_API_KEY',
    'PRIVATE_KEY',
    'DEPLOYER_ADDRESS',
    'BRAIDS_TOKEN_ADDRESS'
  ]
};

// Utility functions
const log = {
  info: (msg) => console.log(`\x1b[36m→\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m✗\x1b[0m ${msg}`),
  warning: (msg) => console.log(`\x1b[33m!\x1b[0m ${msg}`)
};

const validateEnvironment = () => {
  log.info('Validating environment...');
  
  const missingVars = config.requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    log.error('Missing required environment variables:');
    missingVars.forEach(varName => log.error(`  - ${varName}`));
    process.exit(1);
  }

  // Validate private key format
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
    log.error('Invalid PRIVATE_KEY format. Must be a 32-byte hex string with 0x prefix.');
    process.exit(1);
  }

  log.success('Environment validation passed');
};

const saveDeploymentConfig = (config) => {
  const deploymentDir = join(process.cwd(), 'deployment');
  const configPath = join(deploymentDir, 'deployment.json');

  if (!existsSync(deploymentDir)) {
    mkdirSync(deploymentDir, { recursive: true });
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2));
  log.success(`Deployment configuration saved to ${configPath}`);
};

const deploy = async () => {
  try {
    // Validate environment
    validateEnvironment();

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider('https://api.roninchain.com/rpc');
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    log.info('Deploying StakingPool contract...');
    
    // Deploy contract
    const StakingPoolFactory = new ethers.ContractFactory(
      StakingPool.abi,
      StakingPool.bytecode,
      wallet
    );

    const stakingPool = await StakingPoolFactory.deploy(
      process.env.BRAIDS_TOKEN_ADDRESS,
      process.env.DEPLOYER_ADDRESS,
      {
        gasPrice: ethers.parseUnits('20', 'gwei'),
        gasLimit: 5000000
      }
    );

    await stakingPool.waitForDeployment();
    const contractAddress = await stakingPool.getAddress();

    log.success(`StakingPool deployed to: ${contractAddress}`);

    // Save deployment configuration
    const deploymentConfig = {
      timestamp: new Date().toISOString(),
      environment: 'production',
      network: 'ronin',
      deployer: process.env.DEPLOYER_ADDRESS,
      contracts: {
        stakingPool: contractAddress,
        braidsToken: process.env.BRAIDS_TOKEN_ADDRESS
      }
    };

    saveDeploymentConfig(deploymentConfig);

    log.success('Deployment completed successfully!');
    log.info('\nContract addresses:');
    log.info(`StakingPool: ${contractAddress}`);
    log.info(`BRAIDS Token: ${process.env.BRAIDS_TOKEN_ADDRESS}`);

  } catch (error) {
    log.error('Deployment failed:');
    log.error(error.message);
    process.exit(1);
  }
};

// Run deployment
deploy().catch(console.error);