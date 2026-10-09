import { NextResponse } from 'next/server';

// Forwards recorded or uploaded audio to a self-hosted Whisper server that speaks
// the OpenAI transcription API (POST {WHISPER_URL}/audio/transcriptions), e.g.
// speaches (formerly faster-whisper-server) running in Docker on your homelab.
//
// .env.local:
//   WHISPER_URL=http://192.168.0.50:8000/v1
//   WHISPER_MODEL=Systran/faster-whisper-small     (optional)
//   WHISPER_API_KEY=...                            (optional, if your server needs one)

const MAX_BYTES = 25 * 1024 * 1024;
const TIMEOUT_MS = 180_000;

const whisperUrl = () => process.env.WHISPER_URL?.replace(/\/+$/, '');

// Lets the page know whether to offer the record/upload fallback.
export async function GET() {
  return NextResponse.json({ available: !!whisperUrl() });
}

const EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
};

export async function POST(req: Request) {
  const base = whisperUrl();
  if (!base) {
    return NextResponse.json(
      { error: 'No transcription server is set up. Add WHISPER_URL to .env.local.' },
      { status: 501 },
    );
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get('audio');
  } catch {
    return NextResponse.json({ error: 'Expected an audio file upload.' }, { status: 400 });
  }
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: 'No audio received.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Audio is larger than 25 MB. Try a shorter recording.' }, { status: 413 });
  }

  // Whisper servers use the file extension to pick a decoder, so make sure there is one.
  const mime = file.type.split(';')[0];
  const original = file instanceof File ? file.name : '';
  const name = /\.[a-z0-9]{2,4}$/i.test(original) ? original : `recording.${EXT[mime] ?? 'webm'}`;

  const form = new FormData();
  form.append('file', file, name);
  form.append('model', process.env.WHISPER_MODEL ?? 'Systran/faster-whisper-small');
  form.append('response_format', 'json');

  try {
    const res = await fetch(`${base}/audio/transcriptions`, {
      method: 'POST',
      body: form,
      headers: process.env.WHISPER_API_KEY ? { Authorization: `Bearer ${process.env.WHISPER_API_KEY}` } : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      console.error('Whisper error', res.status, await res.text().catch(() => ''));
      return NextResponse.json({ error: `Transcription server returned an error (${res.status}).` }, { status: 502 });
    }

    const data = (await res.json()) as { text?: unknown };
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    if (!text) return NextResponse.json({ error: 'No speech was recognized in that audio.' }, { status: 422 });
    return NextResponse.json({ text });
  } catch (error) {
    console.error('Transcription failed:', error);
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return NextResponse.json(
      {
        error: timedOut
          ? 'The transcription server took too long. Try a shorter recording.'
          : `Could not reach the transcription server at ${base}.`,
      },
      { status: 502 },
    );
  }
}
