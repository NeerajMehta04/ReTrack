import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

const openai = new OpenAI()

export async function POST(req: NextRequest) {
  const { imageUrl, itemName } = await req.json()

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageUrl } },
        {
          type: 'text',
          text: `This is a secondhand item called "${itemName}" being upcycled by students.

Estimate the CO₂ saved per single item by upcycling instead of buying new.

Reply with ONLY this JSON, no other text:
{
  "carbon_kg_per_item": 24.5,
  "summary": "Wooden chair, ~6kg. Saves ~24kg CO₂ per item vs buying new."
}`
        }
      ]
    }]
  })

  const text = response.choices[0].message.content ?? ''
  const clean = text.replace(/```json|```/g, '').trim()
  const data = JSON.parse(clean)

  return NextResponse.json({
    carbon_kg_per_item: data.carbon_kg_per_item,
    summary: data.summary
  })
}
