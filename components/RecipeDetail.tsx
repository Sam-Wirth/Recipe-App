'use client';

import Link from 'next/link';
import { useLayoutEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import RecipeCard from '@/components/RecipeCard';
import CookMode from '@/components/CookMode';
import { ErrorBox, SOURCE_LABEL } from '@/components/ui';
import type { StoredRecipe } from '@/lib/recipeStore';

export default function RecipeDetail({ recipe }: { recipe: StoredRecipe }) {
  const router = useRouter();
  const [cooking, setCooking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Next keeps visited pages alive in the background; don't come back to an open Cook Mode.
  useLayoutEffect(
    () => () => {
      setCooking(false);
      setConfirmDelete(false);
    },
    [],
  );

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipes/${recipe.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed');
      router.push('/recipes');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const saved = new Date(recipe.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCooking(true)}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-700"
        >
          Start Cook Mode
        </button>
        <Link
          href={`/recipes/${recipe.id}/edit`}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          onBlur={() => setConfirmDelete(false)}
          disabled={deleting}
          className={`rounded-lg px-4 py-2.5 font-medium transition-colors disabled:opacity-50 ${
            confirmDelete ? 'bg-red-600 text-white hover:bg-red-700' : 'text-red-600 hover:bg-red-50'
          }`}
        >
          {deleting ? 'Deleting...' : confirmDelete ? 'Tap again to delete' : 'Delete'}
        </button>
        <span className="ml-auto text-xs text-slate-500">
          {SOURCE_LABEL[recipe.source]} · saved {saved}
        </span>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      <RecipeCard recipe={recipe} />

      {recipe.transcript && (
        <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <summary className="cursor-pointer font-medium text-slate-700">Original voice transcript</summary>
          <p className="mt-3 whitespace-pre-wrap text-slate-600">{recipe.transcript}</p>
        </details>
      )}

      {cooking && <CookMode recipe={recipe} onClose={() => setCooking(false)} />}
    </div>
  );
}
