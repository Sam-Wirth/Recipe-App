import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { recipeStore } from '@/lib/recipeStore';
import EditRecipeForm from '@/components/EditRecipeForm';

export const metadata: Metadata = { title: 'Edit recipe' };

async function EditLoader({ params }: { params: PageProps<'/recipes/[id]/edit'>['params'] }) {
  const { id } = await params;
  await connection();
  const recipe = await recipeStore.get(id);
  if (!recipe) notFound();
  return (
    <>
      <Link href={`/recipes/${recipe.id}`} className="text-sm font-medium text-slate-500 hover:text-slate-800">
        ← Back to {recipe.title}
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Edit recipe</h1>
      <EditRecipeForm key={recipe.updatedAt} recipe={recipe} />
    </>
  );
}

export default function EditRecipePage({ params }: PageProps<'/recipes/[id]/edit'>) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-white" />}>
        <EditLoader params={params} />
      </Suspense>
    </div>
  );
}
