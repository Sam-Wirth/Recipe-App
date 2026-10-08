import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { recipeStore } from '@/lib/recipeStore';
import RecipeTile, { RecipeTileSkeleton } from '@/components/RecipeTile';

export const metadata: Metadata = { title: 'My Recipes' };

async function RecipeGrid() {
  await connection();
  const recipes = await recipeStore.list();

  if (recipes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-slate-600">You have not saved any recipes yet.</p>
        <div className="mt-4 flex justify-center gap-3 text-sm">
          <Link href="/scan" className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">
            Scan your pantry
          </Link>
          <Link href="/voice" className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800">
            Record a recipe
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm text-slate-500">
        {recipes.length} recipe{recipes.length === 1 ? '' : 's'}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recipes.map((r) => (
          <RecipeTile key={r.id} recipe={r} />
        ))}
      </div>
    </>
  );
}

export default function RecipesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Recipes</h1>
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <RecipeTileSkeleton key={i} />
            ))}
          </div>
        }
      >
        <RecipeGrid />
      </Suspense>
    </div>
  );
}
