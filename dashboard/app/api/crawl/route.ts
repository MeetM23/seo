import { NextResponse } from 'next/server';
import { getCrawlData } from '@/lib/data';
export const dynamic = 'force-dynamic';
export async function GET() { return NextResponse.json(getCrawlData()); }
