import type Anthropic from '@anthropic-ai/sdk';

// Shared recipe shape used by /api/generate-recipe now, and later by the
// audio-to-recipe parser and the Supabase `recipes.data` jsonb column.

export interface RecipeIngredient {
  item: string; // "chicken thighs"
  quantity: string; // "4, bone-in" or "2 tbsp" — free text keeps the model honest
  fromPantry: boolean; // true if it came from the user's chip list, false for assumed staples
}

export interface Recipe {
  title: string;
  description: string;
  servings: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  ingredients: RecipeIngredient[];
  steps: string[]; // one action per step — becomes the Cook Mode checklist later
  tips?: string[];
}

export const RECIPE_TOOL_NAME = 'save_recipe';

// JSON Schema handed to Claude as a tool definition. Forcing the model to call
// this tool gets structured input back instead of prose.
export const RECIPE_TOOL: Anthropic.Tool = {
  name: RECIPE_TOOL_NAME,
  description: 'Save a complete, cookable recipe in structured form.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short, appetizing recipe name.' },
      description: { type: 'string', description: 'One or two sentences describing the dish.' },
      servings: { type: 'integer', minimum: 1 },
      prepTimeMinutes: { type: 'integer', minimum: 0 },
      cookTimeMinutes: { type: 'integer', minimum: 0 },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            item: { type: 'string' },
            quantity: { type: 'string' },
            fromPantry: {
              type: 'boolean',
              description: 'true if this ingredient is from the provided list; false for an assumed basic staple.',
            },
          },
          required: ['item', 'quantity', 'fromPantry'],
        },
      },
      steps: {
        type: 'array',
        items: { type: 'string' },
        description: 'Ordered instructions, one action per step, no numbering.',
      },
      tips: { type: 'array', items: { type: 'string' } },
    },
    required: ['title', 'description', 'servings', 'prepTimeMinutes', 'cookTimeMinutes', 'ingredients', 'steps'],
  },
};

// Models sometimes send numbers as strings ("15") or leave out optional
// flags. Coerce those small slips before validating, rather than failing.
export function normalizeRecipe(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const r = { ...(value as Record<string, unknown>) };
  for (const key of ['servings', 'prepTimeMinutes', 'cookTimeMinutes']) {
    if (typeof r[key] === 'string') {
      const n = parseInt(r[key] as string, 10);
      if (!Number.isNaN(n)) r[key] = n;
    }
  }
  if (Array.isArray(r.ingredients)) {
    r.ingredients = r.ingredients.map((i) =>
      i && typeof i === 'object'
        ? {
            ...i,
            quantity: typeof (i as RecipeIngredient).quantity === 'string' ? (i as RecipeIngredient).quantity : '',
            fromPantry: (i as RecipeIngredient).fromPantry !== false,
          }
        : i,
    );
  }
  if (r.tips !== undefined && !Array.isArray(r.tips)) delete r.tips;
  return r;
}

// Light runtime check — the model is constrained by the schema, but never trust
// external JSON blindly before it hits the UI or the database.
export function isRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.title === 'string' &&
    typeof r.description === 'string' &&
    typeof r.servings === 'number' &&
    typeof r.prepTimeMinutes === 'number' &&
    typeof r.cookTimeMinutes === 'number' &&
    Array.isArray(r.ingredients) &&
    r.ingredients.every((i) => i && typeof i === 'object' && typeof (i as RecipeIngredient).item === 'string') &&
    Array.isArray(r.steps) &&
    r.steps.every((s) => typeof s === 'string')
  );
}

const LIMITS = { text: 200, longText: 1000, list: 80 };

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function int(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

/**
 * Build a clean Recipe from untrusted input (model output, a browser form, the
 * saved JSON file). Unknown fields are dropped, strings trimmed and capped,
 * numbers clamped. Returns null if there's no usable title, ingredient or step.
 */
export function cleanRecipe(value: unknown): Recipe | null {
  const v = normalizeRecipe(value);
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;

  const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : [])
    .map((i) => {
      const o = (i && typeof i === 'object' ? i : {}) as Record<string, unknown>;
      return { item: str(o.item, LIMITS.text), quantity: str(o.quantity, LIMITS.text), fromPantry: o.fromPantry !== false };
    })
    .filter((i) => i.item)
    .slice(0, LIMITS.list);

  const steps = (Array.isArray(r.steps) ? r.steps : [])
    .map((s) => str(s, LIMITS.longText))
    .filter(Boolean)
    .slice(0, LIMITS.list);

  const tips = (Array.isArray(r.tips) ? r.tips : [])
    .map((s) => str(s, LIMITS.longText))
    .filter(Boolean)
    .slice(0, 20);

  const title = str(r.title, LIMITS.text);
  if (!title || ingredients.length === 0 || steps.length === 0) return null;

  return {
    title,
    description: str(r.description, LIMITS.longText),
    servings: int(r.servings, 1, 100, 2),
    prepTimeMinutes: int(r.prepTimeMinutes, 0, 24 * 60, 0),
    cookTimeMinutes: int(r.cookTimeMinutes, 0, 7 * 24 * 60, 0),
    ingredients,
    steps,
    ...(tips.length ? { tips } : {}),
  };
}

export function formatMinutes(total: number) {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
