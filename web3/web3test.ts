import * as dotenv from 'dotenv';
import * as anchor from '@project-serum/anchor';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@project-serum/anchor';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
// import BN from 'bn.js';
import bs58 from 'bs58';
import * as  fs from "fs";
import * as crypto from "crypto";

dotenv.config();

(async () => {
  const programId = new PublicKey('9c4ZzoaLZGLTVeV7wh77xJriB3bpPs6woxagFsc8dGtx');
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

  const adminKeypairPath = "/Users/stevenbenmoha/IdeaProjects/wager_game/deployer.json"; // Update this path
  const adminKeypairData = JSON.parse(fs.readFileSync(adminKeypairPath, "utf-8"));
  const adminKeypair = Keypair.fromSecretKey(new Uint8Array(adminKeypairData));
  const adminPublicKey = adminKeypair.publicKey;
  console.log("Admin Public Key:", adminPublicKey.toBase58());

  // const adminSecretKey = bs58.decode(adminSecretKeyString);
  // const adminKeypair = Keypair.fromSecretKey(adminSecretKey);
  const usdcMintAddress = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
  const player1PublicKey = new PublicKey(process.env.PLAYER1_PUBLIC_KEY);
  const wallet = new Wallet(adminKeypair);

  console.log('Initializing...');
  const provider = new AnchorProvider(connection, wallet, {
    preflightCommitment: 'confirmed',
  });

  const idlPath = "/Users/elisading/Desktop/fadmania/gamebytes-cloud-functions/functions/src/gamebets/wager_game.json"; // Update if needed
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  console.log('IDL fetched:', idl);

  const program = new anchor.Program(idl, programId, provider);

  console.log('Deriving PDAs...');
  const [gameAccountPDA] = await PublicKey.findProgramAddress([Buffer.from('my_game_id')], programId);
  const [escrowTokenAccountPDA] = await PublicKey.findProgramAddress(
    [Buffer.from('escrow'), Buffer.from('my_game_id')],
    programId
  );
  const [configPDA] = await PublicKey.findProgramAddress(
    [Buffer.from("config")],
    programId
  );
  console.log("Config PDA:", configPDA.toBase58());
  console.log('PDAs derived:', gameAccountPDA.toString(), escrowTokenAccountPDA.toString());

  const player1TokenAccount = await getAssociatedTokenAddress(usdcMintAddress, player1PublicKey);
  console.log('player1TokenAccount:', player1TokenAccount.toString());


  const gameIdStr = "game-id-test-10101"; // Replace with your game ID
  const gameIdHash = crypto.createHash("sha256").update(gameIdStr).digest(); // 32-byte Buffer
  console.log(`Game ID: ${gameIdStr}`);
  console.log(`Game ID Hash (hex): ${gameIdHash.toString("hex")}`);

  console.log("\n--- Finalize Game ---\n");

  // Fetch fee token accounts from config
  const configAccountFinal = await program.account.config.fetch(configPDA);

  const contractFeeTokenAccount = configAccountFinal.contractFeeAccount;
  const gameDeveloperFeeTokenAccount = configAccountFinal.gameDeveloperFeeAccount;

  console.log("Contract Fee Token Account:", contractFeeTokenAccount.toBase58());
  console.log("Game Developer Fee Token Account:", gameDeveloperFeeTokenAccount.toBase58());

  // Ensure player1 and player2 are present
  // if (!gameAccountData.player1 || !gameAccountData.player2) {
  //   console.error("Both players have not deposited yet.");
  //   return;
  // }

  // // Ensure the game is ready for finalization
  // if ("readyForFinalization" in gameAccountData.state) {
  //   console.log("Game is ready for finalization. Proceeding...");
  // } else {
  //   console.error("Game is not ready for finalization. Current state:", gameAccountData.state);
  //   return;
  // }

  const gameAccountData = await program.account.gameAccount.fetch(gameAccountPDA);

  const player1TokenAccountPubkey = gameAccountData.player1.tokenAccount;
  const player2TokenAccountPubkey = gameAccountData.player2.tokenAccount;

  console.log("Player1 Token Account:", player1TokenAccountPubkey.toBase58());
  console.log("Player2 Token Account:", player2TokenAccountPubkey.toBase58());

  try {
    const gameIdArray = Array.from(gameIdHash); 
    const winner = 0;
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

    console.log('Transaction signature:', txSignature);
    console.log('Deposit completed successfully.');
  } catch (error) {
    console.error('Error during deposit:', error);
  }
})();
