import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import RefreshTimer from '@/components/RefreshTimer';

import { Roboto } from 'next/font/google';

const roboto = Roboto({ weight: ['400', '500', '700'], subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SEO Audit Dashboard',
  description: 'Visual SEO audit tool — crawl data, Core Web Vitals, and issue reports.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`min-h-screen bg-[#f8f9fa] text-gray-900 antialiased ${roboto.className}`}>
        <RefreshTimer />
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
