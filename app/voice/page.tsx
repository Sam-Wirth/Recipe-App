import type { Metadata } from 'next';
import VoiceRecipeFlow from '@/components/VoiceRecipeFlow';

export const metadata: Metadata = { title: 'Voice Recipe' };

export default function VoicePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Voice Recipe</h1>
        <p className="mt-2 text-slate-600">
          Talk through a recipe the way you would tell a friend. It comes back as ingredients and steps you can edit and save.
        </p>
      </div>
      <VoiceRecipeFlow />
    </div>
  );
}
