'use client';

import { useEffect, useRef, useState, ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RecipeCard from '@/components/RecipeCard';
import type { Recipe } from '@/lib/recipe';
import { prepareImage, ImagePrepError } from '@/lib/prepareImage';

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function Home() {
  // Scanner state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [customItem, setCustomItem] = useState('');

  // Recipe generation state
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [allowStaples, setAllowStaples] = useState(true);
  const [servings, setServings] = useState(2);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const router = useRouter();
  const recipeRef = useRef<HTMLDivElement>(null);

  // Free the object URL when the preview changes or the page unmounts
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  // Scroll the new recipe into view
  useEffect(() => {
    if (recipe) recipeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [recipe]);

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setImageFile(null);
    setImagePreview(null);
    setPreparing(true);

    try {
      // Converts HEIC → JPEG, fixes rotation and shrinks big photos before upload.
      const prepared = await prepareImage(file);
      setImageFile(prepared);
      setImagePreview(URL.createObjectURL(prepared));
    } catch (err) {
      setError(err instanceof ImagePrepError ? err.message : 'Could not read that image.');
      e.target.value = ''; // let the user pick the same file again
    } finally {
      setPreparing(false);
    }
  };

  const handleScan = async (e: FormEvent) => {
    e.preventDefault();
    if (!imageFile) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', imageFile);

    try {
      const response = await fetch('/api/scan-pantry', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to analyze image');

      // Merge with anything already on the list so multiple photos (fridge + pantry) add up
      setIngredients((prev) => {
        const seen = new Set(prev.map((i) => i.toLowerCase()));
        const added = (data.ingredients as string[]).filter((i) => !seen.has(i.toLowerCase()));
        return [...prev, ...added];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong while scanning.');
    } finally {
      setLoading(false);
    }
  };

  const removeIngredient = (indexToRemove: number) => {
    setIngredients(ingredients.filter((_, index) => index !== indexToRemove));
  };

  const addCustomIngredient = (e: FormEvent) => {
    e.preventDefault();
    const item = customItem.trim();
    if (item && !ingredients.some((i) => i.toLowerCase() === item.toLowerCase())) {
      setIngredients([...ingredients, item]);
    }
    setCustomItem('');
  };

  const handleGenerate = async () => {
    if (ingredients.length === 0) return;

    setGenerating(true);
    setGenError(null);

    try {
      const response = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients, allowStaples, servings, notes }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate recipe');
      setRecipe(data.recipe as Recipe);
      setSaveError(null);
      setSavedId(null);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Something went wrong while generating.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!recipe) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe, source: 'pantry' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save recipe');
      setSavedId(data.recipe.id);
      router.push(`/recipes/${data.recipe.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">Pantry & Fridge Scanner</h1>
          <p className="mt-2 text-slate-600">
            Snap your fridge or pantry, tweak the ingredient list, and get a recipe built from what you have.
          </p>
        </div>

        {/* Upload Form */}
        <form onSubmit={handleScan} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Select or Take Photo</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
              capture="environment"
              onChange={handleImageChange}
              className="block w-full text-sm text-slate-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-indigo-50 file:text-indigo-700
                hover:file:bg-indigo-100 cursor-pointer"
            />
          </div>

          {imagePreview && (
            <div className="relative mt-4 rounded-lg overflow-hidden border border-slate-200 max-h-64 flex justify-center bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob: preview URL */}
              <img src={imagePreview} alt="Pantry preview" className="object-contain max-h-64" />
            </div>
          )}

          <button
            type="submit"
            disabled={!imageFile || loading || preparing}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {preparing ? (
              <>
                <Spinner />
                Preparing photo...
              </>
            ) : loading ? (
              <>
                <Spinner />
                Scanning image...
              </>
            ) : ingredients.length > 0 ? (
              'Scan & Add Ingredients'
            ) : (
              'Scan Ingredients'
            )}
          </button>
        </form>

        {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

        {/* Ingredients + Generate */}
        {ingredients.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <h2 className="text-xl font-semibold text-slate-800">Your Ingredients ({ingredients.length})</h2>
            <p className="text-sm text-slate-500">Review and tweak the list before generating a recipe.</p>

            <div className="flex flex-wrap gap-2 pt-2">
              {ingredients.map((item, index) => (
                <span
                  key={`${item}-${index}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium border border-indigo-100"
                >
                  {item}
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className="hover:text-indigo-900 font-bold focus:outline-none"
                    aria-label={`Remove ${item}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <form onSubmit={addCustomIngredient} className="flex gap-2 pt-4 border-t border-slate-100">
              <input
                type="text"
                placeholder="Add missing ingredient (e.g. olive oil)"
                value={customItem}
                onChange={(e) => setCustomItem(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Add
              </button>
            </form>

            {/* Recipe options */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={allowStaples}
                    onChange={(e) => setAllowStaples(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Assume salt, pepper, oil & water
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  Servings
                  <select
                    value={servings}
                    onChange={(e) => setServings(Number(e.target.value))}
                    className="px-2 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {[1, 2, 3, 4, 6, 8].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <input
                type="text"
                placeholder="Optional: quick weeknight, vegetarian, no oven..."
                value={notes}
                maxLength={300}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Spinner />
                  Designing your recipe...
                </>
              ) : recipe ? (
                'Generate a Different Recipe'
              ) : (
                'Generate Recipe'
              )}
            </button>
          </div>
        )}

        {genError && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{genError}</div>
        )}

        {recipe && (
          <div ref={recipeRef} className={generating ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            <RecipeCard recipe={recipe} />
            <div className="mt-4 space-y-3">
              {savedId ? (
                <Link
                  href={`/recipes/${savedId}`}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  ✓ Saved — view in My Recipes
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || generating}
                  className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Spinner />
                      Saving...
                    </>
                  ) : (
                    'Save to My Recipes'
                  )}
                </button>
              )}
              {saveError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{saveError}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
