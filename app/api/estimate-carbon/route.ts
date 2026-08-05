import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

const openai = new OpenAI()

type CarbonEstimate = {
  carbon_kg_per_item: number
  summary: string
}

export async function POST(req: NextRequest) {
  const { imageUrl, itemName } = await req.json()

  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('https://') || typeof itemName !== 'string') {
    return NextResponse.json({ error: 'A public image URL and item name are required.' }, { status: 400 })
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageUrl } },
          {
            type: 'text',
            text: `Analyse the image itself, not just the supplied inventory name ("${itemName}").

Identify the main secondhand item shown, its likely material, and its approximate size or weight where visible. Then estimate the kg CO2e avoided for ONE item by reusing it rather than buying an equivalent new item. This is an indicative estimate, not a verified lifecycle assessment.

Return a JSON object with exactly these fields:
- "carbon_kg_per_item": a positive number rounded to one decimal place
- "summary": a concise sentence that names the item you see and explains the estimate

Do not reuse an example value or description. If the image is unclear, say so in "summary" and give a conservative estimate.`
          }
        ]
      }]
    })

    const text = response.choices[0].message.content ?? ''
    const data: unknown = JSON.parse(text)
    const estimate = data as Partial<CarbonEstimate>

    if (
      !data ||
      typeof data !== 'object' ||
      typeof estimate.carbon_kg_per_item !== 'number' ||
      !Number.isFinite(estimate.carbon_kg_per_item) ||
      estimate.carbon_kg_per_item <= 0 ||
      typeof estimate.summary !== 'string' ||
      !estimate.summary.trim()
    ) {
      throw new Error('The estimate response had an invalid format.')
    }

    return NextResponse.json({
      carbon_kg_per_item: Math.round(estimate.carbon_kg_per_item * 10) / 10,
      summary: estimate.summary.trim(),
    })
  } catch (error) {
    console.error('Carbon estimation failed:', error)
    return NextResponse.json({ error: 'Unable to estimate the carbon footprint.' }, { status: 502 })
  }
}
