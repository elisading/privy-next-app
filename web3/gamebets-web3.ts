import * as dotenv from 'dotenv';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, web3 } from '@project-serum/anchor';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
// import Long from 'long';
import BN from 'bn.js';
// import fs from 'fs';
// import bs58 from 'bs58';
// import idl from './wager_game_idl.json'; 


dotenv.config();
const programId = new PublicKey('7HFBvvE6nBnasydt1pEXBdRjmrJ7qSn2ZpreGfNQ9KUS');
const connection = new Connection('<https://api.devnet.solana.com>', 'confirmed');


// const USDC_MINT_ADDRESS = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
// const CONFIG_SEEDS = [Buffer.from("config")];
// const ESCROW_SEEDS_PREFIX = Buffer.from("escrow");
// async function derivePDA(seeds: Buffer[]): Promise<{ pda: PublicKey; bump: number }> {
//     const [pda, bump] = await PublicKey.findProgramAddress(seeds, programId);
//     return { pda, bump };
// }


// const u64Value = Long.fromNumber(1000000, true);

const adminSecretKey = JSON.parse(process.env.GAMEBYTES_ADMIN_PRIVATE_KEY);
const adminKeypair = Keypair.fromSecretKey(Uint8Array.from(adminSecretKey));
const usdcMintAddress = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'); 
const player1PublicKey = new PublicKey(process.env.PLAYER1_PUBLIC_KEY);
const wallet = new Wallet(adminKeypair);

console.log('Initializing...');
const provider = new AnchorProvider(connection, wallet, {
    preflightCommitment: 'confirmed',
  });

const idl = await Program.fetchIdl(programId, provider);  // Fetch IDL for Suave's contract
console.log('IDL fetched:', idl);
const program = new Program(idl, programId, provider);

// const gameId = 'my_game_id';
console.log('Deriving PDAs...');
const [gameAccountPDA] = await PublicKey.findProgramAddress([Buffer.from('my_game_id')], programId);
const [escrowTokenAccountPDA] = await PublicKey.findProgramAddress([Buffer.from('escrow'), Buffer.from('my_game_id')], programId);
console.log('PDAs derived:', gameAccountPDA, escrowTokenAccountPDA);

const player1TokenAccount = await getAssociatedTokenAddress(usdcMintAddress, player1PublicKey);

console.log("player1TokenAccount", player1TokenAccount);

try {
  const txSignature = await program.methods
    .player1Deposit('my_game_id', new BN(1000000))  // Game ID and wager amount (1 USDC with 6 decimals)
    .accounts({
      player1: player1PublicKey,  // Player1's public key (wallet address)
      gameAccount: gameAccountPDA,  // PDA for the game account
      escrowTokenAccount: escrowTokenAccountPDA,  // PDA for the escrow account
      player1TokenAccount: player1TokenAccount,  // Player1's USDC token account
      usdcMint: usdcMintAddress,  // USDC Mint address
      tokenProgram: TOKEN_PROGRAM_ID,  // Solana's token program ID
      systemProgram: web3.SystemProgram.programId,  // System Program
      rent: web3.SYSVAR_RENT_PUBKEY,  // Rent Sysvar
    })
    .rpc();

  console.log('Transaction signature:', txSignature);

  console.log('Deposit completed successfully.');
} catch (error) {
  console.error('Error during deposit:', error);
}

