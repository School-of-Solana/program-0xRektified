import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, Keypair, PublicKey } from "@solana/web3.js";
import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";
import { LiteSVM, Clock } from "litesvm";
import { expect } from "chai";
import { AnchorProject } from "../target/types/anchor_project";
import { findConfigPda, findPoolPda, findEpochResultPda, logSvmResult, EPOCH_DURATION, WEIGHT_RATE_NUMERATOR, WEIGHT_RATE_DENOMINATOR } from "./utils";
import { createAndMintToken2022, setupVrfMock } from "./utils";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
const IDL = require("../target/idl/anchor_project.json");

describe("Multi-Epoch Pool Initialization Flow", () => {
  let svm: LiteSVM;
  let provider: LiteSVMProvider;
  let program: Program<AnchorProject>;
  let payer: Keypair;
  let mint: PublicKey;
  let recipientAta: PublicKey;

  before(async () => {
    payer = Keypair.generate();

    svm = fromWorkspace("./").withBuiltins().withSysvars();

    provider = new LiteSVMProvider(svm);
    anchor.setProvider(provider);
    // Create a fresh program instance instead of using the global workspace
    program = new anchor.Program<AnchorProject>(IDL as any, provider);

    svm.airdrop(payer.publicKey, BigInt(10 * LAMPORTS_PER_SOL));

    setupVrfMock(svm);
    
    const res = await createAndMintToken2022(
      svm,
      payer,
      payer.publicKey,
      9
    );
    mint = res.mint;
    recipientAta = res.recipientAta;
    // DEBUG
    // console.log("Token-2022 mint:", mint.toString());
    // console.log("Recipient Ata:", recipientAta.toString());
  });

  it("Can initialize same pool ID for different epochs", async () => {
    // Initialize config
    const [configPda] = findConfigPda(program.programId);
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

    // Initialize pool 0 for epoch 1
    const poolId = 0;
    const epoch1 = 1;
    const [pool0Epoch1Pda] = findPoolPda(poolId, epoch1, program.programId);
    const initPool0Epoch1Tx = await program.methods
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

    initPool0Epoch1Tx.recentBlockhash = svm.latestBlockhash();
    initPool0Epoch1Tx.feePayer = payer.publicKey;
    initPool0Epoch1Tx.sign(payer);
    svm.sendTransaction(initPool0Epoch1Tx);

    // Verify pool 0 epoch 1 exists
    const pool0Epoch1Info = svm.getAccount(pool0Epoch1Pda);
    expect(pool0Epoch1Info).to.not.be.null;
    const pool0Epoch1 = program.coder.accounts.decode("pool", Buffer.from(pool0Epoch1Info!.data));
    expect(pool0Epoch1.id).to.equal(poolId);
    expect(pool0Epoch1.epoch.toNumber()).to.equal(epoch1);

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

    // Resolve epoch 1 (this deletes the pool and moves to epoch 2)
    const [epochResultPda] = findEpochResultPda(epoch1, program.programId);
    const resolveTx = await program.methods
      .resolve(poolId)
      .accounts({
        signer: payer.publicKey,
        config: configPda,
        epochResult: epochResultPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts([
        { pubkey: pool0Epoch1Pda, isSigner: false, isWritable: true }
      ])
      .transaction();

    resolveTx.recentBlockhash = svm.latestBlockhash();
    resolveTx.feePayer = payer.publicKey;
    resolveTx.sign(payer);
    svm.sendTransaction(resolveTx);

    // Verify pool 0 epoch 1 is deleted
    const pool0Epoch1AfterResolve = svm.getAccount(pool0Epoch1Pda);
    expect(pool0Epoch1AfterResolve).to.be.null;

    // Verify config moved to epoch 2
    const configInfo = svm.getAccount(configPda);
    const config = program.coder.accounts.decode("config", Buffer.from(configInfo!.data));
    expect(config.currentEpoch.toNumber()).to.equal(2);

    // Initialize pool 0 for epoch 2 - THIS SHOULD WORK NOW
    const epoch2 = 2;
    const [pool0Epoch2Pda] = findPoolPda(poolId, epoch2, program.programId);
    const initPool0Epoch2Tx = await program.methods
      .initializePool(1)
      .accounts({
        signer: payer.publicKey,
      })
      .remainingAccounts([
        {
          pubkey: pool0Epoch2Pda,
          isSigner: false,
          isWritable: true,
        }
      ])
      .transaction();

    initPool0Epoch2Tx.recentBlockhash = svm.latestBlockhash();
    initPool0Epoch2Tx.feePayer = payer.publicKey;
    initPool0Epoch2Tx.sign(payer);
    logSvmResult("initPool0Epoch2Tx", svm.sendTransaction(initPool0Epoch2Tx));

    // Verify pool 0 epoch 2 exists and is different from pool 0 epoch 1
    const pool0Epoch2Info = svm.getAccount(pool0Epoch2Pda);
    expect(pool0Epoch2Info).to.not.be.null;
    const pool0Epoch2 = program.coder.accounts.decode("pool", Buffer.from(pool0Epoch2Info!.data));
    expect(pool0Epoch2.id).to.equal(poolId);
    expect(pool0Epoch2.epoch.toNumber()).to.equal(epoch2);

    // Verify the PDAs are different
    expect(pool0Epoch1Pda.toString()).to.not.equal(pool0Epoch2Pda.toString());

  });
});
