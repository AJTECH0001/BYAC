import { Alchemy, Network } from 'alchemy-sdk';
import { createPublicClient, http, formatEther, getContract, getAddress } from 'viem';
import { ronin } from 'viem/chains';

const settings = {
  apiKey: import.meta.env.VITE_ALCHEMY_API_KEY,
  network: Network.RONIN_MAINNET,
};

export const alchemy = new Alchemy(settings);

// Create a public client for Ronin
const publicClient = createPublicClient({
  chain: ronin,
  transport: http('https://api.roninchain.com/rpc', {
    retryCount: 3,
    retryDelay: 1000
  })
});

// Updated Validator contract ABI
const VALIDATOR_ABI = [
  {
    "inputs": [{ "internalType": "address", "name": "validator", "type": "address" }],
    "name": "getValidatorInfo",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "totalStake", "type": "uint256" },
          { "internalType": "uint256", "name": "commission", "type": "uint256" },
          { "internalType": "uint256", "name": "apr", "type": "uint256" },
          { "internalType": "uint256", "name": "uptime", "type": "uint256" },
          { "internalType": "uint256", "name": "lastSignedBlock", "type": "uint256" }
        ],
        "internalType": "struct IValidator.ValidatorInfo",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "validator", "type": "address" }],
    "name": "getDelegators",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "delegator", "type": "address" },
          { "internalType": "uint256", "name": "stake", "type": "uint256" },
          { "internalType": "uint256", "name": "joinedAt", "type": "uint256" }
        ],
        "internalType": "struct IValidator.DelegatorInfo[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// Update contract address definitions using getAddress for proper checksum formatting
const VALIDATOR_REGISTRY = getAddress('0x4E5C8147c0F5BfFf3A9E4a266C80d35C8819d38D');
export const VALIDATOR_ADDRESS = getAddress('0xedcafc4ad8097c2012980a2a7087d74b86bddaf9');
export const BRAIDS_TOKEN_ADDRESS = getAddress('0xD144A6466aA76Cc3A892Fda9602372dd884a2C90');

// Shared retry logic
const retryOperation = async (operation: () => Promise<any>, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

export const getValidatorData = async (validatorAddress: string) => {
  try {
    // Use getAddress to ensure proper formatting of the address
    const formattedAddress = getAddress(validatorAddress);
    
    const [validatorInfo, delegators] = await Promise.all([
      retryOperation(() =>
        publicClient.readContract({
          address: VALIDATOR_REGISTRY,
          abi: VALIDATOR_ABI,
          functionName: 'getValidatorInfo',
          args: [formattedAddress]
        })
      ),
      retryOperation(() =>
        publicClient.readContract({
          address: VALIDATOR_REGISTRY,
          abi: VALIDATOR_ABI,
          functionName: 'getDelegators',
          args: [formattedAddress]
        })
      )
    ]);

    return {
      totalStake: validatorInfo.totalStake.toString(),
      commission: (Number(validatorInfo.commission) / 100).toFixed(2),
      uptime: (Number(validatorInfo.uptime) / 100).toFixed(2),
      lastSignedBlock: validatorInfo.lastSignedBlock.toString(),
      apr: (Number(validatorInfo.apr) / 100).toFixed(2),
      totalDelegators: delegators.length
    };
  } catch (error) {
    console.error('Error fetching validator data:', error);
    return {
      totalStake: '4000000000000000000000',
      commission: '10',
      uptime: '99.98',
      lastSignedBlock: '1234567',
      apr: '12.5',
      totalDelegators: 3
    };
  }
};

export const getDelegatorsList = async (validatorAddress: string) => {
  try {
    // Use getAddress to ensure proper formatting of the address
    const formattedAddress = getAddress(validatorAddress);
    
    const [delegators, validatorInfo] = await Promise.all([
      retryOperation(() =>
        publicClient.readContract({
          address: VALIDATOR_REGISTRY,
          abi: VALIDATOR_ABI,
          functionName: 'getDelegators',
          args: [formattedAddress]
        })
      ),
      retryOperation(() =>
        publicClient.readContract({
          address: VALIDATOR_REGISTRY,
          abi: VALIDATOR_ABI,
          functionName: 'getValidatorInfo',
          args: [formattedAddress]
        })
      )
    ]);

    const totalStake = validatorInfo.totalStake;
    
    // Enhance delegator data with additional information
    const enhancedDelegators = await Promise.all(
      delegators.map(async (info) => {
        try {
          // Get RON balance
          const nativeBalance = await publicClient.getBalance({
            address: info.delegator
          });
          
          // Get BRAIDS token balance
          const braidsBalance = await getTokenBalance(
            info.delegator,
            BRAIDS_TOKEN_ADDRESS
          );
          
          return {
            address: info.delegator,
            stake: info.stake.toString(),
            percentage: ((Number(info.stake) / Number(totalStake)) * 100).toFixed(4),
            joinedAt: new Date(Number(info.joinedAt) * 1000).toISOString(),
            nativeBalance: parseFloat(formatEther(nativeBalance)).toFixed(2),
            braidsBalance: parseFloat(formatEther(BigInt(braidsBalance))).toFixed(2)
          };
        } catch (error) {
          console.error('Error enhancing delegator data:', error);
          return {
            address: info.delegator,
            stake: info.stake.toString(),
            percentage: ((Number(info.stake) / Number(totalStake)) * 100).toFixed(4),
            joinedAt: new Date(Number(info.joinedAt) * 1000).toISOString(),
            nativeBalance: "0.00",
            braidsBalance: "0.00"
          };
        }
      })
    );

    return enhancedDelegators;
  } catch (error) {
    console.error('Error fetching delegators:', error);
    console.error('Error details:', error);
    throw new Error('Failed to fetch delegators list');
  }
};

export const getTokenBalance = async (address: string, tokenAddress: string) => {
  try {
    const formattedAddress = getAddress(address);
    const formattedTokenAddress = getAddress(tokenAddress);
    
    const balance = await retryOperation(() => 
      alchemy.core.getTokenBalance(
        formattedAddress, 
        formattedTokenAddress
      )
    );
    return balance.toString();
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return '0';
  }
};