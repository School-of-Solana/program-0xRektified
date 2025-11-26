import { NextRequest, NextResponse } from 'next/server';
import { getProgram, getNetworkFromRequest, getConfigPda } from '@/lib/api/rpc';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const network = getNetworkFromRequest(searchParams);

    const program = await getProgram(network);
    const configPda = getConfigPda(program.programId);

    // Fetch config account
    const configData = await program.account.config.fetch(configPda);

    // Convert BN values to numbers for JSON serialization
    const config = {
      admin: configData.admin.toString(),
      currentEpoch: configData.currentEpoch?.toNumber() || 0,
      totalPositionsMinted: configData.totalPositionsMinted?.toNumber() || 0,
      positionPrice: configData.positionPrice?.toNumber() || 0,
      remainingTotalPosition: configData.remainingTotalPosition?.toNumber() || 0,
      allowedMint: configData.allowedMint.toString(),
      treasuryAta: configData.treasuryAta.toString(),
      weightModel: configData.weightModel,
      resolutionType: configData.resolutionType,
      resolver: configData.resolver.toString(),
      epochDuration: configData.epochDuration?.toNumber() || 0,
      weightRateNumerator: configData.weightRateNumerator?.toNumber() || 0,
      weightRateDenominator: configData.weightRateDenominator?.toNumber() || 0,
    };

    return NextResponse.json({
      success: true,
      network,
      config,
    });
  } catch (error: any) {
    console.error('API Error [/api/config]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch config',
      },
      { status: 500 }
    );
  }
}
