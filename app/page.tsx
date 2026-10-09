import Link from 'next/link';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { recipeStore } from '@/lib/recipeStore';
import RecipeTile, { RecipeTileSkeleton } from '@/components/RecipeTile';

const FEATURES = [
  {
    href: '/scan',
    title: 'Pantry Scanner',
    body: 'Snap your fridge or pantry, tweak the ingredient list, and get a recipe built from what you have.',
    cta: 'Scan ingredients',
  },
  {
    href: '/voice',
    title: 'Voice Recipe',
    body: 'Talk through a recipe the way you would tell a friend. It comes back as ingredients and steps.',
    cta: 'Record a recipe',
  },
  {
    href: '/recipes',
    title: 'My Recipes',
    body: 'Everything you have saved, ready to edit or cook step by step in Cook Mode.',
    cta: 'Browse recipes',
  },
];

async function RecentRecipes() {
  await connection(); // recipes change at runtime — don't prerender this part
  const recipes = (await recipeStore.list()).slice(0, 3);

  if (recipes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        No saved recipes yet. Scan your pantry or record a voice memo to add your first one.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((r) => (
        <RecipeTile key={r.id} recipe={r} />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl space-y-12 px-4 py-10">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">What are we cooking?</h1>
        <p className="max-w-2xl text-slate-600">
          Start from what is in your kitchen or from a recipe in your head. Save the ones you like and cook them
          step by step.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {FEATURES.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="group flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-200 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-slate-900">{f.title}</h2>
            <p className="mt-2 flex-1 text-sm text-slate-600">{f.body}</p>
            <span className="mt-4 text-sm font-medium text-indigo-600 group-hover:text-indigo-800">{f.cta} →</span>
          </Link>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Recently saved</h2>
          <Link href="/recipes" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            See all
          </Link>
        </div>
        <Suspense
          fallback={
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <RecipeTileSkeleton />
              <RecipeTileSkeleton />
              <RecipeTileSkeleton />
            </div>
          }
        >
          <RecentRecipes />
        </Suspense>
      </section>
    </div>
  );
}
