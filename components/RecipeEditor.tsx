'use client';

import { useState } from 'react';
import type { Recipe } from '@/lib/recipe';
import { ErrorBox, Spinner } from '@/components/ui';

// Rows carry a local key so React keeps focus right while rows are added,
// removed or reordered. (crypto.randomUUID isn't available over plain HTTP on a phone.)
interface IngredientRow {
  key: number;
  item: string;
  quantity: string;
  fromPantry: boolean;
}
interface TextRow {
  key: number;
  text: string;
}

interface Props {
  initial: Recipe;
  saveLabel?: string;
  onSave: (recipe: Recipe) => Promise<void>;
  onCancel?: () => void;
}

const input =
  'rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const label = 'block text-sm font-medium text-slate-700 mb-1';
// Unique-enough keys for list rows; only needs to be unique within this page.
let keySeq = 0;
const k = () => ++keySeq;

const smallBtn = 'rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30';

export default function RecipeEditor({ initial, saveLabel = 'Save recipe', onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [servings, setServings] = useState(String(initial.servings));
  const [prep, setPrep] = useState(String(initial.prepTimeMinutes));
  const [cook, setCook] = useState(String(initial.cookTimeMinutes));
  const [ingredients, setIngredients] = useState<IngredientRow[]>(() =>
    initial.ingredients.map((i) => ({ key: k(), ...i })),
  );
  const [steps, setSteps] = useState<TextRow[]>(() => initial.steps.map((text) => ({ key: k(), text })));
  const [tips, setTips] = useState<TextRow[]>(() => (initial.tips ?? []).map((text) => ({ key: k(), text })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const copy = [...list];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    return copy;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const recipe: Recipe = {
      title: title.trim(),
      description: description.trim(),
      servings: Math.max(1, parseInt(servings, 10) || 1),
      prepTimeMinutes: Math.max(0, parseInt(prep, 10) || 0),
      cookTimeMinutes: Math.max(0, parseInt(cook, 10) || 0),
      ingredients: ingredients
        .map(({ item, quantity, fromPantry }) => ({ item: item.trim(), quantity: quantity.trim(), fromPantry }))
        .filter((i) => i.item),
      steps: steps.map((s) => s.text.trim()).filter(Boolean),
      tips: tips.map((t) => t.text.trim()).filter(Boolean),
    };
    if (!recipe.tips?.length) delete recipe.tips;

    if (!recipe.title) return setError('Give the recipe a title.');
    if (recipe.ingredients.length === 0) return setError('Add at least one ingredient.');
    if (recipe.steps.length === 0) return setError('Add at least one step.');

    setSaving(true);
    setError(null);
    try {
      await onSave(recipe);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the recipe.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-4">
        <div>
          <label htmlFor="title" className={label}>
            Title
          </label>
          <input id="title" className={`${input} w-full text-base font-semibold`} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor="description" className={label}>
            Description
          </label>
          <textarea
            id="description"
            rows={2}
            className={`${input} w-full`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="servings" className={label}>
              Servings
            </label>
            <input id="servings" type="number" min={1} inputMode="numeric" className={`${input} w-full`} value={servings} onChange={(e) => setServings(e.target.value)} />
          </div>
          <div>
            <label htmlFor="prep" className={label}>
              Prep (min)
            </label>
            <input id="prep" type="number" min={0} inputMode="numeric" className={`${input} w-full`} value={prep} onChange={(e) => setPrep(e.target.value)} />
          </div>
          <div>
            <label htmlFor="cook" className={label}>
              Cook (min)
            </label>
            <input id="cook" type="number" min={0} inputMode="numeric" className={`${input} w-full`} value={cook} onChange={(e) => setCook(e.target.value)} />
          </div>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-lg font-semibold text-slate-800">Ingredients</legend>
        {ingredients.map((ing, i) => (
          <div key={ing.key} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <input
              aria-label={`Ingredient ${i + 1} quantity`}
              placeholder="Qty"
              className={`${input} w-24 flex-none sm:w-28`}
              value={ing.quantity}
              onChange={(e) => setIngredients((l) => l.map((r) => (r.key === ing.key ? { ...r, quantity: e.target.value } : r)))}
            />
            <input
              aria-label={`Ingredient ${i + 1}`}
              placeholder="Ingredient"
              className={`${input} min-w-0 flex-1 basis-40`}
              value={ing.item}
              onChange={(e) => setIngredients((l) => l.map((r) => (r.key === ing.key ? { ...r, item: e.target.value } : r)))}
            />
            <label className="flex items-center gap-1 text-xs text-slate-500" title="Assumed staple (salt, oil...)">
              <input
                type="checkbox"
                checked={!ing.fromPantry}
                onChange={(e) =>
                  setIngredients((l) => l.map((r) => (r.key === ing.key ? { ...r, fromPantry: !e.target.checked } : r)))
                }
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              staple
            </label>
            <button
              type="button"
              aria-label={`Remove ${ing.item || 'ingredient'}`}
              className={smallBtn}
              onClick={() => setIngredients((l) => l.filter((r) => r.key !== ing.key))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          onClick={() => setIngredients((l) => [...l, { key: k(), item: '', quantity: '', fromPantry: true }])}
        >
          + Add ingredient
        </button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-lg font-semibold text-slate-800">Steps</legend>
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-start gap-2">
            <span className="mt-2 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
              {i + 1}
            </span>
            <textarea
              aria-label={`Step ${i + 1}`}
              rows={2}
              className={`${input} min-w-0 flex-1`}
              value={step.text}
              onChange={(e) => setSteps((l) => l.map((r) => (r.key === step.key ? { ...r, text: e.target.value } : r)))}
            />
            <div className="flex flex-col">
              <button type="button" aria-label="Move step up" className={smallBtn} disabled={i === 0} onClick={() => setSteps((l) => move(l, i, -1))}>
                ↑
              </button>
              <button
                type="button"
                aria-label="Move step down"
                className={smallBtn}
                disabled={i === steps.length - 1}
                onClick={() => setSteps((l) => move(l, i, 1))}
              >
                ↓
              </button>
              <button type="button" aria-label={`Remove step ${i + 1}`} className={smallBtn} onClick={() => setSteps((l) => l.filter((r) => r.key !== step.key))}>
                ✕
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          onClick={() => setSteps((l) => [...l, { key: k(), text: '' }])}
        >
          + Add step
        </button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-lg font-semibold text-slate-800">Tips (optional)</legend>
        {tips.map((tip, i) => (
          <div key={tip.key} className="flex items-center gap-2">
            <input
              aria-label={`Tip ${i + 1}`}
              className={`${input} min-w-0 flex-1`}
              value={tip.text}
              onChange={(e) => setTips((l) => l.map((r) => (r.key === tip.key ? { ...r, text: e.target.value } : r)))}
            />
            <button type="button" aria-label={`Remove tip ${i + 1}`} className={smallBtn} onClick={() => setTips((l) => l.filter((r) => r.key !== tip.key))}>
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          onClick={() => setTips((l) => [...l, { key: k(), text: '' }])}
        >
          + Add tip
        </button>
      </fieldset>

      {error && <ErrorBox>{error}</ErrorBox>}

      <div className="flex gap-3 border-t border-slate-100 pt-4">
        <button
          type="submit"
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Spinner />
              Saving...
            </>
          ) : (
            saveLabel
          )}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
