use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Mint, TokenAccount, Transfer};

declare_id!("9c4ZzoaLZGLTVeV7wh77xJriB3bpPs6woxagFsc8dGtx");

const MAX_PLAYERS: usize = 2;
const FEE_PERCENTAGE: u64 = 1; // 1% fee per fee account

#[program]
pub mod wager_game {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        admin: Pubkey,
        contract_fee_account: Pubkey,
        game_developer_fee_account: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = admin;
        config.contract_fee_account = contract_fee_account;
        config.game_developer_fee_account = game_developer_fee_account;
        Ok(())
    }

    pub fn player1_deposit(
        ctx: Context<Player1Deposit>,
        game_id: [u8; 32],
        wager_amount: u64,
    ) -> Result<()> {
        require!(wager_amount > 0, ErrorCode::InvalidWagerAmount);

        let game_account = &mut ctx.accounts.game_account;

        // If the game is newly created
        if game_account.game_id == [0; 32] {
            // Initialize the game
            game_account.game_id = game_id;
            game_account.wager_amount = wager_amount;
            game_account.player1 = Some(PlayerInfo {
                pubkey: ctx.accounts.player1.key(),
                token_account: ctx.accounts.player1_token_account.key(),
            });
            game_account.state = GameState::WaitingForPlayer2;
            // Set the bump
            game_account.bump = *ctx.bumps.get("game_account").unwrap();

            // Emit GameInitializedEvent
            emit!(GameInitializedEvent {
                game_id,
                wager_amount,
                player1: ctx.accounts.player1.key(),
                timestamp: Clock::get()?.unix_timestamp,
            });
        } else {
            // Game exists, ensure wager amount matches
            require!(
                game_account.wager_amount == wager_amount,
                ErrorCode::MismatchedWagerAmount
            );

            // Ensure player1 slot is not already filled
            require!(
                game_account.player1.is_none(),
                ErrorCode::PlayerAlreadyDeposited
            );

            // Assign player1
            game_account.player1 = Some(PlayerInfo {
                pubkey: ctx.accounts.player1.key(),
                token_account: ctx.accounts.player1_token_account.key(),
            });

            // Update state if both players have deposited
            if game_account.player2.is_some() {
                game_account.state = GameState::ReadyForFinalization;
            } else {
                game_account.state = GameState::WaitingForPlayer2;
            }
        }

        // Transfer Player1's deposit to escrow
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player1_token_account.to_account_info(),
                    to: ctx.accounts.escrow_token_account.to_account_info(),
                    authority: ctx.accounts.player1.to_account_info(),
                },
            ),
            wager_amount,
        )?;

        // Emit PlayerDepositedEvent
        emit!(PlayerDepositedEvent {
            game_id,
            player: ctx.accounts.player1.key(),
            amount: wager_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn player2_deposit(
        ctx: Context<Player2Deposit>,
        game_id: [u8; 32],
        wager_amount: u64,
    ) -> Result<()> {
        require!(wager_amount > 0, ErrorCode::InvalidWagerAmount);

        let game_account = &mut ctx.accounts.game_account;

        // If the game is newly created
        if game_account.game_id == [0; 32] {
            // Initialize the game
            game_account.game_id = game_id;
            game_account.wager_amount = wager_amount;
            game_account.player2 = Some(PlayerInfo {
                pubkey: ctx.accounts.player2.key(),
                token_account: ctx.accounts.player2_token_account.key(),
            });
            game_account.state = GameState::WaitingForPlayer1;
            // Set the bump
            game_account.bump = *ctx.bumps.get("game_account").unwrap();

            // Emit GameInitializedEvent
            emit!(GameInitializedEvent {
                game_id,
                wager_amount,
                player1: ctx.accounts.player2.key(), // Player2 is first to deposit
                timestamp: Clock::get()?.unix_timestamp,
            });
        } else {
            // Game exists, ensure wager amount matches
            require!(
                game_account.wager_amount == wager_amount,
                ErrorCode::MismatchedWagerAmount
            );

            // Ensure player2 slot is not already filled
            require!(
                game_account.player2.is_none(),
                ErrorCode::PlayerAlreadyDeposited
            );

            // Assign player2
            game_account.player2 = Some(PlayerInfo {
                pubkey: ctx.accounts.player2.key(),
                token_account: ctx.accounts.player2_token_account.key(),
            });

            // Update state if both players have deposited
            if game_account.player1.is_some() {
                game_account.state = GameState::ReadyForFinalization;
            } else {
                game_account.state = GameState::WaitingForPlayer1;
            }
        }

        // Transfer Player2's deposit to escrow
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.player2_token_account.to_account_info(),
                    to: ctx.accounts.escrow_token_account.to_account_info(),
                    authority: ctx.accounts.player2.to_account_info(),
                },
            ),
            wager_amount,
        )?;

        // Emit PlayerDepositedEvent
        emit!(PlayerDepositedEvent {
            game_id,
            player: ctx.accounts.player2.key(),
            amount: wager_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn finalize_game(
        ctx: Context<FinalizeGame>,
        game_id: [u8; 32],
        winner: u8,
    ) -> Result<()> {
        let game_account = &mut ctx.accounts.game_account;
        let config = &ctx.accounts.config;

        require!(
            ctx.accounts.admin.key() == config.admin,
            ErrorCode::Unauthorized
        );

        require!(
            game_account.state == GameState::ReadyForFinalization,
            ErrorCode::InvalidGameState
        );

        // Verify winner is valid
        require!(winner == 0 || winner == 1, ErrorCode::InvalidWinner);

        // Calculate fees and payout
        let total = game_account
            .wager_amount
            .checked_mul(MAX_PLAYERS as u64)
            .ok_or(ErrorCode::Overflow)?;
        let fee = total
            .checked_mul(FEE_PERCENTAGE)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(100)
            .ok_or(ErrorCode::Underflow)?;
        let total_fees = fee.checked_mul(2).ok_or(ErrorCode::Overflow)?;
        let payout = total.checked_sub(total_fees).ok_or(ErrorCode::Underflow)?;

        // Use the stored bump
        let bump = game_account.bump;
        let seeds = &[game_id.as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        // Transfer fees to each fee account
        // Transfer to contract developer fee account
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.contract_fee_account.to_account_info(),
                    authority: game_account.to_account_info(),
                },
                signer,
            ),
            fee,
        )?;

        // Transfer to game developer fee account
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: ctx.accounts.game_developer_fee_account.to_account_info(),
                    authority: game_account.to_account_info(),
                },
                signer,
            ),
            fee,
        )?;

        // Determine the winner and transfer payout
        let winner_account = match winner {
            0 => ctx.accounts.player1_token_account.to_account_info(),
            1 => ctx.accounts.player2_token_account.to_account_info(),
            _ => return Err(ErrorCode::InvalidWinner.into()),
        };

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow_token_account.to_account_info(),
                    to: winner_account,
                    authority: game_account.to_account_info(),
                },
                signer,
            ),
            payout,
        )?;

        // Emit GameFinalizedEvent
        let winner_pubkey = match winner {
            0 => game_account.player1.as_ref().unwrap().pubkey,
            1 => game_account.player2.as_ref().unwrap().pubkey,
            _ => return Err(ErrorCode::InvalidWinner.into()),
        };
        emit!(GameFinalizedEvent {
            game_id,
            winner: winner_pubkey,
            payout,
            timestamp: Clock::get()?.unix_timestamp,
        });

        // Update game state
        game_account.state = GameState::Completed;

        Ok(())
    }

    pub fn cancel_game(ctx: Context<CancelGame>, game_id: [u8; 32]) -> Result<()> {
        let game_account = &mut ctx.accounts.game_account;

        require!(
            ctx.accounts.admin.key() == ctx.accounts.config.admin,
            ErrorCode::Unauthorized
        );

        require!(
            game_account.state == GameState::WaitingForPlayer1
                || game_account.state == GameState::WaitingForPlayer2
                || game_account.state == GameState::ReadyForFinalization,
            ErrorCode::InvalidGameStateForCancellation
        );

        // Use the stored bump
        let bump = game_account.bump;
        let seeds = &[game_id.as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        // Refund Player1 if they've deposited
        if let Some(player1_info) = &game_account.player1 {
            require!(
                ctx.accounts.player1_token_account.is_some(),
                ErrorCode::MissingPlayer1TokenAccount
            );
            let player1_token_account = ctx
                .accounts
                .player1_token_account
                .as_ref()
                .unwrap()
                .to_account_info();
            require!(
                player1_token_account.key() == player1_info.token_account,
                ErrorCode::InvalidPlayer1TokenAccount
            );
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_token_account.to_account_info(),
                        to: player1_token_account,
                        authority: game_account.to_account_info(),
                    },
                    signer,
                ),
                game_account.wager_amount,
            )?;
        }

        // Refund Player2 if they've deposited
        if let Some(player2_info) = &game_account.player2 {
            require!(
                ctx.accounts.player2_token_account.is_some(),
                ErrorCode::MissingPlayer2TokenAccount
            );
            let player2_token_account = ctx
                .accounts
                .player2_token_account
                .as_ref()
                .unwrap()
                .to_account_info();
            require!(
                player2_token_account.key() == player2_info.token_account,
                ErrorCode::InvalidPlayer2TokenAccount
            );
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.escrow_token_account.to_account_info(),
                        to: player2_token_account,
                        authority: game_account.to_account_info(),
                    },
                    signer,
                ),
                game_account.wager_amount,
            )?;
        }

        // Emit GameCanceledEvent
        emit!(GameCanceledEvent {
            game_id,
            timestamp: Clock::get()?.unix_timestamp,
        });

        // Update game state
        game_account.state = GameState::Canceled;

        Ok(())
    }

    pub fn get_game_status(
        ctx: Context<GetGameStatus>,
        game_id: [u8; 32],
    ) -> Result<GameState> {
        let game_account = &ctx.accounts.game_account;

        // Ensure that the game_id matches the stored game
        require!(
            game_account.game_id == game_id,
            ErrorCode::InvalidGameId
        );

        // Return the current state of the game
        Ok(game_account.state)
    }
}

