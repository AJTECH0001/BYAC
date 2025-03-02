import { Address, getContract } from 'viem';

// Contract address on Ronin mainnet
export const STAKING_CONTRACT_ADDRESS = '0x3B7C0285284949C08e468C92D4724cb4Bd619Ada';

// Role definitions
export const ROLES = {
  ADMIN: '0x0000000000000000000000000000000000000000000000000000000000000000',
  MAINTAINER: '0x5d7a4c6a9aeaa9884a9d7b49fddaa143a7a193e06b15b7e36ef36d8d5008d313',
  DEPOSITOR: '0x5e6a1cfbca0f5480af5d1fc1b7a145f773c987b7b8a0e7a7a8c21c9a9c6d8d0e'
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