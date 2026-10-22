import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

const openai = new OpenAI()

export const config = {
  api: { bodyParser: false },
}

type ParsedUpdate = {
  item_id: string | null
  item_name: string
  direction: 'in' | 'out'
  quantity: number
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const audioEntry = formData.get('audio')
  const itemsJson = formData.get('items')

  if (!audioEntry || typeof itemsJson !== 'string') {
    return NextResponse.json({ error: 'audio and items JSON are required.' }, { status: 400 })
  }

  const items: { id: string; name: string }[] = JSON.parse(itemsJson)

  try {
    // Next.js returns a File object from formData
    const audioBlob = audioEntry as unknown as Blob
    const audioFile = new File([audioBlob], 'recording.webm', {
      type: (audioBlob as File).type || 'audio/webm',
    })

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
    })
    const transcript = transcription.text.trim()

    const itemList = items.map(i => `- id: ${i.id}, name: ${i.name}`).join('\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an inventory assistant. Extract inventory updates from the user's speech.

Available items:
${itemList}

Return a JSON object with this shape:
{
  "updates": [
    { "item_id": "<id from list or null if no match>", "item_name": "<best match name>", "direction": "in" | "out", "quantity": <positive integer> }
  ]
}

Rules:
- "in" means received/added/found; "out" means given away/removed/used/dispatched
- Match item names fuzzily (e.g. "chairs" → "Chair", "30 tables" → "Table")
- If the item isn't in the list, set item_id to null and use the spoken name
- If quantity is ambiguous, default to 1
- Return an empty updates array if no clear inventory update is described`,
        },
        {
          role: 'user',
          content: transcript,
        },
      ],
    })

    const text = completion.choices[0].message.content ?? '{}'
    const parsed = JSON.parse(text) as { updates?: ParsedUpdate[] }
    const updates: ParsedUpdate[] = (parsed.updates ?? []).map(u => ({
      item_id: u.item_id ?? null,
      item_name: u.item_name ?? '',
      direction: u.direction === 'out' ? 'out' : 'in',
      quantity: Math.max(1, Math.round(Number(u.quantity) || 1)),
    }))

    return NextResponse.json({ transcript, updates })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Voice log processing failed:', msg)
    return NextResponse.json({ error: 'Failed to process voice log.', detail: msg }, { status: 502 })
  }
}
