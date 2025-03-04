import React, { useState, useEffect, useCallback   } from 'react';
import { useAccount, usePublicClient, useContractWrite, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Shield, Pause, Play, Coins, Settings, AlertCircle, Check, Loader2 } from 'lucide-react';
import { STAKING_CONTRACT_ADDRESS, STAKING_ABI, getStakingStats, checkRole,  StakingStats } from '../contracts/StakingContract';

// Define transaction status type
type TransactionStatus = 'idle' | 'preparing' | 'pending' | 'success' | 'error';

// Validation constants - adjust these based on your contract specifics
const MAX_REWARD_AMOUNT = '1000000'; // Example max reward amount
const MIN_REWARD_AMOUNT = '0.000001'; // Example min reward amount

const AdminDashboard: React.FC = () => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  
  const [stakingStats, setStakingStats] = useState<StakingStats | null>(null);
  const [roles, setRoles] = useState({
    isAdmin: false,
    isMaintainer: false,
    isDepositor: false
  });
  const [rewardAmount, setRewardAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Transaction statuses
  const [rewardTxStatus, setRewardTxStatus] = useState<TransactionStatus>('idle');
  const [pauseTxStatus, setPauseTxStatus] = useState<TransactionStatus>('idle');
  const [depositTxStatus, setDepositTxStatus] = useState<TransactionStatus>('idle');
  
  // Transaction hashes for waiting
  const [rewardTxHash, setRewardTxHash] = useState<`0x${string}` | null>(null);
  const [pauseTxHash, setPauseTxHash] = useState<`0x${string}` | null>(null);
  const [depositTxHash, setDepositTxHash] = useState<`0x${string}` | null>(null);

  // Input validation states
  const [rewardInputError, setRewardInputError] = useState<string | null>(null);
  const [depositInputError, setDepositInputError] = useState<string | null>(null);

  // Contract writes with configuration
  const { writeAsync: notifyReward, data: rewardData } = useContractWrite({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'notifyRewardAmount',
  });

  const { writeAsync: pause, data: pauseData } = useContractWrite({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'pause',
  });

  const { writeAsync: unpause, data: unpauseData } = useContractWrite({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'unpause',
  });

  const { writeAsync: depositRewards, data: depositData } = useContractWrite({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'depositRewards',
  });

  // Transaction watchers
  useWaitForTransactionReceipt({
    hash: rewardTxHash,
    onSuccess: () => {
      setRewardTxStatus('success');
      setTimeout(() => {
        setRewardTxStatus('idle');
        setRewardTxHash(null);
      }, 5000);
      fetchData();
    },
    onError: (error) => {
      setRewardTxStatus('error');
      setError(`Reward transaction failed: ${error.message}`);
    }
  });

  useWaitForTransactionReceipt({
    hash: pauseTxHash,
    onSuccess: () => {
      setPauseTxStatus('success');
      setTimeout(() => {
        setPauseTxStatus('idle');
        setPauseTxHash(null);
      }, 5000);
      fetchData();
    },
    onError: (error) => {
      setPauseTxStatus('error');
      setError(`${stakingStats?.isPaused ? 'Unpause' : 'Pause'} transaction failed: ${error.message}`);
    }
  });

  useWaitForTransactionReceipt({
    hash: depositTxHash,
    onSuccess: () => {
      setDepositTxStatus('success');
      setTimeout(() => {
        setDepositTxStatus('idle');
        setDepositTxHash(null);
      }, 5000);
      fetchData();
    },
    onError: (error) => {
      setDepositTxStatus('error');
      setError(`Deposit transaction failed: ${error.message}`);
    }
  });

 
 const fetchData = useCallback(async () => {
  if (!address || !publicClient) return;

  try {
    setLoading(true);
    setError(null);

    const chainId = await publicClient.getChainId();
    if (chainId !== 2020) {
      throw new Error('Please connect to Ronin mainnet');
    }

    const [newStakingStats, adminRole, maintainerRole, depositorRole] = await Promise.all([
      getStakingStats(publicClient),
      checkRole(publicClient, address, 'ADMIN'),
      checkRole(publicClient, address, 'MAINTAINER'),
      checkRole(publicClient, address, 'DEPOSITOR')
    ]);

    setStakingStats(newStakingStats);
    setRoles({
      isAdmin: adminRole,
      isMaintainer: maintainerRole,
      isDepositor: depositorRole
    });
  } catch (err: any) {
    console.error('Error fetching admin data:', err);
    setError(`Failed to load admin data: ${err.message || 'Unknown error'}`);
  } finally {
    setLoading(false);
  }
}, [address, publicClient]);  // Proper dependencies

useEffect(() => {
  if (isConnected && address) {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }
}, [isConnected, address, fetchData]);  
  const handleTransaction = async (
    action: () => Promise<{ hash: `0x${string}` }>,
    type: 'reward' | 'pause' | 'deposit'
  ) => {
    const statusSetters = {
      reward: setRewardTxStatus,
      pause: setPauseTxStatus,
      deposit: setDepositTxStatus
    };
    
    const hashSetters = {
      reward: setRewardTxHash,
      pause: setPauseTxHash,
      deposit: setDepositTxHash
    };

    try {
      statusSetters[type]('preparing');
      setError(null);
      const tx = await action();
      hashSetters[type](tx.hash);
      statusSetters[type]('pending');
    } catch (err: any) {
      statusSetters[type]('error');
      handleTransactionError(err);
    }
  };

  const handleTransactionError = (error: any) => {
    console.error('Transaction error:', error);
    if (error.code === 4001) {
      setError('User rejected transaction');
    } else if (error.message?.includes('insufficient funds')) {
      setError('Insufficient funds for transaction');
    } else {
      setError(error.shortMessage || error.message || 'Transaction failed');
    }
  };

  // Reduce polling interval from 30s to 5s for more real-time updates
useEffect(() => {
  if (isConnected && address) {
    fetchData();  // Initial fetch
    
    // Set up more frequent polling
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }
}, [isConnected, address, publicClient, fetchData]);  

  const setErrorState = (type: 'reward' | 'deposit', message: string) => {
    if (type === 'reward') setRewardInputError(message);
    else setDepositInputError(message);
    return false;
  };

  // Validate reward amount input
  const validateRewardAmount = (amount: string): boolean => {
    if (!amount) return setErrorState('reward', 'Amount is required');
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return setErrorState('reward', 'Invalid number format');
    if (numAmount <= 0) return setErrorState('reward', 'Must be greater than 0');
    if (numAmount < parseFloat(MIN_REWARD_AMOUNT)) return setErrorState('reward', `Minimum ${MIN_REWARD_AMOUNT}`);
    if (numAmount > parseFloat(MAX_REWARD_AMOUNT)) return setErrorState('reward', `Maximum ${MAX_REWARD_AMOUNT}`);
    
    setRewardInputError(null);
    return true;
  };

  // Validate deposit amount input
  const validateDepositAmount = (amount: string): boolean => {
    if (!amount) {
      setDepositInputError('Amount is required');
      return false;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
      setDepositInputError('Invalid number');
      return false;
    }

    if (numAmount <= 0) {
      setDepositInputError('Amount must be greater than zero');
      return false;
    }

    setDepositInputError(null);
    return true;
  };

  const handleSetRewards = async () => {
    if (!validateRewardAmount(rewardAmount) || rewardTxStatus !== 'idle') return;
    await handleTransaction(
      () => notifyReward({ args: [parseEther(rewardAmount)] }),
      'reward'
    );
    setRewardAmount('');
  };
  
  const handlePauseToggle = async () => {
    if (pauseTxStatus !== 'idle') return;
    const action = stakingStats?.isPaused ? unpause : pause;
    await handleTransaction(action, 'pause');
  };
  
  const handleDepositRewards = async () => {
    if (!validateDepositAmount(depositAmount) || depositTxStatus !== 'idle') return;
    await handleTransaction(
      () => depositRewards({ args: [parseEther(depositAmount)] }),
      'deposit'
    );
    setDepositAmount('');
  };

  // Helper for rendering transaction status
  const renderTxStatus = (status: TransactionStatus, actionName: string) => {
    const statusConfig = {
      preparing: { text: 'Preparing', icon: Loader2, color: 'yellow' },
      pending: { text: 'Processing', icon: Loader2, color: 'yellow' },
      success: { text: 'Successful', icon: Check, color: 'green' },
      error: { text: 'Failed', icon: AlertCircle, color: 'red' }
    };

    const config = statusConfig[status];
    if (!config) return null;

    return (
      <span className={`text-xs text-${config.color}-400 flex items-center mt-2`}>
        <config.icon className={`h-3 w-3 mr-1 ${status !== 'success' ? 'animate-spin' : ''}`} />
        {config.text} {actionName}
      </span>
    );
  };

  if (!isConnected || !address) {
    return (
      <div className="text-center py-20">
        <Shield className="h-16 w-16 mx-auto text-gray-400 mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Connect Your Wallet</h2>
        <p className="text-gray-400">Please connect your wallet to access admin features</p>
      </div>
    );
  }

  // Replace the existing role check condition
  if (!roles.isAdmin && !roles.isMaintainer && !roles.isDepositor) {
    return (
      <div className="text-center py-20">
        {loading ? (
          <>
            <Loader2 className="h-16 w-16 mx-auto text-purple-500 animate-spin mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Checking Permissions</h2>
          </>
        ) : (
          <>
            <Shield className="h-16 w-16 mx-auto text-red-400 mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
            <p className="text-gray-400">You don't have permission to access admin features</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center space-x-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <div className="flex-1 text-red-400">{error}</div>
          <button
            onClick={() => {
              setError(null);
              fetchData();
            }}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Admin Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50 rounded-lg">
              <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
            </div>
          )}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Contract Status</span>
            {stakingStats?.isPaused ? (
              <Pause className="h-5 w-5 text-red-400" />
            ) : (
              <Play className="h-5 w-5 text-green-400" />
            )}
          </div>
          <div className="text-xl font-semibold">
            {stakingStats?.isPaused ? 'Paused' : 'Active'}
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50 rounded-lg">
              <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
            </div>
          )}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Reward Rate</span>
            <Coins className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="text-xl font-semibold">
            {stakingStats ? formatEther(stakingStats.rewardRate) : '0'} BRAIDS/block
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50 rounded-lg">
              <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
            </div>
          )}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Period Rewards</span>
            <Settings className="h-5 w-5 text-purple-400" />
          </div>
          <div className="text-xl font-semibold">
            {stakingStats ? formatEther(stakingStats.rewardForDuration) : '0'} BRAIDS
          </div>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Set Rewards (Admin) */}
        {roles.isAdmin && (
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Set Rewards</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Reward Amount
                </label>
                <input
                  type="text"
                  value={rewardAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setRewardAmount(value);
                      if (value) validateRewardAmount(value);
                    }
                  }}
                  placeholder="0.00"
                  disabled={rewardTxStatus === 'pending' || rewardTxStatus === 'preparing'}
                  className={`w-full bg-gray-700 border ${
                    rewardInputError ? 'border-red-500' : 'border-gray-600'
                  } rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed`}
                />
                {rewardInputError && (
                  <p className="mt-1 text-xs text-red-500">{rewardInputError}</p>
                )}
              </div>
              <button
                onClick={handleSetRewards}
                disabled={!rewardAmount || !!rewardInputError || loading || rewardTxStatus === 'pending' || rewardTxStatus === 'preparing'}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center"
              >
                {rewardTxStatus === 'pending' || rewardTxStatus === 'preparing' ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    {rewardTxStatus === 'preparing' ? 'Preparing...' : 'Processing...'}
                  </>
                ) : (
                  'Set Reward Amount'
                )}
              </button>
              {renderTxStatus(rewardTxStatus, 'Reward update')}
            </div>
          </div>
        )}

        {/* Pause/Unpause (Maintainer) */}
        {roles.isMaintainer && (
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Contract Control</h3>
            <button
              onClick={handlePauseToggle}
              disabled={loading || pauseTxStatus === 'pending' || pauseTxStatus === 'preparing'}
              className={`w-full font-semibold py-3 rounded-lg transition-colors ${
                stakingStats?.isPaused
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              } disabled:bg-gray-600 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2`}
            >
              {pauseTxStatus === 'pending' || pauseTxStatus === 'preparing' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {pauseTxStatus === 'preparing' ? 'Preparing...' : 'Processing...'}
                </>
              ) : stakingStats?.isPaused ? (
                <>
                  <Play className="h-5 w-5" />
                  Unpause Contract
                </>
              ) : (
                <>
                  <Pause className="h-5 w-5" />
                  Pause Contract
                </>
              )}
            </button>
            {renderTxStatus(pauseTxStatus, stakingStats?.isPaused ? 'Unpause' : 'Pause')}
          </div>
        )}

        {/* Deposit Rewards (Depositor) */}
        {roles.isDepositor && (
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Deposit Rewards</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Deposit Amount
                </label>
                <input
                  type="text"
                  value={depositAmount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setDepositAmount(value);
                      if (value) validateDepositAmount(value);
                    }
                  }}
                  placeholder="0.00"
                  disabled={depositTxStatus === 'pending' || depositTxStatus === 'preparing'}
                  className={`w-full bg-gray-700 border ${
                    depositInputError ? 'border-red-500' : 'border-gray-600'
                  } rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed`}
                />
                {depositInputError && (
                  <p className="mt-1 text-xs text-red-500">{depositInputError}</p>
                )}
              </div>
              <button
                onClick={handleDepositRewards}
                disabled={!depositAmount || !!depositInputError || loading || depositTxStatus === 'pending' || depositTxStatus === 'preparing'}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center"
              >
                {depositTxStatus === 'pending' || depositTxStatus === 'preparing' ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    {depositTxStatus === 'preparing' ? 'Preparing...' : 'Processing...'}
                  </>
                ) : (
                  'Deposit Rewards'
                )}
              </button>
              {renderTxStatus(depositTxStatus, 'Deposit')}
            </div>
          </div>
        )}
      </div>

      {/* Display user roles for debugging */}
      <div className="mt-8 text-sm text-gray-500">
        <p>Your current roles: {Object.entries(roles)
          .filter(([_, hasRole]) => hasRole)
          .map(([role]) => role.replace('is', ''))
          .join(', ') || 'None'}
        </p>
      </div>
    </div>
  );
};

export default AdminDashboard;