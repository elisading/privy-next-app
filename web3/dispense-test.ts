import * as anchor from '@project-serum/anchor';
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
//   SystemProgram,
//   SYSVAR_RENT_PUBKEY,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
//   getAssociatedTokenAddress,
//   AccountLayout,
//   u64,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as crypto from 'crypto';
// import bs58 from 'bs58';

async function main() {
  console.log('=== Starting the Game Finalization Script ===\n');

  // === 1. Load Admin's Keypair ===
  const adminKeypairPath = "/Users/elisading/Desktop/fadmania/gamebytes-cloud-functions/functions/src/gamebets/admin.json"; // Update this path
  const adminKeypairData = JSON.parse(fs.readFileSync(adminKeypairPath, "utf-8"));
  const adminKeypair = Keypair.fromSecretKey(new Uint8Array(adminKeypairData));
  const adminPublicKey = adminKeypair.publicKey;
  console.log("Admin Public Key:", adminPublicKey.toBase58());

  // === 2. Establish a Connection to the Solana Cluster ===
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  console.log('Connected to Solana Devnet.');

  // === 3. Define Program and Relevant Addresses ===
  // const programId = new PublicKey('9c4ZzoaLZGLTVeV7wh77xJriB3bpPs6woxagFsc8dGtx');
  const programId = new PublicKey('7HFBvvE6nBnasydt1pEXBdRjmrJ7qSn2ZpreGfNQ9KUS');
  console.log('Program ID:', programId.toBase58());

  const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
  console.log('USDC Mint Address:', usdcMint.toBase58());

  // === 4. Define the Game ID and Winner ===
  const gameId = 'game-id-test-10104'; // Replace with your game ID
  const winner = 0; // 0 for player1, 1 for player2

  console.log(`Game ID: ${gameId}`);
  console.log(`Winner: Player${winner + 1}`);

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

  // === 6. Fetch Config Account to Get Fee Accounts ===
  const [configPDA] = await PublicKey.findProgramAddress(
    [Buffer.from('config')],
    programId
  );
  console.log('Config PDA:', configPDA.toBase58());

  // Fetch the Config Account to get fee account addresses
  const configAccountInfo = await connection.getAccountInfo(configPDA);
  if (!configAccountInfo) {
    console.error('Config account not found. Ensure the contract is initialized.');
    return;
  }

  // Decode the Config Account Data
  const idl = JSON.parse(
    fs.readFileSync('/Users/elisading/Desktop/fadmania/gamebytes-cloud-functions/functions/src/gamebets/wager_game_idl.json', 'utf8') // Update this path
  );
  const coder = new anchor.BorshAccountsCoder(idl);
  const configAccount = coder.decode('Config', configAccountInfo.data);

  const contractFeeAccount = new PublicKey(configAccount.contractFeeAccount);
  const gameDeveloperFeeAccount = new PublicKey(configAccount.gameDeveloperFeeAccount);

  console.log('Contract Fee Account:', contractFeeAccount.toBase58());
  console.log('Game Developer Fee Account:', gameDeveloperFeeAccount.toBase58());

  // === 7. Fetch Game Account to Get Player Token Accounts ===
  const gameAccountInfo = await connection.getAccountInfo(gameAccountPDA);
  if (!gameAccountInfo) {
    console.error('Game account not found. Ensure the game has been created.');
    return;
  }

  const gameAccount = coder.decode('GameAccount', gameAccountInfo.data);

  if (!gameAccount.player1 || !gameAccount.player2) {
    console.error('Both players have not deposited yet.');
    return;
  }

  const player1PublicKey = new PublicKey(gameAccount.player1.pubkey);
  const player2PublicKey = new PublicKey(gameAccount.player2.pubkey);

  const player1TokenAccount = new PublicKey(gameAccount.player1.tokenAccount);
  const player2TokenAccount = new PublicKey(gameAccount.player2.tokenAccount);

  console.log('Player1 Public Key:', player1PublicKey.toBase58());
  console.log('Player1 Token Account:', player1TokenAccount.toBase58());

  console.log('Player2 Public Key:', player2PublicKey.toBase58());
  console.log('Player2 Token Account:', player2TokenAccount.toBase58());

  // === 8. Prepare Instruction Data for finalize_game ===
  console.log('Preparing instruction data for finalize_game...');

  // Calculate the discriminator for 'finalize_game' instruction
  const methodName = 'global:finalize_game';
  const discriminator = crypto.createHash('sha256').update(methodName).digest().slice(0, 8);

  // Serialize the game ID and winner
  const gameIdBuffer = Buffer.from(gameId, 'utf8');
  const gameIdLengthBuffer = Buffer.alloc(4);
  gameIdLengthBuffer.writeUInt32LE(gameIdBuffer.length, 0);

  const winnerBuffer = Buffer.alloc(1);
  winnerBuffer.writeUInt8(winner, 0);

  const instructionData = Buffer.concat([
    discriminator,
    gameIdLengthBuffer,
    gameIdBuffer,
    winnerBuffer,
  ]);

  console.log('Instruction data prepared.');

  // === 9. Prepare the List of Accounts Required by the Instruction ===
  const accounts = [
    { pubkey: adminPublicKey, isSigner: true, isWritable: false },
    { pubkey: configPDA, isSigner: false, isWritable: false },
    { pubkey: gameAccountPDA, isSigner: false, isWritable: true },
    { pubkey: player1TokenAccount, isSigner: false, isWritable: true },
    { pubkey: player2TokenAccount, isSigner: false, isWritable: true },
    { pubkey: escrowTokenAccountPDA, isSigner: false, isWritable: true },
    { pubkey: contractFeeAccount, isSigner: false, isWritable: true },
    { pubkey: gameDeveloperFeeAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  console.log('Accounts prepared for the transaction.');

  // === 10. Create the Transaction Instruction ===
  const instruction = new anchor.web3.TransactionInstruction({
    keys: accounts,
    programId,
    data: instructionData,
  });

  console.log('Transaction instruction created.');

  // === 11. Send the Transaction ===
  console.log('Sending the transaction to the network...');
  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [adminKeypair]);
    console.log('Transaction successful with signature:', signature);
  } catch (error) {
    console.error('Transaction failed:', error);
    if (error.logs) {
      console.error('Transaction logs:', error.logs);
    }
  }

  // === 12. Fetch and Log Game Account Data ===
  console.log('Fetching updated game account data...');

  const updatedGameAccountInfo = await connection.getAccountInfo(gameAccountPDA);
  if (updatedGameAccountInfo) {
    const updatedGameAccount = coder.decode('GameAccount', updatedGameAccountInfo.data);

    console.log('Updated Game State:', updatedGameAccount.state);
  } else {
    console.error('Failed to fetch updated game account data.');
  }

  console.log('\n=== Game Finalization Script Completed ===');
}

/*
  To change the winner, modify the 'winner' variable:
    - Set winner = 0 for player1
    - Set winner = 1 for player2

  Ensure that the admin keypair provided has the authority to finalize the game.

  The script assumes that the config account has been initialized and that both players have deposited.
*/

main()
  .then(() => {
    console.log('Script executed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error executing script:', err);
    process.exit(1);
  });