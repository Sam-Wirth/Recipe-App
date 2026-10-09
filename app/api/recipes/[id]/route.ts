import { NextResponse } from 'next/server';
import { cleanRecipe } from '@/lib/recipe';
import { recipeStore } from '@/lib/recipeStore';

const notFound = () => NextResponse.json({ error: 'Recipe not found.' }, { status: 404 });

export async function GET(_req: Request, ctx: RouteContext<'/api/recipes/[id]'>) {
  const { id } = await ctx.params;
  const recipe = await recipeStore.get(id);
  return recipe ? NextResponse.json({ recipe }) : notFound();
}

export async function PUT(req: Request, ctx: RouteContext<'/api/recipes/[id]'>) {
  const { id } = await ctx.params;
  let body: { recipe?: unknown };
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
    const updated = await recipeStore.update(id, recipe);
    return updated ? NextResponse.json({ recipe: updated }) : notFound();
  } catch (error) {
    console.error('Updating recipe failed:', error);
    return NextResponse.json({ error: 'Could not save the recipe.' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<'/api/recipes/[id]'>) {
  const { id } = await ctx.params;
  try {
    return (await recipeStore.remove(id)) ? NextResponse.json({ ok: true }) : notFound();
  } catch (error) {
    console.error('Deleting recipe failed:', error);
    return NextResponse.json({ error: 'Could not delete the recipe.' }, { status: 500 });
  }
}
