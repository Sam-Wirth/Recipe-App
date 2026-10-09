import Link from 'next/link';
import { formatMinutes } from '@/lib/recipe';
import type { StoredRecipe } from '@/lib/recipeStore';
import { SOURCE_LABEL } from '@/components/ui';

// Soft accent colors, picked from the recipe id so each card keeps its color.
const ACCENTS = [
  'from-amber-100 to-orange-100 text-orange-800',
  'from-emerald-100 to-teal-100 text-teal-800',
  'from-sky-100 to-indigo-100 text-indigo-800',
  'from-rose-100 to-pink-100 text-rose-800',
  'from-lime-100 to-green-100 text-green-800',
  'from-violet-100 to-fuchsia-100 text-violet-800',
];

function accentFor(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export default function RecipeTile({ recipe }: { recipe: StoredRecipe }) {
  const total = recipe.prepTimeMinutes + recipe.cookTimeMinutes;
  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-indigo-500"
    >
      <div className={`flex h-24 items-end bg-gradient-to-br p-4 ${accentFor(recipe.id)}`}>
        <span className="text-4xl font-bold leading-none opacity-60">{recipe.title.charAt(0).toUpperCase()}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-semibold text-slate-900 group-hover:text-indigo-700">{recipe.title}</h3>
        {recipe.description && <p className="line-clamp-2 text-sm text-slate-600">{recipe.description}</p>}
        <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-2 text-xs text-slate-500">
          {total > 0 && <span>{formatMinutes(total)}</span>}
          <span>Serves {recipe.servings}</span>
          <span>{recipe.ingredients.length} ingredients</span>
          <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{SOURCE_LABEL[recipe.source]}</span>
        </div>
      </div>
    </Link>
  );
}

export function RecipeTileSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="h-24 animate-pulse bg-slate-100" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}
