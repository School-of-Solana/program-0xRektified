import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, Keypair, PublicKey } from "@solana/web3.js";
import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";
import { LiteSVM, Clock } from "litesvm";
import { expect } from "chai";
import { AnchorProject } from "../target/types/anchor_project";
import {
  findConfigPda,
  findPositionPda,
  findPoolPda,
  findCommitmentPda,
  createAndMintToken2022,
  EPOCH_DURATION,
  WEIGHT_RATE_NUMERATOR,
  WEIGHT_RATE_DENOMINATOR,
} from "./utils";

const IDL = require("../target/idl/anchor_project.json");
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("Multiple Position Minting After Commits", () => {
  let svm: LiteSVM;
  let provider: LiteSVMProvider;
  let program: Program<AnchorProject>;
  let payer: Keypair;
  let mint: PublicKey;

  beforeEach(async () => {
    payer = Keypair.generate();

    svm = fromWorkspace("./").withBuiltins().withSysvars();

    const c = svm.getClock();
    const currentTime = Math.floor(Date.now() / 1000);
    svm.setClock(
      new Clock(
        c.slot,
        c.epochStartTimestamp,
        c.epoch,
        c.leaderScheduleEpoch,
        BigInt(currentTime)
      )
    );

    provider = new LiteSVMProvider(svm);
    anchor.setProvider(provider);

    program = new anchor.Program<AnchorProject>(IDL as any, provider);

    svm.airdrop(payer.publicKey, BigInt(10 * LAMPORTS_PER_SOL));

    const res = await createAndMintToken2022(svm, payer, payer.publicKey, 9);
    mint = res.mint;

    // Initialize config
    const initTx = await program.methods
      .initialize({ timeBased: {} }, { admin: {} }, payer.publicKey, new BN(EPOCH_DURATION), new BN(WEIGHT_RATE_NUMERATOR), new BN(WEIGHT_RATE_DENOMINATOR))
      .accounts({
        signer: payer.publicKey,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    initTx.recentBlockhash = svm.latestBlockhash();
    initTx.feePayer = payer.publicKey;
    initTx.sign(payer);
    svm.sendTransaction(initTx);
  });

  it("Allows user to mint multiple positions even after committing previous ones", async () => {
    const user = payer;
    const POOL_ID = 0;
    const EPOCH = 1;

    // Initialize pool
    const [poolPda] = findPoolPda(POOL_ID, EPOCH, program.programId);
    const initPoolTx = await program.methods
      .initializePool(1)
      .accounts({
        signer: user.publicKey,
      })
      .remainingAccounts([
        {
          pubkey: poolPda,
          isSigner: false,
          isWritable: true,
        }
      ])
      .transaction();

    initPoolTx.recentBlockhash = svm.latestBlockhash();
    initPoolTx.feePayer = user.publicKey;
    initPoolTx.sign(user);
    svm.sendTransaction(initPoolTx);

    // Get user's token account
    const userAta = await getAssociatedTokenAddress(
      mint,
      user.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const getBalance = () => {
      const accountInfo = svm.getAccount(userAta);
      return Number(Buffer.from(accountInfo!.data).readBigUInt64LE(64));
    };

    const initialBalance = getBalance();

    // CYCLE 1: Mint position 0, commit it
    const [position0Pda] = findPositionPda(user.publicKey, 0, program.programId);

    const mint0Tx = await program.methods
      .mintPosition()
      .accounts({
        signer: user.publicKey,
        position: position0Pda,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    mint0Tx.recentBlockhash = svm.latestBlockhash();
    mint0Tx.feePayer = user.publicKey;
    mint0Tx.sign(user);
    svm.sendTransaction(mint0Tx);

    // Verify position 0 exists
    const position0Account = await program.account.positionAccount.fetch(position0Pda);
    expect(position0Account.userIndex.toNumber()).to.equal(0);

    // Balance should be reduced by position_price
    const balanceAfterMint0 = getBalance();
    expect(initialBalance - balanceAfterMint0).to.equal(1000 * 10 ** 9);

    // Commit position 0
    const [commitment0Pda] = findCommitmentPda(
      user.publicKey,
      POOL_ID,
      EPOCH,
      program.programId
    );

    const commit0Tx = await program.methods
      .commit(new BN(0), POOL_ID)
      .accounts({
        signer: user.publicKey,
        position: position0Pda,
        commitment: commitment0Pda,
      })
      .transaction();

    commit0Tx.recentBlockhash = svm.latestBlockhash();
    commit0Tx.feePayer = user.publicKey;
    commit0Tx.sign(user);
    svm.sendTransaction(commit0Tx);

    // Verify position 0 is now closed (account should not exist)
    const position0AfterCommit = svm.getAccount(position0Pda);
    expect(position0AfterCommit).to.be.null;

    // CYCLE 2: Mint position 1 (should work even though position 0 is closed)
    const [position1Pda] = findPositionPda(user.publicKey, 1, program.programId);

    const mint1Tx = await program.methods
      .mintPosition()
      .accounts({
        signer: user.publicKey,
        position: position1Pda,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    mint1Tx.recentBlockhash = svm.latestBlockhash();
    mint1Tx.feePayer = user.publicKey;
    mint1Tx.sign(user);
    svm.sendTransaction(mint1Tx);

    // Verify position 1 exists
    const position1Account = await program.account.positionAccount.fetch(position1Pda);
    expect(position1Account.userIndex.toNumber()).to.equal(1);

    // Balance should be reduced again
    const balanceAfterMint1 = getBalance();
    expect(balanceAfterMint0 - balanceAfterMint1).to.equal(1000 * 10 ** 9);

    // CYCLE 3: Commit position 1 and mint position 2
    const [commitment1Pda] = findCommitmentPda(
      user.publicKey,
      POOL_ID,
      EPOCH,
      program.programId
    );

    const commit1Tx = await program.methods
      .commit(new BN(1), POOL_ID)
      .accounts({
        signer: user.publicKey,
        position: position1Pda,
        commitment: commitment1Pda,
      })
      .transaction();

    commit1Tx.recentBlockhash = svm.latestBlockhash();
    commit1Tx.feePayer = user.publicKey;
    commit1Tx.sign(user);
    svm.sendTransaction(commit1Tx);

    // Verify position 1 is now closed
    const position1AfterCommit = svm.getAccount(position1Pda);
    expect(position1AfterCommit).to.be.null;

    // Mint position 2
    const [position2Pda] = findPositionPda(user.publicKey, 2, program.programId);

    const mint2Tx = await program.methods
      .mintPosition()
      .accounts({
        signer: user.publicKey,
        position: position2Pda,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    mint2Tx.recentBlockhash = svm.latestBlockhash();
    mint2Tx.feePayer = user.publicKey;
    mint2Tx.sign(user);
    svm.sendTransaction(mint2Tx);

    // Verify position 2 exists
    const position2Account = await program.account.positionAccount.fetch(position2Pda);
    expect(position2Account.userIndex.toNumber()).to.equal(2);

    // Verify total spent
    const finalBalance = getBalance();
    expect(initialBalance - finalBalance).to.equal(3000 * 10 ** 9); // 3 positions minted

    // Verify pool stats updated correctly
    const poolAccount = await program.account.pool.fetch(poolPda);
    expect(poolAccount.totalPositions.toNumber()).to.equal(2); // 2 commitments
  });

  it("Handles non-sequential position IDs when some are still open", async () => {
    const user = payer;
    const POOL_ID = 0;
    const EPOCH = 1;

    // Initialize pool
    const [poolPda] = findPoolPda(POOL_ID, EPOCH, program.programId);
    const initPoolTx = await program.methods
      .initializePool(1)
      .accounts({
        signer: user.publicKey,
      })
      .remainingAccounts([
        {
          pubkey: poolPda,
          isSigner: false,
          isWritable: true,
        }
      ])
      .transaction();

    initPoolTx.recentBlockhash = svm.latestBlockhash();
    initPoolTx.feePayer = user.publicKey;
    initPoolTx.sign(user);
    svm.sendTransaction(initPoolTx);

    // Mint position 0
    const [position0Pda] = findPositionPda(user.publicKey, 0, program.programId);
    const mint0Tx = await program.methods
      .mintPosition()
      .accounts({
        signer: user.publicKey,
        position: position0Pda,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();
    mint0Tx.recentBlockhash = svm.latestBlockhash();
    mint0Tx.feePayer = user.publicKey;
    mint0Tx.sign(user);
    svm.sendTransaction(mint0Tx);

    // Mint position 1
    const [position1Pda] = findPositionPda(user.publicKey, 1, program.programId);
    const mint1Tx = await program.methods
      .mintPosition()
      .accounts({
        signer: user.publicKey,
        position: position1Pda,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();
    mint1Tx.recentBlockhash = svm.latestBlockhash();
    mint1Tx.feePayer = user.publicKey;
    mint1Tx.sign(user);
    svm.sendTransaction(mint1Tx);

    // Commit ONLY position 0 (position 1 remains open)
    const [commitment0Pda] = findCommitmentPda(
      user.publicKey,
      POOL_ID,
      EPOCH,
      program.programId
    );
    const commit0Tx = await program.methods
      .commit(new BN(0), POOL_ID)
      .accounts({
        signer: user.publicKey,
        position: position0Pda,
        commitment: commitment0Pda,
      })
      .transaction();
    commit0Tx.recentBlockhash = svm.latestBlockhash();
    commit0Tx.feePayer = user.publicKey;
    commit0Tx.sign(user);
    svm.sendTransaction(commit0Tx);

    // Now mint position 2 - should work fine
    const [position2Pda] = findPositionPda(user.publicKey, 2, program.programId);
    const mint2Tx = await program.methods
      .mintPosition()
      .accounts({
        signer: user.publicKey,
        position: position2Pda,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();
    mint2Tx.recentBlockhash = svm.latestBlockhash();
    mint2Tx.feePayer = user.publicKey;
    mint2Tx.sign(user);
    svm.sendTransaction(mint2Tx);

    // Verify: position 0 closed, position 1 open, position 2 open
    expect(svm.getAccount(position0Pda)).to.be.null;
    expect(svm.getAccount(position1Pda)).to.not.be.null;
    expect(svm.getAccount(position2Pda)).to.not.be.null;

    const position1Account = await program.account.positionAccount.fetch(position1Pda);
    expect(position1Account.userIndex.toNumber()).to.equal(1);

    const position2Account = await program.account.positionAccount.fetch(position2Pda);
    expect(position2Account.userIndex.toNumber()).to.equal(2);
  });
});
