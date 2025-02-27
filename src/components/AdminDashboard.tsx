import React, { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useContractWrite } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { Shield, Pause, Play, Coins, Settings } from 'lucide-react';
import { STAKING_CONTRACT_ADDRESS, STAKING_ABI, getStakingStats, checkRole, ROLES, StakingStats } from '../contracts/StakingContract';

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

  // Contract writes
  const { writeAsync: notifyReward } = useContractWrite({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'notifyRewardAmount',
  });

  const { writeAsync: pause } = useContractWrite({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'pause',
  });

  const { writeAsync: unpause } = useContractWrite({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'unpause',
  });

  const { writeAsync: depositRewards } = useContractWrite({
    address: STAKING_CONTRACT_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'depositRewards',
  });

  const fetchData = async () => {
    if (!address || !publicClient) return;

    try {
      setLoading(true);
      setError(null);

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
    } catch (err) {
      console.error('Error fetching admin data:', err);
      setError('Failed to load admin data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      fetchData();
      
      // Set up polling
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [isConnected, address]);

  const handleSetRewards = async () => {
    if (!rewardAmount) return;
    try {
      await notifyReward({ args: [parseEther(rewardAmount)] });
      setRewardAmount('');
      await fetchData();
    } catch (err) {
      console.error('Setting rewards failed:', err);
      setError('Failed to set rewards. Please try again.');
    }
  };

  const handlePauseToggle = async () => {
    try {
      if (stakingStats?.isPaused) {
        await unpause();
      } else {
        await pause();
      }
      await fetchData();
    } catch (err) {
      console.error('Pause toggle failed:', err);
      setError(`Failed to ${stakingStats?.isPaused ? 'unpause' : 'pause'} staking. Please try again.`);
    }
  };

  const handleDepositRewards = async () => {
    if (!depositAmount) return;
    try {
      await depositRewards({ args: [parseEther(depositAmount)] });
      setDepositAmount('');
      await fetchData();
    } catch (err) {
      console.error('Depositing rewards failed:', err);
      setError('Failed to deposit rewards. Please try again.');
    }
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

  if (!roles.isAdmin && !roles.isMaintainer && !roles.isDepositor) {
    return (
      <div className="text-center py-20">
        <Shield className="h-16 w-16 mx-auto text-red-400 mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
        <p className="text-gray-400">You don't have permission to access admin features</p>
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

      {/* Admin Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
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

        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Reward Rate</span>
            <Coins className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="text-xl font-semibold">
            {stakingStats ? formatEther(stakingStats.rewardRate) : '0'} BRAIDS/block
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
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
                    }
                  }}
                  placeholder="0.00"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                onClick={handleSetRewards}
                disabled={!rewardAmount || loading}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Set Reward Amount
              </button>
            </div>
          </div>
        )}

        {/* Pause/Unpause (Maintainer) */}
        {roles.isMaintainer && (
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold mb-4">Contract Control</h3>
            <button
              onClick={handlePauseToggle}
              disabled={loading}
              className={`w-full font-semibold py-3 rounded-lg transition-colors ${
                stakingStats?.isPaused
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700' } disabled:bg-gray-600 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2`}
            >
              {stakingStats?.isPaused ? (
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
                    }
                  }}
                  placeholder="0.00"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                onClick={handleDepositRewards}
                disabled={!depositAmount || loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Deposit Rewards
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;