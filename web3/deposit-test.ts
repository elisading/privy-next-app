import {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    sendAndConfirmTransaction,
  } from '@solana/web3.js';
  import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
  } from '@solana/spl-token';
  import * as fs from 'fs';
  import * as crypto from 'crypto';
  
  async function main() {
    console.log('=== Starting the Game Creation Script ===\n');
  
    // === 1. Load Player's Keypair ===

  const playerKeypairPath = "./wager_game/player1.json"; // Update this path
  const playerKeypairData = JSON.parse(fs.readFileSync(playerKeypairPath, "utf-8"));
  const playerKeypair = Keypair.fromSecretKey(new Uint8Array(playerKeypairData));
  const playerPublicKey = playerKeypair.publicKey;
  
    console.log('Player Public Key:', playerPublicKey.toBase58());
  
    // === 2. Establish a Connection to the Solana Cluster ===
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    console.log('Connected to Solana Devnet.');
  
    // === 3. Define Program and Relevant Addresses ===
    const programId = new PublicKey('7HFBvvE6nBnasydt1pEXBdRjmrJ7qSn2ZpreGfNQ9KUS');
    console.log('Program ID:', programId.toBase58());
  
    const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
    console.log('USDC Mint Address:', usdcMint.toBase58());
  
    // === 4. Define the Game ID and Wager Amount ===
    const gameId = 'game-id-test-10104'; // Replace with your game ID
    const wagerAmount = 1_000_000; // 1 USDC (USDC has 6 decimals)
  
    console.log("Game ID: ", gameId);
    console.log("Wager Amount:", wagerAmount);
  
    // === 5. Compute PDAs for Game Account and Escrow Token Account ===
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
  
    // === 6. Ensure Player's USDC Token Account Exists ===
    const playerTokenAccount = await getAssociatedTokenAddress(usdcMint, playerPublicKey);
  
    const playerTokenAccountInfo = await connection.getAccountInfo(playerTokenAccount);
    if (!playerTokenAccountInfo) {
      console.log('Player USDC Token Account does not exist. Creating one...');
      const ataTransaction = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          playerPublicKey,
          playerTokenAccount,
          playerPublicKey,
          usdcMint
        )
      );
      await sendAndConfirmTransaction(connection, ataTransaction, [playerKeypair]);
      console.log('Player USDC Token Account created:', playerTokenAccount.toBase58());
    } else {
      console.log('Player USDC Token Account exists:', playerTokenAccount.toBase58());
    }
  
    // === 7. Check Player's USDC Balance ===
    const tokenAccountBalance = await connection.getTokenAccountBalance(playerTokenAccount);
    console.log("Player's USDC Balance:", tokenAccountBalance.value.uiAmount);
  
    if (
      tokenAccountBalance.value.amount === '0' ||
      parseInt(tokenAccountBalance.value.amount) < wagerAmount
    ) {
      console.error('Insufficient USDC balance to place the wager.');
      return;
    }
  
    // === 8. Prepare Instruction Data for player1_deposit ===
    console.log('Preparing instruction data for player deposit...');
  
    // Calculate the discriminator for 'player1_deposit' instruction
    // const methodName = 'global:player1_deposit';
    const methodName = 'global:player2_deposit';
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
  
    console.log('Instruction data prepared.');
  
    // === 9. Prepare the List of Accounts Required by the Instruction ===
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
  
    console.log('Accounts prepared for the transaction.');
  
    // === 10. Create the Transaction Instruction ===
    const instruction = new TransactionInstruction({
      keys: accounts,
      programId,
      data: instructionData,
    });
  
    console.log('Transaction instruction created.');
  
    // === 11. Send the Transaction ===
    console.log('Sending the transaction to the network...');
    const transaction = new Transaction().add(instruction);

  
    try {
      const signature = await sendAndConfirmTransaction(connection, transaction, [playerKeypair]);
      console.log('Transaction successful with signature:', signature);
    } catch (error) {
      console.error('Transaction failed:', error);
      return;
    }
  
    // === 12. Fetch and Log Game Account Data ===
    console.log('Fetching game account data...');
  
    const gameAccountInfo = await connection.getAccountInfo(gameAccountPDA);
    if (gameAccountInfo) {
      const gameAccountData = gameAccountInfo.data;
  
      // Since we're not using Anchor, we'll log the raw data
      console.log('Game Account Raw Data:', gameAccountData.toString('hex'));
  
      // Decoding the account data without Anchor requires custom deserialization using Borsh
      // For minimal changes, we'll leave it as logging the raw data
    } else {
      console.error('Failed to fetch game account data.');
    }
  
    console.log('\n=== Game Creation Script Completed ===');
  }
  
  main()
    .then(() => {
      console.log('Script executed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error executing script:', err);
      process.exit(1);
    });
