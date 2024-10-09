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
var anchor = require("@project-serum/anchor");
var web3_js_1 = require("@solana/web3.js");
var spl_token_1 = require("@solana/spl-token");
var fs = require("fs");
var crypto = require("crypto");
// import bs58 from 'bs58';
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var adminKeypairPath, adminKeypairData, adminKeypair, adminPublicKey, connection, programId, usdcMint, gameId, winner, gameAccountPDA, escrowTokenAccountPDA, configPDA, configAccountInfo, idl, coder, configAccount, contractFeeAccount, gameDeveloperFeeAccount, gameAccountInfo, gameAccount, player1PublicKey, player2PublicKey, player1TokenAccount, player2TokenAccount, methodName, discriminator, gameIdBuffer, gameIdLengthBuffer, winnerBuffer, instructionData, accounts, instruction, transaction, signature, error_1, updatedGameAccountInfo, updatedGameAccount;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('=== Starting the Game Finalization Script ===\n');
                    adminKeypairPath = "/Users/elisading/Desktop/fadmania/gamebytes-cloud-functions/functions/src/gamebets/admin.json";
                    adminKeypairData = JSON.parse(fs.readFileSync(adminKeypairPath, "utf-8"));
                    adminKeypair = web3_js_1.Keypair.fromSecretKey(new Uint8Array(adminKeypairData));
                    adminPublicKey = adminKeypair.publicKey;
                    console.log("Admin Public Key:", adminPublicKey.toBase58());
                    connection = new web3_js_1.Connection('https://api.devnet.solana.com', 'confirmed');
                    console.log('Connected to Solana Devnet.');
                    programId = new web3_js_1.PublicKey('7HFBvvE6nBnasydt1pEXBdRjmrJ7qSn2ZpreGfNQ9KUS');
                    console.log('Program ID:', programId.toBase58());
                    usdcMint = new web3_js_1.PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
                    console.log('USDC Mint Address:', usdcMint.toBase58());
                    gameId = 'game-id-test-10104';
                    winner = 0;
                    console.log("Game ID: ".concat(gameId));
                    console.log("Winner: Player".concat(winner + 1));
                    return [4 /*yield*/, web3_js_1.PublicKey.findProgramAddress([Buffer.from(gameId)], programId)];
                case 1:
                    gameAccountPDA = (_a.sent())[0];
                    console.log('Game Account PDA:', gameAccountPDA.toBase58());
                    return [4 /*yield*/, web3_js_1.PublicKey.findProgramAddress([Buffer.from('escrow'), Buffer.from(gameId)], programId)];
                case 2:
                    escrowTokenAccountPDA = (_a.sent())[0];
                    console.log('Escrow Token Account PDA:', escrowTokenAccountPDA.toBase58());
                    return [4 /*yield*/, web3_js_1.PublicKey.findProgramAddress([Buffer.from('config')], programId)];
                case 3:
                    configPDA = (_a.sent())[0];
                    console.log('Config PDA:', configPDA.toBase58());
                    return [4 /*yield*/, connection.getAccountInfo(configPDA)];
                case 4:
                    configAccountInfo = _a.sent();
                    if (!configAccountInfo) {
                        console.error('Config account not found. Ensure the contract is initialized.');
                        return [2 /*return*/];
                    }
                    idl = JSON.parse(fs.readFileSync('/Users/elisading/Desktop/fadmania/gamebytes-cloud-functions/functions/src/gamebets/wager_game_idl.json', 'utf8') // Update this path
                    );
                    coder = new anchor.BorshAccountsCoder(idl);
                    configAccount = coder.decode('Config', configAccountInfo.data);
                    contractFeeAccount = new web3_js_1.PublicKey(configAccount.contractFeeAccount);
                    gameDeveloperFeeAccount = new web3_js_1.PublicKey(configAccount.gameDeveloperFeeAccount);
                    console.log('Contract Fee Account:', contractFeeAccount.toBase58());
                    console.log('Game Developer Fee Account:', gameDeveloperFeeAccount.toBase58());
                    return [4 /*yield*/, connection.getAccountInfo(gameAccountPDA)];
                case 5:
                    gameAccountInfo = _a.sent();
                    if (!gameAccountInfo) {
                        console.error('Game account not found. Ensure the game has been created.');
                        return [2 /*return*/];
                    }
                    gameAccount = coder.decode('GameAccount', gameAccountInfo.data);
                    if (!gameAccount.player1 || !gameAccount.player2) {
                        console.error('Both players have not deposited yet.');
                        return [2 /*return*/];
                    }
                    player1PublicKey = new web3_js_1.PublicKey(gameAccount.player1.pubkey);
                    player2PublicKey = new web3_js_1.PublicKey(gameAccount.player2.pubkey);
                    player1TokenAccount = new web3_js_1.PublicKey(gameAccount.player1.tokenAccount);
                    player2TokenAccount = new web3_js_1.PublicKey(gameAccount.player2.tokenAccount);
                    console.log('Player1 Public Key:', player1PublicKey.toBase58());
                    console.log('Player1 Token Account:', player1TokenAccount.toBase58());
                    console.log('Player2 Public Key:', player2PublicKey.toBase58());
                    console.log('Player2 Token Account:', player2TokenAccount.toBase58());
                    // === 8. Prepare Instruction Data for finalize_game ===
                    console.log('Preparing instruction data for finalize_game...');
                    methodName = 'global:finalize_game';
                    discriminator = crypto.createHash('sha256').update(methodName).digest().slice(0, 8);
                    gameIdBuffer = Buffer.from(gameId, 'utf8');
                    gameIdLengthBuffer = Buffer.alloc(4);
                    gameIdLengthBuffer.writeUInt32LE(gameIdBuffer.length, 0);
                    winnerBuffer = Buffer.alloc(1);
                    winnerBuffer.writeUInt8(winner, 0);
                    instructionData = Buffer.concat([
                        discriminator,
                        gameIdLengthBuffer,
                        gameIdBuffer,
                        winnerBuffer,
                    ]);
                    console.log('Instruction data prepared.');
                    accounts = [
                        { pubkey: adminPublicKey, isSigner: true, isWritable: false },
                        { pubkey: configPDA, isSigner: false, isWritable: false },
                        { pubkey: gameAccountPDA, isSigner: false, isWritable: true },
                        { pubkey: player1TokenAccount, isSigner: false, isWritable: true },
                        { pubkey: player2TokenAccount, isSigner: false, isWritable: true },
                        { pubkey: escrowTokenAccountPDA, isSigner: false, isWritable: true },
                        { pubkey: contractFeeAccount, isSigner: false, isWritable: true },
                        { pubkey: gameDeveloperFeeAccount, isSigner: false, isWritable: true },
                        { pubkey: spl_token_1.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                    ];
                    console.log('Accounts prepared for the transaction.');
                    instruction = new anchor.web3.TransactionInstruction({
                        keys: accounts,
                        programId: programId,
                        data: instructionData,
                    });
                    console.log('Transaction instruction created.');
                    // === 11. Send the Transaction ===
                    console.log('Sending the transaction to the network...');
                    transaction = new web3_js_1.Transaction().add(instruction);
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [adminKeypair])];
                case 7:
                    signature = _a.sent();
                    console.log('Transaction successful with signature:', signature);
                    return [3 /*break*/, 9];
                case 8:
                    error_1 = _a.sent();
                    console.error('Transaction failed:', error_1);
                    if (error_1.logs) {
                        console.error('Transaction logs:', error_1.logs);
                    }
                    return [3 /*break*/, 9];
                case 9:
                    // === 12. Fetch and Log Game Account Data ===
                    console.log('Fetching updated game account data...');
                    return [4 /*yield*/, connection.getAccountInfo(gameAccountPDA)];
                case 10:
                    updatedGameAccountInfo = _a.sent();
                    if (updatedGameAccountInfo) {
                        updatedGameAccount = coder.decode('GameAccount', updatedGameAccountInfo.data);
                        console.log('Updated Game State:', updatedGameAccount.state);
                    }
                    else {
                        console.error('Failed to fetch updated game account data.');
                    }
                    console.log('\n=== Game Finalization Script Completed ===');
                    return [2 /*return*/];
            }
        });
    });
}
/*
  To change the winner, modify the 'winner' variable:
    - Set winner = 0 for player1
    - Set winner = 1 for player2

  Ensure that the admin keypair provided has the authority to finalize the game.

  The script assumes that the config account has been initialized and that both players have deposited.
*/
main()
    .then(function () {
    console.log('Script executed successfully.');
    process.exit(0);
})
    .catch(function (err) {
    console.error('Error executing script:', err);
    process.exit(1);
});
