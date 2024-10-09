"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
//   import fs from 'fs';
var crypto = require("crypto");
var bs58_1 = require("bs58");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var secretKey, playerKeypair, playerPublicKey, connection, programId, usdcMint, gameId, wagerAmount, gameAccountPDA, escrowTokenAccountPDA, playerTokenAccount, playerTokenAccountInfo, ataTransaction, tokenAccountBalance, methodName, discriminator, gameIdBuffer, gameIdLengthBuffer, wagerAmountBuffer, instructionData, accounts, instruction, transaction, signature, error_1, gameAccountInfo, gameAccountData;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('=== Starting the Game Creation Script ===\n');
                    secretKey = bs58_1.default.decode("5g5Q2Mvh2pvCnaWVeLe7BQCCYzxQcAuUToqPXmZLPx5Vw8tNUEj276fvWk2qs5f5nDfLKXbFfTemx5e7AAWuijMH");
                    playerKeypair = web3_js_1.Keypair.fromSecretKey(secretKey);
                    playerPublicKey = playerKeypair.publicKey;
                    console.log('Player Public Key:', playerPublicKey.toBase58());
                    connection = new web3_js_1.Connection('https://api.devnet.solana.com', 'confirmed');
                    console.log('Connected to Solana Devnet.');
                    programId = new web3_js_1.PublicKey('7HFBvvE6nBnasydt1pEXBdRjmrJ7qSn2ZpreGfNQ9KUS');
                    console.log('Program ID:', programId.toBase58());
                    usdcMint = new web3_js_1.PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
                    console.log('USDC Mint Address:', usdcMint.toBase58());
                    gameId = 'game-id-test-10104';
                    wagerAmount = 1000000;
                    console.log("Game ID: ", gameId);
                    console.log("Wager Amount:", wagerAmount);
                    return [4 /*yield*/, web3_js_1.PublicKey.findProgramAddress([Buffer.from(gameId)], programId)];
                case 1:
                    gameAccountPDA = (_a.sent())[0];
                    console.log('Game Account PDA:', gameAccountPDA.toBase58());
                    return [4 /*yield*/, web3_js_1.PublicKey.findProgramAddress([Buffer.from('escrow'), Buffer.from(gameId)], programId)];
                case 2:
                    escrowTokenAccountPDA = (_a.sent())[0];
                    console.log('Escrow Token Account PDA:', escrowTokenAccountPDA.toBase58());
                    return [4 /*yield*/, (0, spl_token_1.getAssociatedTokenAddress)(usdcMint, playerPublicKey)];
                case 3:
                    playerTokenAccount = _a.sent();
                    return [4 /*yield*/, connection.getAccountInfo(playerTokenAccount)];
                case 4:
                    playerTokenAccountInfo = _a.sent();
                    if (!!playerTokenAccountInfo) return [3 /*break*/, 6];
                    console.log('Player USDC Token Account does not exist. Creating one...');
                    ataTransaction = new web3_js_1.Transaction().add((0, spl_token_1.createAssociatedTokenAccountInstruction)(playerPublicKey, playerTokenAccount, playerPublicKey, usdcMint));
                    return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(connection, ataTransaction, [playerKeypair])];
                case 5:
                    _a.sent();
                    console.log('Player USDC Token Account created:', playerTokenAccount.toBase58());
                    return [3 /*break*/, 7];
                case 6:
                    console.log('Player USDC Token Account exists:', playerTokenAccount.toBase58());
                    _a.label = 7;
                case 7: return [4 /*yield*/, connection.getTokenAccountBalance(playerTokenAccount)];
                case 8:
                    tokenAccountBalance = _a.sent();
                    console.log("Player's USDC Balance:", tokenAccountBalance.value.uiAmount);
                    if (tokenAccountBalance.value.amount === '0' ||
                        parseInt(tokenAccountBalance.value.amount) < wagerAmount) {
                        console.error('Insufficient USDC balance to place the wager.');
                        return [2 /*return*/];
                    }
                    // === 8. Prepare Instruction Data for player1_deposit ===
                    console.log('Preparing instruction data for player deposit...');
                    methodName = 'global:player2_deposit';
                    discriminator = crypto.createHash('sha256').update(methodName).digest().slice(0, 8);
                    gameIdBuffer = Buffer.from(gameId, 'utf8');
                    gameIdLengthBuffer = Buffer.alloc(4);
                    gameIdLengthBuffer.writeUInt32LE(gameIdBuffer.length, 0);
                    wagerAmountBuffer = Buffer.alloc(8);
                    wagerAmountBuffer.writeBigUInt64LE(BigInt(wagerAmount), 0);
                    instructionData = Buffer.concat([
                        discriminator,
                        gameIdLengthBuffer,
                        gameIdBuffer,
                        wagerAmountBuffer,
                    ]);
                    console.log('Instruction data prepared.');
                    accounts = [
                        { pubkey: playerPublicKey, isSigner: true, isWritable: true },
                        { pubkey: gameAccountPDA, isSigner: false, isWritable: true },
                        { pubkey: escrowTokenAccountPDA, isSigner: false, isWritable: true },
                        { pubkey: playerTokenAccount, isSigner: false, isWritable: true },
                        { pubkey: usdcMint, isSigner: false, isWritable: false },
                        { pubkey: web3_js_1.SystemProgram.programId, isSigner: false, isWritable: false },
                        { pubkey: spl_token_1.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                        { pubkey: web3_js_1.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
                    ];
                    console.log('Accounts prepared for the transaction.');
                    instruction = new web3_js_1.TransactionInstruction({
                        keys: accounts,
                        programId: programId,
                        data: instructionData,
                    });
                    console.log('Transaction instruction created.');
                    // === 11. Send the Transaction ===
                    console.log('Sending the transaction to the network...');
                    transaction = new web3_js_1.Transaction().add(instruction);
                    _a.label = 9;
                case 9:
                    _a.trys.push([9, 11, , 12]);
                    return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [playerKeypair])];
                case 10:
                    signature = _a.sent();
                    console.log('Transaction successful with signature:', signature);
                    return [3 /*break*/, 12];
                case 11:
                    error_1 = _a.sent();
                    console.error('Transaction failed:', error_1);
                    return [2 /*return*/];
                case 12:
                    // === 12. Fetch and Log Game Account Data ===
                    console.log('Fetching game account data...');
                    return [4 /*yield*/, connection.getAccountInfo(gameAccountPDA)];
                case 13:
                    gameAccountInfo = _a.sent();
                    if (gameAccountInfo) {
                        gameAccountData = gameAccountInfo.data;
                        // Since we're not using Anchor, we'll log the raw data
                        console.log('Game Account Raw Data:', gameAccountData.toString('hex'));
                        // Decoding the account data without Anchor requires custom deserialization using Borsh
                        // For minimal changes, we'll leave it as logging the raw data
                    }
                    else {
                        console.error('Failed to fetch game account data.');
                    }
                    console.log('\n=== Game Creation Script Completed ===');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .then(function () {
    console.log('Script executed successfully.');
    process.exit(0);
})
    .catch(function (err) {
    console.error('Error executing script:', err);
    process.exit(1);
});
