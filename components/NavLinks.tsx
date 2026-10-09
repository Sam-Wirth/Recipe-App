'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/scan', label: 'Pantry Scanner' },
  { href: '/voice', label: 'Voice Recipe' },
  { href: '/recipes', label: 'My Recipes' },
];

function Links({ pathname }: { pathname: string | null }) {
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto text-sm">
      {LINKS.map((link) => {
        const active = !!pathname && (pathname === link.href || pathname.startsWith(link.href + '/'));
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-colors ${
              active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Plain links with no highlight — the prerendered fallback. */
export function NavLinksFallback() {
  return <Links pathname={null} />;
}

/** Highlights the current section (reads the URL, so it renders inside <Suspense>). */
export default function NavLinks() {
  return <Links pathname={usePathname()} />;
}
