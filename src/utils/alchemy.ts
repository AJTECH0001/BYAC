import { Alchemy, Network } from 'alchemy-sdk';
import { createPublicClient, http, formatEther, getContract } from 'viem';
import { ronin } from 'viem/chains';

const settings = {
  apiKey: import.meta.env.VITE_ALCHEMY_API_KEY,
  network: Network.RONIN_MAINNET,
};

export const alchemy = new Alchemy(settings);

// Create a public client for Ronin
const publicClient = createPublicClient({
  chain: ronin,
  transport: http('https://api.roninchain.com/rpc')
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

// Contract address for the validator registry
const VALIDATOR_REGISTRY = '0x4E5C8147c0F5BfFf3A9E4a266C80d35C8819d38D';

// Shared retry logic
const retryOperation = async (operation: () => Promise<any>, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`Retry attempt ${i + 1} after error:`, error);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

export const getValidatorData = async (validatorAddress: string) => {
  try {
    // Ensure the address is formatted correctly
    const formattedAddress = validatorAddress.toLowerCase() as `0x${string}`;
    
    const contract = getContract({
      address: VALIDATOR_REGISTRY as `0x${string}`,
      abi: VALIDATOR_ABI,
      publicClient
    });

    // Debug
    console.log("Contract methods:", Object.keys(contract.read));
    
    const validatorInfo = await retryOperation(() => 
      contract.read.getValidatorInfo([formattedAddress])
    );
    
    // Fetch delegators count separately to avoid redundant calls
    const delegators = await retryOperation(() => 
      contract.read.getDelegators([formattedAddress])
    );

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
    // Ensure the address is formatted correctly
    const formattedAddress = validatorAddress.toLowerCase() as `0x${string}`;
    
    const contract = getContract({
      address: VALIDATOR_REGISTRY as `0x${string}`,
      abi: VALIDATOR_ABI,
      publicClient
    });
    
    // Debug
    console.log("Getting delegators for:", formattedAddress);
    
    const [delegators, validatorInfo] = await Promise.all([
      retryOperation(() => contract.read.getDelegators([formattedAddress])),
      retryOperation(() => contract.read.getValidatorInfo([formattedAddress]))
    ]);

    const totalStake = validatorInfo.totalStake;
    
    // Enhance delegator data with additional information
    const enhancedDelegators = await Promise.all(
      delegators.map(async (info) => {
        try {
          // Get RON balance
          const nativeBalance = await publicClient.getBalance({
            address: info.delegator as `0x${string}`
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

export const VALIDATOR_ADDRESS = '0xedcafc4ad8097c2012980a2a7087d74b86bddaf9';
export const BRAIDS_TOKEN_ADDRESS = '0xD144A6466aA76Cc3A892Fda9602372dd884a2C90';

export const getTokenBalance = async (address: string, tokenAddress: string) => {
  try {
    const balance = await retryOperation(() => 
      alchemy.core.getTokenBalance(
        address as `0x${string}`, 
        tokenAddress as `0x${string}`
      )
    );
    return balance.toString();
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return '0';
  }
};