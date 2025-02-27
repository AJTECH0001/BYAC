import React, { useState, useEffect } from 'react';
import { useAccount, useBalance, usePublicClient, useContractWrite } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Coins, Wallet, Award, TrendingUp, LockIcon, Calendar, RefreshCw, Clock, AlertCircle } from 'lucide-react';
import { STAKING_CONTRACT_ADDRESS, STAKING_ABI, getStakingStats, getUserStats, StakingStats, UserStats } from '../contracts/StakingContract';
import { BRAIDS_TOKEN_ADDRESS } from '../utils/alchemy';

interface WalletStatus {
  isInstalled: boolean;
  isReady: boolean;
}

interface StakingDashboardProps {
  walletStatus: WalletStatus;
}

// Staking period options with minimum requirements
const STAKING_PERIODS = [
  { id: 0, days: 0, apr: 0, label: 'No Lock (Flexible)', minAmount: 0 },
  { id: 1, days: 30, apr: 5, label: '30 Days', minAmount: 1000 },
  { id: 2, days: 60, apr: 15, label: '60 Days', minAmount: 5000 },
  { id: 3, days: 90, apr: 25, label: '90 Days', minAmount: 10000 }
];

const StakingDashboard: React.FC<StakingDashboardProps> = ({ walletStatus }) => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  
  const [stakingStats, setStakingStats] = useState<StakingStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState(STAKING_PERIODS[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [transactionInProgress, setTransactionInProgress] = useState(false);

  // Contract writes
  const { writeAsync: stake } = useContractWrite({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'stake',
  });

  const { writeAsync: withdraw } = useContractWrite({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'withdraw',
  });

  const { writeAsync: exit } = useContractWrite({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'exit',
  });

  const { writeAsync: getReward } = useContractWrite({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'getReward',
  });

  // Token balances
  const { data: braidsBalance } = useBalance({
    address,
    token: BRAIDS_TOKEN_ADDRESS as `0x${string}`,
    watch: true,
  });

  const fetchData = async () => {
    if (!address || !publicClient) {
      console.log('Fetch data aborted: Missing address or publicClient');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('Fetching staking data for address:', address);
      const [newStakingStats, newUserStats] = await Promise.all([
        getStakingStats(publicClient),
        getUserStats(publicClient, address)
      ]);

      console.log('Staking stats fetched:', {
        totalStaked: newStakingStats.totalStaked.toString(),
        rewardRate: newStakingStats.rewardRate.toString(),
        isPaused: newStakingStats.isPaused
      });
      
      console.log('User stats fetched:', {
        stakedAmount: newUserStats.stakedAmount.toString(),
        earnedRewards: newUserStats.earnedRewards.toString(),
        stakingPoints: newUserStats.stakingPoints.toString(),
        stakingTime: newUserStats.stakingTime.toString()
      });

      setStakingStats(newStakingStats);
      setUserStats(newUserStats);
    } catch (err) {
      console.error('Error fetching staking data:', err);
      setError('Failed to load staking data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let intervalId: number | undefined;

    const fetchDataSafely = async () => {
      if (!isMounted) return;
      await fetchData();
    };

    if (isConnected && address) {
      console.log('Wallet connected, setting up data fetching');
      fetchDataSafely();
      
      // Set up polling with proper cleanup
      intervalId = window.setInterval(() => {
        if (isMounted) {
          console.log('Polling: Refreshing staking data');
          fetchDataSafely();
        }
      }, 30000);
    }

    // Cleanup function
    return () => {
      console.log('Component unmounting, cleaning up interval');
      isMounted = false;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [isConnected, address]);

  // Validate staking amount against minimum requirements
  useEffect(() => {
    setValidationError(null);
    
    if (stakeAmount && selectedPeriod.minAmount > 0) {
      const amount = parseFloat(stakeAmount);
      if (amount < selectedPeriod.minAmount) {
        setValidationError(`Minimum ${selectedPeriod.minAmount} BRAIDS required for ${selectedPeriod.label} staking`);
        console.log(`Validation error: ${amount} is below minimum requirement of ${selectedPeriod.minAmount}`);
      }
    }
  }, [stakeAmount, selectedPeriod]);

  // Validate withdrawal amount
  useEffect(() => {
    if (withdrawAmount && userStats) {
      const amount = parseFloat(withdrawAmount);
      const maxAmount = parseFloat(formatEther(userStats.stakedAmount));
      
      if (amount > maxAmount) {
        setValidationError(`You can only withdraw up to ${maxAmount} BRAIDS`);
        console.log(`Withdrawal validation error: ${amount} exceeds available balance of ${maxAmount}`);
      } else {
        setValidationError(null);
      }
    }
  }, [withdrawAmount, userStats]);

  const handleStake = async () => {
    if (!stakeAmount) {
      console.log('Stake aborted: No amount specified');
      return;
    }
    
    // Validate minimum amount
    const amount = parseFloat(stakeAmount);
    if (amount < selectedPeriod.minAmount) {
      setValidationError(`Minimum ${selectedPeriod.minAmount} BRAIDS required for ${selectedPeriod.label} staking`);
      console.log(`Stake aborted: ${amount} is below minimum requirement of ${selectedPeriod.minAmount}`);
      return;
    }
    
    try {
      console.log(`Initiating stake of ${stakeAmount} BRAIDS for ${selectedPeriod.label} period`);
      setTransactionInProgress(true);
      
      // For a real implementation, we would need a contract that accepts the lock period
      // This is a simplified version assuming the contract handles locking internally
      const parsedAmount = parseEther(stakeAmount);
      console.log(`Parsed amount to stake: ${parsedAmount.toString()}`);
      
      await stake({ args: [parsedAmount] });
      console.log('Stake transaction successful');
      
      setStakeAmount('');
      await fetchData();
    } catch (err) {
      console.error('Staking failed:', err);
      setError(`Failed to stake tokens: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTransactionInProgress(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount) {
      console.log('Withdraw aborted: No amount specified');
      return;
    }
    
    if (userStats && parseFloat(withdrawAmount) > parseFloat(formatEther(userStats.stakedAmount))) {
      setValidationError(`You can only withdraw up to ${formatEther(userStats.stakedAmount)} BRAIDS`);
      console.log(`Withdraw aborted: Requested amount exceeds staked balance`);
      return;
    }
    
    try {
      console.log(`Initiating withdrawal of ${withdrawAmount} BRAIDS`);
      setTransactionInProgress(true);
      
      const parsedAmount = parseEther(withdrawAmount);
      console.log(`Parsed amount to withdraw: ${parsedAmount.toString()}`);
      
      await withdraw({ args: [parsedAmount] });
      console.log('Withdraw transaction successful');
      
      setWithdrawAmount('');
      await fetchData();
    } catch (err) {
      console.error('Withdrawal failed:', err);
      setError(`Failed to withdraw tokens: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTransactionInProgress(false);
    }
  };

  const handleExit = async () => {
    if (!userStats || userStats.stakedAmount <= 0n) {
      console.log('Exit aborted: No staked tokens found');
      return;
    }
    
    try {
      console.log('Initiating exit (withdraw all + claim rewards)');
      setTransactionInProgress(true);
      
      await exit();
      console.log('Exit transaction successful');
      
      await fetchData();
    } catch (err) {
      console.error('Exit failed:', err);
      setError(`Failed to exit staking: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTransactionInProgress(false);
    }
  };

  const handleClaim = async () => {
    if (!userStats || userStats.earnedRewards <= 0n) {
      console.log('Claim aborted: No rewards to claim');
      return;
    }
    
    try {
      console.log(`Initiating claim of ${formatEther(userStats.earnedRewards)} BRAIDS rewards`);
      setTransactionInProgress(true);
      
      await getReward();
      console.log('Claim rewards transaction successful');
      
      await fetchData();
    } catch (err) {
      console.error('Claim failed:', err);
      setError(`Failed to claim rewards: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTransactionInProgress(false);
    }
  };

  // Calculate estimated rewards based on amount, APR and period
  const calculateEstimatedRewards = () => {
    if (!stakeAmount || parseFloat(stakeAmount) === 0) return '0';
    
    const amount = parseFloat(stakeAmount);
    const aprDecimal = selectedPeriod.apr / 100;
    const periodInYears = selectedPeriod.days / 365;
    
    // Simple interest calculation: principal * rate * time
    const rewards = amount * aprDecimal * periodInYears;
    console.log(`Estimated rewards calculated: ${rewards.toFixed(4)} for ${amount} BRAIDS at ${selectedPeriod.apr}% APR for ${selectedPeriod.days} days`);
    return rewards.toFixed(4);
  };

  // Calculate unlock date based on selected period
  const calculateUnlockDate = () => {
    if (selectedPeriod.days === 0) return 'Flexible (No Lock)';
    
    const unlockDate = new Date();
    unlockDate.setDate(unlockDate.getDate() + selectedPeriod.days);
    
    const formattedDate = unlockDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    console.log(`Unlock date calculated: ${formattedDate} for ${selectedPeriod.days} day period`);
    return formattedDate;
  };

  // Get remaining time for current staking position
  const getRemainingLockTime = () => {
    if (!userStats || userStats.stakingTime === 0n) return 'No active lock';
    
    const stakingTimeMs = Number(userStats.stakingTime) * 1000;
    const currentTimeMs = Date.now();
    const elapsedDays = Math.floor((currentTimeMs - stakingTimeMs) / (1000 * 60 * 60 * 24));
    
    console.log(`Stake time: ${new Date(stakingTimeMs).toLocaleString()}, Elapsed: ${elapsedDays} days`);
    
    // For demonstration purposes - in a real implementation, we would store the lock period
    return elapsedDays > 0 ? `${elapsedDays} days elapsed` : 'Just started';
  };

  if (!walletStatus.isInstalled) {
    console.log('Rendering wallet not installed view');
    return (
      <div className="text-center py-20">
        <Wallet className="h-16 w-16 mx-auto text-gray-400 mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Ronin Wallet Required</h2>
        <p className="text-gray-400 mb-4">Please install Ronin Wallet to access staking</p>
        <a
          href="https://wallet.roninchain.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          Install Ronin Wallet
        </a>
      </div>
    );
  }

  if (!isConnected) {
    console.log('Rendering wallet not connected view');
    return (
      <div className="text-center py-20">
        <Wallet className="h-16 w-16 mx-auto text-gray-400 mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Connect Your Wallet</h2>
        <p className="text-gray-400">Please connect your wallet to access staking</p>
      </div>
    );
  }

  console.log('Rendering main staking dashboard');
  return (
    <div className="space-y-8">
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

      {/* Staking Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Total Staked</span>
            <LockIcon className="h-5 w-5 text-purple-400" />
          </div>
          <div className="text-xl font-semibold">
            {stakingStats ? formatEther(stakingStats.totalStaked) : '0'} BRAIDS
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Your Stake</span>
            <Coins className="h-5 w-5 text-green-400" />
          </div>
          <div className="text-xl font-semibold">
            {userStats ? formatEther(userStats.stakedAmount) : '0'} BRAIDS
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Earned Rewards</span>
            <Award className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="text-xl font-semibold">
            {userStats ? formatEther(userStats.earnedRewards) : '0'} BRAIDS
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Staking Points</span>
            <TrendingUp className="h-5 w-5 text-blue-400" />
          </div>
          <div className="text-xl font-semibold">
            {userStats ? userStats.stakingPoints.toString() : '0'} pts
          </div>
        </div>
      </div>

      {/* Staking Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stake */}
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Stake BRAIDS</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Amount to Stake
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={stakeAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setStakeAmount(value);
                      console.log(`Stake amount changed to: ${value}`);
                    }
                  }}
                  placeholder="0.00"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={transactionInProgress}
                />
                <button
                  onClick={() => {
                    if (braidsBalance) {
                      const maxAmount = formatEther(braidsBalance.value);
                      setStakeAmount(maxAmount);
                      console.log(`Setting max stake amount: ${maxAmount}`);
                    } else {
                      console.log('Cannot set max amount: Balance not available');
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  disabled={transactionInProgress || !braidsBalance}
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Staking Period Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Staking Period
              </label>
              <div className="grid grid-cols-2 gap-2">
                {STAKING_PERIODS.map((period) => (
                  <button
                    key={period.id}
                    onClick={() => {
                      setSelectedPeriod(period);
                      console.log(`Selected staking period: ${period.label} (${period.days} days, ${period.apr}% APR)`);
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-colors ${
                      selectedPeriod.id === period.id
                        ? 'bg-purple-600/20 border-purple-500 text-white'
                        : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700'
                    }`}
                    disabled={transactionInProgress}
                  >
                    <div className="font-semibold">{period.label}</div>
                    <div className="text-sm mt-1 flex items-center">
                      {period.apr}% APR
                      {period.days > 0 && (
                        <Clock className="h-3 w-3 ml-1 text-gray-400" />
                      )}
                    </div>
                    {period.minAmount > 0 && (
                      <div className="text-xs mt-1 text-gray-400">
                        Min: {period.minAmount} BRAIDS
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Validation Error */}
            {validationError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                <div className="text-sm text-red-400">{validationError}</div>
              </div>
            )}

            {/* Staking Summary */}
            <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Staking Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Lock Period:</span>
                  <span>{selectedPeriod.days > 0 ? `${selectedPeriod.days} Days` : 'No Lock'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">APR:</span>
                  <span className="text-green-400">{selectedPeriod.apr}%</span>
                </div>
                {selectedPeriod.days > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Unlock Date:</span>
                    <span>{calculateUnlockDate()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Estimated Rewards:</span>
                  <span className="text-yellow-400">{calculateEstimatedRewards()} BRAIDS</span>
                </div>
                {selectedPeriod.minAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Minimum Required:</span>
                    <span>{selectedPeriod.minAmount} BRAIDS</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleStake}
              disabled={
                !stakeAmount || 
                loading || 
                stakingStats?.isPaused || 
                !!validationError ||
                parseFloat(stakeAmount) < selectedPeriod.minAmount ||
                transactionInProgress
              }
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {transactionInProgress 
                ? 'Transaction in Progress...' 
                : stakingStats?.isPaused 
                  ? 'Staking Paused' 
                  : validationError 
                    ? 'Insufficient Amount' 
                    : `Stake for ${selectedPeriod.days > 0 ? selectedPeriod.days + ' Days' : 'Flexible'}`}
            </button>
          </div>
        </div>

        {/* Withdraw */}
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Withdraw BRAIDS</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Amount to Withdraw
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={withdrawAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setWithdrawAmount(value);
                      console.log(`Withdraw amount changed to: ${value}`);
                    }
                  }}
                  placeholder="0.00"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={transactionInProgress}
                />
                <button
                  onClick={() => {
                    if (userStats) {
                      const maxAmount = formatEther(userStats.stakedAmount);
                      setWithdrawAmount(maxAmount);
                      console.log(`Setting max withdraw amount: ${maxAmount}`);
                    } else {
                      console.log('Cannot set max withdraw amount: User stats not available');
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  disabled={transactionInProgress || !userStats || userStats.stakedAmount <= 0n}
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Active Staking Positions */}
            <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Your Staking Position</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <LockIcon className="h-4 w-4 text-purple-400 mr-2" />
                    <span>Staked Amount:</span>
                  </div>
                  <span>{userStats ? formatEther(userStats.stakedAmount) : '0'} BRAIDS</span>
                </div>
                
                {/* Note: In a real implementation, we would show the actual lock period and unlock date */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-blue-400 mr-2" />
                    <span>Lock Status:</span>
                  </div>
                  <span>{getRemainingLockTime()}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <Award className="h-4 w-4 text-yellow-400 mr-2" />
                    <span>Earned Rewards:</span>
                  </div>
                  <span>{userStats ? formatEther(userStats.earnedRewards) : '0'} BRAIDS</span>
                </div>
              </div>
            </div>

            <div className="text-sm text-yellow-500 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
              <p>Note: Early withdrawals before the lock period ends may incur penalties.</p>
            </div>

            <button
              onClick={handleWithdraw}
              disabled={
                !withdrawAmount || 
                loading || 
                parseFloat(withdrawAmount) <= 0 || 
                !!validationError ||
                transactionInProgress ||
                (userStats && userStats.stakedAmount <= 0n)
              }
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {transactionInProgress 
                ? 'Transaction in Progress...' 
                : validationError 
                  ? 'Invalid Amount' 
                  : 'Withdraw BRAIDS'}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={handleClaim}
          disabled={
            !userStats || 
            userStats.earnedRewards <= 0n || 
            loading || 
            transactionInProgress
          }
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Award className="h-5 w-5" />
          {transactionInProgress 
            ? 'Transaction in Progress...' 
            : `Claim Rewards ${userStats ? '(' + formatEther(userStats.earnedRewards) + ' BRAIDS)' : ''}`}
        </button>

        <button
          onClick={handleExit}
          disabled={
            !userStats || 
            userStats.stakedAmount <= 0n || 
            loading || 
            transactionInProgress
          }
          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw className="h-5 w-5" />
          {transactionInProgress 
            ? 'Transaction in Progress...' 
            : 'Exit & Claim All'}
        </button>
      </div>
    </div>
  );
};

export default StakingDashboard;