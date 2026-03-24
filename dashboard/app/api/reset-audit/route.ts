import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), '../data');

export async function POST() {
  try {
    const files = ['crawl.json', 'cwv.json', 'issues.json', 'report.json', 'links.json'];
    
    // Reset status to idle
    fs.writeFileSync(path.join(DATA_DIR, 'status.json'),
      JSON.stringify({ state: 'idle', step: '', progress: 0 }));

    // Clear all data files
    files.forEach(f => {
      const p = path.join(DATA_DIR, f);
      if (fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify([]));
    });

    // Remove stop flag if any
    const stopFlag = path.join(DATA_DIR, 'stop.flag');
    if (fs.existsSync(stopFlag)) fs.unlinkSync(stopFlag);

    // Remove PID file if any
    const pidFile = path.join(DATA_DIR, 'audit.pid');
    if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
