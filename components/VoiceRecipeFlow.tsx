'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import RecipeEditor from '@/components/RecipeEditor';
import { ErrorBox, Spinner } from '@/components/ui';
import type { Recipe } from '@/lib/recipe';

// --- Minimal Web Speech API types (not in every TS DOM lib) -----------------
interface SpeechResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
}
interface SpeechRecognizer {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechCtor = new () => SpeechRecognizer;

interface Capabilities {
  liveSpeech: boolean; // browser speech-to-text
  recorder: boolean; // MediaRecorder + mic (needs HTTPS or localhost)
  whisper: boolean; // server has WHISPER_URL
  secure: boolean;
}

const MAX_RECORD_SECONDS = 10 * 60;

function getSpeechCtor(): SpeechCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function pickMimeType() {
  for (const t of ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm']) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function VoiceRecipeFlow() {
  const router = useRouter();
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [mode, setMode] = useState<'idle' | 'listening' | 'recording' | 'transcribing'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const keepListening = useRef(false);
  const committed = useRef(''); // transcript text including finalized speech
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Detect what this browser/server combo can do (client-only, after mount)
  useEffect(() => {
    const secure = window.isSecureContext;
    const base = {
      liveSpeech: secure && !!getSpeechCtor(),
      recorder: secure && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined',
      secure,
    };
    fetch('/api/transcribe')
      .then((r) => r.json())
      .then((d: { available?: boolean }) => setCaps({ ...base, whisper: !!d.available }))
      .catch(() => setCaps({ ...base, whisper: false }));
  }, []);

  // Clean up mic/timers if the user leaves mid-recording
  useEffect(
    () => () => {
      keepListening.current = false;
      recognizerRef.current?.abort();
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const appendText = (text: string) =>
    setTranscript((t) => (t.trim() ? `${t.trim()} ${text.trim()}` : text.trim()));

  // --- Browser speech-to-text -----------------------------------------------
  const startListening = () => {
    const Ctor = getSpeechCtor();
    if (!Ctor) return;
    setError(null);

    // Android Chrome repeats phrases in continuous mode, so restart per phrase instead.
    const android = /android/i.test(navigator.userAgent);
    committed.current = transcript.trim() ? transcript.trim() + ' ' : '';
    keepListening.current = true;

    const begin = () => {
      const rec = new Ctor();
      rec.continuous = !android;
      rec.interimResults = true;
      rec.lang = navigator.language || 'en-US';

      rec.onresult = (e) => {
        let pending = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) committed.current += r[0].transcript.trim() + ' ';
          else pending += r[0].transcript;
        }
        setTranscript(committed.current.trimEnd());
        setInterim(pending);
      };

      rec.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return; // harmless; onend restarts
        keepListening.current = false;
        setError(
          e.error === 'not-allowed' || e.error === 'service-not-allowed'
            ? 'Microphone access was blocked. Allow it in your browser settings and try again.'
            : e.error === 'network'
              ? 'Speech recognition needs an internet connection in this browser.' +
                (caps?.whisper ? ' Try "Record audio" instead.' : '')
              : `Speech recognition stopped (${e.error}).`,
        );
      };

      // Browsers end recognition after silence or ~60 s; keep going until the user stops.
      rec.onend = () => {
        if (keepListening.current) {
          try {
            begin();
            return;
          } catch {
            /* fall through */
          }
        }
        setInterim('');
        setMode('idle');
      };

      recognizerRef.current = rec;
      rec.start();
    };

    try {
      begin();
      setMode('listening');
    } catch {
      keepListening.current = false;
      setError('Could not start speech recognition.');
    }
  };

  const stopListening = () => {
    keepListening.current = false;
    recognizerRef.current?.stop();
  };

  // --- Whisper fallback: record or upload audio -----------------------------
  const transcribe = useCallback(async (audio: Blob, filename?: string) => {
    setMode('transcribing');
    setError(null);
    try {
      const form = new FormData();
      form.append('audio', audio, filename ?? 'recording');
      const res = await fetch('/api/transcribe', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transcription failed.');
      appendText(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed.');
    } finally {
      setMode('idle');
    }
  }, []);

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const startRecording = async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Microphone access was blocked. Allow it in your browser settings and try again.');
      return;
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      const type = recorder.mimeType || mimeType || 'audio/webm';
      const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      const blob = new Blob(chunks, { type });
      if (blob.size) transcribe(blob, `recording.${ext}`);
      else setMode('idle');
    };

    recorderRef.current = recorder;
    recorder.start(1000);
    setSeconds(0);
    setMode('recording');
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_RECORD_SECONDS) stopRecording();
        return s + 1;
      });
    }, 1000);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) transcribe(file, file.name);
  };

  // --- Transcript → recipe --------------------------------------------------
  const handleParse = async () => {
    setParsing(true);
    setError(null);
    try {
      const res = await fetch('/api/parse-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not build a recipe.');
      setRecipe(data.recipe as Recipe);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build a recipe.');
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async (final: Recipe) => {
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe: final, source: 'voice', transcript }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save the recipe.');
    // Next keeps this page alive in the background; start fresh next time.
    setRecipe(null);
    setTranscript('');
    router.push(`/recipes/${data.recipe.id}`);
  };

  // --- Review step ----------------------------------------------------------
  if (recipe) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Here is what I heard. Fix anything that is off, then save it.
        </div>
        <RecipeEditor
          initial={recipe}
          saveLabel="Save to My Recipes"
          onSave={handleSave}
          onCancel={() => setRecipe(null)}
        />
      </div>
    );
  }

  // --- Capture step ---------------------------------------------------------
  const busy = mode !== 'idle' || parsing;
  const shown = mode === 'listening' && interim ? `${transcript} ${interim}`.trim() : transcript;
  const noMicReason =
    caps && !caps.secure
      ? 'Live recording needs HTTPS when you are not on localhost (for example, on your phone over Wi-Fi).'
      : caps && !caps.liveSpeech && !caps.whisper
        ? 'This browser has no built-in speech recognition. Set up a Whisper server to record here, or type below.'
        : null;

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap gap-3">
          {caps?.liveSpeech &&
            (mode === 'listening' ? (
              <button
                type="button"
                onClick={stopListening}
                className="flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 font-medium text-white hover:bg-red-700"
              >
                <span className="h-3 w-3 animate-pulse rounded-full bg-white" />
                Stop listening
              </button>
            ) : (
              <button
                type="button"
                onClick={startListening}
                disabled={busy}
                className="flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                🎙️ {transcript ? 'Keep talking' : 'Start talking'}
              </button>
            ))}

          {caps?.whisper &&
            caps.recorder &&
            (mode === 'recording' ? (
              <button
                type="button"
                onClick={stopRecording}
                className="flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 font-medium text-white hover:bg-red-700"
              >
                <span className="h-3 w-3 animate-pulse rounded-full bg-white" />
                Stop recording · {fmtTime(seconds)}
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={busy}
                className={`flex items-center gap-2 rounded-full px-6 py-3 font-medium disabled:opacity-50 ${
                  caps.liveSpeech
                    ? 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                <span className="h-3 w-3 rounded-full bg-red-500" aria-hidden="true" />
                Record audio
              </button>
            ))}

          {caps?.whisper && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="rounded-full border border-slate-300 px-6 py-3 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Upload voice memo
              </button>
              <input ref={fileRef} type="file" accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg" className="hidden" onChange={handleUpload} />
            </>
          )}

          {!caps && <div className="h-12 w-48 animate-pulse rounded-full bg-slate-100" />}
        </div>

        {mode === 'listening' && <p className="text-sm text-slate-500">Listening… talk through the dish, ingredients and steps.</p>}
        {mode === 'transcribing' && (
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner className="h-4 w-4 text-indigo-600" />
            Transcribing audio…
          </p>
        )}
        {noMicReason && mode === 'idle' && <p className="text-sm text-amber-700">{noMicReason}</p>}

        <div>
          <label htmlFor="transcript" className="mb-1 block text-sm font-medium text-slate-700">
            Transcript <span className="font-normal text-slate-400">— edit freely, or type and paste here</span>
          </label>
          <textarea
            id="transcript"
            rows={10}
            value={shown}
            readOnly={mode === 'listening'}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={'e.g. "This is my grandma\'s chili. Brown two pounds of ground beef with a diced onion, then add two cans of kidney beans…"'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 read-only:bg-slate-50"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>{transcript.trim() ? `${transcript.trim().split(/\s+/).length} words` : ''}</span>
            {transcript && mode === 'idle' && (
              <button type="button" onClick={() => setTranscript('')} className="hover:text-slate-600">
                Clear
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleParse}
          disabled={busy || transcript.trim().length < 20}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {parsing ? (
            <>
              <Spinner />
              Building your recipe…
            </>
          ) : (
            'Turn into a recipe'
          )}
        </button>
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      <details className="text-sm text-slate-500">
        <summary className="cursor-pointer">Tips for a good voice recipe</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Say the dish name and how many it serves first.</li>
          <li>List ingredients with amounts, then walk through the steps in order.</li>
          <li>Mention oven temperatures and cooking times out loud.</li>
          <li>Pausing is fine. Recording keeps going until you press stop.</li>
        </ul>
      </details>
    </div>
  );
}
