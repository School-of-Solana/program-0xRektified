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
  setupVrfMock,
  EPOCH_DURATION,
  WEIGHT_RATE_NUMERATOR,
  WEIGHT_RATE_DENOMINATOR
} from "./utils";

const IDL = require("../target/idl/anchor_project.json");
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

function findEpochResultPda(
  epoch: number,
  programId: PublicKey
): [PublicKey, number] {
  const epochBuffer = Buffer.alloc(8);
  epochBuffer.writeBigUInt64LE(BigInt(epoch));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("epoch_result"), epochBuffer],
    programId
  );
}

describe("Resolve", () => {
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

    // Setup VRF mock (required by #[vrf] macro)
    setupVrfMock(svm);

    [configPda] = findConfigPda(program.programId);

    const res = await createAndMintToken2022(svm, payer, payer.publicKey, 9);
    mint = res.mint;
    recipientAta = res.recipientAta;
  });

  it("Resolves epoch with single pool and single commitment", async () => {
    const weightModel = { timeBased: {} };
    const resolutionType = { admin: {} };

    // Initialize config
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
    expect(config.currentEpoch.toNumber()).to.equal(1);

    // Mint position
    const [positionPda] = findPositionPda(payer.publicKey, 0, program.programId);
    const mintPositionTx = await program.methods
      .mintPosition()
      .accounts({
        signer: payer.publicKey,
        position: positionPda,
        mint: mint,
        treasuryAta: config.treasuryAta,
        userAta: recipientAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    mintPositionTx.recentBlockhash = svm.latestBlockhash();
    mintPositionTx.feePayer = payer.publicKey;
    mintPositionTx.sign(payer);
    svm.sendTransaction(mintPositionTx);

    // Advance time
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

    // Initialize pool
    const poolId = 0;
    const [poolPda] = findPoolPda(poolId, 1, program.programId);
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

    // Commit position to pool
    const [commitmentPda] = findCommitmentPda(
      payer.publicKey,
      poolId,
      1,
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
    svm.sendTransaction(commitTx);

    // Verify pool state before resolution
    let poolInfo = svm.getAccount(poolPda);
    let pool = program.coder.accounts.decode("pool", Buffer.from(poolInfo!.data));
    expect(pool.totalPositions.toNumber()).to.equal(1);
    expect(pool.totalWeight.toNumber()).to.be.greaterThan(0);
    const poolWeight = pool.totalWeight.toNumber();
    // Advance time past epoch end (EPOCH_DURATION is 60 seconds)
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
    const [epochResultPda] = findEpochResultPda(1, program.programId);
    const resolveTx = await program.methods
      .resolve(poolId)
      .accounts({
        signer: payer.publicKey,
        config: configPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts([
        {
          pubkey: poolPda,
          isSigner: false,
          isWritable: true,
        },
      ])
      .transaction();

    resolveTx.recentBlockhash = svm.latestBlockhash();
    resolveTx.feePayer = payer.publicKey;
    resolveTx.sign(payer);

    svm.sendTransaction(resolveTx);

    // Verify epoch was incremented
    configInfo = svm.getAccount(configPda);
    config = program.coder.accounts.decode("config", Buffer.from(configInfo!.data));
    // console.log(config);
    expect(config.currentEpoch.toNumber()).to.equal(2);

    // Verify EpochResult was created with correct data
    const epochResultInfo = svm.getAccount(epochResultPda);
    expect(epochResultInfo).to.not.be.null;
    const epochResult = program.coder.accounts.decode(
      "epochResult",
      Buffer.from(epochResultInfo!.data)
    );
    expect(epochResult.epoch.toNumber()).to.equal(1);
    expect(epochResult.winningPoolId).to.equal(poolId);
    expect(epochResult.weight.toNumber()).to.equal(poolWeight);
    expect(epochResult.totalPositionAmount.toNumber()).to.equal(1);

    // Verify pool was deleted
    poolInfo = svm.getAccount(poolPda);
    expect(poolInfo).to.be.null;
  });

  it("Resolves epoch with multiple pools", async () => {
    const weightModel = { timeBased: {} };
    const resolutionType = { admin: {} };

    // Initialize
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

    // Mint 3 positions
    const positions = [];
    for (let i = 0; i < 3; i++) {
      const [positionPda] = findPositionPda(payer.publicKey, i, program.programId);
      positions.push(positionPda);
      const mintTx = await program.methods
        .mintPosition()
        .accounts({
          signer: payer.publicKey,
          position: positionPda,
          mint: mint,
          treasuryAta: config.treasuryAta,
          userAta: recipientAta,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .transaction();

      mintTx.recentBlockhash = svm.latestBlockhash();
      mintTx.feePayer = payer.publicKey;
      mintTx.sign(payer);
      svm.sendTransaction(mintTx);
    }

    // Advance time
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

    // Initialize 3 pools in a single transaction
    const pools = [];
    for (let poolId = 0; poolId < 3; poolId++) {
      const [poolPda] = findPoolPda(poolId, 1, program.programId);
      pools.push(poolPda);
    }

    const initPoolsTx = await program.methods
      .initializePool(3)
      .accounts({
        signer: payer.publicKey,
      })
      .remainingAccounts(
        pools.map((pubkey) => ({
          pubkey,
          isSigner: false,
          isWritable: true,
        }))
      )
      .transaction();
    initPoolsTx.recentBlockhash = svm.latestBlockhash();
    initPoolsTx.feePayer = payer.publicKey;
    initPoolsTx.sign(payer);
    svm.sendTransaction(initPoolsTx);

    // Commit positions: pool 0 gets 1 position, pool 1 gets 2 positions, pool 2 gets 0
    const commitTx1 = await program.methods
      .commit(new anchor.BN(0), 0)
      .accounts({
        signer: payer.publicKey,
        position: positions[0],
        commitment: findCommitmentPda(payer.publicKey, 0, 1, program.programId)[0],
      })
      .transaction();

    commitTx1.recentBlockhash = svm.latestBlockhash();
    commitTx1.feePayer = payer.publicKey;
    commitTx1.sign(payer);
    svm.sendTransaction(commitTx1);

    const commitTx2 = await program.methods
      .commit(new anchor.BN(1), 1)
      .accounts({
        signer: payer.publicKey,
        position: positions[1],
        commitment: findCommitmentPda(payer.publicKey, 1, 1, program.programId)[0],
      })
      .transaction();

    commitTx2.recentBlockhash = svm.latestBlockhash();
    commitTx2.feePayer = payer.publicKey;
    commitTx2.sign(payer);
    svm.sendTransaction(commitTx2);

    const commitTx3 = await program.methods
      .commit(new anchor.BN(2), 1)
      .accounts({
        signer: payer.publicKey,
        position: positions[2],
        commitment: findCommitmentPda(payer.publicKey, 1, 1, program.programId)[0],
      })
      .transaction();

    commitTx3.recentBlockhash = svm.latestBlockhash();
    commitTx3.feePayer = payer.publicKey;
    commitTx3.sign(payer);
    svm.sendTransaction(commitTx3);

    // Get pool 1 weight before resolution
    const pool1Info = svm.getAccount(pools[1]);
    const pool1 = program.coder.accounts.decode("pool", Buffer.from(pool1Info!.data));
    const pool1Weight = pool1.totalWeight.toNumber();

    // Advance time past epoch end
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

    // Resolve with pool 1 as winner
    const [epochResultPda] = findEpochResultPda(1, program.programId);
    const resolveTx = await program.methods
      .resolve(1)
      .accounts({
        signer: payer.publicKey,
        config: configPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts(
        pools.map((pubkey) => ({
          pubkey,
          isSigner: false,
          isWritable: true,
        }))
      )
      .transaction();

    resolveTx.recentBlockhash = svm.latestBlockhash();
    resolveTx.feePayer = payer.publicKey;
    resolveTx.sign(payer);
    svm.sendTransaction(resolveTx);

    // Verify epoch incremented
    configInfo = svm.getAccount(configPda);
    config = program.coder.accounts.decode("config", Buffer.from(configInfo!.data));
    expect(config.currentEpoch.toNumber()).to.equal(2);

    // Verify EpochResult
    const epochResultInfo = svm.getAccount(epochResultPda);
    expect(epochResultInfo).to.not.be.null;
    const epochResult = program.coder.accounts.decode(
      "epochResult",
      Buffer.from(epochResultInfo!.data)
    );
    expect(epochResult.epoch.toNumber()).to.equal(1);
    expect(epochResult.winningPoolId).to.equal(1);
    expect(epochResult.weight.toNumber()).to.equal(pool1Weight);
    expect(epochResult.totalPositionAmount.toNumber()).to.equal(3);

    // Verify all pools were deleted
    pools.forEach((poolPda) => {
      const poolInfo = svm.getAccount(poolPda);
      expect(poolInfo).to.be.null;
    });
  });

  it("Allows resolving empty epoch (no commitments)", async () => {
    const weightModel = { timeBased: {} };
    const resolutionType = { admin: {} };

    // Initialize
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

    // Initialize pools but don't commit anything
    const pools = [];
    for (let poolId = 0; poolId < 2; poolId++) {
      const [poolPda] = findPoolPda(poolId, 1, program.programId);
      pools.push(poolPda);
    }

    const initPoolsTx = await program.methods
      .initializePool(2)
      .accounts({
        signer: payer.publicKey,
      })
      .remainingAccounts(
        pools.map((pubkey) => ({
          pubkey,
          isSigner: false,
          isWritable: true,
        }))
      )
      .transaction();
    initPoolsTx.recentBlockhash = svm.latestBlockhash();
    initPoolsTx.feePayer = payer.publicKey;
    initPoolsTx.sign(payer);
    svm.sendTransaction(initPoolsTx);

    // Advance time past epoch end
    const clockBeforeResolve3 = svm.getClock();
    svm.setClock(
      new Clock(
        clockBeforeResolve3.slot + BigInt(70),
        clockBeforeResolve3.epochStartTimestamp,
        clockBeforeResolve3.epoch,
        clockBeforeResolve3.leaderScheduleEpoch,
        clockBeforeResolve3.unixTimestamp + BigInt(70)
      )
    );

    // @note TODO implement PDA creation without anchor later so we ll remove this test
    // Resolve empty epoch (should create EpochResult with zero values)
    const [epochResultPda] = findEpochResultPda(1, program.programId);
    const resolveTx = await program.methods
      .resolve(0)
      .accounts({
        signer: payer.publicKey,
        config: configPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts(
        pools.map((pubkey) => ({
          pubkey,
          isSigner: false,
          isWritable: true,
        }))
      )
      .transaction();

    resolveTx.recentBlockhash = svm.latestBlockhash();
    resolveTx.feePayer = payer.publicKey;
    resolveTx.sign(payer);
    svm.sendTransaction(resolveTx);

    // Verify epoch incremented
    const configInfo = svm.getAccount(configPda);
    const config = program.coder.accounts.decode(
      "config",
      Buffer.from(configInfo!.data)
    );
    expect(config.currentEpoch.toNumber()).to.equal(2);

    // Verify EpochResult was created with zero values
    const epochResultInfo = svm.getAccount(epochResultPda);
    expect(epochResultInfo).to.not.be.null;
    const epochResult = program.coder.accounts.decode(
      "epochResult",
      Buffer.from(epochResultInfo!.data)
    );
    expect(epochResult.epoch.toNumber()).to.equal(1);
    expect(epochResult.weight.toNumber()).to.equal(0);
    expect(epochResult.totalPositionAmount.toNumber()).to.equal(0);
  });

  it("Prevents resolving with wrong epoch pools", async () => {
    const weightModel = { timeBased: {} };
    const resolutionType = { admin: {} };

    // Initialize
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

    // Initialize pool 0 for epoch 1
    const [pool0Epoch1Pda] = findPoolPda(0, 1, program.programId);
    const initPool0Tx = await program.methods
      .initializePool(1)
      .accounts({
        signer: payer.publicKey,
      })
      .remainingAccounts([
        {
          pubkey: pool0Epoch1Pda,
          isSigner: false,
          isWritable: true,
        }
      ])
      .transaction();

    initPool0Tx.recentBlockhash = svm.latestBlockhash();
    initPool0Tx.feePayer = payer.publicKey;
    initPool0Tx.sign(payer);
    svm.sendTransaction(initPool0Tx);

    // Advance time past epoch end
    const clockBeforeResolve4 = svm.getClock();
    svm.setClock(
      new Clock(
        clockBeforeResolve4.slot + BigInt(70),
        clockBeforeResolve4.epochStartTimestamp,
        clockBeforeResolve4.epoch,
        clockBeforeResolve4.leaderScheduleEpoch,
        clockBeforeResolve4.unixTimestamp + BigInt(70)
      )
    );

    // Resolve epoch 1 successfully
    const resolve1Tx = await program.methods
      .resolve(0)
      .accounts({
        signer: payer.publicKey,
        config: configPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts([
        {
          pubkey: pool0Epoch1Pda,
          isSigner: false,
          isWritable: true,
        },
      ])
      .transaction();

    resolve1Tx.recentBlockhash = svm.latestBlockhash();
    resolve1Tx.feePayer = payer.publicKey;
    resolve1Tx.sign(payer);
    svm.sendTransaction(resolve1Tx);

    // Verify we're now in epoch 2
    let configInfo = svm.getAccount(configPda);
    let config = program.coder.accounts.decode(
      "config",
      Buffer.from(configInfo!.data)
    );
    expect(config.currentEpoch.toNumber()).to.equal(2);

    // Initialize pools 0 and 1 for epoch 2 (need both to create pool 1)
    const [pool0Epoch2Pda] = findPoolPda(0, 2, program.programId);
    const [pool1Epoch2Pda] = findPoolPda(1, 2, program.programId);
    const initPool1Tx = await program.methods
      .initializePool(2)
      .accounts({
        signer: payer.publicKey,
      })
      .remainingAccounts([
        {
          pubkey: pool0Epoch2Pda,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: pool1Epoch2Pda,
          isSigner: false,
          isWritable: true,
        }
      ])
      .transaction();

    initPool1Tx.recentBlockhash = svm.latestBlockhash();
    initPool1Tx.feePayer = payer.publicKey;
    initPool1Tx.sign(payer);
    svm.sendTransaction(initPool1Tx);

    // Verify pool 1 has epoch 2
    const pool1Info = svm.getAccount(pool1Epoch2Pda);
    const pool1 = program.coder.accounts.decode("pool", Buffer.from(pool1Info!.data));
    expect(pool1.epoch.toNumber()).to.equal(2);

    // This validates that deleted pools cannot be used in resolution
    try {
      const resolve2Tx = await program.methods
        .resolve(1)
        .accounts({
          signer: payer.publicKey,
          config: configPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .remainingAccounts([
          {
            pubkey: pool0Epoch1Pda, // This pool is from epoch 1, was deleted
            isSigner: false,
            isWritable: true,
          },
        ])
        .transaction();

      resolve2Tx.recentBlockhash = svm.latestBlockhash();
      resolve2Tx.feePayer = payer.publicKey;
      resolve2Tx.sign(payer);
      svm.sendTransaction(resolve2Tx);

      // If we get here, the transaction didn't fail as expected
      expect.fail("Should have failed - cannot use deleted pool");
    } catch (error) {
      // Expected to fail because pool0Epoch1Pda was deleted during epoch 1 resolution
      // This is the correct behavior - old pools cannot be reused
    }

    // Verify epoch 2 was NOT resolved (still at epoch 2)
    configInfo = svm.getAccount(configPda);
    config = program.coder.accounts.decode("config", Buffer.from(configInfo!.data));
    expect(config.currentEpoch.toNumber()).to.equal(2);
  });

  it("Rejects unauthorized signer from resolving", async () => {
    const weightModel = { timeBased: {} };
    const resolutionType = { admin: {} };

    // Initialize with payer as both admin and resolver
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

    // Create position
    const [positionPda] = findPositionPda(payer.publicKey, 0, program.programId);
    const mintPositionTx = await program.methods
      .mintPosition()
      .accountsPartial({
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

    // Advance time
    const oldClock = svm.getClock();
    svm.setClock(
      new Clock(
        oldClock.slot + BigInt(100),
        oldClock.epochStartTimestamp,
        oldClock.epoch,
        oldClock.leaderScheduleEpoch,
        oldClock.unixTimestamp + BigInt(30)
      )
    );

    // Initialize pool
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

    // Commit position
    const [commitmentPda] = findCommitmentPda(
      payer.publicKey,
      poolId,
      epoch,
      program.programId
    );
    const commitTx = await program.methods
      .commit(new BN(0), poolId)
      .accountsPartial({
        signer: payer.publicKey,
        position: positionPda,
        commitment: commitmentPda,
      })
      .transaction();

    commitTx.recentBlockhash = svm.latestBlockhash();
    commitTx.feePayer = payer.publicKey;
    commitTx.sign(payer);
    svm.sendTransaction(commitTx);

    // Create an unauthorized keypair
    const unauthorized = Keypair.generate();
    svm.airdrop(unauthorized.publicKey, BigInt(10 * LAMPORTS_PER_SOL));

    // Advance time past epoch end
    const clockBeforeUnauthorizedResolve = svm.getClock();
    svm.setClock(
      new Clock(
        clockBeforeUnauthorizedResolve.slot + BigInt(70),
        clockBeforeUnauthorizedResolve.epochStartTimestamp,
        clockBeforeUnauthorizedResolve.epoch,
        clockBeforeUnauthorizedResolve.leaderScheduleEpoch,
        clockBeforeUnauthorizedResolve.unixTimestamp + BigInt(70)
      )
    );

    // Try to resolve with unauthorized signer - should fail due to constraint
    try {
      const resolveTx = await program.methods
        .resolve(poolId)
        .accountsPartial({
          signer: unauthorized.publicKey,
          config: configPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .remainingAccounts([
          {
            pubkey: poolPda,
            isSigner: false,
            isWritable: true,
          },
        ])
        .transaction();

      resolveTx.recentBlockhash = svm.latestBlockhash();
      resolveTx.feePayer = unauthorized.publicKey;
      resolveTx.sign(unauthorized);
      svm.sendTransaction(resolveTx);

      expect.fail("Transaction should have failed with constraint error");
    } catch (error: any) {
      // Anchor will throw a constraint error during account validation
      expect(error.toString()).to.include("constraint");
    }
  });
});
