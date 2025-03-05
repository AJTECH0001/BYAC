import React, { useEffect } from "react";
import { createWeb3Modal } from "@web3modal/wagmi/react";
import { defaultWagmiConfig } from "@web3modal/wagmi/react/config";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import StakingDashboard from "./components/StakingDashboard";
import DelegatorDashboard from "./components/DelegatorDashboard";
import AdminDashboard from "./components/AdminDashboard";
import HomePage from "./components/HomePage";
import { custom } from "viem";

// Updated to Ronin mainnet
const roninChain = {
  id: 2020,
  name: "Ronin",
  network: "ronin",
  nativeCurrency: {
    decimals: 18,
    name: "RON",
    symbol: "RON",
  },
  rpcUrls: {
    public: { http: ["https://api.roninchain.com/rpc"] },
    default: { http: ["https://api.roninchain.com/rpc"] },
  },
  blockExplorers: {
    default: { name: "Ronin Explorer", url: "https://app.roninchain.com" },
  },
  testnet: false,
};

const metadata = {
  name: "BYAC Portal",
  description: "Bigyak Axie Club Portal",
  url: "https://byacportal.netlify.app",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

const chains = [roninChain];
const projectId = "8f67e1ab5c172a8fc09f6c6316bf344d";

const roninTransport = custom({
  async request({ method, params }) {
    if (typeof window === "undefined") {
      throw new Error("Browser environment required");
    }

    // Check for mobile deep link
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && !window.ronin?.provider) {
      const roninWalletUrl = "https://wallet.roninchain.com/";
      window.location.href = roninWalletUrl;
      return new Promise(() => {}); // Never resolves, as we're redirecting
    }

    // Wait for provider to be available
    if (!window.ronin?.provider) {
      throw new Error("Please install Ronin Wallet");
    }

    try {
      // Add a small delay to ensure the wallet is fully ready
      await new Promise((resolve) => setTimeout(resolve, 100));
      const response = await window.ronin.provider.request({ method, params });
      return response;
    } catch (error) {
      if (error.code === 4001) {
        throw new Error("User rejected the request");
      }
      if (error.code === -32002) {
        throw new Error("Wallet is locked. Please unlock your wallet.");
      }
      if (error.code === -32603) {
        throw new Error("Wallet connection failed. Please try again.");
      }
      throw error;
    }
  },
});

const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  enableWalletConnect: false,
  enableInjected: true,
  enableEIP6963: true,
  transports: {
    [roninChain.id]: roninTransport,
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 120_000,
      refetchInterval: 120_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

createWeb3Modal({
  wagmiConfig: config,
  projectId,
  chains,
  defaultChain: roninChain,
  includeWalletIds: ["injected"],
  excludeWalletIds: [
    "walletConnect",
    "coinbaseWallet",
    "metaMask",
    "brave",
    "ledger",
  ],
  themeMode: "dark",
  themeVariables: {
    "--w3m-z-index": "9999",
    "--w3m-overlay-backdrop-filter": "blur(6px)",
  },
});

const App = () => {
  const [currentPage, setCurrentPage] = React.useState("home");
  const [walletStatus, setWalletStatus] = React.useState({
    isInstalled: false,
    isReady: false,
  });
  const [connectedAddress, setConnectedAddress] = React.useState<string | null>(
    null
  );
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  useEffect(() => {
    const checkWallet = async () => {
      setLoading(true);
      const hasRonin = typeof window !== "undefined" && !!window.ronin;
      const hasProvider = hasRonin && !!window.ronin?.provider;

      setWalletStatus({
        isInstalled: hasRonin,
        isReady: hasProvider,
      });

      if (hasProvider) {
        try {
          const accounts = await window.ronin.provider.request({
            method: "eth_accounts",
          });
          setConnectedAddress(accounts[0]?.toLowerCase() || null);
          setErrorMessage(null); // Clear error message on success
        } catch (error) {
          console.error("Error getting accounts:", error);
          setConnectedAddress(null);
          setErrorMessage(
            "Failed to retrieve account information. Please try again."
          );
        }
      } else {
        setErrorMessage("Ronin Wallet is not installed or ready.");
      }
      setLoading(false);
    };

    // Initial check
    checkWallet();

    // Set up interval with proper cleanup
    let intervalId: number | undefined;
    const startInterval = () => {
      intervalId = window.setInterval(checkWallet, 120_000);
    };

    startInterval();

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalId) {
          window.clearInterval(intervalId);
        }
      } else {
        checkWallet();
        startInterval();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup function
    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#/", "") || "home";
      setCurrentPage(hash);
    };

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleWalletClick = () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && !walletStatus.isInstalled) {
      window.location.href = "https://wallet.roninchain.com/";
      return;
    }
  };

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
          <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center space-x-8">
                  <a href="#/" className="flex items-center">
                    <Crown className="h-8 w-8 text-yellow-500" />
                    <span className="ml-2 text-xl font-bold">BYAC Portal</span>
                  </a>
                  <div className="hidden md:flex space-x-4">
                    <a
                      href="#/"
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        currentPage === "home"
                          ? "bg-gray-800 text-white"
                          : "text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      Home
                    </a>
                    <a
                      href="#/staking"
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        currentPage === "staking"
                          ? "bg-gray-800 text-white"
                          : "text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      Staking
                    </a>
                    <a
                      href="#/delegators"
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        currentPage === "delegators"
                          ? "bg-gray-800 text-white"
                          : "text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      Delegators
                    </a>
                    {connectedAddress && (
                      <a
                        href="#/admin"
                        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                          currentPage === "admin"
                            ? "bg-gray-800 text-white"
                            : "text-gray-300 hover:bg-gray-700"
                        }`}
                      >
                        Admin
                      </a>
                    )}
                    <a
                      href="https://app.roninchain.com/swap?outputCurrency=0xD144A6466aA76Cc3A892Fda9602372dd884a2C90"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      Buy $BRAIDS
                    </a>
                    <a
                      href="https://roninchain.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
                    >
                      Ronin Apps
                    </a>
                  </div>
                </div>
                {!walletStatus.isInstalled ? (
                  <a
                    href="https://wallet.roninchain.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleWalletClick}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Install Ronin Wallet
                  </a>
                ) : (
                  <w3m-button />
                )}
              </div>
            </div>
          </nav>

          <main className="container mx-auto px-4 py-8">
            {loading && <div>Checking wallet connection...</div>}
            {errorMessage && <div className="error-message">{errorMessage}</div>}
            {currentPage === "home" && <HomePage />}
            {currentPage === "staking" && <StakingDashboard walletStatus={walletStatus} />}
            {currentPage === "delegators" && <DelegatorDashboard />}
            {currentPage === "admin" && <AdminDashboard />}
          </main>
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default App;