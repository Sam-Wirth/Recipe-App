'use client';

import { useRouter } from 'next/navigation';
import RecipeEditor from '@/components/RecipeEditor';
import type { StoredRecipe } from '@/lib/recipeStore';

export default function EditRecipeForm({ recipe }: { recipe: StoredRecipe }) {
  const router = useRouter();
  return (
    <RecipeEditor
      initial={recipe}
      saveLabel="Save changes"
      onCancel={() => router.push(`/recipes/${recipe.id}`)}
      onSave={async (updated) => {
        const res = await fetch(`/api/recipes/${recipe.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipe: updated }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not save changes.');
        router.push(`/recipes/${recipe.id}`);
        router.refresh();
      }}
    />
  );
}