// Event Definitions
#[event]
pub struct GameInitializedEvent {
    #[index]
    pub game_id: [u8; 32],
    pub wager_amount: u64,
    pub player1: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PlayerDepositedEvent {
    #[index]
    pub game_id: [u8; 32],
    pub player: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct GameFinalizedEvent {
    #[index]
    pub game_id: [u8; 32],
    pub winner: Pubkey,
    pub payout: u64,
    pub timestamp: i64,
}

#[event]
pub struct GameCanceledEvent {
    #[index]
    pub game_id: [u8; 32],
    pub timestamp: i64,
}

// Structs and Enums
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PlayerInfo {
    pub pubkey: Pubkey,
    pub token_account: Pubkey,
}

#[derive(Accounts)]
#[instruction(game_id: [u8; 32])]
pub struct GetGameStatus<'info> {
    #[account(
        seeds = [game_id.as_ref()],
        bump = game_account.bump
    )]
    pub game_account: Account<'info, GameAccount>,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 32 + 32, // discriminator + admin pubkey + fee accounts
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: [u8; 32])]
pub struct Player1Deposit<'info> {
    #[account(mut)]
    pub player1: Signer<'info>,
    #[account(
        init_if_needed,
        payer = player1,
        seeds = [game_id.as_ref()],
        bump,
        space = GameAccount::LEN,
    )]
    pub game_account: Account<'info, GameAccount>,
    #[account(
        init_if_needed,
        payer = player1,
        seeds = [b"escrow", game_id.as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = game_account,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = player1_token_account.owner == player1.key(),
        constraint = player1_token_account.mint == usdc_mint.key(),
    )]
    pub player1_token_account: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(game_id: [u8; 32])]
