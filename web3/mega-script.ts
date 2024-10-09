import * as anchor from "@project-serum/anchor";
import { Program, Wallet } from "@project-serum/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

import fs from "fs";
import crypto from "crypto";
import { WagerGame } from "../target/types/wager_game"; // Import the generated types

async function main() {
  console.log("=== Starting the Mega Script ===\n");

  // === 1. Setup Connection and Provider ===
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  console.log("Connected to Solana Devnet.\n");

  // === 2. Load Keypairs ===

  // Deployer Keypair
  const deployerKeypairPath = "./.config/solana/id.json"; // Update this path if needed
  const deployerKeypairData = JSON.parse(fs.readFileSync(deployerKeypairPath, "utf-8"));
  const deployerKeypair = Keypair.fromSecretKey(new Uint8Array(deployerKeypairData));
  const deployerPublicKey = deployerKeypair.publicKey;
  console.log("Deployer Public Key:", deployerPublicKey.toBase58());

  // Admin Keypair
  const adminKeypairPath = "./wager_game/deployer.json"; // Update this path
  const adminKeypairData = JSON.parse(fs.readFileSync(adminKeypairPath, "utf-8"));
  const adminKeypair = Keypair.fromSecretKey(new Uint8Array(adminKeypairData));
  const adminPublicKey = adminKeypair.publicKey;
  console.log("Admin Public Key:", adminPublicKey.toBase58());

  // Player1 Keypair
  const player1KeypairPath = "./wager_game/player1.json"; // Update this path
  const player1KeypairData = JSON.parse(fs.readFileSync(player1KeypairPath, "utf-8"));
  const player1Keypair = Keypair.fromSecretKey(new Uint8Array(player1KeypairData));
  const player1PublicKey = player1Keypair.publicKey;
  console.log("Player1 Public Key:", player1PublicKey.toBase58());

  // Player2 Keypair
  const player2KeypairPath = "./wager_game/player2.json"; // Update this path
  const player2KeypairData = JSON.parse(fs.readFileSync(player2KeypairPath, "utf-8"));
  const player2Keypair = Keypair.fromSecretKey(new Uint8Array(player2KeypairData));
  const player2PublicKey = player2Keypair.publicKey;
  console.log("Player2 Public Key:", player2PublicKey.toBase58());

  console.log("\n=== Loaded All Keypairs Successfully ===\n");

  // === 3. Define Program and Relevant Addresses ===
  const programId = new PublicKey("FcLJQfVzwpnCcsbRw5CH7mRufx1LY5zNnEFqnV9CzmCs");
  console.log("Program ID:", programId.toBase58());

  const usdcMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
  console.log("USDC Mint Address:", usdcMint.toBase58());

  // Fee Accounts
  const suaveFeePublicKey = new PublicKey("4mJ1A9cVwjhxanEJZNQxHXaWXTrUMxYaekRxB5nqYYGQ");
  const gameBytesFeePublicKey = new PublicKey("F4h8qZaKcchipKcf6s1EMfx8mEd9KCrLj1XqQr8dhU6v");
  console.log("Suave Fee Public Key:", suaveFeePublicKey.toBase58());
  console.log("GameBytes Fee Public Key:", gameBytesFeePublicKey.toBase58());

  console.log("\n=== All Relevant Public Keys Defined ===\n");

  // === 4. Get Players' USDC Token Accounts ===
  console.log("\n--- Getting Players' USDC Token Accounts ---\n");

  // Get Player1's USDC token account
  const player1TokenAccount = await getAssociatedTokenAddress(usdcMint, player1PublicKey);

  // Get Player2's USDC token account
  const player2TokenAccount = await getAssociatedTokenAddress(usdcMint, player2PublicKey);

  console.log("Player1's USDC Token Account:", player1TokenAccount.toBase58());
  console.log("Player2's USDC Token Account:", player2TokenAccount.toBase58());

  // === 5. Initialize the Program ===
  const idlPath = "/Users/stevenbenmoha/IdeaProjects/wager_game/target/idl/wager_game.json"; // Update if needed
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  const provider = new anchor.AnchorProvider(connection, new Wallet(deployerKeypair), {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);
  const program = new anchor.Program<WagerGame>(idl, programId, provider); // Use the correct type

  // === 6. Setup Config Account ===
  const [configPDA, configBump] = await PublicKey.findProgramAddress(
    [Buffer.from("config")],
    programId
  );
  console.log("Config PDA:", configPDA.toBase58());

  // Check if Config Account exists
  const configAccountInfo = await connection.getAccountInfo(configPDA);
  if (configAccountInfo) {
    console.log("Config account already exists.");

    // Fetch and log the config data
    const configAccount = await program.account.config.fetch(configPDA);

    console.log("Admin Public Key in Config:", configAccount.admin.toBase58());
    console.log("Contract Fee Token Account:", configAccount.contractFeeAccount.toBase58());
    console.log(
      "Game Developer Fee Token Account:",
      configAccount.gameDeveloperFeeAccount.toBase58()
    );

    // Ensure the admin keypair corresponds to the admin public key in config
    if (!adminPublicKey.equals(configAccount.admin)) {
      console.error(
        "Admin keypair does not match the admin public key stored in the config account."
      );
      return;
    }
  } else {
    console.log("Config account does not exist. Initializing...");

    // Create associated token accounts for fee accounts
    async function createAssociatedTokenAccountForPublicKey(
      ownerPublicKey: PublicKey
    ): Promise<PublicKey> {
      const associatedTokenAccount = await getAssociatedTokenAddress(usdcMint, ownerPublicKey);

      const accountInfo = await connection.getAccountInfo(associatedTokenAccount);

      if (accountInfo === null) {
        // Create the associated token account
        const tx = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            deployerPublicKey,
            associatedTokenAccount,
            ownerPublicKey,
            usdcMint
          )
        );

        await sendAndConfirmTransaction(connection, tx, [deployerKeypair]);
        console.log(
          `Created associated token account for ${ownerPublicKey.toBase58()}: ${associatedTokenAccount.toBase58()}`
        );
      } else {
        console.log(
          `Associated token account already exists for ${ownerPublicKey.toBase58()}: ${associatedTokenAccount.toBase58()}`
        );
      }

      return associatedTokenAccount;
    }

    // Create associated token accounts for fee accounts
    const suaveFeeTokenAccount = await createAssociatedTokenAccountForPublicKey(suaveFeePublicKey);
    const gameBytesFeeTokenAccount = await createAssociatedTokenAccountForPublicKey(
      gameBytesFeePublicKey
    );

    console.log("Suave Fee Token Account:", suaveFeeTokenAccount.toBase58());
    console.log("GameBytes Fee Token Account:", gameBytesFeeTokenAccount.toBase58());

    // Initialize the config account
    try {
      const txSignature = await program.methods
        .initialize(
          adminPublicKey, // Admin public key
          suaveFeeTokenAccount, // Contract fee account
          gameBytesFeeTokenAccount // Game developer fee account
        )
        .accounts({
          payer: deployerPublicKey,
          config: configPDA,
          systemProgram: SystemProgram.programId,
        })
        .signers([deployerKeypair]) // Deployer needs to sign the transaction
        .rpc();

      console.log("Config account initialized successfully with signature:", txSignature);
    } catch (error) {
      console.error("Failed to initialize config account:", error);
      return;
    }
  }

  console.log("\n=== Config Account Setup Completed ===\n");

  // === 7. Fetch Initial Player USDC Balances ===
  console.log("\n--- Fetching Initial Player USDC Balances ---\n");

  try {
    const player1TokenAccountInfo = await connection.getTokenAccountBalance(player1TokenAccount);
    const player2TokenAccountInfo = await connection.getTokenAccountBalance(player2TokenAccount);

    console.log(
      `Player1 USDC Balance Before Game: ${player1TokenAccountInfo.value.uiAmountString}`
    );
    console.log(
      `Player2 USDC Balance Before Game: ${player2TokenAccountInfo.value.uiAmountString}`
    );
  } catch (error) {
    console.error("Failed to fetch initial player token account balances:", error);
  }

  // === 8. Prepare Game Variables ===
  const gameIdStr = "my_unique_game_id2"; // Replace with your game ID
  const gameIdHash = crypto.createHash("sha256").update(gameIdStr).digest(); // 32-byte Buffer
  console.log(`Game ID: ${gameIdStr}`);
  console.log(`Game ID Hash (hex): ${gameIdHash.toString("hex")}`);

  const wagerAmount = 1_000_000; // 1 USDC (USDC has 6 decimals)
  console.log(`Wager Amount: ${wagerAmount} (in smallest units of USDC)`);

  // Compute PDAs for Game Account and Escrow Token Account
  const [gameAccountPDA, gameAccountBump] = await PublicKey.findProgramAddress(
    [gameIdHash],
    programId
  );
  console.log("Game Account PDA:", gameAccountPDA.toBase58());
  console.log("Game Account Bump:", gameAccountBump);

  const [escrowTokenAccountPDA, escrowBump] = await PublicKey.findProgramAddress(
    [Buffer.from("escrow"), gameIdHash],
    programId
  );
  console.log("Escrow Token Account PDA:", escrowTokenAccountPDA.toBase58());
  console.log("Escrow Bump:", escrowBump);

  console.log("\n=== Game Variables Prepared ===\n");

  // === 9. Fetch Existing Game Account (if any) ===
  let gameAccountData = null;
  try {
    gameAccountData = await program.account.gameAccount.fetch(gameAccountPDA);
    console.log("Existing Game Account found.");
    console.log("Game State:", gameAccountData.state);
  } catch (error) {
    console.log("No existing Game Account found. It will be created during the first deposit.");
  }

  // === 10. Player1 Deposit ===
  console.log("\n--- Player1 Deposit ---\n");

  // Check if Player1 has already deposited
  let player1HasDeposited = false;
  if (gameAccountData && gameAccountData.player1) {
    if (gameAccountData.player1.pubkey.equals(player1PublicKey)) {
      console.log("Player1 has already deposited.");
      player1HasDeposited = true;
    } else {
      console.error("Player1 in game account does not match the provided player1 public key.");
      return;
    }
  }

  if (!player1HasDeposited) {
    // Create associated token account for Player1 if it doesn't exist
    const player1TokenAccountInfo = await connection.getAccountInfo(player1TokenAccount);

    if (!player1TokenAccountInfo) {
      const tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          player1PublicKey,
          player1TokenAccount,
          player1PublicKey,
          usdcMint
        )
      );
      await sendAndConfirmTransaction(connection, tx, [player1Keypair]);
      console.log(
        `Created associated token account for Player1: ${player1TokenAccount.toBase58()}`
      );
    } else {
      console.log(
        `Player1's associated token account already exists: ${player1TokenAccount.toBase58()}`
      );
    }

    console.log("Attempting Player1 deposit...");
    // Player1 Deposit
    try {
      const gameIdArray = Array.from(gameIdHash); // Convert Buffer to number[]
      const txSignature = await program.methods
        .player1Deposit(gameIdArray, new anchor.BN(wagerAmount)) // Use gameIdArray instead of gameIdHash
        .accounts({
          player1: player1PublicKey,
          gameAccount: gameAccountPDA,
          escrowTokenAccount: escrowTokenAccountPDA,
          player1TokenAccount: player1TokenAccount,
          usdcMint: usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([player1Keypair])
        .rpc();

      console.log("Player1 deposited successfully with signature:", txSignature);
    } catch (error) {
      console.error("Player1 deposit failed:", error);
      return;
    }
  } else {
    console.log("Skipping Player1 deposit as they have already deposited.");
  }

  console.log("\n=== Player1 Deposit Completed ===\n");

  // Refresh gameAccountData
  try {
    gameAccountData = await program.account.gameAccount.fetch(gameAccountPDA);
  } catch (error) {
    console.error("Failed to fetch game account after Player1 deposit:", error);
    return;
  }

  // === 11. Player2 Deposit ===
  console.log("\n--- Player2 Deposit ---\n");

  // Check if Player2 has already deposited
  let player2HasDeposited = false;
  if (gameAccountData && gameAccountData.player2) {
    if (gameAccountData.player2.pubkey.equals(player2PublicKey)) {
      console.log("Player2 has already deposited.");
      player2HasDeposited = true;
    } else {
      console.error("Player2 in game account does not match the provided player2 public key.");
      return;
    }
  }

  if (!player2HasDeposited) {
    // Create associated token account for Player2 if it doesn't exist
    const player2TokenAccountInfo = await connection.getAccountInfo(player2TokenAccount);

    if (!player2TokenAccountInfo) {
      const tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          player2PublicKey,
          player2TokenAccount,
          player2PublicKey,
          usdcMint
        )
      );
      await sendAndConfirmTransaction(connection, tx, [player2Keypair]);
      console.log(
        `Created associated token account for Player2: ${player2TokenAccount.toBase58()}`
      );
    } else {
      console.log(
        `Player2's associated token account already exists: ${player2TokenAccount.toBase58()}`
      );
    }

    console.log("Attempting Player2 deposit...");
    // Player2 Deposit
    try {
      const gameIdArray = Array.from(gameIdHash); // Convert Buffer to number[]
      const txSignature = await program.methods
        .player2Deposit(gameIdArray, new anchor.BN(wagerAmount)) // Use gameIdArray instead of gameIdHash
        .accounts({
          player2: player2PublicKey,
          gameAccount: gameAccountPDA,
          escrowTokenAccount: escrowTokenAccountPDA,
          player2TokenAccount: player2TokenAccount,
          usdcMint: usdcMint,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([player2Keypair])
        .rpc();

      console.log("Player2 deposited successfully with signature:", txSignature);
    } catch (error) {
      console.error("Player2 deposit failed:", error);
      return;
    }
  } else {
    console.log("Skipping Player2 deposit as they have already deposited.");
  }

  console.log("\n=== Player2 Deposit Completed ===\n");

  // Refresh gameAccountData
  try {
    gameAccountData = await program.account.gameAccount.fetch(gameAccountPDA);
    console.log("Current Game State:", gameAccountData.state);
  } catch (error) {
    console.error("Failed to fetch game account after Player2 deposit:", error);
    return;
  }

  // === 12. Finalize Game ===
  console.log("\n--- Finalize Game ---\n");

  // Fetch fee token accounts from config
  const configAccountFinal = await program.account.config.fetch(configPDA);

  const contractFeeTokenAccount = configAccountFinal.contractFeeAccount;
  const gameDeveloperFeeTokenAccount = configAccountFinal.gameDeveloperFeeAccount;

  console.log("Contract Fee Token Account:", contractFeeTokenAccount.toBase58());
  console.log("Game Developer Fee Token Account:", gameDeveloperFeeTokenAccount.toBase58());

  // Ensure player1 and player2 are present
  if (!gameAccountData.player1 || !gameAccountData.player2) {
    console.error("Both players have not deposited yet.");
    return;
  }

  // Ensure the game is ready for finalization
  if ("readyForFinalization" in gameAccountData.state) {
    console.log("Game is ready for finalization. Proceeding...");
  } else {
    console.error("Game is not ready for finalization. Current state:", gameAccountData.state);
    return;
  }

  // Get player token accounts from game account data
  const player1TokenAccountPubkey = gameAccountData.player1.tokenAccount;
  const player2TokenAccountPubkey = gameAccountData.player2.tokenAccount;

  console.log("Player1 Token Account:", player1TokenAccountPubkey.toBase58());
  console.log("Player2 Token Account:", player2TokenAccountPubkey.toBase58());

  // Assuming winner is player1
  const winner = 0; // 0 for player1, 1 for player2
  console.log(`Winner is Player${winner + 1}`);

  console.log("Attempting to finalize the game...");
  // Call finalize_game via program.methods
  try {
    const gameIdArray = Array.from(gameIdHash); // Convert Buffer to number array

    // Proceed to finalize the game
    const txSignature = await program.methods
      .finalizeGame(gameIdArray, winner)
      .accounts({
        admin: adminPublicKey,
        config: configPDA,
        gameAccount: gameAccountPDA,
        player1TokenAccount: player1TokenAccountPubkey,
        player2TokenAccount: player2TokenAccountPubkey,
        escrowTokenAccount: escrowTokenAccountPDA,
        contractFeeAccount: contractFeeTokenAccount,
        gameDeveloperFeeAccount: gameDeveloperFeeTokenAccount,
        usdcMint: usdcMint, // Include usdcMint in accounts
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([adminKeypair])
      .rpc();

    console.log("Game finalized successfully with signature:", txSignature);
  } catch (error) {
    console.error("Game finalization failed:", error);

    // Optionally, simulate the transaction for detailed logs
    if ("logs" in error) {
      console.error("Transaction logs:", error.logs);
    }

    return;
  }

  console.log("\n=== Game Finalization Completed ===\n");

  // === 13. Fetch and Log Final Game Account Data ===
  console.log("Fetching updated game account data...");

  try {
    const updatedGameAccount = await program.account.gameAccount.fetch(gameAccountPDA);
    console.log("Updated Game State:", updatedGameAccount.state);
    console.log("Game Account Data:", updatedGameAccount);
  } catch (error) {
    console.error("Failed to fetch updated game account data:", error);
  }

  // === 14. Check Players' USDC Balances After Game ===
  console.log("\n--- Checking Players' USDC Balances After Game ---\n");

  try {
    const player1TokenAccountInfoAfter = await connection.getTokenAccountBalance(
      player1TokenAccount
    );
    const player2TokenAccountInfoAfter = await connection.getTokenAccountBalance(
      player2TokenAccount
    );

    console.log(
      `Player1 USDC Balance After Game: ${player1TokenAccountInfoAfter.value.uiAmountString}`
    );
    console.log(
      `Player2 USDC Balance After Game: ${player2TokenAccountInfoAfter.value.uiAmountString}`
    );
  } catch (error) {
    console.error("Failed to fetch player token account balances after game:", error);
  }

  console.log("\n=== Mega Script Completed Successfully ===");
}

main()
  .then(() => {
    console.log("\nScript executed successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error executing script:", err);
    process.exit(1);
  });