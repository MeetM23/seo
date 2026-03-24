import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const filePath = path.resolve(process.cwd(), '../data/links.json');
    if (!fs.existsSync(filePath)) return NextResponse.json([]);
    const raw = fs.readFileSync(filePath, 'utf8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json([]);
  }
}
