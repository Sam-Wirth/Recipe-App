'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Recipe } from '@/lib/recipe';

// Full-screen, one-thing-at-a-time view for cooking with messy hands:
// first gather ingredients, then work through the steps with big buttons.
// Arrow keys / space move between steps, Escape exits.

export default function CookMode({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  // stage 0 = gather ingredients, 1..n = steps, n+1 = done
  const [stage, setStage] = useState(0);
  const [gathered, setGathered] = useState<Set<number>>(new Set());
  const steps = recipe.steps;
  const last = steps.length + 1;

  const next = useCallback(() => setStage((s) => Math.min(last, s + 1)), [last]);
  const prev = useCallback(() => setStage((s) => Math.max(0, s - 1)), []);

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  // Keep the screen awake while cooking (needs HTTPS or localhost; silently skipped otherwise)
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const l = await navigator.wakeLock?.request('screen');
        if (cancelled) l?.release();
        else lock = l ?? null;
      } catch {
        /* not supported or not allowed */
      }
    };
    request();
    const onVisible = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => undefined);
    };
  }, []);

  // Stop the page behind from scrolling
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const toggle = (i: number) =>
    setGathered((g) => {
      const n = new Set(g);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  const progress = Math.round((stage / last) * 100);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Cook Mode: ${recipe.title}`} className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">Cook Mode</p>
          <p className="truncate font-semibold text-slate-900">{recipe.title}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Exit
        </button>
      </div>
      <div className="h-1.5 bg-slate-100">
        <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-8">
          {stage === 0 && (
            <>
              <h2 className="text-2xl font-bold text-slate-900">Gather your ingredients</h2>
              <p className="mt-1 text-slate-500">
                Tap each one as you set it out. {gathered.size} of {recipe.ingredients.length} ready.
              </p>
              <ul className="mt-6 space-y-2">
                {recipe.ingredients.map((ing, i) => {
                  const done = gathered.has(i);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => toggle(i)}
                        aria-pressed={done}
                        className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left text-lg transition-colors ${
                          done ? 'border-emerald-200 bg-emerald-50 text-slate-400 line-through' : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 text-sm ${
                            done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'
                          }`}
                        >
                          {done ? '✓' : ''}
                        </span>
                        <span>
                          <span className="font-semibold">{ing.quantity}</span> {ing.item}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {stage >= 1 && stage <= steps.length && (
            <>
              <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">
                Step {stage} of {steps.length}
              </p>
              <p className="mt-4 text-2xl leading-relaxed text-slate-900 sm:text-3xl sm:leading-relaxed">{steps[stage - 1]}</p>
              {stage < steps.length && (
                <p className="mt-10 border-t border-slate-100 pt-4 text-sm text-slate-400">
                  Next: {steps[stage]}
                </p>
              )}
            </>
          )}

          {stage === last && (
            <div className="text-center">
              <p className="text-5xl" aria-hidden="true">🍽️</p>
              <h2 className="mt-4 text-3xl font-bold text-slate-900">All done. Enjoy!</h2>
              {recipe.tips && recipe.tips.length > 0 && (
                <ul className="mx-auto mt-6 max-w-md space-y-1 text-left text-slate-600">
                  {recipe.tips.map((t, i) => (
                    <li key={i}>• {t}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-slate-200 p-4">
        <button
          type="button"
          onClick={prev}
          disabled={stage === 0}
          className="rounded-xl bg-slate-100 py-4 text-lg font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
        >
          Back
        </button>
        {stage < last ? (
          <button
            type="button"
            onClick={next}
            className="rounded-xl bg-indigo-600 py-4 text-lg font-semibold text-white hover:bg-indigo-700"
          >
            {stage === 0 ? 'Start cooking' : stage === steps.length ? 'Finish' : 'Next step'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-emerald-600 py-4 text-lg font-semibold text-white hover:bg-emerald-700"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
