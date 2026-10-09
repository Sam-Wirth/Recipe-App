import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { recipeStore } from '@/lib/recipeStore';
import RecipeDetail from '@/components/RecipeDetail';

export async function generateMetadata({ params }: PageProps<'/recipes/[id]'>): Promise<Metadata> {
  const { id } = await params;
  await connection();
  const recipe = await recipeStore.get(id);
  return { title: recipe?.title ?? 'Recipe not found' };
}

async function RecipeLoader({ params }: { params: PageProps<'/recipes/[id]'>['params'] }) {
  const { id } = await params;
  await connection();
  const recipe = await recipeStore.get(id);
  if (!recipe) notFound();
  return <RecipeDetail recipe={recipe} />;
}

export default function RecipePage({ params }: PageProps<'/recipes/[id]'>) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <Link href="/recipes" className="text-sm font-medium text-slate-500 hover:text-slate-800">
        ← My Recipes
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-white" />}>
        <RecipeLoader params={params} />
      </Suspense>
    </div>
  );
}
