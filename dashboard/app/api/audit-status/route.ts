import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const statusFile = path.resolve(process.cwd(), '../data/status.json');
  try {
    if (!fs.existsSync(statusFile)) {
      return NextResponse.json({ state: 'idle', step: '', progress: 0 });
    }
    const data = JSON.parse(fs.readFileSync(statusFile, 'utf-8'));
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ state: 'error', error: err.message }, { status: 500 });
  }
}
