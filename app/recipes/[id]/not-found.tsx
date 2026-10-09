import Link from 'next/link';

export default function RecipeNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Recipe not found</h1>
      <p className="mt-2 text-slate-600">It may have been deleted.</p>
      <Link href="/recipes" className="mt-6 inline-block font-medium text-indigo-600 hover:text-indigo-800">
        Back to My Recipes
      </Link>
    </div>
  );
}
