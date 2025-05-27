import { expect } from "chai";
import BN from "bn.js";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  setupTestContext,
  setupAuctionContext,
  setupCommitmentContext,
  initializeAuction,
  waitForAuctionStart,
  waitForClaimStart,
  getTokenBalance,
  assertTokenBalance,
  TEST_CONFIG,
} from "../utils/setup";
import { PublicKey, SystemProgram, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("Account Closure Tests", () => {
  // 设置测试环境和变量
  let testCtx, auctionCtx, commitCtx;
  let connection: Connection;
  const binId = 0;

  before(async () => {
    console.log("Setting up test environment...");
    testCtx = await setupTestContext();
    auctionCtx = await setupAuctionContext(testCtx);
    commitCtx = await setupCommitmentContext(auctionCtx);
    connection = testCtx.connection;
    
    // 初始化拍卖
    await initializeAuction(auctionCtx);
    await waitForAuctionStart();
    console.log("✓ Auction started");
  });

  it("should create a Committed account during commit", async () => {
    // 认购金额
    const commitAmount = new BN(5_000_000);
    
    // 检查账户是否存在之前
    const accountBefore = await connection.getAccountInfo(commitCtx.user1_committed_pda);
    expect(accountBefore).to.be.null;
    
    // 进行认购
    await commitCtx.program.methods
      .commit(binId, commitAmount)
      .accounts({
        user: commitCtx.user1.publicKey,
        auction: commitCtx.auctionPda,
        committed: commitCtx.user1_committed_pda,
        user_payment_token: commitCtx.user1_payment_token,
        vault_payment_token: commitCtx.vault_payment_token,
        token_program: TOKEN_PROGRAM_ID,
        system_program: SystemProgram.programId,
      })
      .signers([commitCtx.user1])
      .rpc();
    
    // 检查账户是否已创建
    const accountAfter = await connection.getAccountInfo(commitCtx.user1_committed_pda);
    expect(accountAfter).to.not.be.null;
    console.log("✓ Committed account created during commit");
    
    // 获取账户租金金额，用于后续验证
    const rentAmount = accountAfter.lamports;
    console.log(`Account rent: ${rentAmount} lamports`);
  });

  it("should close Committed account after full claim and return rent", async () => {
    // 等待认领期开始
    await waitForClaimStart();
    console.log("✓ Claim period started");
    
    // 获取用户SOL余额（用于比较租金返还）
    const userBalanceBefore = await connection.getBalance(commitCtx.user1.publicKey);
    
    // 获取拍卖和认购信息
    const auctionData: any = await commitCtx.program.account.auction.fetch(commitCtx.auctionPda);
    const commitmentData: any = await commitCtx.program.account.committed.fetch(commitCtx.user1_committed_pda);
    
    // 找到相关的bin
    const bin = auctionData.bins[binId];
    const commitBin = commitmentData.bins.find(b => b.binId === binId);
    
    // 计算可认领金额
    const userDesiredSaleTokens = commitBin.paymentTokenCommitted / bin.saleTokenPrice;
    const totalSaleTokensDemanded = bin.paymentTokenRaised / bin.saleTokenPrice;
    
         // 计算实际可认领的sale token和退款
     let saleTokensToGet, refundAmount;
     if (totalSaleTokensDemanded <= bin.saleTokenCap) {
       // 未超募
       saleTokensToGet = userDesiredSaleTokens;
       refundAmount = new BN(0);
     } else {
       // 超募 - 需要将数值转换为BN进行操作
       const userDesiredSaleTokensBN = new BN(userDesiredSaleTokens);
       const binCapBN = new BN(bin.saleTokenCap);
       const totalDemandedBN = new BN(totalSaleTokensDemanded);
       
       saleTokensToGet = userDesiredSaleTokensBN
         .mul(binCapBN)
         .div(totalDemandedBN);
       const effectivePayment = saleTokensToGet.mul(new BN(bin.saleTokenPrice));
       refundAmount = new BN(commitBin.paymentTokenCommitted).sub(effectivePayment);
     }
    
    console.log(`User will claim ${saleTokensToGet} sale tokens and ${refundAmount} payment token refund`);
    
    // 获取committed账户信息（用于确认账户存在）
    const committedAccountBefore = await connection.getAccountInfo(commitCtx.user1_committed_pda);
    expect(committedAccountBefore).to.not.be.null;
    
    // 进行认领
    await commitCtx.program.methods
      .claim(binId, saleTokensToGet, refundAmount)
      .accounts({
        user: commitCtx.user1.publicKey,
        auction: commitCtx.auctionPda,
        committed: commitCtx.user1_committed_pda,
        sale_token_mint: commitCtx.saleTokenMint,
        user_sale_token: commitCtx.user1_sale_token,
        user_payment_token: commitCtx.user1_payment_token,
        vault_sale_token: commitCtx.vault_sale_token,
        vault_payment_token: commitCtx.vault_payment_token,
        token_program: TOKEN_PROGRAM_ID,
        associated_token_program: commitCtx.associated_token_program,
        system_program: SystemProgram.programId,
      })
      .signers([commitCtx.user1])
      .rpc();
    
    // 检查账户是否已关闭
    const committedAccountAfter = await connection.getAccountInfo(commitCtx.user1_committed_pda);
    expect(committedAccountAfter).to.be.null;
    console.log("✓ Committed account was closed after full claim");
    
    // 检查用户SOL余额是否增加（租金返还）
    const userBalanceAfter = await connection.getBalance(commitCtx.user1.publicKey);
    // 注意：余额会因为交易费而有所减少，但租金返还应该使总余额增加
    expect(userBalanceAfter).to.be.greaterThan(userBalanceBefore);
    console.log(`✓ User SOL balance increased from ${userBalanceBefore} to ${userBalanceAfter}`);
  });
  
  it("should handle multiple bins and only close account when all bins are claimed", async () => {
    // 为同一用户创建第二个认购
    const binId1 = 0;
    const binId2 = 1;
    const commitAmount1 = new BN(3_000_000);
    const commitAmount2 = new BN(2_000_000);
    
    // 第一次认购（bin 0）
    await commitCtx.program.methods
      .commit(binId1, commitAmount1)
      .accounts({
        user: commitCtx.user2.publicKey,
        auction: commitCtx.auctionPda,
        committed: commitCtx.user2_committed_pda,
        user_payment_token: commitCtx.user2_payment_token,
        vault_payment_token: commitCtx.vault_payment_token,
        token_program: TOKEN_PROGRAM_ID,
        system_program: SystemProgram.programId,
      })
      .signers([commitCtx.user2])
      .rpc();
    
    // 第二次认购（bin 1）
    await commitCtx.program.methods
      .commit(binId2, commitAmount2)
      .accounts({
        user: commitCtx.user2.publicKey,
        auction: commitCtx.auctionPda,
        committed: commitCtx.user2_committed_pda,
        user_payment_token: commitCtx.user2_payment_token,
        vault_payment_token: commitCtx.vault_payment_token,
        token_program: TOKEN_PROGRAM_ID,
        system_program: SystemProgram.programId,
      })
      .signers([commitCtx.user2])
      .rpc();
    
    // 获取拍卖数据
    const auctionData: any = await commitCtx.program.account.auction.fetch(commitCtx.auctionPda);
    const commitmentData: any = await commitCtx.program.account.committed.fetch(commitCtx.user2_committed_pda);
    
         // 为bin 0计算可认领金额
     const bin1 = auctionData.bins[binId1];
     const commitBin1 = commitmentData.bins.find(b => b.binId === binId1);
     const userDesiredSaleTokens1 = commitBin1.paymentTokenCommitted / bin1.saleTokenPrice;
     const totalSaleTokensDemanded1 = bin1.paymentTokenRaised / bin1.saleTokenPrice;
     
     let saleTokensToGet1, refundAmount1;
     if (totalSaleTokensDemanded1 <= bin1.saleTokenCap) {
       saleTokensToGet1 = userDesiredSaleTokens1;
       refundAmount1 = new BN(0);
     } else {
       // 转换为BN类型进行计算
       const userDesiredSaleTokensBN = new BN(userDesiredSaleTokens1);
       const binCapBN = new BN(bin1.saleTokenCap);
       const totalDemandedBN = new BN(totalSaleTokensDemanded1);
       
       saleTokensToGet1 = userDesiredSaleTokensBN
         .mul(binCapBN)
         .div(totalDemandedBN);
       const effectivePayment = saleTokensToGet1.mul(new BN(bin1.saleTokenPrice));
       refundAmount1 = new BN(commitBin1.paymentTokenCommitted).sub(effectivePayment);
     }
    
    // 只认领第一个bin
    await commitCtx.program.methods
      .claim(binId1, saleTokensToGet1, refundAmount1)
      .accounts({
        user: commitCtx.user2.publicKey,
        auction: commitCtx.auctionPda,
        committed: commitCtx.user2_committed_pda,
        sale_token_mint: commitCtx.saleTokenMint,
        user_sale_token: commitCtx.user2_sale_token,
        user_payment_token: commitCtx.user2_payment_token,
        vault_sale_token: commitCtx.vault_sale_token,
        vault_payment_token: commitCtx.vault_payment_token,
        token_program: TOKEN_PROGRAM_ID,
        associated_token_program: commitCtx.associated_token_program,
        system_program: SystemProgram.programId,
      })
      .signers([commitCtx.user2])
      .rpc();
    
    // 账户应该仍然存在（因为还有一个bin未认领）
    const committedAccountAfterFirstClaim = await connection.getAccountInfo(commitCtx.user2_committed_pda);
    expect(committedAccountAfterFirstClaim).to.not.be.null;
    console.log("✓ Account still exists after claiming only one bin");
    
         // 为bin 1计算可认领金额
     const bin2 = auctionData.bins[binId2];
     const commitBin2 = commitmentData.bins.find(b => b.binId === binId2);
     const userDesiredSaleTokens2 = commitBin2.paymentTokenCommitted / bin2.saleTokenPrice;
     const totalSaleTokensDemanded2 = bin2.paymentTokenRaised / bin2.saleTokenPrice;
     
     let saleTokensToGet2, refundAmount2;
     if (totalSaleTokensDemanded2 <= bin2.saleTokenCap) {
       saleTokensToGet2 = userDesiredSaleTokens2;
       refundAmount2 = new BN(0);
     } else {
       // 转换为BN类型进行计算
       const userDesiredSaleTokensBN = new BN(userDesiredSaleTokens2);
       const binCapBN = new BN(bin2.saleTokenCap);
       const totalDemandedBN = new BN(totalSaleTokensDemanded2);
       
       saleTokensToGet2 = userDesiredSaleTokensBN
         .mul(binCapBN)
         .div(totalDemandedBN);
       const effectivePayment = saleTokensToGet2.mul(new BN(bin2.saleTokenPrice));
       refundAmount2 = new BN(commitBin2.paymentTokenCommitted).sub(effectivePayment);
     }
    
    // 认领第二个bin
    await commitCtx.program.methods
      .claim(binId2, saleTokensToGet2, refundAmount2)
      .accounts({
        user: commitCtx.user2.publicKey,
        auction: commitCtx.auctionPda,
        committed: commitCtx.user2_committed_pda,
        sale_token_mint: commitCtx.saleTokenMint,
        user_sale_token: commitCtx.user2_sale_token,
        user_payment_token: commitCtx.user2_payment_token,
        vault_sale_token: commitCtx.vault_sale_token,
        vault_payment_token: commitCtx.vault_payment_token,
        token_program: TOKEN_PROGRAM_ID,
        associated_token_program: commitCtx.associated_token_program,
        system_program: SystemProgram.programId,
      })
      .signers([commitCtx.user2])
      .rpc();
    
    // 现在账户应该已经关闭
    const committedAccountAfterSecondClaim = await connection.getAccountInfo(commitCtx.user2_committed_pda);
    expect(committedAccountAfterSecondClaim).to.be.null;
    console.log("✓ Account closed after claiming all bins");
  });
}); 