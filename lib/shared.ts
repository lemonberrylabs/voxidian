import { zodTextFormat } from 'openai/helpers/zod'
import { z, ZodType } from 'zod'

export const instructions = (existingFiles: string[]) => {
  const today = new Date().toISOString().slice(0, 10)
  return `Analyze this voice note transcript to:
- Identify if there are any instructions at the beginning of the note (like "append to daily note" or "append to [page name including .md extension if provided]")
- Clean up the transcript by removing filler words like "um", "uh", "like", etc.
- Identify entities mentioned that should be wiki-linked using [[entity name]]. Entities may contain spaces.
- Generate a descriptive title for the note IF it's intended as a new note (instruction type 'new_note'). Titles may contain spaces. If appending, the title can be empty or reflect the instruction.
- Ensure the output strictly adheres to the VoiceNoteAnalysis schema.
- If the instruction is 'append_daily', use today's date (${today}) implicitly; do not include it in target_page.
- If the instruction is 'append_to_page', the target_page must be the full path to the file (e.g., 'folder/My Existing Note.md') or just the filename if at the root level.
- For context, here is the list of existing markdown files (with their full paths) that could be linked to or appended to: ${existingFiles.join(', ')}
`
}

export function getUniqueNoteName(existing: string[], baseTitle: string): string {
  // Ensure baseTitle has .md extension
  let fileName = baseTitle.endsWith('.md') ? baseTitle : `${baseTitle}.md`
  let counter = 1

  // Extract just the base title without extension for incrementing
  const base = baseTitle.replace(/ \d+\.md$/, '').replace(/\.md$/, '')

  // Helper function to extract just the filename from a full path if needed
  const getFilename = (path: string): string => {
    const lastSlashIndex = path.lastIndexOf('/')
    return lastSlashIndex >= 0 ? path.substring(lastSlashIndex + 1) : path
  }

  // Check if the filename already exists, considering full paths
  while (existing.some((path) => getFilename(path) === fileName)) {
    fileName = `${base} ${counter}.md`
    counter++
  }

  return fileName
}

// Define Zod schemas
const VoiceNoteInstructionSchema = z.object({
  type: z.enum(['new_note', 'append_daily', 'append_to_page']),
  target_page: z.string().optional(),
})

export const VoiceNoteAnalysisSchema = z.object({
  instruction: VoiceNoteInstructionSchema,
  title: z.string(),
  content: z.string(),
})

// Infer types from Zod schemas
export type VoiceNoteAnalysis = z.infer<typeof VoiceNoteAnalysisSchema>

// Interface for the part of OpenAI client we use
// It's generic to handle the schema and name for zodTextFormat appropriately
interface TranscriptAnalyzerClient<T extends ZodType<VoiceNoteAnalysis>> {
  responses: {
    parse: (args: {
      model: string
      instructions: string
      input: string
      text: {
        // The type for `format` parameter in `openai.responses.parse` when using `zodTextFormat`
        // is effectively `(schema: T, name: string) => specific_internal_type`.
        // However, `zodTextFormat` itself creates this object.
        // The `parse` method expects the *result* of `zodTextFormat`.
        // The `OpenAITextResponseFormat` type is `string | { type: "json_object"; schema: TJSONObject; } | { type: "custom"; ... }`
        // `zodTextFormat` returns an object that fits the "custom" part of this union.
        // For simplicity and because `zodTextFormat` is part of the same library,
        // we can expect the caller to prepare this part. Or, if we want to be very strict,
        // we would need to replicate the complex type that zodTextFormat returns.
        // Let's assume the `format` object is pre-constructed.
        format: ReturnType<typeof zodTextFormat<T>>
      }
    }) => Promise<{ output_parsed: VoiceNoteAnalysis | null | undefined }>
  }
}

// New shared function for transcript analysis, now using the interface
export async function performTranscriptAnalysis(
  client: TranscriptAnalyzerClient<typeof VoiceNoteAnalysisSchema>, // Use the interface
  transcript: string,
  existingFiles: string[]
): Promise<VoiceNoteAnalysis> {
  try {
    const response = await client.responses.parse({
      model: 'gpt-4o-mini',
      instructions: instructions(existingFiles),
      input: transcript,
      text: {
        // The format object is now expected to be compatible with what client.responses.parse expects
        // when zodTextFormat is used. The client instance itself will provide this.
        format: zodTextFormat(VoiceNoteAnalysisSchema, 'VoiceNoteAnalysis'),
      },
    })

    if (!response.output_parsed) {
      // It's good to log the raw response if parsing fails, but avoid logging potentially large/sensitive raw response in shared code.
      // Caller can decide to log more detailed info if needed.
      console.error('OpenAI response parsing returned null or undefined.')
      throw new Error('Failed to parse OpenAI response into the expected format.')
    }
    return response.output_parsed
  } catch (error) {
    console.error('Error during transcript analysis with OpenAI:', error)
    // Re-throw a more specific error, helping to identify where it originated.
    throw new Error(
      'Transcript analysis using OpenAI failed: ' + (error instanceof Error ? error.message : String(error))
    )
  }
}
