import { processVoiceNote } from '../../lib/voxidian'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const { voicenote } = await request.json()
    if (!voicenote) {
      throw new Error('No voicenote provided')
    }
    const githubToken = process.env.GITHUB_TOKEN
    const ownerRepo = process.env.GITHUB_REPOSITORY
    if (!githubToken) {
      throw new Error('GITHUB_TOKEN environment variable not set')
    }
    if (!ownerRepo) {
      throw new Error('GITHUB_REPOSITORY environment variable not set')
    }
    const result = await processVoiceNote(voicenote, githubToken, ownerRepo)
    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error processing voice note:', errorMessage)
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
