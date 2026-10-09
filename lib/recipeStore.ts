// Saved-recipe storage. Server-only.
//
// For now recipes live in one JSON file (data/recipes.json in the project folder).
// Everything goes through the RecipeStore interface, so the Supabase step only
// has to provide a second implementation and change `recipeStore` at the bottom.

import { promises as fs } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { cleanRecipe, type Recipe } from '@/lib/recipe';

export type RecipeSource = 'pantry' | 'voice' | 'manual';

export interface StoredRecipe extends Recipe {
  id: string;
  source: RecipeSource;
  createdAt: string; // ISO timestamps
  updatedAt: string;
  transcript?: string; // original voice transcript, kept for reference
}

export interface RecipeStore {
  list(): Promise<StoredRecipe[]>; // newest first
  get(id: string): Promise<StoredRecipe | null>;
  create(recipe: Recipe, meta: { source: RecipeSource; transcript?: string }): Promise<StoredRecipe>;
  update(id: string, recipe: Recipe): Promise<StoredRecipe | null>;
  remove(id: string): Promise<boolean>;
}

const SOURCES: RecipeSource[] = ['pantry', 'voice', 'manual'];
export const isRecipeSource = (v: unknown): v is RecipeSource => SOURCES.includes(v as RecipeSource);

// ---------------------------------------------------------------------------
// JSON file implementation

class JsonFileRecipeStore implements RecipeStore {
  private file: string;
  private queue: Promise<unknown> = Promise.resolve(); // serializes writes

  constructor(dir: string) {
    this.file = path.join(dir, 'recipes.json');
  }

  private async readAll(): Promise<StoredRecipe[]> {
    let text: string;
    try {
      text = await fs.readFile(this.file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    const data = JSON.parse(text) as { recipes?: unknown[] };
    return (data.recipes ?? []).flatMap((raw) => {
      const r = raw as Partial<StoredRecipe>;
      const recipe = cleanRecipe(r);
      if (!recipe || typeof r.id !== 'string') return [];
      return [
        {
          ...recipe,
          id: r.id,
          source: isRecipeSource(r.source) ? r.source : 'manual',
          createdAt: r.createdAt ?? new Date(0).toISOString(),
          updatedAt: r.updatedAt ?? r.createdAt ?? new Date(0).toISOString(),
          ...(r.transcript ? { transcript: r.transcript } : {}),
        },
      ];
    });
  }

  private async writeAll(recipes: StoredRecipe[]) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const json = JSON.stringify({ version: 1, recipes }, null, 2);
    // Write to a temp file and rename, so a crash mid-write can't corrupt the data.
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, json, 'utf8');
    try {
      await fs.rename(tmp, this.file);
    } catch {
      // Windows can refuse the rename if another program has the file open.
      await fs.writeFile(this.file, json, 'utf8');
      await fs.rm(tmp, { force: true });
    }
  }

  // Run read-modify-write operations one at a time.
  private mutate<T>(fn: (recipes: StoredRecipe[]) => Promise<T> | T): Promise<T> {
    const run = this.queue.then(async () => {
      const recipes = await this.readAll();
      return fn(recipes);
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async list() {
    const all = await this.readAll();
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string) {
    return (await this.readAll()).find((r) => r.id === id) ?? null;
  }

  create(recipe: Recipe, meta: { source: RecipeSource; transcript?: string }) {
    return this.mutate(async (recipes) => {
      const now = new Date().toISOString();
      const stored: StoredRecipe = {
        ...recipe,
        id: randomBytes(5).toString('hex'),
        source: meta.source,
        createdAt: now,
        updatedAt: now,
        ...(meta.transcript ? { transcript: meta.transcript.slice(0, 20_000) } : {}),
      };
      await this.writeAll([...recipes, stored]);
      return stored;
    });
  }

  update(id: string, recipe: Recipe) {
    return this.mutate(async (recipes) => {
      const i = recipes.findIndex((r) => r.id === id);
      if (i === -1) return null;
      const { id: _id, source, createdAt, transcript } = recipes[i];
      const updated: StoredRecipe = {
        ...recipe,
        id: _id,
        source,
        createdAt,
        updatedAt: new Date().toISOString(),
        ...(transcript ? { transcript } : {}),
      };
      recipes[i] = updated;
      await this.writeAll(recipes);
      return updated;
    });
  }

  remove(id: string) {
    return this.mutate(async (recipes) => {
      const next = recipes.filter((r) => r.id !== id);
      if (next.length === recipes.length) return false;
      await this.writeAll(next);
      return true;
    });
  }
}

export const recipeStore: RecipeStore = new JsonFileRecipeStore(
  process.env.RECIPE_DATA_DIR ?? path.join(process.cwd(), 'data'),
);
