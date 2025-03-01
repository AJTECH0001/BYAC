import { Address, getContract } from 'viem';

// Contract address on Ronin mainnet
export const STAKING_CONTRACT_ADDRESS = '0x7262035c2f5c2032e5247e6dd095fc02c889d5d6';

// Role definitions
export const ROLES = {
  ADMIN: '0x0000000000000000000000000000000000000000000000000000000000000000',
  MAINTAINER: '0x339759585899103d2ace64958e37e86727aa8861e649b486940c702c768b91d7',
  DEPOSITOR: '0xd81cd2f46e36b47e37e13fd3fbc0041c6558ce6fc0c6925e21b3ee7f9b0c9fa2'
} as const;

// ABI for the staking contract
export const STAKING_ABI = [
  // View Functions
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'earned',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'rewardRate',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'userPoints',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'stakingTime',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' }
    ],
    name: 'hasRole',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  // User Actions
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'stake',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'getReward',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'exit',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  // Admin Actions
  {
    inputs: [{ name: 'reward', type: 'uint256' }],
    name: 'notifyRewardAmount',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'depositRewards',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'pause',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'unpause',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

export interface StakingStats {
  totalStaked: bigint;
  rewardRate: bigint;
  rewardForDuration: bigint;
  isPaused: boolean;
}

export interface UserStats {
  stakedAmount: bigint;
  earnedRewards: bigint;
  stakingPoints: bigint;
  stakingTime: bigint;
}

export const getStakingStats = async (publicClient: any): Promise<StakingStats> => {
  try {
    const contract = getContract({
      address: STAKING_CONTRACT_ADDRESS as Address,
      abi: STAKING_ABI,
      publicClient,
    });

    const [totalStaked, rewardRate, isPaused] = await Promise.all([
      contract.read.totalSupply(),
      contract.read.rewardRate(),
      contract.read.paused()
    ]);

    return {
      totalStaked,
      rewardRate,
      rewardForDuration: rewardRate * BigInt(604800), // 1 week of rewards
      isPaused
    };
  } catch (error) {
    console.error('Error fetching staking stats:', error);
    // Return default values if there's an error
    return {
      totalStaked: BigInt(0),
      rewardRate: BigInt(0),
      rewardForDuration: BigInt(0),
      isPaused: false
    };
  }
};

export const getUserStats = async (publicClient: any, address: string): Promise<UserStats> => {
  try {
    const contract = getContract({
      address: STAKING_CONTRACT_ADDRESS as Address,
      abi: STAKING_ABI,
      publicClient,
    });

    const [stakedAmount, earnedRewards, stakingPoints, stakingTime] = await Promise.all([
      contract.read.balanceOf([address as Address]),
      contract.read.earned([address as Address]),
      contract.read.userPoints([address as Address]),
      contract.read.stakingTime([address as Address])
    ]);

    return {
      stakedAmount,
      earnedRewards,
      stakingPoints,
      stakingTime
    };
  } catch (error) {
    console.error('Error fetching user stats:', error);
    // Return default values if there's an error
    return {
      stakedAmount: BigInt(0),
      earnedRewards: BigInt(0),
      stakingPoints: BigInt(0),
      stakingTime: BigInt(0)
    };
  }
};

export const checkRole = async (publicClient: any, address: string, role: keyof typeof ROLES): Promise<boolean> => {
  try {
    const contract = getContract({
      address: STAKING_CONTRACT_ADDRESS as Address,
      abi: STAKING_ABI,
      publicClient,
    });

    return contract.read.hasRole([ROLES[role], address as Address]);
  } catch (error) {
    console.error(`Error checking role ${role}:`, error);
    return false;
  }
};