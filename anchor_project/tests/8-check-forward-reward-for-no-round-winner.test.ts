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
  findEpochResultPda,
  findTreasuryPda,
  setupVrfMock,
  logSvmResult,
  EPOCH_DURATION,
  WEIGHT_RATE_NUMERATOR,
  WEIGHT_RATE_DENOMINATOR,
} from "./utils";

const IDL = require("../target/idl/anchor_project.json");
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("Forward Rewards When No Winner", () => {
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

    // Create a fresh program instance instead of using the global workspace
    const programId = anchor.workspace.AnchorProject.programId;
    program = new anchor.Program<AnchorProject>(IDL as any, provider);

    svm.airdrop(payer.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
    setupVrfMock(svm);

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

  it("Forwards treasury balance to next epoch when winning pool has no participants", async () => {
    // Setup: User commits to pool 1, but pool 2 (with no participants) wins
    const user1 = Keypair.generate();

    svm.airdrop(user1.publicKey, BigInt(10 * LAMPORTS_PER_SOL));

    // Transfer tokens to user1
    const payerAta = await getAssociatedTokenAddress(
      mint,
      payer.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const user1Ata = await getAssociatedTokenAddress(
      mint,
      user1.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const createUser1AtaIx = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      user1Ata,
      user1.publicKey,
      mint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transferIx = createTransferCheckedInstruction(
      payerAta,
      mint,
      user1Ata,
      payer.publicKey,
      10_000 * 10 ** 9,
      9,
      [],
      TOKEN_2022_PROGRAM_ID
    );

    const setupTx = new anchor.web3.Transaction().add(
      createUser1AtaIx,
      transferIx
    );
    setupTx.recentBlockhash = svm.latestBlockhash();
    setupTx.feePayer = payer.publicKey;
    setupTx.sign(payer);
    svm.sendTransaction(setupTx);

    // User1 mints a position
    const [user1Position] = findPositionPda(
      user1.publicKey,
      0,
      program.programId
    );
    const user1MintTx = await program.methods
      .mintPosition()
      .accounts({
        signer: user1.publicKey,
        position: user1Position,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    user1MintTx.recentBlockhash = svm.latestBlockhash();
    user1MintTx.feePayer = user1.publicKey;
    user1MintTx.sign(user1);
    svm.sendTransaction(user1MintTx);

    // Initialize pools 0, 1, and 2 for epoch 1 (need all three to create pools 1 and 2)
    const EPOCH_1 = 1;
    const POOL_1 = 1;
    const POOL_2 = 2;

    const [pool0Pda] = findPoolPda(0, EPOCH_1, program.programId);
    const [pool1Pda] = findPoolPda(POOL_1, EPOCH_1, program.programId);
    const [pool2Pda] = findPoolPda(POOL_2, EPOCH_1, program.programId);

    const initPoolsTx = await program.methods
      .initializePool(3)
      .accounts({
        signer: payer.publicKey,
      })
      .remainingAccounts([
        {
          pubkey: pool0Pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: pool1Pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: pool2Pda,
          isSigner: false,
          isWritable: true,
        }
      ])
      .transaction();

    initPoolsTx.recentBlockhash = svm.latestBlockhash();
    initPoolsTx.feePayer = payer.publicKey;
    initPoolsTx.sign(payer);
    svm.sendTransaction(initPoolsTx);

    // User1 commits to pool 1
    const [user1Commitment] = findCommitmentPda(
      user1.publicKey,
      POOL_1,
      EPOCH_1,
      program.programId
    );

    const commitTx = await program.methods
      .commit(new BN(0), POOL_1)
      .accounts({
        signer: user1.publicKey,
        position: user1Position,
        commitment: user1Commitment,
      })
      .transaction();

    commitTx.recentBlockhash = svm.latestBlockhash();
    commitTx.feePayer = user1.publicKey;
    commitTx.sign(user1);
    svm.sendTransaction(commitTx);

    // Get treasury balance before resolve (should have 1000 tokens from user1's position mint)
    const [treasuryPda] = findTreasuryPda(program.programId);
    const treasuryAta = await getAssociatedTokenAddress(
      mint,
      treasuryPda,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const treasuryBalanceBeforeResolve = Buffer.from(
      svm.getAccount(treasuryAta)!.data
    ).readBigUInt64LE(64);
    expect(Number(treasuryBalanceBeforeResolve)).to.equal(1000 * 10 ** 9); // 1 position = 1000 tokens

    // Advance time past epoch end
    const clockBeforeResolve1 = svm.getClock();
    svm.setClock(
      new Clock(
        clockBeforeResolve1.slot + BigInt(70),
        clockBeforeResolve1.epochStartTimestamp,
        clockBeforeResolve1.epoch,
        clockBeforeResolve1.leaderScheduleEpoch,
        clockBeforeResolve1.unixTimestamp + BigInt(70)
      )
    );

    // Resolve epoch 1 with pool 2 as winner (pool 2 has NO participants)
    const [configPda] = findConfigPda(program.programId);
    const [epoch1ResultPda] = findEpochResultPda(EPOCH_1, program.programId);
    const resolveEpoch1Tx = await program.methods
      .resolve(POOL_2)
      .accounts({
        signer: payer.publicKey,
        config: configPda,
        epochResult: epoch1ResultPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts([
        { pubkey: pool1Pda, isSigner: false, isWritable: true },
        { pubkey: pool2Pda, isSigner: false, isWritable: true },
      ])
      .transaction();

    resolveEpoch1Tx.recentBlockhash = svm.latestBlockhash();
    resolveEpoch1Tx.feePayer = payer.publicKey;
    resolveEpoch1Tx.sign(payer);
    svm.sendTransaction(resolveEpoch1Tx);

    // Verify epoch 1 result
    const epoch1ResultAccount = svm.getAccount(epoch1ResultPda);
    expect(epoch1ResultAccount).to.not.be.null;
    const epoch1Result = program.coder.accounts.decode(
      "epochResult",
      Buffer.from(epoch1ResultAccount!.data)
    );
    expect(epoch1Result.winningPoolId).to.equal(POOL_2);
    expect(epoch1Result.weight.toNumber()).to.equal(0); // Pool 2 has no participants
    expect(epoch1Result.totalPositionAmount.toNumber()).to.equal(1); // 1 position total (in pool 1)

    // User1 tries to claim from pool 1 - should fail because pool 1 lost
    try {
      const claimTx = await program.methods
        .claim(POOL_1, new BN(EPOCH_1))
        .accounts({
          signer: user1.publicKey,
          tokenMint: mint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .transaction();

      claimTx.recentBlockhash = svm.latestBlockhash();
      claimTx.feePayer = user1.publicKey;
      claimTx.sign(user1);
      svm.sendTransaction(claimTx);

      expect.fail("Should have failed - user committed to losing pool");
    } catch (error) {
      // Expected - user committed to losing pool
    }

    // Treasury balance after resolve should REMAIN THE SAME (funds forwarded to next epoch)
    const treasuryBalanceAfterResolve = Buffer.from(
      svm.getAccount(treasuryAta)!.data
    ).readBigUInt64LE(64);
    expect(Number(treasuryBalanceAfterResolve)).to.equal(
      Number(treasuryBalanceBeforeResolve)
    );

    // Now test epoch 2: new user wins and should get BOTH epoch 1 + epoch 2 funds
    const user2 = Keypair.generate();
    svm.airdrop(user2.publicKey, BigInt(10 * LAMPORTS_PER_SOL));

    // Transfer tokens to user2
    const user2Ata = await getAssociatedTokenAddress(
      mint,
      user2.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const createUser2AtaIx = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      user2Ata,
      user2.publicKey,
      mint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transferToUser2Ix = createTransferCheckedInstruction(
      payerAta,
      mint,
      user2Ata,
      payer.publicKey,
      10_000 * 10 ** 9,
      9,
      [],
      TOKEN_2022_PROGRAM_ID
    );

    const setupUser2Tx = new anchor.web3.Transaction().add(
      createUser2AtaIx,
      transferToUser2Ix
    );
    setupUser2Tx.recentBlockhash = svm.latestBlockhash();
    setupUser2Tx.feePayer = payer.publicKey;
    setupUser2Tx.sign(payer);
    svm.sendTransaction(setupUser2Tx);

    // User2 mints position
    const [user2Position] = findPositionPda(
      user2.publicKey,
      0,
      program.programId
    );
    const user2MintTx = await program.methods
      .mintPosition()
      .accounts({
        signer: user2.publicKey,
        position: user2Position,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    user2MintTx.recentBlockhash = svm.latestBlockhash();
    user2MintTx.feePayer = user2.publicKey;
    user2MintTx.sign(user2);
    svm.sendTransaction(user2MintTx);

    // Advance clock to give the position some weight
    let clock = svm.getClock();
    svm.setClock(
      new Clock(
        clock.slot + BigInt(100),
        clock.epochStartTimestamp,
        clock.epoch,
        clock.leaderScheduleEpoch,
        clock.unixTimestamp + BigInt(60)
      )
    );

    // Initialize pool 0 for epoch 2
    const EPOCH_2 = 2;
    const POOL_0 = 0;
    const poolNbr = 1;
    const [pool3Pda] = findPoolPda(POOL_0, EPOCH_2, program.programId);
    const initPool3Tx = await program.methods
      .initializePool(poolNbr)
      .accounts({
        signer: payer.publicKey,
      })
      .remainingAccounts([
        {
          pubkey: pool3Pda,
          isSigner: false,
          isWritable: true,
        }
      ])
      .transaction();

    initPool3Tx.recentBlockhash = svm.latestBlockhash();
    initPool3Tx.feePayer = payer.publicKey;
    initPool3Tx.sign(payer);
    svm.sendTransaction(initPool3Tx);

    // User2 commits to pool 3
    const [user2Commitment] = findCommitmentPda(
      user2.publicKey,
      POOL_0,
      EPOCH_2,
      program.programId
    );

    const commitUser2Tx = await program.methods
      .commit(new BN(0), POOL_0)
      .accounts({
        signer: user2.publicKey,
        position: user2Position,
        commitment: user2Commitment,
      })
      .transaction();

    commitUser2Tx.recentBlockhash = svm.latestBlockhash();
    commitUser2Tx.feePayer = user2.publicKey;
    commitUser2Tx.sign(user2);
    svm.sendTransaction(commitUser2Tx);

    // Check treasury balance before epoch 2 resolve (should have 1000 from epoch 1 + 1000 from epoch 2 = 2000)
    const treasuryBalanceBeforeEpoch2Resolve = Buffer.from(
      svm.getAccount(treasuryAta)!.data
    ).readBigUInt64LE(64);
    expect(Number(treasuryBalanceBeforeEpoch2Resolve)).to.equal(2000 * 10 ** 9); // 2 positions = 2000 tokens

    // Advance time past epoch 2 end
    const clockBeforeResolve2 = svm.getClock();
    svm.setClock(
      new Clock(
        clockBeforeResolve2.slot + BigInt(70),
        clockBeforeResolve2.epochStartTimestamp,
        clockBeforeResolve2.epoch,
        clockBeforeResolve2.leaderScheduleEpoch,
        clockBeforeResolve2.unixTimestamp + BigInt(70)
      )
    );

    // Resolve epoch 2 with pool 0 as winner
    const [epoch2ResultPda] = findEpochResultPda(EPOCH_2, program.programId);
    const resolveEpoch2Tx = await program.methods
      .resolve(POOL_0)
      .accounts({
        signer: payer.publicKey,
        config: configPda,
        epochResult: epoch2ResultPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts([{ pubkey: pool3Pda, isSigner: false, isWritable: true }])
      .transaction();

    resolveEpoch2Tx.recentBlockhash = svm.latestBlockhash();
    resolveEpoch2Tx.feePayer = payer.publicKey;
    resolveEpoch2Tx.sign(payer);
    logSvmResult(`resolveEpoch2Tx`, svm.sendTransaction(resolveEpoch2Tx));

    // Verify epoch 2 result
    const epoch2ResultAccount = svm.getAccount(epoch2ResultPda);
    expect(epoch2ResultAccount).to.not.be.null;
    const epoch2Result = program.coder.accounts.decode(
      "epochResult",
      Buffer.from(epoch2ResultAccount!.data)
    );
    expect(epoch2Result.winningPoolId).to.equal(POOL_0);
    expect(epoch2Result.weight.toNumber()).to.be.greaterThan(0);
    expect(epoch2Result.totalPositionAmount.toNumber()).to.equal(2); // 1 from epoch 1 + 1 from epoch 2

    // User2 claims reward - should get ALL 2000 tokens (epoch 1 + epoch 2)
    const user2BalanceBefore = Buffer.from(
      svm.getAccount(user2Ata)!.data
    ).readBigUInt64LE(64);

    const claimUser2Tx = await program.methods
      .claim(POOL_0, new BN(EPOCH_2))
      .accounts({
        signer: user2.publicKey,
        tokenMint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    claimUser2Tx.recentBlockhash = svm.latestBlockhash();
    claimUser2Tx.feePayer = user2.publicKey;
    claimUser2Tx.sign(user2);
    svm.sendTransaction(claimUser2Tx);

    const user2BalanceAfter = Buffer.from(
      svm.getAccount(user2Ata)!.data
    ).readBigUInt64LE(64);
    const user2Reward = user2BalanceAfter - user2BalanceBefore;

    // THIS IS THE KEY TEST: User2 should receive 2000 tokens (both epochs)
    expect(Number(user2Reward)).to.equal(2000 * 10 ** 9);
  });
});
