import Link from 'next/link';
import { Suspense } from 'react';
import NavLinks, { NavLinksFallback } from '@/components/NavLinks';
import { SITE_NAME } from '@/lib/site';

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          {SITE_NAME}
        </Link>
        <Suspense fallback={<NavLinksFallback />}>
          <NavLinks />
        </Suspense>
      </div>
    </header>
  );
}
