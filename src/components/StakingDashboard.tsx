import React, { useState, useEffect } from 'react';
import { useAccount, useBalance, usePublicClient, useContractWrite } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Coins, Wallet, Award, RefreshCw, AlertCircle } from 'lucide-react';
import { STAKING_CONTRACT_ADDRESS, STAKING_ABI, getStakingStats, getUserStats } from '../contracts/StakingContract';
import { BRAIDS_TOKEN_ADDRESS } from '../utils/alchemy';

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
  
  const [stakingStats, setStakingStats] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
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

  // Token balance for BRAIDS
  const { data: braidsBalance } = useBalance({
    address,
    token: BRAIDS_TOKEN_ADDRESS as `0x${string}`,
    watch: true,
  });

  // Fetch staking stats and user stats
  const fetchData = async () => {
    if (!address || !publicClient) return;
    try {
      setLoading(true);
      setError(null);
      
      const chainId = await publicClient.getChainId();
      if (chainId !== 2020) {
        throw new Error('Please connect to Ronin Mainnet');
      }

      const [newStakingStats, newUserStats] = await Promise.all([
        getStakingStats(publicClient).catch(() => null),
        getUserStats(publicClient, address).catch(() => null)
      ]);

      setStakingStats(newStakingStats);
      setUserStats(newUserStats);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
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
      fetchDataSafely();
      intervalId = window.setInterval(() => {
        if (isMounted) {
          fetchDataSafely();
        }
      }, 30000);
    }

    return () => {
      isMounted = false;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [isConnected, address]);

  // Validate stake amount (only ensuring it's a valid positive number)
  useEffect(() => {
    if (stakeAmount) {
      const amount = parseFloat(stakeAmount);
      if (amount <= 0) {
        setValidationError('Enter a valid amount');
      } else if (!publicClient?.chain || publicClient.chain.id !== 2020) {
        setValidationError('Wrong network');
      } else if (stakingStats?.isPaused) {
        setValidationError('Staking is paused');
      } else {
        setValidationError(null);
      }
    }
  }, [stakeAmount, publicClient, stakingStats]);

  // Validate withdraw amount
  useEffect(() => {
    if (withdrawAmount && userStats) {
      const amount = parseFloat(withdrawAmount);
      const maxAmount = parseFloat(formatEther(userStats.stakedAmount));
      if (amount > maxAmount) {
        setValidationError(`You can only withdraw up to ${maxAmount} BRAIDS`);
      } else {
        setValidationError(null);
      }
    }
  }, [withdrawAmount, userStats]);

  useEffect(() => {
    const checkNetwork = async () => {
      if (publicClient) {
        const chainId = await publicClient.getChainId();
        if (chainId !== 2020) {
          setError('Please connect to Ronin Mainnet');
        }
      }
    };
    checkNetwork();
  }, [publicClient]);

  const handleStake = async () => {
    if (!stakeAmount) return;
    try {
      setTransactionInProgress(true);
      const parsedAmount = parseEther(stakeAmount);
      const tx = await stake({ args: [parsedAmount] });
      await publicClient.waitForTransactionReceipt({ hash: tx.hash });
      await fetchData();
      setStakeAmount('');
    } catch (err) {
      console.error('Staking failed:', err);
      setError(`Failed to stake: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTransactionInProgress(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount) return;
    if (userStats && parseFloat(withdrawAmount) > parseFloat(formatEther(userStats.stakedAmount))) {
      setValidationError(`You can only withdraw up to ${formatEther(userStats.stakedAmount)} BRAIDS`);
      return;
    }
    try {
      setTransactionInProgress(true);
      const parsedAmount = parseEther(withdrawAmount);
      await withdraw({ args: [parsedAmount] });
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
    if (!userStats || userStats.stakedAmount <= 0n) return;
    try {
      setTransactionInProgress(true);
      await exit();
      await fetchData();
    } catch (err) {
      console.error('Exit failed:', err);
      setError(`Failed to exit staking: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTransactionInProgress(false);
    }
  };

  const handleClaim = async () => {
    if (!userStats || userStats.earnedRewards <= 0n) return;
    try {
      const tx = await getReward();
      await publicClient.waitForTransactionReceipt({ hash: tx.hash });
      await fetchData();
    } catch (err) {
      console.error('Claim failed:', err);
      setError(`Claim failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTransactionInProgress(false);
    }
  };

  if (!walletStatus.isInstalled) {
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
    return (
      <div className="text-center py-20">
        <Wallet className="h-16 w-16 mx-auto text-gray-400 mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Connect Your Wallet</h2>
        <p className="text-gray-400">Please connect your wallet to access staking</p>
      </div>
    );
  }

  if (!publicClient) {
    return (
      <div className="text-center py-20">
        <Wallet className="h-16 w-16 mx-auto text-gray-400 mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Network Error</h2>
        <p className="text-gray-400">Please check your wallet connection</p>
      </div>
    );
  }

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Total Staked</span>
            <Coins className="h-5 w-5 text-purple-400" />
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
      </div>

      {/* Staking Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Stake Section */}
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
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  disabled={transactionInProgress || !braidsBalance}
                >
                  MAX
                </button>
              </div>
            </div>

            {validationError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <div className="text-sm text-red-400">{validationError}</div>
              </div>
            )}

            <button
              onClick={handleStake}
              disabled={
                !stakeAmount ||
                loading ||
                stakingStats?.isPaused ||
                !!validationError ||
                transactionInProgress
              }
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {transactionInProgress ? 'Transaction in Progress...' : 'Stake BRAIDS'}
            </button>
          </div>
        </div>

        {/* Withdraw Section */}
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
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  disabled={transactionInProgress || !userStats || userStats.stakedAmount <= 0n}
                >
                  MAX
                </button>
              </div>
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
              {transactionInProgress ? 'Transaction in Progress...' : 'Withdraw BRAIDS'}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={handleClaim}
          disabled={!userStats || userStats.earnedRewards <= 0n || loading || transactionInProgress}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Award className="h-5 w-5" />
          {transactionInProgress ? 'Transaction in Progress...' : 'Claim Rewards'}
        </button>

        <button
          onClick={handleExit}
          disabled={!userStats || userStats.stakedAmount <= 0n || loading || transactionInProgress}
          className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw className="h-5 w-5" />
          {transactionInProgress ? 'Transaction in Progress...' : 'Exit & Claim All'}
        </button>
      </div>
    </div>
  );
};

export default StakingDashboard;
