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
  setupVrfMock,
  EPOCH_DURATION,
  WEIGHT_RATE_NUMERATOR,
  WEIGHT_RATE_DENOMINATOR
} from "./utils";

const IDL = require("../target/idl/anchor_project.json");
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("Multi-Round Wallet Weight Distribution", () => {
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

  it("Distributes rewards proportionally based on weight among multiple winners", async () => {
    // This test requires a fresh setup with 3 winners in the same pool
    const winner1 = Keypair.generate();
    const winner2 = Keypair.generate();
    const winner3 = Keypair.generate();

    svm.airdrop(winner1.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
    svm.airdrop(winner2.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
    svm.airdrop(winner3.publicKey, BigInt(10 * LAMPORTS_PER_SOL));

    // Create and mint tokens to all three winners
    const payerAta = await getAssociatedTokenAddress(
      mint,
      payer.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    for (const w of [winner1, winner2, winner3]) {
      const ata = await getAssociatedTokenAddress(
        mint,
        w.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const createAtaIx = createAssociatedTokenAccountInstruction(
        payer.publicKey,
        ata,
        w.publicKey,
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const transferIx = createTransferCheckedInstruction(
        payerAta,
        mint,
        ata,
        payer.publicKey,
        10_000 * 10 ** 9,
        9,
        [],
        TOKEN_2022_PROGRAM_ID
      );

      const tx = new anchor.web3.Transaction().add(createAtaIx, transferIx);
      tx.recentBlockhash = svm.latestBlockhash();
      tx.feePayer = payer.publicKey;
      tx.sign(payer);
      svm.sendTransaction(tx);
    }

    // Winner1 mints position earliest (will have highest weight)
    const [winner1Position] = findPositionPda(
      winner1.publicKey,
      0,
      program.programId
    );
    const winner1MintTx = await program.methods
      .mintPosition()
      .accounts({
        signer: winner1.publicKey,
        position: winner1Position,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    winner1MintTx.recentBlockhash = svm.latestBlockhash();
    winner1MintTx.feePayer = winner1.publicKey;
    winner1MintTx.sign(winner1);
    svm.sendTransaction(winner1MintTx);

    // Advance clock 30 seconds
    let clock = svm.getClock();
    svm.setClock(
      new Clock(
        clock.slot + BigInt(50),
        clock.epochStartTimestamp,
        clock.epoch,
        clock.leaderScheduleEpoch,
        clock.unixTimestamp + BigInt(30)
      )
    );

    // Winner2 mints position (medium weight)
    const [winner2Position] = findPositionPda(
      winner2.publicKey,
      0,
      program.programId
    );
    const winner2MintTx = await program.methods
      .mintPosition()
      .accounts({
        signer: winner2.publicKey,
        position: winner2Position,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    winner2MintTx.recentBlockhash = svm.latestBlockhash();
    winner2MintTx.feePayer = winner2.publicKey;
    winner2MintTx.sign(winner2);
    svm.sendTransaction(winner2MintTx);

    // Advance clock another 30 seconds
    clock = svm.getClock();
    svm.setClock(
      new Clock(
        clock.slot + BigInt(50),
        clock.epochStartTimestamp,
        clock.epoch,
        clock.leaderScheduleEpoch,
        clock.unixTimestamp + BigInt(30)
      )
    );

    // Winner3 mints position latest (lowest weight)
    const [winner3Position] = findPositionPda(
      winner3.publicKey,
      0,
      program.programId
    );
    const winner3MintTx = await program.methods
      .mintPosition()
      .accounts({
        signer: winner3.publicKey,
        position: winner3Position,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    winner3MintTx.recentBlockhash = svm.latestBlockhash();
    winner3MintTx.feePayer = winner3.publicKey;
    winner3MintTx.sign(winner3);
    svm.sendTransaction(winner3MintTx);

    // Advance clock before committing
    clock = svm.getClock();
    svm.setClock(
      new Clock(
        clock.slot + BigInt(100),
        clock.epochStartTimestamp,
        clock.epoch,
        clock.leaderScheduleEpoch,
        clock.unixTimestamp + BigInt(60)
      )
    );

    // Initialize pool 0 for epoch 1
    const POOL_ID = 0;
    const EPOCH = 1;
    const [pool0Pda] = findPoolPda(POOL_ID, EPOCH, program.programId);
    const initPool0Tx = await program.methods
      .initializePool(1)
      .accounts({
        signer: payer.publicKey,
      })
      .remainingAccounts([
        {
          pubkey: pool0Pda,
          isSigner: false,
          isWritable: true,
        }
      ])
      .transaction();

    initPool0Tx.recentBlockhash = svm.latestBlockhash();
    initPool0Tx.feePayer = payer.publicKey;
    initPool0Tx.sign(payer);
    svm.sendTransaction(initPool0Tx);

    // Verify pool was created
    const poolAccount = svm.getAccount(pool0Pda);
    expect(poolAccount).to.not.be.null;
    const poolData = program.coder.accounts.decode(
      "pool",
      Buffer.from(poolAccount!.data)
    );
    expect(poolData.id).to.equal(POOL_ID);
    expect(poolData.epoch.toNumber()).to.equal(EPOCH);

    // All three winners commit to pool 0
    for (let i = 0; i < 3; i++) {
      const w = [winner1, winner2, winner3][i];
      const pos = [winner1Position, winner2Position, winner3Position][i];
      const [commitmentPda] = findCommitmentPda(
        w.publicKey,
        POOL_ID,
        EPOCH,
        program.programId
      );

      const commitTx = await program.methods
        .commit(new BN(0), POOL_ID)
        .accounts({
          signer: w.publicKey,
          position: pos,
          commitment: commitmentPda,
        })
        .transaction();

      commitTx.recentBlockhash = svm.latestBlockhash();
      commitTx.feePayer = w.publicKey;
      commitTx.sign(w);
      svm.sendTransaction(commitTx);
    }

    // Get commitments to check weights
    const commitments = [];
    for (const w of [winner1, winner2, winner3]) {
      const [commitmentPda] = findCommitmentPda(
        w.publicKey,
        POOL_ID,
        EPOCH,
        program.programId
      );
      const commitmentAccount = svm.getAccount(commitmentPda);
      expect(commitmentAccount).to.not.be.null;

      if (commitmentAccount) {
        // Commitment layout: discriminator (8) + user_pk (32) + position_amount (8) + weight (8) + pool_id (1) + epoch (8)
        const commitment = program.coder.accounts.decode(
          "commitment",
          Buffer.from(commitmentAccount.data)
        );
        commitments.push({ user: w, weight: commitment.weight });
      }
    }

    // Advance time past epoch end
    const clockBeforeResolve = svm.getClock();
    svm.setClock(
      new Clock(
        clockBeforeResolve.slot + BigInt(70),
        clockBeforeResolve.epochStartTimestamp,
        clockBeforeResolve.epoch,
        clockBeforeResolve.leaderScheduleEpoch,
        clockBeforeResolve.unixTimestamp + BigInt(70)
      )
    );

    // Resolve with pool 0 as winner
    const [configPda] = findConfigPda(program.programId);
    const [epochResultPda] = findEpochResultPda(EPOCH, program.programId);
    const resolveTx = await program.methods
      .resolve(POOL_ID)
      .accounts({
        signer: payer.publicKey,
        config: configPda,
        epochResult: epochResultPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts([{ pubkey: pool0Pda, isSigner: false, isWritable: true }])
      .transaction();

    resolveTx.recentBlockhash = svm.latestBlockhash();
    resolveTx.feePayer = payer.publicKey;
    resolveTx.sign(payer);
    svm.sendTransaction(resolveTx);

    // All claim their rewards
    const rewards = [];
    for (let i = 0; i < 3; i++) {
      const w = [winner1, winner2, winner3][i];
      const ata = await getAssociatedTokenAddress(
        mint,
        w.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const balanceBefore = Buffer.from(
        svm.getAccount(ata)!.data
      ).readBigUInt64LE(64);

      const claimTx = await program.methods
        .claim(POOL_ID, new BN(EPOCH))
        .accounts({
          signer: w.publicKey,
          tokenMint: mint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .transaction();

      claimTx.recentBlockhash = svm.latestBlockhash();
      claimTx.feePayer = w.publicKey;
      claimTx.sign(w);
      svm.sendTransaction(claimTx);

      const balanceAfter = Buffer.from(
        svm.getAccount(ata)!.data
      ).readBigUInt64LE(64);
      const reward = balanceAfter - balanceBefore;
      rewards.push(reward);

      console.log(`Winner${i + 1} reward:`, reward);
    }

    // Verify proportional distribution based on weight
    // Winner1 (earliest, highest weight) should receive more than Winner2
    expect(Number(rewards[0])).to.be.greaterThan(Number(rewards[1]));
    // Winner2 (medium weight) should receive more than Winner3
    expect(Number(rewards[1])).to.be.greaterThan(Number(rewards[2]));

    // Verify the reward ratios match the weight ratios
    const weight1 = Number(commitments[0].weight);
    const weight2 = Number(commitments[1].weight);
    const weight3 = Number(commitments[2].weight);

    const reward1 = Number(rewards[0]);
    const reward2 = Number(rewards[1]);
    const reward3 = Number(rewards[2]);

    // Check that reward ratios approximately match weight ratios (within 1% tolerance)
    const weightRatio12 = weight1 / weight2;
    const rewardRatio12 = reward1 / reward2;
    expect(Math.abs(weightRatio12 - rewardRatio12) / weightRatio12).to.be.lessThan(
      0.01
    );

    const weightRatio23 = weight2 / weight3;
    const rewardRatio23 = reward2 / reward3;
    expect(Math.abs(weightRatio23 - rewardRatio23) / weightRatio23).to.be.lessThan(
      0.01
    );
  });
});