pub struct Player2Deposit<'info> {
    #[account(mut)]
    pub player2: Signer<'info>,
    #[account(
        init_if_needed,
        payer = player2,
        seeds = [game_id.as_ref()],
        bump,
        space = GameAccount::LEN,
    )]
    pub game_account: Account<'info, GameAccount>,
    #[account(
        init_if_needed,
        payer = player2,
        seeds = [b"escrow", game_id.as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = game_account,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = player2_token_account.owner == player2.key(),
        constraint = player2_token_account.mint == usdc_mint.key(),
    )]
    pub player2_token_account: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(game_id: [u8; 32])]
pub struct FinalizeGame<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [game_id.as_ref()], bump = game_account.bump)]
    pub game_account: Account<'info, GameAccount>,
    #[account(mut)]
    pub player1_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub player2_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"escrow", game_id.as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = game_account,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = contract_fee_account.key() == config.contract_fee_account,
    )]
    pub contract_fee_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = game_developer_fee_account.key() == config.game_developer_fee_account,
    )]
    pub game_developer_fee_account: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(game_id: [u8; 32])]
pub struct CancelGame<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [game_id.as_ref()], bump = game_account.bump)]
    pub game_account: Account<'info, GameAccount>,
    #[account(
        mut,
        seeds = [b"escrow", game_id.as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = game_account,
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    // Player token accounts are optional because a player might not have deposited yet
    #[account(mut)]
    pub player1_token_account: Option<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub player2_token_account: Option<Account<'info, TokenAccount>>,
}

#[account]
pub struct GameAccount {
    pub game_id: [u8; 32],
    pub player1: Option<PlayerInfo>,
    pub player2: Option<PlayerInfo>,
    pub wager_amount: u64,
    pub state: GameState,
    pub bump: u8,
}

impl GameAccount {
    const LEN: usize = 8  // Discriminator
        + 32              // game_id: [u8; 32]
        + (1 + 32 + 32) * 2 // Option<PlayerInfo> for player1 and player2
        + 8               // wager_amount
        + 1               // state
        + 1;              // bump
}

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub contract_fee_account: Pubkey,
    pub game_developer_fee_account: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Copy)]
pub enum GameState {
    WaitingForPlayer1,
    WaitingForPlayer2,
    ReadyForFinalization,
    Completed,
    Canceled,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Player has already deposited.")]
    PlayerAlreadyDeposited,
    #[msg("Invalid game state.")]
    InvalidGameState,
    #[msg("Invalid game state for cancellation.")]
    InvalidGameStateForCancellation,
    #[msg("Invalid winner.")]
    InvalidWinner,
    #[msg("Mismatched wager amount.")]
    MismatchedWagerAmount,
    #[msg("Invalid wager amount.")]
    InvalidWagerAmount,
    #[msg("Arithmetic overflow occurred.")]
    Overflow,
    #[msg("Arithmetic underflow occurred.")]
    Underflow,
    #[msg("Unauthorized access.")]
    Unauthorized,
    #[msg("Insufficient funds.")]
    InsufficientFunds,
    #[msg("Invalid Player1 token account.")]
    InvalidPlayer1TokenAccount,
    #[msg("Invalid Player2 token account.")]
    InvalidPlayer2TokenAccount,
    #[msg("Missing Player1 token account.")]
    MissingPlayer1TokenAccount,
    #[msg("Missing Player2 token account.")]
    MissingPlayer2TokenAccount,
    #[msg("Invalid game ID.")]
    InvalidGameId,
}