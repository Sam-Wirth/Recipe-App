import { NextResponse } from 'next/server';
import { cleanRecipe } from '@/lib/recipe';
import { recipeStore, isRecipeSource } from '@/lib/recipeStore';

export async function GET() {
  const recipes = await recipeStore.list();
  return NextResponse.json({ recipes });
}

export async function POST(req: Request) {
  let body: { recipe?: unknown; source?: unknown; transcript?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const recipe = cleanRecipe(body.recipe);
  if (!recipe) {
    return NextResponse.json(
      { error: 'A recipe needs a title, at least one ingredient and at least one step.' },
      { status: 400 },
    );
  }

  try {
    const stored = await recipeStore.create(recipe, {
      source: isRecipeSource(body.source) ? body.source : 'manual',
      transcript: typeof body.transcript === 'string' ? body.transcript : undefined,
    });
    return NextResponse.json({ recipe: stored }, { status: 201 });
  } catch (error) {
    console.error('Saving recipe failed:', error);
    return NextResponse.json({ error: 'Could not save the recipe.' }, { status: 500 });
  }
}
