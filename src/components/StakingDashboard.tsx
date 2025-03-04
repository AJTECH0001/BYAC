import React, { useState, useEffect } from 'react';
import { useAccount, useBalance, usePublicClient, useWriteContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Coins, Wallet, Award, Eye, EyeOff } from 'lucide-react';
import {
  STAKING_CONTRACT_ADDRESS,
  STAKING_ABI,
  getStakingStats,
  getUserStats,
} from '../contracts/StakingContract';
import { BRAIDS_TOKEN_ADDRESS } from '../utils/alchemy';
import Modal from './Modal';

interface WalletStatus {
  isInstalled: boolean;
  isReady: boolean;
}

interface StakingDashboardProps {
  walletStatus: WalletStatus;
}

const StakingDashboard: React.FC<StakingDashboardProps> = ({ walletStatus }) => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [stakingStats, setStakingStats] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [hideNumbers, setHideNumbers] = useState(false);
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);
  const [isUnstakeModalOpen, setIsUnstakeModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionInProgress, setTransactionInProgress] = useState(false);
  const [tokenPrice, setTokenPrice] = useState(1000.00);
  const [circulatingSupply, setCirculatingSupply] = useState(159_155_561n);

  const { data: braidsBalance } = useBalance({
    address,
    token: BRAIDS_TOKEN_ADDRESS as `0x${string}`,
    watch: true,
  });

  const calculateAPR = () => {
    if (!stakingStats?.dailyRewards || !stakingStats?.totalStaked) return 0;
    const dailyRewards = Number(formatEther(stakingStats.dailyRewards));
    const totalStaked = Number(formatEther(stakingStats.totalStaked));
    return totalStaked > 0 ? ((dailyRewards * 365) / totalStaked) * 100 : 0;
  };

  const fetchData = async () => {
    if (!address || !publicClient) return;
    try {
      setError(null);
      const chainId = await publicClient.getChainId();
      if (chainId !== 2020) throw new Error('Please connect to Ronin Mainnet');
      
      const [newStakingStats, newUserStats] = await Promise.all([
        getStakingStats(publicClient).catch(() => null),
        getUserStats(publicClient, address).catch(() => null),
      ]);
      setStakingStats(newStakingStats);
      setUserStats(newUserStats);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    }
  };

  useEffect(() => {
    setTokenPrice(1000.00);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let intervalId: number | undefined;
    
    const fetchDataSafely = async () => {
      if (!isMounted) return;
      await fetchData();
    };

    if (isConnected && address) {
      fetchDataSafely();
      intervalId = window.setInterval(fetchDataSafely, 30000);
    }
    return () => {
      isMounted = false;
      intervalId !== undefined && window.clearInterval(intervalId);
    };
  }, [isConnected, address]);

  const handleStake = async () => {
    if (!stakeAmount) return;
    try {
      setTransactionInProgress(true);
      const parsedAmount = parseEther(stakeAmount);
      const hash = await writeContractAsync({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'stake',
        args: [parsedAmount],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await fetchData();
      setStakeAmount('');
    } catch (err) {
      console.error('Stake failed:', err);
      setError(`Failed to stake: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTransactionInProgress(false);
    }
  };

  const handleUnstake = async () => {
    if (!unstakeAmount) return;
    try {
      setTransactionInProgress(true);
      const parsedAmount = parseEther(unstakeAmount);
      const hash = await writeContractAsync({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'withdraw',
        args: [parsedAmount],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await fetchData();
      setUnstakeAmount('');
    } catch (err) {
      console.error('Unstake failed:', err);
      setError(`Failed to unstake: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTransactionInProgress(false);
    }
  };

  const handleClaim = async () => {
    if (!userStats?.earnedRewards || userStats.earnedRewards <= 0n) return;
    try {
      setTransactionInProgress(true);
      const hash = await writeContractAsync({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'getReward',
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await fetchData();
    } catch (err) {
      console.error('Claim failed:', err);
      setError(`Claim failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTransactionInProgress(false);
    }
  };

  const handleRestake = async () => {
    if (!userStats?.earnedRewards || userStats.earnedRewards <= 0n) return;
    try {
      setTransactionInProgress(true);
      const claimHash = await writeContractAsync({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'getReward',
      });
      await publicClient.waitForTransactionReceipt({ hash: claimHash });
      
      const stakeHash = await writeContractAsync({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: 'stake',
        args: [userStats.earnedRewards],
      });
      await publicClient.waitForTransactionReceipt({ hash: stakeHash });
      
      await fetchData();
    } catch (err) {
      console.error('Restake failed:', err);
      setError(`Restake failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTransactionInProgress(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center space-x-3">
          <div className="flex-1 text-red-400">{error}</div>
          <button
            onClick={fetchData}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Header / Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* BRAIDS Price */}
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">BRAIDS PRICE</span>
          </div>
          <div className="text-xl font-semibold">${tokenPrice.toFixed(2)}</div>
          <div className="text-sm text-red-400 mt-1">-13.32%</div>
        </div>

        {/* Daily Rewards */}
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">DAILY REWARDS</span>
            <Award className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="text-xl font-semibold">
            {hideNumbers
              ? '****'
              : stakingStats?.dailyRewards
              ? formatEther(stakingStats.dailyRewards)
              : '0'}{' '}
            BRAIDS
          </div>
        </div>

        {/* Circulating Supply */}
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">CIRCULATING SUPPLY</span>
            <Coins className="h-5 w-5 text-purple-400" />
          </div>
          <div className="text-xl font-semibold">
            {Number(circulatingSupply).toLocaleString()} BRAIDS
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: My Staking */}
        <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700 space-y-4">
          {/* Header row: Title and Hide Numbers button */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold">My BRAIDS Staking</h3>
            <button
              onClick={() => setHideNumbers(!hideNumbers)}
              className="flex items-center text-sm text-gray-400 hover:text-gray-200"
            >
              {hideNumbers ? (
                <>
                  <EyeOff className="w-4 h-4 mr-1" />
                  Show numbers
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-1" />
                  Hide numbers
                </>
              )}
            </button>
          </div>

          {/* Claimable Rewards + Buttons */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm">
              <span className="text-gray-400">CLAIMABLE REWARDS: </span>
              <span className="font-medium text-white">
                {hideNumbers
                  ? '****'
                  : userStats?.earnedRewards
                  ? formatEther(userStats.earnedRewards)
                  : '0'}{' '}
                BRAIDS
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRestake}
                disabled={
                  !userStats?.earnedRewards ||
                  userStats.earnedRewards <= 0n ||
                  transactionInProgress
                }
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors disabled:bg-gray-600"
              >
                Restake
              </button>
              <button
                onClick={handleClaim}
                disabled={
                  !userStats?.earnedRewards ||
                  userStats.earnedRewards <= 0n ||
                  transactionInProgress
                }
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors disabled:bg-gray-600"
              >
                Claim
              </button>
            </div>
          </div>

          {/* My Staked / Available */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-400 block">TOTAL STAKED</span>
              <span className="text-lg font-semibold">
                {hideNumbers
                  ? '****'
                  : userStats?.stakedAmount
                  ? formatEther(userStats.stakedAmount)
                  : '0'}{' '}
                BRAIDS
              </span>
            </div>
            <div>
              <span className="text-sm text-gray-400 block">AVAILABLE IN WALLET</span>
              <span className="text-lg font-semibold">
                {hideNumbers
                  ? '****'
                  : braidsBalance
                  ? formatEther(braidsBalance.value)
                  : '0'}{' '}
                BRAIDS
              </span>
            </div>
          </div>

          {/* Stake & Unstake Buttons */}
          <div className="space-y-4">
            <button
              onClick={() => setIsStakeModalOpen(true)}
              disabled={transactionInProgress || stakingStats?.isPaused}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded disabled:bg-gray-600"
            >
              Stake
            </button>
            <button
              onClick={() => setIsUnstakeModalOpen(true)}
              disabled={transactionInProgress}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded disabled:bg-gray-600"
            >
              Unstake
            </button>
          </div>
        </div>

        {/* Right: Total Staked & Estimated Rewards */}
        <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-xl font-semibold mb-2">Total Staked</h3>
            <div className="text-3xl font-bold">
              {hideNumbers
                ? '****'
                : stakingStats?.totalStaked
                ? formatEther(stakingStats.totalStaked)
                : '0'}{' '}
              BRAIDS
            </div>
            {stakingStats?.totalStaked && (
              <div className="text-sm text-gray-400">
                {hideNumbers
                  ? '~ $****'
                  : `$${(Number(formatEther(stakingStats.totalStaked)) * tokenPrice).toLocaleString()}`}
              </div>
            )}

            {/* Estimated APR */}
            <div className="mt-4">
              <h3 className="text-xl font-semibold mb-2">Estimated Rewards</h3>
              <span className="text-2xl font-semibold">
                {`${calculateAPR().toFixed(2)}%`}
              </span>{' '}
              <span className="text-sm text-gray-400">APR</span>
            </div>
          </div>
        </div>
      </div>

      {/* ======== Stake Modal ======== */}
      <Modal
        title="Stake BRAIDS"
        isOpen={isStakeModalOpen}
        onClose={() => setIsStakeModalOpen(false)}
      >
        <label className="block text-sm text-gray-400 mb-1">Amount to Stake</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={stakeAmount}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                setStakeAmount(val);
              }
            }}
            placeholder="0.00"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none"
            disabled={transactionInProgress}
          />
          <button
            onClick={() => {
              if (braidsBalance) {
                setStakeAmount(formatEther(braidsBalance.value));
              }
            }}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:bg-gray-600"
            disabled={transactionInProgress || !braidsBalance}
          >
            MAX
          </button>
        </div>
        <button
          onClick={async () => {
            await handleStake();
            setIsStakeModalOpen(false); // Close modal after confirming
          }}
          disabled={!stakeAmount || transactionInProgress || stakingStats?.isPaused}
          className="mt-2 w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded disabled:bg-gray-600"
        >
          {transactionInProgress ? 'Staking...' : 'Confirm Stake'}
        </button>
      </Modal>

      {/* ======== Unstake Modal ======== */}
      <Modal
        title="Unstake BRAIDS"
        isOpen={isUnstakeModalOpen}
        onClose={() => setIsUnstakeModalOpen(false)}
      >
        <label className="block text-sm text-gray-400 mb-1">Amount to Unstake</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={unstakeAmount}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                setUnstakeAmount(val);
              }
            }}
            placeholder="0.00"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none"
            disabled={transactionInProgress}
          />
          <button
            onClick={() => {
              if (userStats?.stakedAmount) {
                setUnstakeAmount(formatEther(userStats.stakedAmount));
              }
            }}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:bg-gray-600"
            disabled={
              transactionInProgress ||
              !userStats?.stakedAmount ||
              userStats.stakedAmount <= 0n
            }
          >
            MAX
          </button>
        </div>
        <button
          onClick={async () => {
            await handleUnstake();
            setIsUnstakeModalOpen(false); // Close modal after confirming
          }}
          disabled={!unstakeAmount || transactionInProgress}
          className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded disabled:bg-gray-600"
        >
          {transactionInProgress ? 'Unstaking...' : 'Confirm Unstake'}
        </button>
      </Modal>
    </div>
  );
};

export default StakingDashboard;