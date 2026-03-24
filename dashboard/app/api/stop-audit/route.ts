import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR   = path.resolve(process.cwd(), '../data');
const STOP_FILE  = path.join(DATA_DIR, 'stop.flag');
const STATUS_FILE = path.join(DATA_DIR, 'status.json');

export async function POST() {
  try {
    // Write the stop flag — audit.js polls for this file after every page
    fs.writeFileSync(STOP_FILE, 'stop');

    // Immediately mark status as idle so the UI unblocks (audit.js will
    // also write 'idle' when it actually stops, but this gives instant feedback)
    fs.writeFileSync(STATUS_FILE, JSON.stringify({
      state: 'idle',
      step: 'Stopping…',
      progress: 0
    }));

    return NextResponse.json({ success: true, message: 'Stop signal sent' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
