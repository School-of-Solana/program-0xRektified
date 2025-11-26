import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, Keypair, PublicKey } from "@solana/web3.js";
import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";
import { LiteSVM } from "litesvm";
import { expect } from "chai";
import { AnchorProject } from "../target/types/anchor_project";
import { findConfigPda, findPoolPda, findEpochResultPda, EPOCH_DURATION, WEIGHT_RATE_NUMERATOR, WEIGHT_RATE_DENOMINATOR, logSvmResult } from "./utils";
import { createAndMintToken2022 } from "./utils";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

describe("Initialize", () => {
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
    program = anchor.workspace.AnchorProject;

    svm.airdrop(payer.publicKey, BigInt(10 * LAMPORTS_PER_SOL));

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

  it("Initializes game config with admin", async () => {
    const [configPda] = findConfigPda(program.programId);
    const weightModel = { timeBased: {} };
    const resolutionType = { admin: {} };
    const tx = await program.methods
      .initialize(weightModel, resolutionType, payer.publicKey, new BN(EPOCH_DURATION), new BN(WEIGHT_RATE_NUMERATOR), new BN(WEIGHT_RATE_DENOMINATOR))
      .accounts({
        signer: payer.publicKey,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    tx.recentBlockhash = svm.latestBlockhash();
    tx.feePayer = payer.publicKey;
    tx.sign(payer);

    let re = svm.sendTransaction(tx);
    logSvmResult('init', re);

    const accountInfo = svm.getAccount(configPda);
    expect(accountInfo).to.not.be.null;

    const config = program.coder.accounts.decode(
      "config",
      Buffer.from(accountInfo!.data)
    );

    expect(config.admin.toString()).to.equal(
      payer.publicKey.toString()
    );
    expect(config.allowedMint.toString()).to.equal(
      mint.toString()
    );
    expect(config.totalPositionsMinted.toNumber()).to.equal(0);
  });

  it("Initializes game config and pools with admin", async () => {
    const [configPda] = findConfigPda(program.programId);
    const weightModel = { timeBased: {} };
    const resolutionType = { admin: {} };
    const tx = await program.methods
      .initialize(weightModel, resolutionType, payer.publicKey, new BN(EPOCH_DURATION), new BN(WEIGHT_RATE_NUMERATOR), new BN(WEIGHT_RATE_DENOMINATOR))
      .accounts({
        signer: payer.publicKey,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    tx.recentBlockhash = svm.latestBlockhash();
    tx.feePayer = payer.publicKey;
    tx.sign(payer);

    svm.sendTransaction(tx);

    const accountInfo = svm.getAccount(configPda);
    expect(accountInfo).to.not.be.null;

    const config = program.coder.accounts.decode(
      "config",
      Buffer.from(accountInfo!.data)
    );

    expect(config.admin.toString()).to.equal(
      payer.publicKey.toString()
    );
    expect(config.allowedMint.toString()).to.equal(
      mint.toString()
    );
    expect(config.totalPositionsMinted.toNumber()).to.equal(0);

    // Initialize pool 0 with epoch 1
    const numPools = 3;
    const epoch = 1;
    const poolPdaList = [];

    for (let i=0; i<numPools; i++){
      const [poolPda] = findPoolPda(i, epoch, program.programId);
      poolPdaList.push(poolPda);
    }

    const initPoolTx = await program.methods
      .initializePool(numPools)
      .accounts({
        signer: payer.publicKey,
      })
      .remainingAccounts(
        poolPdaList.map((pubkey) => ({
          pubkey,
          isSigner: false,
          isWritable: true,
        }))
      )
      .transaction();

    initPoolTx.recentBlockhash = svm.latestBlockhash();
    initPoolTx.feePayer = payer.publicKey;
    initPoolTx.sign(payer);

    svm.sendTransaction(initPoolTx);

    // Verify pool was created correctly
    for (let i = 0; i < poolPdaList.length; i++) {
      const poolPda = poolPdaList[i];
      const poolInfo = svm.getAccount(poolPda);
      expect(poolInfo).to.not.be.null;

      const pool = program.coder.accounts.decode(
        "pool",
        Buffer.from(poolInfo!.data)
      );

      expect(pool.id).to.equal(i);
      expect(pool.epoch.toNumber()).to.equal(epoch);
      expect(pool.totalPositions.toNumber()).to.equal(0);
      expect(pool.totalWeight.toNumber()).to.equal(0);
    }

    // Verify EpochResult was created correctly
    const [epochResultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("epoch_result"), Buffer.from(new BN(epoch).toArray("le", 8))],
      program.programId
    );

    const epochResultInfo = svm.getAccount(epochResultPda);
    expect(epochResultInfo).to.not.be.null;

    const epochResult = program.coder.accounts.decode(
      "epochResult",
      Buffer.from(epochResultInfo!.data)
    );

    expect(epochResult.epoch.toNumber()).to.equal(epoch);
    expect(epochResult.epochResultState).to.deep.equal({ active: {} });
    expect(epochResult.poolCount).to.equal(numPools);
    expect(epochResult.endAt.toNumber()).to.be.greaterThan(0);
    expect(epochResult.weight.toNumber()).to.equal(0);
    expect(epochResult.totalPositionAmount.toNumber()).to.equal(0);
    expect(epochResult.winningPoolId).to.equal(0);

  });
});
