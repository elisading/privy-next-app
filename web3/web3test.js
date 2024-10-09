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
var dotenv = require("dotenv");
var web3_js_1 = require("@solana/web3.js");
var anchor_1 = require("@project-serum/anchor");
var spl_token_1 = require("@solana/spl-token");
var bn_js_1 = require("bn.js");
var bs58_1 = require("bs58");
// import idl from './wager_game_idl.json'; 
dotenv.config();
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var programId, connection, adminSecretKey, adminKeypair, usdcMintAddress, player1PublicKey, wallet, provider, idl, program, gameAccountPDA, escrowTokenAccountPDA, player1TokenAccount, txSignature, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                programId = new web3_js_1.PublicKey('7HFBvvE6nBnasydt1pEXBdRjmrJ7qSn2ZpreGfNQ9KUS');
                connection = new web3_js_1.Connection('https://api.devnet.solana.com', 'confirmed');
                adminSecretKey = bs58_1.default.decode("5r5y53TmCTiTL2dYB7j2nAbM4NXntwnUQLXUCMQoHRmicNeyUYhgaTY3Gy29GPFTUaApZ8PLsfZH3ybcnzGaw2Mc");
                adminKeypair = web3_js_1.Keypair.fromSecretKey(adminSecretKey);
                usdcMintAddress = new web3_js_1.PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
                player1PublicKey = new web3_js_1.PublicKey("6wxd6wRYnAeHvVa1qPGUyem5QqwNKCEebfcJTnt9tRkj");
                wallet = new anchor_1.Wallet(adminKeypair);
                console.log('Initializing...');
                provider = new anchor_1.AnchorProvider(connection, wallet, {
                    preflightCommitment: 'confirmed',
                });
                return [4 /*yield*/, anchor_1.Program.fetchIdl(programId, provider)];
            case 1:
                idl = _a.sent();
                console.log('IDL fetched:', idl);
                program = new anchor_1.Program(idl, programId, provider);
                console.log('Deriving PDAs...');
                return [4 /*yield*/, web3_js_1.PublicKey.findProgramAddress([Buffer.from('my_game_id')], programId)];
            case 2:
                gameAccountPDA = (_a.sent())[0];
                return [4 /*yield*/, web3_js_1.PublicKey.findProgramAddress([Buffer.from('escrow'), Buffer.from('my_game_id')], programId)];
            case 3:
                escrowTokenAccountPDA = (_a.sent())[0];
                console.log('PDAs derived:', gameAccountPDA.toString(), escrowTokenAccountPDA.toString());
                return [4 /*yield*/, (0, spl_token_1.getAssociatedTokenAddress)(usdcMintAddress, player1PublicKey)];
            case 4:
                player1TokenAccount = _a.sent();
                console.log('player1TokenAccount:', player1TokenAccount.toString());
                _a.label = 5;
            case 5:
                _a.trys.push([5, 7, , 8]);
                return [4 /*yield*/, program.methods
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
                        .rpc()];
            case 6:
                txSignature = _a.sent();
                console.log('Transaction signature:', txSignature);
                console.log('Deposit completed successfully.');
                return [3 /*break*/, 8];
            case 7:
                error_1 = _a.sent();
                console.error('Error during deposit:', error_1);
                return [3 /*break*/, 8];
            case 8: return [2 /*return*/];
        }
    });
}); })();
