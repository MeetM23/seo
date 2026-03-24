import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '..', 'data');

export interface SEOIssue {
  issue: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  recommendation: string;
  why: string;
  fix: string;
  weight: number;
}

export interface CrawlRow {
  url: string;
  status: number;
  wordCount: number;
  internalLinks: number;
  issues: {
    errors: SEOIssue[];
    warnings: SEOIssue[];
    allIssues?: SEOIssue[];
  };
  title?: string;
  metaDescription?: string;
}

export interface ReportData {
  siteHealth: number;
  patterns: {
    pattern: string;
    count: number;
    cause: string;
    fix: string;
  }[];
  totalIssues: number;
  topRecommendations: string[];
}

export interface Issue {
  url: string;
  issue: string;
  detail: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  recommendation: string;
}

export interface CWVRow {
  url: string;
  strategy: string;
  performanceScore: number | string;
  lcp: number | string;
  lcpTag: string;
  cls: number | string;
  clsTag: string;
  fid: number | string;
  fidTag: string;
  ttfb: number | string;
  ttfbTag: string;
  fcp: number | string;
  tbt: number | string;
  speedIndex: number | string;
  error: string;
}
export interface LinkEntry {
  source: string;
  target: string;
  anchor: string;
  type: 'internal' | 'external';
}

export interface PrecisionSignal {
  robots_tag: 'INDEXABLE' | 'NOINDEX' | 'NOT FOUND';
  source: 'meta tag' | 'header' | 'googlebot meta' | 'none';
  valid: boolean;
  confidence_score: string;
  notes: string;
}

export interface IndexingValidation {
  issue: string;
  severity: string;
  confidence_score: string;
  explanation: string;
  recommended_action: string;
  final_verdict: 'VALID ISSUE' | 'LIKELY FALSE POSITIVE' | 'NEEDS MANUAL REVIEW' | 'GOOGLE OVERRIDDEN';
  signals?: PrecisionSignal;
  isGoogleVerified?: boolean;
  isFresh?: boolean;
  isLikelyIndexedInSERP?: boolean;
}

export interface LinkRow {
  url: string;
  internalCount: number;
  externalCount: number;
  incomingCount: number;
  outgoingLinks: LinkEntry[];
  incomingLinks: LinkEntry[];
  externalLinks: LinkEntry[];
  brokenLinks: LinkEntry[];
  linkIssues: string[];
  indexingValidation?: IndexingValidation;
}

export function getLinks(): LinkRow[] { return readJson<LinkRow>('links.json'); }

function readJson<T>(filename: string): T[] {
  const filePath = path.join(DATA_DIR, filename);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

export function getCrawlData(): CrawlRow[]  { return readJson<CrawlRow>('crawl.json'); }
export function getReport(): ReportData | null {
  const filePath = path.join(DATA_DIR, 'report.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as ReportData;
  } catch {
    return null;
  }
}
export function getIssues(): Issue[] { 
  const data = getCrawlData();
  const allIssues: Issue[] = [];
  
  data.forEach(row => {
    const { errors, warnings } = row.issues || { errors: [], warnings: [] };
    
    [...errors, ...warnings].forEach(iss => {
      allIssues.push({
        url: row.url,
        issue: iss.issue,
        detail: iss.why,
        severity: iss.severity,
        recommendation: iss.fix
      });
    });
  });
  
  return allIssues;
}
export function getCWV(): CWVRow[]           { return readJson<CWVRow>('cwv.json'); }

