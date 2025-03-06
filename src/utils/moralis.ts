import Moralis from 'moralis';
import { formatEther } from 'viem';

const RONIN_CHAIN_ID = '2020';
const VALIDATOR_ADDRESS = '0xedcafc4ad8097c2012980a2a7087d74b86bddaf9';
// Need to define this constant that was used but not declared in the second file
const BRAIDS_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'; // Replace with actual address

export interface Delegator {
  address: string;
  stake: string;
  percentage: string;
  joinedAt: string;
  nativeBalance: string;
  braidsBalance: string;
}

// Initialize Moralis with proper promise handling
let initializationPromise: Promise<boolean> | null = null;

export const initMoralis = async () => {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      if (!import.meta.env.VITE_MORALIS_API_KEY) {
        throw new Error('Moralis API key is required');
      }

      if (!Moralis.Core.isStarted) {
        await Moralis.start({
          apiKey: import.meta.env.VITE_MORALIS_API_KEY,
        });
      }

      return true;
    } catch (error: any) {
      console.error('Moralis initialization error:', error.message || 'Unknown error');
      initializationPromise = null;
      return false;
    }
  })();

  return initializationPromise;
};

// Get validator data from Ronin Chain
export const getValidatorData = async (validatorAddress: string = VALIDATOR_ADDRESS) => {
  try {
    const initialized = await initMoralis();
    if (!initialized) throw new Error('Moralis not initialized');

    // This would ideally come from Ronin RPC or a staking contract
    const response = await fetch('https://api.roninchain.com/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'ronin_getValidatorInfo',
        params: [validatorAddress]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const validatorInfo = data.result;
    return {
      totalStake: validatorInfo.totalStake || '0',
      totalDelegators: validatorInfo.delegators?.length || 0,
      apr: validatorInfo.apr || '12.5',
      commission: validatorInfo.commissionRate || '10',
      uptime: validatorInfo.uptime || '99.98',
      lastSignedBlock: validatorInfo.lastSignedBlock || '0'
    };
  } catch (error: any) {
    console.error('Error fetching validator data:', error.message || 'Unknown error');
    return null;
  }
};

// Get delegators list
export const getDelegatorsList = async (validatorAddress: string = VALIDATOR_ADDRESS): Promise<Delegator[] | null> => {
  try {
    const initialized = await initMoralis();
    if (!initialized) throw new Error('Moralis not initialized');

    // Fetch validator info from Ronin RPC
    const response = await fetch('https://api.roninchain.com/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'ronin_getValidatorInfo',
        params: [validatorAddress]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const validatorInfo = data.result;
    if (!validatorInfo?.delegators) return [];

    const totalStake = BigInt(validatorInfo.totalStake || '0');

    // Get wallet balances for all delegators
    const delegatorAddresses = validatorInfo.delegators.map((d: any) => d.address);
    const balances = await getWalletBalances(delegatorAddresses);

    // Map delegator data
    const delegators = validatorInfo.delegators.map((delegator: any) => {
      const stake = BigInt(delegator.amount || '0');
      const percentage = totalStake > 0 
        ? ((Number(stake) / Number(totalStake)) * 100).toFixed(2)
        : '0.00';
      
      const balanceInfo = balances.find(b => b.address.toLowerCase() === delegator.address.toLowerCase());

      return {
        address: delegator.address,
        stake: stake.toString(),
        percentage,
        joinedAt: delegator.joinedAt || new Date().toISOString(),
        nativeBalance: balanceInfo?.nativeBalance || '0',
        braidsBalance: balanceInfo?.braidsBalance || '0'
      };
    });

    return delegators;
  } catch (error: any) {
    console.error('Error fetching delegators list:', error.message || 'Unknown error');
    return null;
  }
};

// Get native balance for a wallet
export const getNativeBalance = async (address: string) => {
  try {
    const initialized = await initMoralis();
    if (!initialized) return null;

    const response = await Moralis.EvmApi.balance.getNativeBalance({
      address,
      chain: RONIN_CHAIN_ID,
    });

    return {
      balance: response.result.balance.toString(),
      formatted: response.result.formatted
    };
  } catch (error: any) {
    console.error('Error getting native balance:', error.message || 'Unknown error');
    return null;
  }
};

// Get BRAIDS token balance for a wallet
export const getBraidsBalance = async (address: string) => {
  try {
    const initialized = await initMoralis();
    if (!initialized) return null;

    const response = await Moralis.EvmApi.token.getWalletTokenBalances({
      address,
      chain: RONIN_CHAIN_ID,
      tokenAddresses: [BRAIDS_TOKEN_ADDRESS],
    });

    if (!response?.result || response.result.length === 0) return null;

    const braidsToken = response.result[0];
    return {
      balance: braidsToken.value?.toString() || '0',
      formatted: braidsToken.token?.decimals 
        ? (Number(braidsToken.value) / Math.pow(10, Number(braidsToken.token.decimals))).toFixed(2)
        : '0'
    };
  } catch (error: any) {
    console.error('Error getting BRAIDS balance:', error.message || 'Unknown error');
    return null;
  }
};

// Get both native and BRAIDS balances for multiple addresses
export const getWalletBalances = async (addresses: string[]) => {
  try {
    const balancePromises = addresses.map(async (address) => {
      const [native, braids] = await Promise.all([
        getNativeBalance(address),
        getBraidsBalance(address)
      ]);

      return {
        address,
        nativeBalance: native?.formatted || '0',
        braidsBalance: braids?.formatted || '0'
      };
    });

    return await Promise.all(balancePromises);
  } catch (error: any) {
    console.error('Error fetching wallet balances:', error.message || 'Unknown error');
    return [];
  }
};