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

  // Deterministic fallback: normalize plural/singular + lowercase so "houses" → "house" = "House"
  function normalizeLabel(s: string): string {
    const t = s.toLowerCase().trim()
    if (t.endsWith('ies')) return t.slice(0, -3) + 'y' // batteries → battery
    if (t.endsWith('ves')) return t.slice(0, -3) + 'f' // shelves → shelf
    if (t.endsWith('ses')) return t.slice(0, -2)        // buses → bus
    if (t.endsWith('s'))  return t.slice(0, -1)         // chairs → chair, houses → house
    return t
  }

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
- Treat Available items as opaque inventory labels, not their ordinary English meaning. Match spoken words to labels using plural/singular, capitalisation and minor spelling differences ("houses" matches "House"). NEVER omit a mentioned item — if no label matches, ALWAYS return a row with item_id: null and item_name set to the spoken name so the user can act on it.
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

    // Fallback: if GPT returned item_id: null, try deterministic normalize match
    for (const u of updates) {
      if (u.item_id !== null) continue
      const spokenNorm = normalizeLabel(u.item_name)
      const match = items.find(i => normalizeLabel(i.name) === spokenNorm)
      if (match) {
        u.item_id = match.id
        u.item_name = match.name
      }
    }

    return NextResponse.json({ transcript, updates })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Voice log processing failed:', msg)
    return NextResponse.json({ error: 'Failed to process voice log.', detail: msg }, { status: 502 })
  }
}
