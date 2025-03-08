import React, { useState, useEffect } from "react";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { Coins, Wallet, Award, Eye, EyeOff } from "lucide-react";
import {
  STAKING_CONTRACT_ADDRESS,
  STAKING_ABI,
  getStakingStats,
  getUserStats,
  BRAIDS_TOKEN_ABI,
} from "../contracts/StakingContract";
import { BRAIDS_TOKEN_ADDRESS } from "../utils/alchemy";
import Modal from "./Modal";

interface WalletStatus {
  isInstalled: boolean;
  isReady: boolean;
}

interface StakingDashboardProps {
  walletStatus: WalletStatus;
}

interface PriceData {
  price: number;
  priceChange24h: number;
}

const StakingDashboard: React.FC<StakingDashboardProps> = ({
  walletStatus,
}) => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [stakingStats, setStakingStats] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [hideNumbers, setHideNumbers] = useState(false);
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);
  const [isUnstakeModalOpen, setIsUnstakeModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionInProgress, setTransactionInProgress] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenPrice, setTokenPrice] = useState(0);
  const [priceChange24h, setPriceChange24h] = useState(0);
  const [circulatingSupply, setCirculatingSupply] = useState(159_155_561n);
  const [isPriceFetching, setIsPriceFetching] = useState(false);

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

  const fetchTokenPrice = async () => {
    try {
      setIsPriceFetching(true);
      // Note: BRAIDS may not be listed on CoinGecko; you’d need its ID or contract address
      const response = await fetch(
        "https://api.coingecko.com/api/v3/coins/ronin/contract/0xd144a6466aa76cc3a892fda9602372dd884a2c90"
      );
      if (!response.ok) {
        throw new Error("CoinGecko API failed");
      }
      const data = await response.json();
      const price = data.market_data.current_price.usd;
      const priceChange24h = data.market_data.price_change_percentage_24h;
      setTokenPrice(price);
      setPriceChange24h(priceChange24h);
    } catch (err) {
      console.error("Error fetching token price:", err);
      // Fallback to last known value
      setTokenPrice(0.0001138); // From Jan 22, 2025
      setPriceChange24h(18.76);
    } finally {
      setIsPriceFetching(false);
    }
  };

  const fetchData = async () => {
    if (!address || !publicClient) return;
    try {
      setIsLoading(true);
      setError(null);
      const chainId = await publicClient.getChainId();
      if (chainId !== 2020) throw new Error("Please connect to Ronin Mainnet");

      const [newStakingStats, newUserStats] = await Promise.all([
        getStakingStats(publicClient).catch(() => null),
        getUserStats(publicClient, address).catch(() => null),
      ]);

      if (newStakingStats && newUserStats) {
        setStakingStats(newStakingStats);
        setUserStats(newUserStats);
      } else {
        throw new Error("Failed to fetch staking data");
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Fetch token price on component mount
    fetchTokenPrice();

    // Set up interval to periodically update price
    const priceInterval = window.setInterval(fetchTokenPrice, 300000); // Update every 5 minutes

    return () => {
      window.clearInterval(priceInterval);
    };
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

      if (parsedAmount <= 0n) throw new Error("Amount must be greater than 0");
      if (parsedAmount > parseEther("1000000")) {
        throw new Error(
          "Amount exceeds maximum stake limit of 1,000,000 BRAIDS"
        );
      }
      if (braidsBalance && parsedAmount > braidsBalance.value) {
        throw new Error("Insufficient BRAIDS balance");
      }

      // Check and approve token allowance
      const currentAllowance = await publicClient.readContract({
        address: BRAIDS_TOKEN_ADDRESS,
        abi: BRAIDS_TOKEN_ABI,
        functionName: "allowance",
        args: [address, STAKING_CONTRACT_ADDRESS],
      });

      if (currentAllowance < parsedAmount) {
        const approveHash = await writeContractAsync({
          address: BRAIDS_TOKEN_ADDRESS,
          abi: BRAIDS_TOKEN_ABI,
          functionName: "approve",
          args: [STAKING_CONTRACT_ADDRESS, parsedAmount],
          gas: 100000n,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        console.log("Approval successful:", approveHash);
      }

      // Estimate gas
      const gasEstimate = await publicClient.estimateContractGas({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: "stake",
        args: [parsedAmount],
        account: address,
      });

      // Execute stake transaction
      const hash = await writeContractAsync({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: "stake",
        args: [parsedAmount],
        gas: gasEstimate ? gasEstimate + 10000n : 300000n,
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await fetchData();
      setStakeAmount("");
    } catch (err) {
      console.error("Stake failed:", err);
      let errorMessage =
        "Transaction failed! Contract Interaction with RON failed";
      if (err && err.revert) {
        errorMessage += `: ${
          err.revert.reason || err.revert.data || "Unknown reason"
        }`;
        if (err.revert.reason && err.revert.reason.includes("Panic")) {
          errorMessage +=
            " - There was an arithmetic overflow in the contract. Please try a smaller amount or check the contract for issues.";
        } else if (err.revert.reason && err.revert.reason.includes("paused")) {
          errorMessage += " - Staking is paused. Please try again later.";
        }
      } else if (err.message) {
        errorMessage += `: ${err.message}`;
      }
      setError(errorMessage);
    } finally {
      setTransactionInProgress(false);
    }
  };

  const handleUnstake = async () => {
    if (!unstakeAmount) return;
    try {
      setTransactionInProgress(true);
      const parsedAmount = parseEther(unstakeAmount);

      if (parsedAmount <= 0n) throw new Error("Amount must be greater than 0");
      if (userStats?.stakedAmount && parsedAmount > userStats.stakedAmount) {
        throw new Error("Insufficient staked amount");
      }

      const hash = await writeContractAsync({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: "withdraw",
        args: [parsedAmount],
        gas: 300000n,
      });

      await publicClient.waitForTransactionReceipt({ hash });
      await fetchData();
      setUnstakeAmount("");
    } catch (err) {
      console.error("Unstake failed:", err);
      setError(
        `Failed to unstake: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
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
        functionName: "getReward",
        gas: 300000n,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await fetchData();
    } catch (err) {
      console.error("Claim failed:", err);
      setError(
        `Claim failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
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
        functionName: "getReward",
        gas: 300000n,
      });
      await publicClient.waitForTransactionReceipt({ hash: claimHash });

      const stakeHash = await writeContractAsync({
        address: STAKING_CONTRACT_ADDRESS,
        abi: STAKING_ABI,
        functionName: "stake",
        args: [userStats.earnedRewards],
        gas: 300000n,
      });
      await publicClient.waitForTransactionReceipt({ hash: stakeHash });

      await fetchData();
    } catch (err) {
      console.error("Restake failed:", err);
      setError(
        `Restake failed: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    } finally {
      setTransactionInProgress(false);
    }
  };

  const checkStakeAvailability = () => {
    if (!braidsBalance || braidsBalance.value <= 0n) {
      setError("No BRAIDS available to stake");
      return false;
    }
    setIsStakeModalOpen(true);
    return true;
  };

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">BRAIDS PRICE</span>
          </div>
          <div className="text-xl font-semibold">${tokenPrice.toFixed(6)}</div>
          <div
            className={`text-sm ${
              priceChange24h >= 0 ? "text-green-400" : "text-red-400"
            } mt-1`}
          >
            {priceChange24h >= 0 ? "+" : ""}
            {priceChange24h.toFixed(2)}%
          </div>
        </div>

        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">DAILY REWARDS</span>
            <Award className="h-5 w-5 text-yellow-400" />
          </div>
          <div className="text-xl font-semibold">
            {hideNumbers
              ? "****"
              : stakingStats?.dailyRewards
              ? formatEther(stakingStats.dailyRewards)
              : "0"}{" "}
            BRAIDS
          </div>
        </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700 space-y-4">
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

          <div className="flex items-center justify-between mb-4">
            <div className="text-sm">
              <span className="text-gray-400">CLAIMABLE REWARDS: </span>
              <span className="font-medium text-white">
                {hideNumbers
                  ? "****"
                  : userStats?.earnedRewards
                  ? formatEther(userStats.earnedRewards)
                  : "0"}{" "}
                BRAIDS
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRestake}
                disabled={
                  !userStats?.earnedRewards ||
                  userStats.earnedRewards <= 0n ||
                  transactionInProgress ||
                  isLoading
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
                  transactionInProgress ||
                  isLoading
                }
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors disabled:bg-gray-600"
              >
                Claim
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-400 block">TOTAL STAKED</span>
              <span className="text-lg font-semibold">
                {hideNumbers
                  ? "****"
                  : userStats?.stakedAmount
                  ? formatEther(userStats.stakedAmount)
                  : "0"}{" "}
                BRAIDS
              </span>
            </div>
            <div>
              <span className="text-sm text-gray-400 block">
                AVAILABLE IN WALLET
              </span>
              <span className="text-lg font-semibold">
                {hideNumbers
                  ? "****"
                  : braidsBalance
                  ? formatEther(braidsBalance.value)
                  : "0"}{" "}
                BRAIDS
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={checkStakeAvailability}
              disabled={
                transactionInProgress || stakingStats?.isPaused || isLoading
              }
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded disabled:bg-gray-600"
            >
              {isLoading ? "Loading..." : "Stake"}
            </button>
            <button
              onClick={() => setIsUnstakeModalOpen(true)}
              disabled={transactionInProgress || isLoading}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded disabled:bg-gray-600"
            >
              {isLoading ? "Loading..." : "Unstake"}
            </button>
          </div>
        </div>

        <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700 flex flex-col justify-between">
          <div className="space-y-3">
            <h3 className="text-xl font-semibold mb-2">Total Staked</h3>
            <div className="text-3xl font-bold">
              {hideNumbers
                ? "****"
                : stakingStats?.totalStaked
                ? formatEther(stakingStats.totalStaked)
                : "0"}{" "}
              BRAIDS
            </div>
            {stakingStats?.totalStaked && (
              <div className="text-sm text-gray-400">
                {hideNumbers
                  ? "~ $****"
                  : `$${(
                      Number(formatEther(stakingStats.totalStaked)) * tokenPrice
                    ).toLocaleString()}`}
              </div>
            )}

            <div className="mt-4">
              <h3 className="text-xl font-semibold mb-2">Estimated Rewards</h3>
              <span className="text-2xl font-semibold">
                {`${calculateAPR().toFixed(2)}%`}
              </span>{" "}
              <span className="text-sm text-gray-400">APR</span>
            </div>
          </div>
        </div>
      </div>

      <Modal
        title="Stake BRAIDS"
        isOpen={isStakeModalOpen}
        onClose={() => setIsStakeModalOpen(false)}
      >
        <label className="block text-sm text-gray-400 mb-1">
          Amount to Stake
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={stakeAmount}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || /^\d*\.?\d*$/.test(val)) {
                setStakeAmount(val);
              }
            }}
            placeholder="0.00"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none"
            disabled={transactionInProgress || isLoading}
          />
          <button
            onClick={() => {
              if (braidsBalance) {
                setStakeAmount(formatEther(braidsBalance.value));
              }
            }}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:bg-gray-600"
            disabled={transactionInProgress || !braidsBalance || isLoading}
          >
            MAX
          </button>
        </div>
        <button
          onClick={async () => {
            await handleStake();
            setIsStakeModalOpen(false);
          }}
          disabled={
            !stakeAmount ||
            transactionInProgress ||
            stakingStats?.isPaused ||
            isLoading
          }
          className="mt-2 w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded disabled:bg-gray-600"
        >
          {transactionInProgress ? "Staking..." : "Confirm Stake"}
        </button>
      </Modal>

      <Modal
        title="Unstake BRAIDS"
        isOpen={isUnstakeModalOpen}
        onClose={() => setIsUnstakeModalOpen(false)}
      >
        <label className="block text-sm text-gray-400 mb-1">
          Amount to Unstake
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={unstakeAmount}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "" || /^\d*\.?\d*$/.test(val)) {
                setUnstakeAmount(val);
              }
            }}
            placeholder="0.00"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none"
            disabled={transactionInProgress || isLoading}
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
              userStats.stakedAmount <= 0n ||
              isLoading
            }
          >
            MAX
          </button>
        </div>
        <button
          onClick={async () => {
            await handleUnstake();
            setIsUnstakeModalOpen(false);
          }}
          disabled={!unstakeAmount || transactionInProgress || isLoading}
          className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded disabled:bg-gray-600"
        >
          {transactionInProgress ? "Unstaking..." : "Confirm Unstake"}
        </button>
      </Modal>
    </div>
  );
};

export default StakingDashboard;
