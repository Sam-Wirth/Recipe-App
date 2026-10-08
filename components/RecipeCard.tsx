import type { Recipe } from '@/lib/recipe';

function formatMinutes(total: number) {
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  const stats = [
    { label: 'Prep', value: formatMinutes(recipe.prepTimeMinutes) },
    { label: 'Cook', value: formatMinutes(recipe.cookTimeMinutes) },
    { label: 'Serves', value: String(recipe.servings) },
  ];

  return (
    <article className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-bold text-slate-900">{recipe.title}</h2>
        <p className="text-slate-600">{recipe.description}</p>
        <dl className="flex flex-wrap gap-3 pt-2">
          {stats.map((s) => (
            <div key={s.label} className="px-3 py-1.5 rounded-lg bg-slate-100 text-sm">
              <dt className="inline text-slate-500">{s.label}: </dt>
              <dd className="inline font-medium text-slate-800">{s.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section>
        <h3 className="text-lg font-semibold text-slate-800 mb-3">Ingredients</h3>
        <ul className="space-y-1.5">
          {recipe.ingredients.map((ing, i) => (
            <li key={i} className="flex items-baseline gap-2 text-slate-700">
              <span className="text-indigo-500">•</span>
              <span>
                <span className="font-medium">{ing.quantity}</span> {ing.item}
                {!ing.fromPantry && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">
                    staple
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-slate-800 mb-3">Steps</h3>
        <ol className="space-y-3">
          {recipe.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-none w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <p className="text-slate-700 pt-0.5">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      {recipe.tips && recipe.tips.length > 0 && (
        <section className="p-4 rounded-lg bg-indigo-50 border border-indigo-100">
          <h3 className="text-sm font-semibold text-indigo-800 mb-2">Tips</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-indigo-900">
            {recipe.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
