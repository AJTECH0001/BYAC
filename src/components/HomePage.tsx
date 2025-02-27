import React from 'react';
import { ArrowRight, Shield, Crown, TrendingUp, Lock, Wallet } from 'lucide-react';
import { useAccount, useBalance } from 'wagmi';
import { formatEther } from 'viem';
import { VALIDATOR_ADDRESS, BRAIDS_TOKEN_ADDRESS } from '../utils/alchemy';

const BALANCE_REFRESH_INTERVAL = 120_000; // 2 minutes in milliseconds

const HomePage = () => {
  const { address, isConnected } = useAccount();

  const { data: ronBalance } = useBalance({
    address,
    watch: true,
    cacheTime: BALANCE_REFRESH_INTERVAL,
    refetchInterval: BALANCE_REFRESH_INTERVAL
  });

  const { data: braidsBalance } = useBalance({
    address,
    token: BRAIDS_TOKEN_ADDRESS as `0x${string}`,
    watch: true,
    cacheTime: BALANCE_REFRESH_INTERVAL,
    refetchInterval: BALANCE_REFRESH_INTERVAL
  });

  // Format balance to standard numeric format
  const formatBalance = (balance: bigint | undefined): string => {
    if (!balance) return '0.00';
    const formatted = formatEther(balance);
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(Number(formatted));
  };

  return (
    <div className="space-y-20">
      {/* Hero Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-600/20 to-purple-600/20 backdrop-blur-sm"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-5xl font-bold tracking-tight mb-6 bg-gradient-to-r from-yellow-400 to-purple-400 bg-clip-text text-transparent">
              Welcome to BigYak Axie Club Portal
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Your gateway to the Bigyak Axie Club ecosystem. Delegate, stake, earn rewards, and join the exclusive community.
            </p>

            {isConnected && (
              <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">RON Balance</span>
                    <Wallet className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="text-xl font-semibold">
                    {formatBalance(ronBalance?.value)} RON
                  </div>
                </div>
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-400">$BRAIDS Balance</span>
                    <Crown className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="text-xl font-semibold">
                    {formatBalance(braidsBalance?.value)} BRAIDS
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button 
                onClick={() => window.location.hash = '#/staking'}
                className="bg-gradient-to-r from-yellow-500 to-purple-500 text-white font-semibold px-8 py-3 rounded-lg inline-flex items-center justify-center gap-2 hover:from-yellow-600 hover:to-purple-600 transition-all"
              >
                Start Staking <ArrowRight className="w-5 h-5" />
              </button>
              <a 
                href="https://app.roninchain.com/swap?outputCurrency=0xD144A6466aA76Cc3A892Fda9602372dd884a2C90"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold px-8 py-3 rounded-lg inline-flex items-center justify-center gap-2 hover:from-purple-600 hover:to-blue-600 transition-all"
              >
                Buy $BRAIDS <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Exclusive Benefits</h2>
          <p className="text-gray-400">Discover the advantages of being part of the BYAC ecosystem</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            {
              icon: <Shield className="w-8 h-8 text-yellow-400" />,
              title: "Secure Staking",
              description: "Enterprise-grade security for your staked assets"
            },
            {
              icon: <Crown className="w-8 h-8 text-purple-400" />,
              title: "Exclusive Access",
              description: "VIP benefits and early access to new features"
            },
            {
              icon: <TrendingUp className="w-8 h-8 text-green-400" />,
              title: "High APR",
              description: "Earn competitive rewards on your staked tokens"
            },
            {
              icon: <Lock className="w-8 h-8 text-blue-400" />,
              title: "Smart Contracts",
              description: "Audited and secure staking contracts"
            }
          ].map((feature, index) => (
            <div key={index} className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors">
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-gray-800/30 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: "$2M+", label: "Total Value Locked" },
              { value: "1K+", label: "Active Stakers" },
              { value: "30%", label: "Max APR" },
              { value: "24/7", label: "Support" }
            ].map((stat, index) => (
              <div key={index}>
                <div className="text-3xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-purple-400 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;