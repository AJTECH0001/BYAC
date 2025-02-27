import React, { useState, useEffect } from 'react';
import { Users, User, Copy, ExternalLink, Trophy, Wallet, AlertCircle, Shield, Award, TrendingUp, Clock, Percent } from 'lucide-react';
import { formatEther } from 'viem';
import { getValidatorData, getDelegatorsList, VALIDATOR_ADDRESS } from '../utils/alchemy';

interface Delegator {
  address: string;
  stake: string;
  percentage: string;
  joinedAt: string;
  rank: number;
  nativeBalance: string;
  braidsBalance: string;
}

interface ValidatorStats {
  totalStake: string;
  totalDelegators: number;
  apr: string;
  commission: string;
  uptime: string;
  lastSignedBlock: string;
}

const DelegatorDashboard: React.FC = () => {
  const [delegators, setDelegators] = useState<Delegator[]>([]);
  const [validatorStats, setValidatorStats] = useState<ValidatorStats>({
    totalStake: '0',
    totalDelegators: 0,
    apr: '0',
    commission: '0',
    uptime: '0',
    lastSignedBlock: '0'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch validator data
      const validatorData = await getValidatorData(VALIDATOR_ADDRESS);
      if (!validatorData) {
        throw new Error('Failed to fetch validator data');
      }

      // Fetch delegator list
      const delegatorList = await getDelegatorsList(VALIDATOR_ADDRESS);
      if (!delegatorList) {
        throw new Error('Failed to fetch delegator list');
      }

      // Sort delegators by stake
      const enrichedDelegators = delegatorList
        .map((delegator, index) => ({
          ...delegator,
          rank: index + 1
        }))
        .sort((a, b) => Number(BigInt(b.stake) - BigInt(a.stake)));

      setValidatorStats(validatorData);
      setDelegators(enrichedDelegators);
      setError(null);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      setError('Failed to load delegator data. Please try again later.');
      setDelegators([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let intervalId: number;

    const initFetch = async () => {
      if (mounted) {
        await fetchData();
        
        if (mounted && !error) {
          intervalId = window.setInterval(() => {
            if (mounted) {
              fetchData();
            }
          }, 120000);
        }
      }
    };

    initFetch();

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const copyToClipboard = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (loading && !delegators.length) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
          <div className="text-purple-400">Loading delegator data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center space-x-3">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-400">{error}</p>
          </div>
          <button
            onClick={() => fetchData()}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Validator Stats */}
      <div className="bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-lg p-8 backdrop-blur-sm border border-purple-500/20">
        <div className="flex items-center space-x-4 mb-6">
          <Shield className="h-12 w-12 text-purple-400" />
          <div>
            <h2 className="text-2xl font-bold">BYAC Validator</h2>
            <div className="flex items-center space-x-2 mt-1">
              <span className="text-sm text-gray-400">{VALIDATOR_ADDRESS.slice(0, 6)}...{VALIDATOR_ADDRESS.slice(-4)}</span>
              <button
                onClick={() => copyToClipboard(VALIDATOR_ADDRESS)}
                className="p-1 hover:bg-gray-700 rounded transition-colors"
                title="Copy Address"
              >
                {copiedAddress === VALIDATOR_ADDRESS ? (
                  <span className="text-green-400 text-sm">Copied!</span>
                ) : (
                  <Copy className="h-4 w-4 text-gray-400" />
                )}
              </button>
              <a
                href={`https://app.roninchain.com/address/${VALIDATOR_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:bg-gray-700 rounded transition-colors"
                title="View on Explorer"
              >
                <ExternalLink className="h-4 w-4 text-gray-400" />
              </a>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Total Stake</span>
              <Shield className="h-5 w-5 text-purple-400" />
            </div>
            <div className="text-xl font-semibold">{formatEther(BigInt(validatorStats.totalStake))} RON</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Delegators</span>
              <Users className="h-5 w-5 text-blue-400" />
            </div>
            <div className="text-xl font-semibold">{validatorStats.totalDelegators}</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">APR</span>
              <TrendingUp className="h-5 w-5 text-green-400" />
            </div>
            <div className="text-xl font-semibold">{validatorStats.apr}%</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Commission</span>
              <Percent className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="text-xl font-semibold">{validatorStats.commission}%</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Uptime</span>
              <Award className="h-5 w-5 text-orange-400" />
            </div>
            <div className="text-xl font-semibold">{validatorStats.uptime}%</div>
          </div>

          <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">Last Block</span>
              <Clock className="h-5 w-5 text-indigo-400" />
            </div>
            <div className="text-xl font-semibold">#{validatorStats.lastSignedBlock}</div>
          </div>
        </div>
      </div>

      {/* Delegators List */}
      <div className="bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <Users className="h-6 w-6 text-purple-400" />
              <h2 className="text-xl font-semibold">Active Delegators ({validatorStats.totalDelegators})</h2>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-700">
                  <th className="pb-4 font-semibold text-gray-400">Rank</th>
                  <th className="pb-4 font-semibold text-gray-400">Address</th>
                  <th className="pb-4 font-semibold text-gray-400">Stake Amount</th>
                  <th className="pb-4 font-semibold text-gray-400">Share</th>
                  <th className="pb-4 font-semibold text-gray-400">Wallet Balance</th>
                  <th className="pb-4 font-semibold text-gray-400">Joined</th>
                  <th className="pb-4 font-semibold text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {delegators.map((delegator) => (
                  <tr key={delegator.address} className="hover:bg-gray-700/30">
                    <td className="py-4">
                      <div className="flex items-center space-x-2">
                        <Trophy className={`h-5 w-5 ${
                          delegator.rank === 1 ? 'text-yellow-400' :
                          delegator.rank === 2 ? 'text-gray-400' :
                          delegator.rank === 3 ? 'text-amber-600' :
                          'text-gray-600'
                        }`} />
                        <span className="font-medium">#{delegator.rank}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center space-x-3">
                        <User className="h-5 w-5 text-gray-400" />
                        <a
                          href={`https://app.roninchain.com/address/${delegator.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          {`${delegator.address.slice(0, 6)}...${delegator.address.slice(-4)}`}
                        </a>
                      </div>
                    </td>
                    <td className="py-4">{formatEther(BigInt(delegator.stake))} RON</td>
                    <td className="py-4">{delegator.percentage}%</td>
                    <td className="py-4">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center space-x-2">
                          <Wallet className="h-4 w-4 text-blue-400" />
                          <span>{delegator.nativeBalance} RON</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Trophy className="h-4 w-4 text-yellow-400" />
                          <span>{delegator.braidsBalance} BRAIDS</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      {new Date(delegator.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => copyToClipboard(delegator.address)}
                          className="p-1 hover:bg-gray-700 rounded transition-colors"
                          title="Copy Address"
                        >
                          {copiedAddress === delegator.address ? (
                            <span className="text-green-400 text-sm">Copied!</span>
                          ) : (
                            <Copy className="h-4 w-4 text-gray-400" />
                          )}
                        </button>
                        <a
                          href={`https://app.roninchain.com/address/${delegator.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-gray-700 rounded transition-colors"
                          title="View on Explorer"
                        >
                          <ExternalLink className="h-4 w-4 text-gray-400" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DelegatorDashboard;