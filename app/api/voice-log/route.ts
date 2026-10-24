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
          content: `You are a stock-movement logger for a community organisation. Your only job is to record physical items coming in or going out of the inventory — you never manage the item catalogue itself.

Available items:
${itemList}

Return a JSON object:
{
  "updates": [
    { "item_id": "<id from list or null>", "item_name": "<spoken or matched name>", "direction": "in" | "out", "quantity": <positive integer> }
  ]
}

Guidelines:
- Return one update per item mentioned — if the speaker names several distinct items, split them into separate update objects.
- "in" covers: received, added, donated, found, bought, got, "want to add", "add to the list" — anything that increases stock.
- "out" covers: given away, removed, dispatched, used, distributed, lent out.
- Match item names fuzzily to the available list (e.g. "footballs" → "Football", "chairs" → "Chair"). If no match, set item_id to null and copy the spoken name as-is.
- Default quantity to 1 when not stated.
- Return an empty updates array only if no physical item or quantity is mentioned at all.`,
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
