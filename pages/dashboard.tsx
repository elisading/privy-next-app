import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { ConnectedSolanaWallet, getAccessToken, usePrivy, useSolanaWallets, type WalletWithMetadata} from "@privy-io/react-auth";
import { clusterApiUrl, Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import Head from "next/head";
import Bottleneck from "bottleneck";

async function verifyToken() {
  const url = "/api/verify";
  const accessToken = await getAccessToken();
  const result = await fetch(url, {
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined),
    },
  });

  return await result.json();
}

export default function DashboardPage() {
  // const [verifyResult, setVerifyResult] = useState();
  const [transactionResult, setTransactionResult] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger for refreshing user object
  const [balance, setBalance] = useState<number | null>(null);
  // const [solanaWallet, setSolanaWallet] = useState<ConnectedSolanaWallet | null>(null);

  const router = useRouter();
  const {
    ready,
    authenticated,
    user,
    logout,
    // linkEmail,
    // linkWallet,
    // unlinkEmail,
    // unlinkPhone,
    // unlinkWallet,
  } = usePrivy();

  const { wallets, createWallet } = useSolanaWallets();
  const solanaWallet = wallets[0];
  // useEffect(() => {
  //   if (wallets.length > 0 && wallets[0]) {
  //     setSolanaWallet(wallets[0] as ConnectedSolanaWallet); // Set solanaWallet state
  //   }
  // }, [wallets]);

  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/");
    }
  }, [ready, authenticated, router]);

  const initialize = () => {
    window.addEventListener("message", onMessageReceived);
  };

  useEffect(() => {
    initialize();

    return () => {
      window.removeEventListener("message", onMessageReceived);
    };
  }, []); 

  const onMessageReceived = (event: any) => {
    let message = event.data;

    if (message && typeof message === "string" && message !== "" && event.eventType === "deposit") {
      try {
        message = JSON.parse(message);
      } catch (e) {
        console.error("Error parsing message data:", e);
      }
    }

    handleEvent(message);
  };

  const handleEvent = (event: any) => {

    console.log("Event received:", event);
    if (event.eventType === "deposit") {
      console.log("Deposit event received:", event);
    // const { player, gameId, betAmount } = event.data;
    // console.log(player, gameId, betAmount);

    handleSendTransaction();
      
    } 

   
  };

  const limiter = new Bottleneck({
    minTime: 1000, 
  });

  useEffect(() => {
    const fetchBalance = async () => {
      if (solanaWallet) {
        try {
          setLoading(true);
          const connection = new Connection(clusterApiUrl("devnet"));
          const walletPublicKey = new PublicKey(solanaWallet.address);
          const balance = await limiter.schedule(() => connection.getBalance(walletPublicKey));
          setBalance(balance / 1_000_000_000); // Convert lamports to SOL
        } catch (error) {
          console.error("Failed to fetch wallet balance:", error);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchBalance();
  }, [solanaWallet, refreshTrigger]);

  useEffect(() => {
    const verifyUserToken = async () => {
      if (authenticated) {
        try {
          const result = await verifyToken();
          console.log("Token verification result:", result);
        } catch (error) {
          console.error("Token verification failed:", error);
        }
      }
    };

    verifyUserToken();
  }, [authenticated]);

  // Refresh the user object when refreshTrigger changes
  useEffect(() => {
    // Logic here can include API calls to refresh the user object if necessary
  }, [refreshTrigger]);

  // Handle manually creating a Solana wallet
  const handleCreateSolanaWallet = async () => {
    try {
      setLoading(true);
      if (!authenticated) throw new Error("User is not authenticated");

      const wallet = await createWallet();
      console.log("Created Solana Wallet:", wallet);
      setRefreshTrigger((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to create Solana wallet:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (solanaWallet?.address) {
      navigator.clipboard.writeText(solanaWallet.address);
      alert("Copied to clipboard!");
    }
  }

  // const {exportWallet} = useSolanaWallets();

  function ExportWalletButton() {
    const {ready, authenticated, user} = usePrivy();
    const {exportWallet} = useSolanaWallets();
    // Check that your user is authenticated
    const isAuthenticated = ready && authenticated;
    // Check that your user has an embedded wallet
    const hasEmbeddedWallet = !!user?.linkedAccounts?.find(
      (account): account is WalletWithMetadata =>
        account.type === 'wallet' &&
        account.walletClientType === 'privy' &&
        account.chainType === 'solana',
    );
  
    return (
      <button onClick={() =>exportWallet()} disabled={!isAuthenticated || !hasEmbeddedWallet}
      className="text-sm bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded-md text-white">
        Export Private Key
      </button>
    );
  }

  // Handle sending a Solana transaction
  const handleSendTransaction = async () => {
    try {
      setLoading(true);

      // console.log("solanaWallet", solanaWallet);
      // if (!solanaWallet) {
      //   console.log("No wallet found");
      //   return false
      // }

      if (solanaWallet) {

      // Connection to the Solana Devnet
      const connection = new Connection(clusterApiUrl("devnet"));

      // const walletString = solanaWallet.address;

      // Fetch the public key of the Solana wallet
      const walletPublicKey = new PublicKey(solanaWallet.address);
      const toPubkeyString = "2i44BeA3vKQWAjgHf6qoFNn4RimNmBjkJ6h2wieFAsSN";
      const testPubkey = new PublicKey(toPubkeyString);

      const balance = await connection.getBalance(walletPublicKey);
      console.log(`Wallet balance: ${balance} lamports`);

      // Build a transaction to send 0.01 SOL to the recipient address
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: walletPublicKey,
          toPubkey: testPubkey,
          lamports: 10000000, // 0.01 SOL (1 SOL = 1,000,000,000 lamports)
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletPublicKey;
      console.log("Transaction object:", transaction);

      // Send transaction using the wallet's sendTransaction method
      // const tSW = solanaWallet ?? {};
      const txHash = await solanaWallet?.sendTransaction!(transaction, connection);

      // Log and display the transaction result
      console.log("Transaction sent, hash:", txHash);
      console.log("Transaction sent, hash:", txHash);
      setTransactionResult(txHash);
      } else {


        console.log("failed to send")
        // handleSendTransaction()

        setTimeout(() => {
          handleSendTransaction()
        }
          , 200)
      }
    } catch (error) {
      console.error("Transaction failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Gamebets</title>
      </Head>

      <main className="flex flex-col min-h-screen px-4 sm:px-20 py-6 sm:py-10 bg-privy-light-blue">
        {ready && authenticated ? (
          <>
            <div className="flex flex-row justify-between">
              <h1 className="text-2xl font-semibold">Gamebets</h1>
              <button
                onClick={logout}
                className="text-sm bg-violet-200 hover:text-violet-900 py-2 px-4 rounded-md text-violet-700"
              >
                Logout
              </button>
            </div>

            {solanaWallet && (
              <div className="mt-6 p-4 bg-white rounded-lg shadow-md">
                <h2 className="text-lg font-bold text-gray-800">Solana Wallet</h2>
                
                <div className="mt-2">
                  <p className="text-sm text-gray-600">Address:</p>
                  <p className="text-sm font-mono text-gray-900">{solanaWallet.address}</p>
                </div>

                <div className="mt-4">
                  <p className="text-sm text-gray-600">Balance:</p>
                  <p className="text-sm font-mono text-gray-900">
                    {balance !== null ? `${balance} SOL` : "Loading..."}
                  </p>
                </div>

                <div className="mt-4 flex space-x-4">
                  <button
                    onClick={() => setRefreshTrigger((prev) => prev + 1)}
                    className="text-sm bg-gray-600 hover:bg-gray-700 py-2 px-4 rounded-md text-white"
                  >
                    Refresh Balance
                  </button>
                  
                  <button
                    onClick={copyToClipboard}
                    className="text-sm bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md"
                  >
                    Copy Address
                  </button>

                  <ExportWalletButton />
                </div>
              </div>
            )}



            <div className="mt-12 flex gap-4 flex-wrap">
              {/* Send Solana Test Transaction Button */}
              <button
                disabled={!solanaWallet || loading}
                onClick={handleSendTransaction}
                className="text-sm bg-violet-600 hover:bg-violet-700 py-2 px-4 rounded-md text-white border-none"
              >
                {loading ? "Sending Transaction..." : "Send Test Transaction (0.01 SOL)"}
              </button>

              {/* Create Solana Wallet Button */}
              <button
                disabled={loading || !authenticated || !!solanaWallet}
                onClick={handleCreateSolanaWallet}
                className="text-sm bg-green-600 hover:bg-green-700 py-2 px-4 rounded-md text-white"
              >
                {solanaWallet ? "Solana Wallet Created" : "Create Solana Wallet"}
              </button>

              {/* Refresh User Object Button */}
              <button
                onClick={() => setRefreshTrigger((prev) => prev + 1)}
                className="text-sm bg-gray-600 hover:bg-gray-700 py-2 px-4 rounded-md text-white"
              >
                Refresh User Object
              </button>

              {/* Transaction Result */}
              {transactionResult && (
                <div className="mt-6 w-full">
                  <h2 className="text-sm font-semibold">Transaction Result</h2>
                  <pre className="max-w-4xl bg-slate-700 text-slate-50 font-mono p-4 text-xs sm:text-sm rounded-md mt-2">
                    {transactionResult}
                  </pre>
                </div>
              )}
            </div>

            <p className="mt-6 font-bold uppercase text-sm text-gray-600">
              User object
            </p>
            <pre className="max-w-4xl bg-slate-700 text-slate-50 font-mono p-4 text-xs sm:text-sm rounded-md mt-2">
              {JSON.stringify(user, null, 2)}
            </pre>

            {solanaWallet && (
            <div className="mt-6 w-full">
              <h2 className="text-sm font-semibold">Solana Wallet Information</h2>
              <pre className="max-w-4xl bg-slate-700 text-slate-50 font-mono p-4 text-xs sm:text-sm rounded-md mt-2">
                {JSON.stringify(solanaWallet, null, 2)}
              </pre>
            </div>
          )}

          </>
        ) : null}
      </main>
    </>
  );
}
