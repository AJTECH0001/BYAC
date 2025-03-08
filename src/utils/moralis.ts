import Moralis from 'moralis';

const RONIN_CHAIN_ID = '2020';
const BRAIDS_TOKEN_ADDRESS = '0xD144A6466aA76Cc3A892Fda9602372dd884a2C90';
const VALIDATOR_ADDRESS = '0xedcafc4ad8097c2012980a2a7087d74b86bddaf9';
let initializationPromise: Promise<boolean> | null = null;

// Initialize Moralis
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
export const getValidatorData = async () => {
  try {
    const initialized = await initMoralis();
    if (!initialized) {
      throw new Error('Moralis not initialized');
    }

    // For now, return mock data since we can't directly query validator data
    // In production, this would be replaced with actual blockchain queries
    return {
      totalStake: '4000000000000000000000', // 4000 RON
      commission: '10',
      uptime: '99.98',
      lastSignedBlock: '1234567',
      apr: '12.5'
    };
  } catch (error: any) {
    console.error('Error fetching validator data:', error.message || 'Unknown error');
    return null;
  }
};

// Get validator's delegator list using GraphQL
export const getValidatorDelegators = async () => {
  try {
    // Return mock data for development since the GraphQL endpoint is not accessible
    return [
      {
        address: '0x1234567890123456789012345678901234567890',
        stake: '1000000000000000000000',
        percentage: '25.00',
        joinedAt: new Date().toISOString()
      },
      {
        address: '0x2345678901234567890123456789012345678901',
        stake: '800000000000000000000',
        percentage: '20.00',
        joinedAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        address: '0x3456789012345678901234567890123456789012',
        stake: '600000000000000000000',
        percentage: '15.00',
        joinedAt: new Date(Date.now() - 172800000).toISOString()
      }
    ];
  } catch (error: any) {
    console.error('Error fetching delegators:', error.message || 'Unknown error');
    return [];
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