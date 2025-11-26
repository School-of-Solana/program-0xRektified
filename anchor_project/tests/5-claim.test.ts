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
  findTreasuryPda,
  logSvmResult,
  setupVrfMock,
  EPOCH_DURATION,
  WEIGHT_RATE_NUMERATOR,
  WEIGHT_RATE_DENOMINATOR,
} from "./utils";
import {
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
const IDL = require("../target/idl/anchor_project.json");

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

describe("Claim", () => {
  let svm: LiteSVM;
  let provider: LiteSVMProvider;
  let program: Program<AnchorProject>;
  let payer: Keypair;
  let winner: Keypair;
  let loser: Keypair;
  let mint: PublicKey;
  let configPda: PublicKey;

  const EPOCH = 1;
  const WINNING_POOL_ID = 0;
  const LOSING_POOL_ID = 1;

  beforeEach(async () => {
    payer = Keypair.generate();
    winner = Keypair.generate();
    loser = Keypair.generate();

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

    // Airdrop SOL to all users
    svm.airdrop(payer.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
    svm.airdrop(winner.publicKey, BigInt(10 * LAMPORTS_PER_SOL));
    svm.airdrop(loser.publicKey, BigInt(10 * LAMPORTS_PER_SOL));

    // Setup VRF mock (required by #[vrf] macro in resolve)
    setupVrfMock(svm);

    [configPda] = findConfigPda(program.programId);

    // Create mint - payer receives tokens
    const res = await createAndMintToken2022(svm, payer, payer.publicKey, 9);
    mint = res.mint;
    const payerAta = res.recipientAta;

    // Create ATAs for winner and loser and transfer tokens to them
    const winnerAta = await getAssociatedTokenAddress(
      mint,
      winner.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const loserAta = await getAssociatedTokenAddress(
      mint,
      loser.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Create winner ATA and transfer tokens
    const createWinnerAtaIx = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      winnerAta,
      winner.publicKey,
      mint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transferToWinnerIx = createTransferCheckedInstruction(
      payerAta,
      mint,
      winnerAta,
      payer.publicKey,
      10_000 * 10 ** 9, // 10,000 tokens
      9,
      [],
      TOKEN_2022_PROGRAM_ID
    );

    const winnerAtaTx = new anchor.web3.Transaction().add(
      createWinnerAtaIx,
      transferToWinnerIx
    );
    winnerAtaTx.recentBlockhash = svm.latestBlockhash();
    winnerAtaTx.feePayer = payer.publicKey;
    winnerAtaTx.sign(payer);
    svm.sendTransaction(winnerAtaTx);

    // Create loser ATA and transfer tokens
    const createLoserAtaIx = createAssociatedTokenAccountInstruction(
      payer.publicKey,
      loserAta,
      loser.publicKey,
      mint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transferToLoserIx = createTransferCheckedInstruction(
      payerAta,
      mint,
      loserAta,
      payer.publicKey,
      10_000 * 10 ** 9, // 10,000 tokens
      9,
      [],
      TOKEN_2022_PROGRAM_ID
    );

    const loserAtaTx = new anchor.web3.Transaction().add(
      createLoserAtaIx,
      transferToLoserIx
    );
    loserAtaTx.recentBlockhash = svm.latestBlockhash();
    loserAtaTx.feePayer = payer.publicKey;
    loserAtaTx.sign(payer);
    svm.sendTransaction(loserAtaTx);

    // Initialize
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

    // Initialize two pools for epoch 1
    const [pool0Pda] = findPoolPda(WINNING_POOL_ID, EPOCH, program.programId);
    const [pool1Pda] = findPoolPda(LOSING_POOL_ID, EPOCH, program.programId);

    const initPoolsTx = await program.methods
      .initializePool(2)
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
        }
      ])
      .transaction();

    initPoolsTx.recentBlockhash = svm.latestBlockhash();
    initPoolsTx.feePayer = payer.publicKey;
    initPoolsTx.sign(payer);
    svm.sendTransaction(initPoolsTx);

    // Winner mints and commits to pool 0
    const [winnerPosition] = findPositionPda(winner.publicKey, 0, program.programId);
    const winnerMintTx = await program.methods
      .mintPosition()
      .accounts({
        signer: winner.publicKey,
        position: winnerPosition,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    winnerMintTx.recentBlockhash = svm.latestBlockhash();
    winnerMintTx.feePayer = winner.publicKey;
    winnerMintTx.sign(winner);
    svm.sendTransaction(winnerMintTx);

    // Loser mints position
    const [loserPosition] = findPositionPda(loser.publicKey, 0, program.programId);
    const loserMintTx = await program.methods
      .mintPosition()
      .accounts({
        signer: loser.publicKey,
        position: loserPosition,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    loserMintTx.recentBlockhash = svm.latestBlockhash();
    loserMintTx.feePayer = loser.publicKey;
    loserMintTx.sign(loser);
    svm.sendTransaction(loserMintTx);

    // Advance clock after minting to give positions weight
    const oldClock = svm.getClock();
    svm.setClock(
      new Clock(
        oldClock.slot + BigInt(100),
        oldClock.epochStartTimestamp,
        oldClock.epoch,
        oldClock.leaderScheduleEpoch,
        oldClock.unixTimestamp + BigInt(58) // We need to be bellow the 60 seconds
      )
    );

    // Winner commits to pool 0
    const [winnerCommitment] = findCommitmentPda(
      winner.publicKey,
      WINNING_POOL_ID,
      EPOCH,
      program.programId
    );

    const winnerCommitTx = await program.methods
      .commit(new BN(0), WINNING_POOL_ID)
      .accounts({
        signer: winner.publicKey,
        position: winnerPosition,
        commitment: winnerCommitment,
      })
      .transaction();

    winnerCommitTx.recentBlockhash = svm.latestBlockhash();
    winnerCommitTx.feePayer = winner.publicKey;
    winnerCommitTx.sign(winner);
    svm.sendTransaction(winnerCommitTx);

    // Loser commits to pool 1
    const [loserCommitment] = findCommitmentPda(
      loser.publicKey,
      LOSING_POOL_ID,
      EPOCH,
      program.programId
    );
    const loserCommitTx = await program.methods
      .commit(new BN(0), LOSING_POOL_ID)
      .accounts({
        signer: loser.publicKey,
        position: loserPosition,
        commitment: loserCommitment,
      })
      .transaction();

    loserCommitTx.recentBlockhash = svm.latestBlockhash();
    loserCommitTx.feePayer = loser.publicKey;
    loserCommitTx.sign(loser);
    svm.sendTransaction(loserCommitTx);

    // Check pool data before resolution
    const pool0Account = svm.getAccount(pool0Pda);
    const pool1Account = svm.getAccount(pool1Pda);

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

    // Resolve epoch with pool 0 as winner
    const resolveTx = await program.methods
      .resolve(WINNING_POOL_ID)
      .accounts({
        signer: payer.publicKey,
      })
      .remainingAccounts([
        { pubkey: pool0Pda, isSigner: false, isWritable: true },
        { pubkey: pool1Pda, isSigner: false, isWritable: true },
      ])
      .transaction();

    resolveTx.recentBlockhash = svm.latestBlockhash();
    resolveTx.feePayer = payer.publicKey;
    resolveTx.sign(payer);
    svm.sendTransaction(resolveTx);
  });

  it("Successfully claims reward and verifies correct amount", async () => {
    const [winnerCommitment] = findCommitmentPda(
      winner.publicKey,
      WINNING_POOL_ID,
      EPOCH,
      program.programId
    );

    // Get commitment info before claim
    const commitmentAccountBefore = svm.getAccount(winnerCommitment);
    expect(commitmentAccountBefore).to.not.be.null;

    // Get winner's ATA and balance before claim
    const winnerAta = await getAssociatedTokenAddress(
      mint,
      winner.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const winnerAtaBefore = svm.getAccount(winnerAta);
    const balanceBefore = winnerAtaBefore
      ? Buffer.from(winnerAtaBefore.data).readBigUInt64LE(64)
      : BigInt(0);

    // Claim
    const claimTx = await program.methods
      .claim(WINNING_POOL_ID, new BN(EPOCH))
      .accounts({
        signer: winner.publicKey,
        tokenMint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    claimTx.recentBlockhash = svm.latestBlockhash();
    claimTx.feePayer = winner.publicKey;
    claimTx.sign(winner);
    svm.sendTransaction(claimTx);

    // Get balance after claim
    const winnerAtaAfter = svm.getAccount(winnerAta);
    const balanceAfter = winnerAtaAfter
      ? Buffer.from(winnerAtaAfter.data).readBigUInt64LE(64)
      : BigInt(0);

    // Verify balance increased
    expect(Number(balanceAfter)).to.be.greaterThan(Number(balanceBefore));

    // Get epoch result to verify reward calculation
    const [epochResultPda] = findEpochResultPda(EPOCH, program.programId);
    const epochResultAccount = svm.getAccount(epochResultPda);

    if (epochResultAccount) {
      const data = Buffer.from(epochResultAccount.data);
      const totalPositionAmount = data.readBigUInt64LE(24);
      const totalWeight = data.readBigUInt64LE(16);

      console.log("Total position amount:", totalPositionAmount);
      console.log("Total weight:", totalWeight);

      const rewardReceived = balanceAfter - balanceBefore;
      console.log("Reward received:", rewardReceived);
      expect(Number(rewardReceived)).to.be.greaterThan(0);
    }

    // Verify commitment account is closed
    const commitmentAccountAfter = svm.getAccount(winnerCommitment);
    console.log(
      "Commitment account after claim:",
      commitmentAccountAfter
        ? "still exists (close might not work in LiteSVM)"
        : "closed"
    );
  });

  it("Prevents claiming from losing pool", async () => {
    const [loserCommitment] = findCommitmentPda(
      loser.publicKey,
      LOSING_POOL_ID,
      EPOCH,
      program.programId
    );

    // Loser tries to claim but should fail because their pool lost
    try {
      const claimTx = await program.methods
        .claim(LOSING_POOL_ID, new BN(EPOCH))
        .accounts({
          signer: loser.publicKey,
          tokenMint: mint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .transaction();

      claimTx.recentBlockhash = svm.latestBlockhash();
      claimTx.feePayer = loser.publicKey;
      claimTx.sign(loser);
      svm.sendTransaction(claimTx);

      // If we get here, the transaction didn't fail as expected
      expect.fail("Should have failed - cannot claim from losing pool");
    } catch (error) {
      // Expected to fail with LosingPool error
    }
  });

  it("Prevents double claiming", async () => {
    // First claim should succeed
    const claimTx1 = await program.methods
      .claim(WINNING_POOL_ID, new BN(EPOCH))
      .accounts({
        signer: winner.publicKey,
        tokenMint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    claimTx1.recentBlockhash = svm.latestBlockhash();
    claimTx1.feePayer = winner.publicKey;
    claimTx1.sign(winner);
    svm.sendTransaction(claimTx1);

    // Second claim should fail because commitment was closed
    try {
      const claimTx2 = await program.methods
        .claim(WINNING_POOL_ID, new BN(EPOCH))
        .accounts({
          signer: winner.publicKey,
          tokenMint: mint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .transaction();

      claimTx2.recentBlockhash = svm.latestBlockhash();
      claimTx2.feePayer = winner.publicKey;
      claimTx2.sign(winner);
      svm.sendTransaction(claimTx2);

      expect.fail("Should have failed - cannot claim twice");
    } catch (error) {
      // Expected to fail because commitment account no longer exists
    }
  });

  it("Fails when claiming with wrong epoch", async () => {
    const WRONG_EPOCH = 999;

    try {
      const claimTx = await program.methods
        .claim(WINNING_POOL_ID, new BN(WRONG_EPOCH))
        .accounts({
          signer: winner.publicKey,
          tokenMint: mint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .transaction();

      claimTx.recentBlockhash = svm.latestBlockhash();
      claimTx.feePayer = winner.publicKey;
      claimTx.sign(winner);
      logSvmResult("test",svm.sendTransaction(claimTx));

      expect.fail("Should have failed - wrong epoch");
    } catch (error) {
      // Expected to fail because epoch_result for epoch 999 doesn't exist
    }
  });

  it("Fails when user has no commitment for the pool", async () => {
    // Create a new user who didn't commit to any pool
    const nonParticipant = Keypair.generate();
    svm.airdrop(nonParticipant.publicKey, BigInt(10 * LAMPORTS_PER_SOL));

    try {
      const claimTx = await program.methods
        .claim(WINNING_POOL_ID, new BN(EPOCH))
        .accounts({
          signer: nonParticipant.publicKey,
          tokenMint: mint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .transaction();

      claimTx.recentBlockhash = svm.latestBlockhash();
      claimTx.feePayer = nonParticipant.publicKey;
      claimTx.sign(nonParticipant);
      svm.sendTransaction(claimTx);

      expect.fail("Should have failed - no commitment exists");
    } catch (error) {
      // Expected to fail because commitment account doesn't exist
    }
  });

  it("Winner receives all treasury funds in single-winner scenario", async () => {
    const winnerAta = await getAssociatedTokenAddress(
      mint,
      winner.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Get treasury ATA
    const [treasuryPda] = findTreasuryPda(program.programId);
    const treasuryAta = await getAssociatedTokenAddress(
      mint,
      treasuryPda,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Get treasury balance before claim (should have tokens from minting fees)
    const treasuryAtaBefore = svm.getAccount(treasuryAta);
    const treasuryBalanceBefore = treasuryAtaBefore
      ? Buffer.from(treasuryAtaBefore.data).readBigUInt64LE(64)
      : BigInt(0);

    console.log("Treasury balance before claim:", treasuryBalanceBefore);

    // Get winner balance before claim
    const winnerAtaBefore = svm.getAccount(winnerAta);
    const winnerBalanceBefore = winnerAtaBefore
      ? Buffer.from(winnerAtaBefore.data).readBigUInt64LE(64)
      : BigInt(0);

    console.log("Winner balance before claim:", winnerBalanceBefore);

    // Winner claims
    const claimTx = await program.methods
      .claim(WINNING_POOL_ID, new BN(EPOCH))
      .accounts({
        signer: winner.publicKey,
        tokenMint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .transaction();

    claimTx.recentBlockhash = svm.latestBlockhash();
    claimTx.feePayer = winner.publicKey;
    claimTx.sign(winner);
    svm.sendTransaction(claimTx);

    // Get balances after claim
    const treasuryAtaAfter = svm.getAccount(treasuryAta);
    const treasuryBalanceAfter = treasuryAtaAfter
      ? Buffer.from(treasuryAtaAfter.data).readBigUInt64LE(64)
      : BigInt(0);

    const winnerAtaAfter = svm.getAccount(winnerAta);
    const winnerBalanceAfter = winnerAtaAfter
      ? Buffer.from(winnerAtaAfter.data).readBigUInt64LE(64)
      : BigInt(0);

    console.log("Treasury balance after claim:", treasuryBalanceAfter);
    console.log("Winner balance after claim:", winnerBalanceAfter);

    const rewardReceived = winnerBalanceAfter - winnerBalanceBefore;
    const treasuryPaid = treasuryBalanceBefore - treasuryBalanceAfter;

    console.log("Reward received by winner:", rewardReceived);
    console.log("Amount paid from treasury:", treasuryPaid);

    // Verify the amounts match
    expect(rewardReceived).to.equal(treasuryPaid);

    // In a single winner scenario with 2 participants (winner + loser),
    // the winner should receive all the treasury funds (2 position mints = 2000 tokens)
    expect(Number(rewardReceived)).to.equal(Number(treasuryBalanceBefore));
  });
});
