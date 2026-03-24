'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/',           label: '📊 Dashboard' },
  { href: '/report',     label: '📈 Report' },
  { href: '/issues',     label: '🔍 Issues' },
  { href: '/pages-list', label: '📄 Pages' },
  { href: '/links',      label: '🔗 Links' },
];

export default function Navbar() {
  const path = usePathname();
  return (
    <nav className="bg-white/90 backdrop-blur sticky top-0 z-30 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
            <span className="text-[#1a73e8]">⚡</span> SEO Engine
          </span>
          <div className="hidden sm:flex items-center gap-1">
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  path === l.href
                    ? 'bg-[#e8f0fe] text-[#1a73e8]'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
