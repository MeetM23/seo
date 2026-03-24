import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch (err) {
      return NextResponse.json({ error: 'Valid URL is required.' }, { status: 400 });
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'URL must be http or https.' }, { status: 400 });
    }

    const cleanUrl = parsedUrl.href;
    const apiKey = process.env.PAGESPEED_API_KEY || '';

    // Resolving the absolute path to the engine/run.js
    const scriptPath = path.resolve(process.cwd(), '../engine/run.js');
    const statusFile = path.resolve(process.cwd(), '../data/status.json');

    // Make sure we're not running overlapping audits
    let isRunning = false;
    try {
      if (fs.existsSync(statusFile)) {
        const d = JSON.parse(fs.readFileSync(statusFile, 'utf-8'));
        if (d.state === 'running') isRunning = true;
      }
    } catch(e) {}

    if (isRunning) {
      return NextResponse.json({ error: 'Audit already in progress' }, { status: 400 });
    }

    // Set initial status to prevent race conditions
    fs.writeFileSync(statusFile, JSON.stringify({ state: 'running', step: 'Starting engines...', progress: 2 }));

    const pidFile = path.resolve(process.cwd(), '../data/audit.pid');

    // Spawn detached process
    const child = spawn('node', [scriptPath, cleanUrl, apiKey, '500', 'mobile'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    
    // Save PID so the stop-audit API can kill it
    if (child.pid) fs.writeFileSync(pidFile, String(child.pid));
    
    child.unref();

    return NextResponse.json({ success: true, message: 'Audit started in background' });
  } catch (error: any) {
    console.error(`[API run-audit] Catch Error: ${error}`);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
