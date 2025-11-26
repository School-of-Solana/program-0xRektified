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
  logSvmResult
} from "./utils";

const IDL = require("../target/idl/anchor_project.json");
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

describe("Commit Position", () => {
  let svm: LiteSVM;
  let provider: LiteSVMProvider;
  let program: Program<AnchorProject>;
  let payer: Keypair;
  let mint: PublicKey;
  let recipientAta: PublicKey;
  let configPda: PublicKey;

  beforeEach(async () => {
    payer = Keypair.generate();

    svm = fromWorkspace("./").withBuiltins().withSysvars();

    const c = svm.getClock();
    const currentTime = Math.floor(Date.now() / 1000);
    svm.setClock(
      new Clock(c.slot, c.epochStartTimestamp, c.epoch, c.leaderScheduleEpoch, BigInt(currentTime))
    );

    provider = new LiteSVMProvider(svm);
    anchor.setProvider(provider);

    // Create a fresh program instance instead of using the global workspace
    program = new anchor.Program<AnchorProject>(IDL as any, provider);

    svm.airdrop(payer.publicKey, BigInt(10 * LAMPORTS_PER_SOL));

    [configPda] = findConfigPda(program.programId);

    const res = await createAndMintToken2022(
      svm,
      payer,
      payer.publicKey,
      9
    );
    mint = res.mint;
    recipientAta = res.recipientAta;
    console.log("Token-2022 mint:", mint.toString());
    console.log("Recipient Ata:", recipientAta.toString());
  });

  it("Commits first position to pool", async () => {
    const weightModel = { timeBased: {} };
    const resolutionType = { admin: {} };
    const initTx = await program.methods
      .initialize(weightModel, resolutionType, payer.publicKey, new BN(EPOCH_DURATION), new BN(WEIGHT_RATE_NUMERATOR), new BN(WEIGHT_RATE_DENOMINATOR))
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

    let configInfo = svm.getAccount(configPda);
    let config = program.coder.accounts.decode(
      "config",
      Buffer.from(configInfo!.data)
    );

    const [positionPda] = findPositionPda(payer.publicKey, 0, program.programId);
    const mintPositionTx = await program.methods
      .mintPosition()
      .accounts({
        signer: payer.publicKey,
        position: positionPda,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    mintPositionTx.recentBlockhash = svm.latestBlockhash();
    mintPositionTx.feePayer = payer.publicKey;
    mintPositionTx.sign(payer);
    svm.sendTransaction(mintPositionTx);

    let positionInfo = svm.getAccount(positionPda);
    expect(positionInfo).to.not.be.null;

    const oldClock = svm.getClock();
    svm.setClock(
      new Clock(
        oldClock.slot + 100n,
        oldClock.epochStartTimestamp,
        oldClock.epoch,
        oldClock.leaderScheduleEpoch,
        oldClock.unixTimestamp + 60n
      )
    );

    const poolId = 0;
    const epoch = 1;
    const [poolPda] = findPoolPda(poolId, epoch, program.programId);
    const initPoolTx = await program.methods
      .initializePool(1)
      .accounts({
        signer: payer.publicKey,
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
    initPoolTx.feePayer = payer.publicKey;
    initPoolTx.sign(payer);
    let initTxRes = svm.sendTransaction(initPoolTx);
      console.log(`initTxRes`);
      console.log(initTxRes);
    let poolInfo = svm.getAccount(poolPda);
    let pool = program.coder.accounts.decode("pool", Buffer.from(poolInfo!.data));
    expect(pool.totalPositions.toNumber()).to.equal(0);
    expect(pool.totalWeight.toNumber()).to.equal(0);
    expect(pool.id).to.equal(poolId);
    expect(pool.epoch.toNumber()).to.equal(epoch);

    const [commitmentPda] = findCommitmentPda(
      payer.publicKey,
      poolId,
      epoch,
      program.programId
    );
    const commitTx = await program.methods
      .commit(new anchor.BN(0), poolId)
      .accounts({
        signer: payer.publicKey,
        position: positionPda,
        commitment: commitmentPda,
      })
      .transaction();

    commitTx.recentBlockhash = svm.latestBlockhash();
    commitTx.feePayer = payer.publicKey;
    commitTx.sign(payer);
    let poolCommitTx = svm.sendTransaction(commitTx);
    logSvmResult("poolCommitTx", poolCommitTx);

      console.log(`poolCommitTx`);
      console.log(poolCommitTx);
    positionInfo = svm.getAccount(positionPda);
    expect(positionInfo).to.be.null;

    const commitmentInfo = svm.getAccount(commitmentPda);
    expect(commitmentInfo).to.not.be.null;
    const commitment = program.coder.accounts.decode(
      "commitment",
      Buffer.from(commitmentInfo!.data)
    );

    expect(commitment.userPk.toString()).to.equal(payer.publicKey.toString());
    expect(commitment.positionAmount.toNumber()).to.equal(1);
    expect(commitment.weight.toNumber()).to.be.greaterThan(0);
    expect(commitment.poolId).to.equal(poolId);
    expect(commitment.epoch.toNumber()).to.equal(epoch);

    poolInfo = svm.getAccount(poolPda);
    pool = program.coder.accounts.decode("pool", Buffer.from(poolInfo!.data));
    expect(pool.totalPositions.toNumber()).to.equal(1);
    expect(pool.totalWeight.toNumber()).to.be.greaterThan(0);
    expect(pool.totalWeight.toNumber()).to.equal(commitment.weight.toNumber());
  });

  it("Accumulates multiple commitments from same user", async () => {
    const weightModel = { timeBased: {} };
    const resolutionType = { admin: {} };
    const initTx = await program.methods
      .initialize(weightModel, resolutionType, payer.publicKey, new BN(EPOCH_DURATION), new BN(WEIGHT_RATE_NUMERATOR), new BN(WEIGHT_RATE_DENOMINATOR))
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

    let configInfo = svm.getAccount(configPda);
    let config = program.coder.accounts.decode(
      "config",
      Buffer.from(configInfo!.data)
    );

    const [position1Pda] = findPositionPda(payer.publicKey, 0, program.programId);
    const mintPosition1Tx = await program.methods
      .mintPosition()
      .accounts({
        signer: payer.publicKey,
        position: position1Pda,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    mintPosition1Tx.recentBlockhash = svm.latestBlockhash();
    mintPosition1Tx.feePayer = payer.publicKey;
    mintPosition1Tx.sign(payer);
    svm.sendTransaction(mintPosition1Tx);

    const [position2Pda] = findPositionPda(payer.publicKey, 1, program.programId);
    const mintPosition2Tx = await program.methods
      .mintPosition()
      .accounts({
        signer: payer.publicKey,
        position: position2Pda,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    mintPosition2Tx.recentBlockhash = svm.latestBlockhash();
    mintPosition2Tx.feePayer = payer.publicKey;
    mintPosition2Tx.sign(payer);
    svm.sendTransaction(mintPosition2Tx);

    const oldClock = svm.getClock();
    svm.setClock(
      new Clock(
        oldClock.slot + 100n,
        oldClock.epochStartTimestamp,
        oldClock.epoch,
        oldClock.leaderScheduleEpoch,
        oldClock.unixTimestamp + 120n
      )
    );

    const poolId = 0;
    const epoch = 1;
    const [poolPda] = findPoolPda(poolId, epoch, program.programId);
    const initPoolTx = await program.methods
      .initializePool(1)
      .accounts({
        signer: payer.publicKey,
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
    initPoolTx.feePayer = payer.publicKey;
    initPoolTx.sign(payer);
    svm.sendTransaction(initPoolTx);

    const [commitmentPda] = findCommitmentPda(
      payer.publicKey,
      poolId,
      epoch,
      program.programId
    );
    const commit1Tx = await program.methods
      .commit(new anchor.BN(0), poolId)
      .accounts({
        signer: payer.publicKey,
        position: position1Pda,
        commitment: commitmentPda,
      })
      .transaction();

    commit1Tx.recentBlockhash = svm.latestBlockhash();
    commit1Tx.feePayer = payer.publicKey;
    commit1Tx.sign(payer);
    svm.sendTransaction(commit1Tx);

    let position1Info = svm.getAccount(position1Pda);
    expect(position1Info).to.be.null;

    let commitmentInfo = svm.getAccount(commitmentPda);
    let commitment = program.coder.accounts.decode(
      "commitment",
      Buffer.from(commitmentInfo!.data)
    );
    const weightAfterFirst = commitment.weight.toNumber();
    expect(commitment.positionAmount.toNumber()).to.equal(1);

    const commit2Tx = await program.methods
      .commit(new anchor.BN(1), poolId)
      .accounts({
        signer: payer.publicKey,
        position: position2Pda,
        commitment: commitmentPda,
      })
      .transaction();

    commit2Tx.recentBlockhash = svm.latestBlockhash();
    commit2Tx.feePayer = payer.publicKey;
    commit2Tx.sign(payer);
    svm.sendTransaction(commit2Tx);

    let position2Info = svm.getAccount(position2Pda);
    expect(position2Info).to.be.null;

    commitmentInfo = svm.getAccount(commitmentPda);
    commitment = program.coder.accounts.decode(
      "commitment",
      Buffer.from(commitmentInfo!.data)
    );
    expect(commitment.positionAmount.toNumber()).to.equal(2);
    expect(commitment.weight.toNumber()).to.be.greaterThan(weightAfterFirst);

    let poolInfo = svm.getAccount(poolPda);
    let pool = program.coder.accounts.decode("pool", Buffer.from(poolInfo!.data));
    expect(pool.totalPositions.toNumber()).to.equal(2);
    expect(pool.totalWeight.toNumber()).to.equal(commitment.weight.toNumber());
  });

  it("Tracks separate commitments per epoch", async () => {
    const weightModel = { timeBased: {} };
    const resolutionType = { admin: {} };
    const initTx = await program.methods
      .initialize(weightModel, resolutionType, payer.publicKey, new BN(EPOCH_DURATION), new BN(WEIGHT_RATE_NUMERATOR), new BN(WEIGHT_RATE_DENOMINATOR))
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

    let configInfo = svm.getAccount(configPda);
    let config = program.coder.accounts.decode(
      "config",
      Buffer.from(configInfo!.data)
    );

    const [position1Pda] = findPositionPda(payer.publicKey, 0, program.programId);
    const mintPosition1Tx = await program.methods
      .mintPosition()
      .accounts({
        signer: payer.publicKey,
        position: position1Pda,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    mintPosition1Tx.recentBlockhash = svm.latestBlockhash();
    mintPosition1Tx.feePayer = payer.publicKey;
    mintPosition1Tx.sign(payer);
    svm.sendTransaction(mintPosition1Tx);

    const [position2Pda] = findPositionPda(payer.publicKey, 1, program.programId);
    const mintPosition2Tx = await program.methods
      .mintPosition()
      .accounts({
        signer: payer.publicKey,
        position: position2Pda,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    mintPosition2Tx.recentBlockhash = svm.latestBlockhash();
    mintPosition2Tx.feePayer = payer.publicKey;
    mintPosition2Tx.sign(payer);
    svm.sendTransaction(mintPosition2Tx);

    const oldClock = svm.getClock();
    svm.setClock(
      new Clock(
        oldClock.slot + 100n,
        oldClock.epochStartTimestamp,
        oldClock.epoch,
        oldClock.leaderScheduleEpoch,
        oldClock.unixTimestamp + 90n
      )
    );

    const poolId = 0;
    const epoch1 = 1;
    const [poolPda] = findPoolPda(poolId, epoch1, program.programId);
    const initPool1Tx = await program.methods
      .initializePool(1)
      .accounts({
        signer: payer.publicKey,
      })
      .remainingAccounts([
        {
          pubkey: poolPda,
          isSigner: false,
          isWritable: true,
        }
      ])
      .transaction();

    initPool1Tx.recentBlockhash = svm.latestBlockhash();
    initPool1Tx.feePayer = payer.publicKey;
    initPool1Tx.sign(payer);
    svm.sendTransaction(initPool1Tx);

    const [commitment1Pda] = findCommitmentPda(
      payer.publicKey,
      poolId,
      epoch1,
      program.programId
    );

    const commit1Tx = await program.methods
      .commit(new anchor.BN(0), poolId)
      .accounts({
        signer: payer.publicKey,
        position: position1Pda,
        commitment: commitment1Pda,
      })
      .transaction();

    commit1Tx.recentBlockhash = svm.latestBlockhash();
    commit1Tx.feePayer = payer.publicKey;
    commit1Tx.sign(payer);
    svm.sendTransaction(commit1Tx);

    let commitment1Info = svm.getAccount(commitment1Pda);
    expect(commitment1Info).to.not.be.null;
    let commitment1 = program.coder.accounts.decode(
      "commitment",
      Buffer.from(commitment1Info!.data)
    );
    expect(commitment1.epoch.toNumber()).to.equal(epoch1);
    expect(commitment1.positionAmount.toNumber()).to.equal(1);

    // @note TODO add admin method to switch to next epoc
    const epoch2 = 2;

    // The commitment PDA for epoch 2 should be different
    const [commitment2Pda] = findCommitmentPda(
      payer.publicKey,
      poolId,
      epoch2,
      program.programId
    );

    // Verify the PDAs are different
    expect(commitment1Pda.toString()).to.not.equal(commitment2Pda.toString());

    // Verify epoch 2 commitment doesn't exist yet
    let commitment2Info = svm.getAccount(commitment2Pda);
    expect(commitment2Info).to.be.null;

    console.log("Epoch 1 commitment PDA:", commitment1Pda.toString());
    console.log("Epoch 2 commitment PDA:", commitment2Pda.toString());
    console.log("Commitments are properly separated by epoch");
  });

  it("Prevents commits after epoch ends", async () => {
    const weightModel = { timeBased: {} };
    const resolutionType = { admin: {} };
    const initTx = await program.methods
      .initialize(weightModel, resolutionType, payer.publicKey, new BN(EPOCH_DURATION), new BN(WEIGHT_RATE_NUMERATOR), new BN(WEIGHT_RATE_DENOMINATOR))
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

    const [positionPda] = findPositionPda(payer.publicKey, 0, program.programId);
    const mintPositionTx = await program.methods
      .mintPosition()
      .accounts({
        signer: payer.publicKey,
        position: positionPda,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    mintPositionTx.recentBlockhash = svm.latestBlockhash();
    mintPositionTx.feePayer = payer.publicKey;
    mintPositionTx.sign(payer);
    svm.sendTransaction(mintPositionTx);

    // Initialize pool first - this sets end_at = current_time + EPOCH_DURATION (60 seconds)
    const poolId = 0;
    const epoch = 1;
    const [poolPda] = findPoolPda(poolId, epoch, program.programId);
    const initPoolTx = await program.methods
      .initializePool(1)
      .accounts({
        signer: payer.publicKey,
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
    initPoolTx.feePayer = payer.publicKey;
    initPoolTx.sign(payer);
    svm.sendTransaction(initPoolTx);

    // Now advance time by 70 seconds (beyond the 60 second EPOCH_DURATION)
    const oldClock = svm.getClock();
    svm.setClock(
      new Clock(
        oldClock.slot + BigInt(100),
        oldClock.epochStartTimestamp,
        oldClock.epoch,
        oldClock.leaderScheduleEpoch,
        oldClock.unixTimestamp + BigInt(70)  // 70 seconds > 60 second epoch duration
      )
    );

    // Try to commit after epoch ends - should fail
    const [commitmentPda] = findCommitmentPda(
      payer.publicKey,
      poolId,
      epoch,
      program.programId
    );

    const commitTx = await program.methods
      .commit(new anchor.BN(0), poolId)
      .accountsPartial({
        signer: payer.publicKey,
        position: positionPda,
        commitment: commitmentPda,
      })
      .transaction();

    commitTx.recentBlockhash = svm.latestBlockhash();
    commitTx.feePayer = payer.publicKey;
    commitTx.sign(payer);
    const result = svm.sendTransaction(commitTx) as any;

    // Check that the transaction failed with EpochEnded error
    expect(typeof result.err).to.equal("function");
    const meta = result.meta();
    const logs = meta.logs().join("\n");
    expect(logs).to.include("EpochEnded");
  });
});
