// Mock data for the application
export const VALIDATOR_ADDRESS = '0xedcafc4ad8097c2012980a2a7087d74b86bddaf9';
export const BRAIDS_TOKEN_ADDRESS = '0xD144A6466aA76Cc3A892Fda9602372dd884a2C90';

export const getValidatorData = async () => {
  return {
    totalStake: '4000000000000000000000', // 4000 RON
    commission: '10',
    uptime: '99.98',
    lastSignedBlock: '1234567',
    apr: '12.5',
    totalDelegators: 3
  };
};

export const getDelegatorsList = async () => {
  return [
    {
      address: '0x1234567890123456789012345678901234567890',
      stake: '1000000000000000000000',
      percentage: '25.00',
      joinedAt: new Date().toISOString(),
      nativeBalance: '1000.00',
      braidsBalance: '5000.00'
    },
    {
      address: '0x2345678901234567890123456789012345678901',
      stake: '800000000000000000000',
      percentage: '20.00',
      joinedAt: new Date(Date.now() - 86400000).toISOString(),
      nativeBalance: '800.00',
      braidsBalance: '4000.00'
    },
    {
      address: '0x3456789012345678901234567890123456789012',
      stake: '600000000000000000000',
      percentage: '15.00',
      joinedAt: new Date(Date.now() - 172800000).toISOString(),
      nativeBalance: '600.00',
      braidsBalance: '3000.00'
    }
  ];
};