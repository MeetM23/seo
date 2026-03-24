import { NextResponse } from 'next/server';
import { getIssues } from '@/lib/data';
export const dynamic = 'force-dynamic';
export async function GET() { return NextResponse.json(getIssues()); }
