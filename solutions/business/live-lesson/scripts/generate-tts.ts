/**
 * TTS Audio Pre-generation Script
 *
 * Reads lesson manifest, extracts paragraph text + step intro/summary,
 * calls 智谱 CogTTS API to generate MP3 files.
 *
 * Usage:
 *   cd solutions/business/live-lesson
 *   ZHIPU_API_KEY=xxx npx ts-node scripts/generate-tts.ts <lessonId>
 *
 * Output: data/lessons/<lessonId>/audio/p1.wav, step-0-intro.wav, etc.
 */

import * as fs from 'fs'
import * as path from 'path'

const API_URL = 'https://open.bigmodel.cn/api/paas/v4/audio/speech'

interface Paragraph {
  id: string
  text: string
}

interface Task {
  id: number
  intro: string
  summary: string
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // bold
    .replace(/\*([^*]+)\*/g, '$1')       // italic
    .replace(/¶\d+(-\d+)?/g, '')         // paragraph refs
    .replace(/[•]/g, ',')                // bullets to pause
    .replace(/\n+/g, '. ')              // newlines to sentence breaks
    .replace(/\s+/g, ' ')
    .trim()
}

async function callTTS(text: string, apiKey: string): Promise<Buffer> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'glm-tts',
      input: text,
      voice: 'tongtong',
      response_format: 'wav',
      speed: 1.0,
      watermark_enabled: false,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`TTS API error ${res.status}: ${err}`)
  }

  const arrayBuf = await res.arrayBuffer()
  return Buffer.from(arrayBuf)
}

async function main() {
  const lessonId = process.argv[2]
  if (!lessonId) {
    console.error('Usage: npx ts-node scripts/generate-tts.ts <lessonId>')
    process.exit(1)
  }

  const apiKey = process.env.ZHIPU_API_KEY
  if (!apiKey) {
    console.error('Missing ZHIPU_API_KEY environment variable')
    process.exit(1)
  }

  const manifestPath = path.resolve(__dirname, '..', 'data', 'lessons', lessonId, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`)
    process.exit(1)
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  const audioDir = path.resolve(__dirname, '..', 'data', 'lessons', lessonId, 'audio')
  fs.mkdirSync(audioDir, { recursive: true })

  const jobs: { filename: string; text: string }[] = []

  // Article paragraphs
  const paragraphs: Paragraph[] = manifest.article?.paragraphs || []
  for (const p of paragraphs) {
    const num = p.id.replace('p', '')
    jobs.push({ filename: `p${num}.wav`, text: p.text })
  }

  // Step intros and summaries (hardcoded TASKS from TaskPanel)
  // We read them from the readingSteps in manifest if available,
  // otherwise the script caller should provide them separately.
  // For now, support a tasks.json sidecar file or fall back to readingSteps descriptions.
  const tasksPath = path.resolve(__dirname, '..', 'data', 'lessons', lessonId, 'tasks.json')
  if (fs.existsSync(tasksPath)) {
    const tasks: Task[] = JSON.parse(fs.readFileSync(tasksPath, 'utf-8'))
    for (const t of tasks) {
      if (t.intro) {
        jobs.push({ filename: `step-${t.id}-intro.wav`, text: stripMarkdown(t.intro) })
      }
      if (t.summary) {
        jobs.push({ filename: `step-${t.id}-summary.wav`, text: stripMarkdown(t.summary) })
      }
    }
  } else {
    // Use readingSteps descriptions as fallback
    const steps = manifest.readingSteps || []
    for (const step of steps) {
      if (step.description) {
        jobs.push({ filename: `step-${step.idx}-intro.wav`, text: stripMarkdown(step.description) })
      }
    }
  }

  console.log(`Generating ${jobs.length} audio files for lesson "${lessonId}"...`)

  for (const job of jobs) {
    const outPath = path.join(audioDir, job.filename)
    if (fs.existsSync(outPath)) {
      console.log(`  [skip] ${job.filename} (already exists)`)
      continue
    }

    console.log(`  [gen]  ${job.filename} (${job.text.slice(0, 60)}...)`)
    try {
      const mp3 = await callTTS(job.text, apiKey)
      fs.writeFileSync(outPath, mp3)
      console.log(`         → ${mp3.length} bytes`)
    } catch (err) {
      console.error(`  [ERR]  ${job.filename}: ${err}`)
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500))
  }

  console.log('Done.')
}

main()
