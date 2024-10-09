"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv = require("dotenv");
var web3_js_1 = require("@solana/web3.js");
var anchor_1 = require("@project-serum/anchor");
var spl_token_1 = require("@solana/spl-token");
// import Long from 'long';
var bn_js_1 = require("bn.js");
// import fs from 'fs';
// import bs58 from 'bs58';
// import idl from './wager_game_idl.json'; 
dotenv.config();
var programId = new web3_js_1.PublicKey('7HFBvvE6nBnasydt1pEXBdRjmrJ7qSn2ZpreGfNQ9KUS');
var connection = new web3_js_1.Connection('<https://api.devnet.solana.com>', 'confirmed');
// const USDC_MINT_ADDRESS = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
// const CONFIG_SEEDS = [Buffer.from("config")];
// const ESCROW_SEEDS_PREFIX = Buffer.from("escrow");
// async function derivePDA(seeds: Buffer[]): Promise<{ pda: PublicKey; bump: number }> {
//     const [pda, bump] = await PublicKey.findProgramAddress(seeds, programId);
//     return { pda, bump };
// }
// const u64Value = Long.fromNumber(1000000, true);
var adminSecretKey = JSON.parse(process.env.GAMEBYTES_ADMIN_PRIVATE_KEY);
var adminKeypair = web3_js_1.Keypair.fromSecretKey(Uint8Array.from(adminSecretKey));
var usdcMintAddress = new web3_js_1.PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
var player1PublicKey = new web3_js_1.PublicKey(process.env.PLAYER1_PUBLIC_KEY);
var wallet = new anchor_1.Wallet(adminKeypair);
console.log('Initializing...');
var provider = new anchor_1.AnchorProvider(connection, wallet, {
    preflightCommitment: 'confirmed',
});
var idl = await anchor_1.Program.fetchIdl(programId, provider); // Fetch IDL for Suave's contract
console.log('IDL fetched:', idl);
var program = new anchor_1.Program(idl, programId, provider);
// const gameId = 'my_game_id';
console.log('Deriving PDAs...');
var gameAccountPDA = (await web3_js_1.PublicKey.findProgramAddress([Buffer.from('my_game_id')], programId))[0];
var escrowTokenAccountPDA = (await web3_js_1.PublicKey.findProgramAddress([Buffer.from('escrow'), Buffer.from('my_game_id')], programId))[0];
console.log('PDAs derived:', gameAccountPDA, escrowTokenAccountPDA);
var player1TokenAccount = await (0, spl_token_1.getAssociatedTokenAddress)(usdcMintAddress, player1PublicKey);
console.log("player1TokenAccount", player1TokenAccount);
try {
    var txSignature = await program.methods
        .player1Deposit('my_game_id', new bn_js_1.default(1000000)) // Game ID and wager amount (1 USDC with 6 decimals)
        .accounts({
        player1: player1PublicKey, // Player1's public key (wallet address)
        gameAccount: gameAccountPDA, // PDA for the game account
        escrowTokenAccount: escrowTokenAccountPDA, // PDA for the escrow account
        player1TokenAccount: player1TokenAccount, // Player1's USDC token account
        usdcMint: usdcMintAddress, // USDC Mint address
        tokenProgram: spl_token_1.TOKEN_PROGRAM_ID, // Solana's token program ID
        systemProgram: anchor_1.web3.SystemProgram.programId, // System Program
        rent: anchor_1.web3.SYSVAR_RENT_PUBKEY, // Rent Sysvar
    })
        .rpc();
    console.log('Transaction signature:', txSignature);
    console.log('Deposit completed successfully.');
}
catch (error) {
    console.error('Error during deposit:', error);
}
