import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import {  getAccessToken, usePrivy, useSolanaWallets, type WalletWithMetadata} from "@privy-io/react-auth";
import { clusterApiUrl, Connection, PublicKey, SystemProgram, Transaction, SYSVAR_RENT_PUBKEY, TransactionInstruction} from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as crypto from 'crypto';
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
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const usdcMintAddress = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'); 
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

  const solanaWalletRef = useRef(solanaWallet);
  useEffect(() => {
    solanaWalletRef.current = solanaWallet;
  }, [solanaWallet]);

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
    const { gameId, betAmount } = event.data;
    console.log( gameId, betAmount);
    console.log("inside event handler   ", solanaWalletRef.current);

    const instructionData = getInstructionData(gameId, betAmount);
    console.log("instructionData", instructionData);
    handlePlayerDeposit(instructionData, gameId);

      
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
          setSolBalance(balance / 1_000_000_000); // Convert lamports to SOL

          const usdcTokenAddress = await getAssociatedTokenAddress(usdcMintAddress, walletPublicKey);
          const usdcAccount = await getAccount(connection, usdcTokenAddress, "confirmed", TOKEN_PROGRAM_ID);
          const usdcBalance = Number(usdcAccount.amount) / 1e6;
          setUsdcBalance(usdcBalance);

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

  const sendUserEvent = (event: any) => {


    const win = window as any;

    if (win.parent.webkit && win.parent.webkit.messageHandlers && win.parent.webkit.messageHandlers.gameMessageHandle) {
      win.parent.webkit.messageHandlers.gameMessageHandle.postMessage(JSON.stringify(event));
      console.log('event posted')
  } else {

    console.log("failed to post", win)
  }

  }


  const getInstructionData = (gameId: string, wagerAmount: number) => {

  const methodName = 'global:player1_deposit';
  const discriminator = crypto.createHash('sha256').update(methodName).digest().slice(0, 8);

  // Serialize the game ID and wager amount
  const gameIdBuffer = Buffer.from(gameId, 'utf8');
  const gameIdLengthBuffer = Buffer.alloc(4);
  gameIdLengthBuffer.writeUInt32LE(gameIdBuffer.length, 0);

  const wagerAmountBuffer = Buffer.alloc(8);
  wagerAmountBuffer.writeBigUInt64LE(BigInt(wagerAmount), 0);

  const instructionData = Buffer.concat([
    discriminator,
    gameIdLengthBuffer,
    gameIdBuffer,
    wagerAmountBuffer,
  ]);
  console.log("instructionData", instructionData);
  return instructionData;
  };
  
  const handlePlayerDeposit = async (instructionData: Buffer, gameId: string) => {
    const playerWallet = solanaWalletRef.current;
    if (playerWallet) {
      const programId = new PublicKey('7HFBvvE6nBnasydt1pEXBdRjmrJ7qSn2ZpreGfNQ9KUS'); // deposit works 
      // const programId = new PublicKey('FcLJQfVzwpnCcsbRw5CH7mRufx1LY5zNnEFqnV9CzmCs');
      // const programId = new PublicKey('9c4ZzoaLZGLTVeV7wh77xJriB3bpPs6woxagFsc8dGtx');
      
      console.log('Program ID:', programId);
      const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
      const connection = new Connection(clusterApiUrl('devnet'));
      const playerPublicKey = new PublicKey(playerWallet.address);
      const [gameAccountPDA] = await PublicKey.findProgramAddress(
        [Buffer.from(gameId)],
        programId
      );
      console.log('Game Account PDA:', gameAccountPDA.toBase58());

      const [escrowTokenAccountPDA] = await PublicKey.findProgramAddress(
        [Buffer.from('escrow'), Buffer.from(gameId)],
        programId
      );
      console.log('Escrow Token Account PDA:', escrowTokenAccountPDA.toBase58());
      const playerTokenAccount = await getAssociatedTokenAddress(usdcMintAddress, playerPublicKey);

      const accounts = [
        { pubkey: playerPublicKey, isSigner: true, isWritable: true },
        { pubkey: gameAccountPDA, isSigner: false, isWritable: true },
        { pubkey: escrowTokenAccountPDA, isSigner: false, isWritable: true },
        { pubkey: playerTokenAccount, isSigner: false, isWritable: true },
        { pubkey: usdcMint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ];

      const instruction = new TransactionInstruction({
        keys: accounts,
        programId,
        data: instructionData,
      });
      console.log('Transaction instruction created.');


      const transaction = new Transaction().add(instruction);
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = playerPublicKey;
      console.log('Transaction object:', transaction);
      const signedTx = await playerWallet.signTransaction!(transaction);
      console.log('Transaction signed:', signedTx);
      const txHash = await connection.sendRawTransaction(signedTx.serialize());
      console.log("TX Hash:", txHash);

      sendUserEvent({ eventType: 'deposit', data: { tx: txHash } });
      setTransactionResult(txHash);
    } else {
      console.log('Failed to send transaction');
    }
  };

  // Handle sending a Solana transaction
  const handleSendTransaction = async () => {
    try {
      setLoading(true);

      const currentWallet = solanaWalletRef.current;

      if (currentWallet) {

      // Connection to the Solana Devnet
      const connection = new Connection(clusterApiUrl("devnet"));

      // Fetch the public key of the Solana wallet
      const walletPublicKey = new PublicKey(currentWallet.address);
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
      const txHash = await currentWallet?.sendTransaction!(transaction, connection);

      sendUserEvent({eventType: "deposit", data: {tx: txHash}});
      // Log and display the transaction result
      console.log("Transaction sent, hash:", txHash);


      setTransactionResult(txHash);
      } else {


        console.log("failed to send")

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
                    {solBalance !== null ? `${solBalance} SOL` : "Loading..."}
                  </p>
                </div>

                <div className="mt-4">
                  <p className="text-sm text-gray-600">USDC Balance:</p>
                  <p className="text-sm font-mono text-gray-900">
                    {usdcBalance !== null ? `${usdcBalance} USDC` : "Loading..."}
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
