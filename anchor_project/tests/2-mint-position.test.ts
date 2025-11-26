import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL, Keypair } from "@solana/web3.js";
import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";
import { LiteSVM, Clock } from "litesvm";
import { expect } from "chai";
import { AnchorProject } from "../target/types/anchor_project";
import { findConfigPda, findPositionPda, EPOCH_DURATION, WEIGHT_RATE_NUMERATOR, WEIGHT_RATE_DENOMINATOR } from "./utils";
import { createAndMintToken2022 } from "./utils";

import { TOKEN_2022_PROGRAM_ID, getAccount } from "@solana/spl-token";


describe("Mint Position", () => {
  let svm: LiteSVM;
  let provider: LiteSVMProvider;
  let program: Program<AnchorProject>;
  let payer: Keypair;
  let configPda: PublicKey;
  let mint: PublicKey;
  let recipientAta: PublicKey;
  let initialUserToken2022Balance: bigint;

  before(async () => {
    payer = Keypair.generate();
    svm = fromWorkspace("./").withBuiltins().withSysvars();

    const c = svm.getClock();
    const currentTime = Math.floor(Date.now() / 1000);
    svm.setClock(
      new Clock(c.slot, c.epochStartTimestamp, c.epoch, c.leaderScheduleEpoch, BigInt(currentTime))
    );

    provider = new LiteSVMProvider(svm);
    anchor.setProvider(provider);
    program = anchor.workspace.AnchorProject;

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

    const amountMintedToAta = await getAccount(provider.connection, recipientAta, undefined, TOKEN_2022_PROGRAM_ID );
    initialUserToken2022Balance = amountMintedToAta.amount;
    console.log("Token-2022 mint:", mint.toString());
    console.log("Recipient Ata:", recipientAta.toString());
    console.log(`Amount minted: ${amountMintedToAta.amount}`);
  });

  it("Creates first position", async () => {
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

    let configInfo = svm.getAccount(configPda);
    let config = program.coder.accounts.decode(
      "config",
      Buffer.from(configInfo!.data)
    );

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
    try {
      const txSig = svm.sendTransaction(mintPositionTx);
      // console.log("Mint position tx signature:", txSig);
    } catch (error) {
      console.error("Mint position transaction failed:");
      console.error(error);
      throw error;
    }

    const positionInfo = svm.getAccount(positionPda);

    const position = program.coder.accounts.decode(
      "positionAccount",
      Buffer.from(positionInfo!.data)
    );

    configInfo = svm.getAccount(configPda);
    config = program.coder.accounts.decode(
      "config",
      Buffer.from(configInfo!.data)
    );
    expect(position.userIndex.toNumber()).to.equal(0);
    expect(position.globalId.toNumber()).to.equal(0);
    expect(position.owner.toString()).to.equal(payer.publicKey.toString());
    expect(position.createdAt.toNumber()).to.be.greaterThan(0);
    expect(config.totalPositionsMinted.toNumber()).to.equal(1);

    // Check user balance

    const ataAccountInfo = await getAccount(provider.connection, recipientAta, undefined, TOKEN_2022_PROGRAM_ID );
    const newUserToken2022Balance = ataAccountInfo.amount;
    expect(newUserToken2022Balance).to.equal(initialUserToken2022Balance - BigInt(config.positionPrice));
  });

  it("Increments global counter correctly", async () => {
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

    const [position1Pda] = findPositionPda(payer.publicKey, 0, program.programId);
    let configInfo = svm.getAccount(configPda);
    let config = program.coder.accounts.decode(
      "config",
      Buffer.from(configInfo!.data)
    );
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

    const configBeforeInfo = svm.getAccount(configPda);
    const configBefore = program.coder.accounts.decode(
      "config",
      Buffer.from(configBeforeInfo!.data)
    );

    let ataAccountInfo = await getAccount(provider.connection, recipientAta, undefined, TOKEN_2022_PROGRAM_ID );
    let newUserToken2022Balance = ataAccountInfo.amount;
    expect(newUserToken2022Balance).to.equal(initialUserToken2022Balance - BigInt(config.positionPrice));
    expect(configBefore.totalPositionsMinted.toNumber()).to.equal(1);

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

    const configAfterInfo = svm.getAccount(configPda);
    const configAfter = program.coder.accounts.decode(
      "config",
      Buffer.from(configAfterInfo!.data)
    );
    ataAccountInfo = await getAccount(provider.connection, recipientAta, undefined, TOKEN_2022_PROGRAM_ID );
    newUserToken2022Balance = ataAccountInfo.amount;
    const amountSpent = BigInt(config.positionPrice * 2);
    expect(newUserToken2022Balance).to.equal(initialUserToken2022Balance - amountSpent);
    expect(configBefore.totalPositionsMinted.toNumber()).to.equal(1);
    expect(configAfter.totalPositionsMinted.toNumber()).to.equal(2);

    const treasurayAtaAccountInfo = await getAccount(provider.connection, config.treasuryAta, undefined, TOKEN_2022_PROGRAM_ID );
    expect(treasurayAtaAccountInfo.amount).to.equal(amountSpent);

  });

  it("Stores position with correct data", async () => {
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

    const positionInfo = svm.getAccount(positionPda);
    const position = program.coder.accounts.decode(
      "positionAccount",
      Buffer.from(positionInfo!.data)
    );

    expect(position.userIndex).to.exist;
    expect(position.createdAt).to.exist;
    expect(position.createdAt.toNumber()).to.be.greaterThan(0);
    expect(position.owner.toString()).to.equal(payer.publicKey.toString());
  });
});
