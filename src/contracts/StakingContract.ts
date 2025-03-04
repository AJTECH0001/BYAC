import { Address, PublicClient } from 'viem';

// Contract address on Ronin mainnet
export const STAKING_CONTRACT_ADDRESS = '0x7262035c2f5c2032e5247e6dd095fc02c889d5d6';

// Role definitions
export const ROLES = {
  ADMIN: '0x0000000000000000000000000000000000000000000000000000000000000000',
  MAINTAINER: '0x5d7a4c6a9aeaa9884a9d7b49fddaa143a7a193e06b15b7e36ef36d8d5008d313',
  DEPOSITOR: '0x5e6a1cfbca0f5480af5d1fc1b7a145f773c987b7b8a0e7a7a8c21c9a9c6d8d0e'
} as const;

// ABI for the staking contract
export const STAKING_ABI = [
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

/**
 * Helper to safely read contract values.
 * Accepts a function returning a Promise<T> and a fallback value in case of error.
 */
const safeRead = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Error && error.message.includes("Wallet connection failed")) {
      console.warn("Wallet connection failed during contract read, returning fallback value.");
    } else {
      console.error("Contract read error:", error);
    }
    return fallback;
  }
};

export const getStakingStats = async (publicClient: PublicClient): Promise<StakingStats> => {
  const totalStaked = await safeRead(
    () =>
      publicClient.readContract({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'totalSupply'
      }),
    0n
  );

  const rewardRate = await safeRead(
    () =>
      publicClient.readContract({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'rewardRate'
      }),
    0n
  );

  const isPaused = await safeRead(
    () =>
      publicClient.readContract({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'paused'
      }),
    false
  );

  return {
    totalStaked,
    rewardRate,
    rewardForDuration: rewardRate * BigInt(604800), // 1 week of rewards (604800 seconds)
    isPaused
  };
};

export const getUserStats = async (
  publicClient: PublicClient,
  address: Address
): Promise<UserStats> => {
  const stakedAmount = await safeRead(
    () =>
      publicClient.readContract({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'balanceOf',
        args: [address]
      }),
    0n
  );

  const earnedRewards = await safeRead(
    () =>
      publicClient.readContract({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'earned',
        args: [address]
      }),
    0n
  );

  const stakingPoints = await safeRead(
    () =>
      publicClient.readContract({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'userPoints',
        args: [address]
      }),
    0n
  );

  const stakingTime = await safeRead(
    () =>
      publicClient.readContract({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'stakingTime',
        args: [address]
      }),
    0n
  );

  return { stakedAmount, earnedRewards, stakingPoints, stakingTime };
};

export const checkRole = async (
  publicClient: PublicClient,
  address: Address,
  role: keyof typeof ROLES
): Promise<boolean> => {
  return await safeRead(
    () =>
      publicClient.readContract({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'hasRole',
        args: [ROLES[role], address]
      }),
    false
  );
};