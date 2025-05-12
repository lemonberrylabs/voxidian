// Add an empty export to make it a module and avoid potential issues.
import { App, TFile, Notice, normalizePath } from 'obsidian'

import 'openai/shims/web'

import { OpenAI } from 'openai'

// import { zodTextFormat } from 'openai/helpers/zod' // Removed unused import

import { getUniqueNoteName, VoiceNoteAnalysis, performTranscriptAnalysis } from '../../lib/shared'

// Removed unused instructions and VoiceNoteAnalysisSchema

// Added performTranscriptAnalysis

// OpenAI API key for authentication
let apiKey: string = ''
let openaiClient: OpenAI | undefined

// Function to initialize or update the OpenAI API key
export function initializeOpenAI(key: string) {
  if (!key) {
    console.error('Voxidian: OpenAI API key is not provided for initialization.')
    return
  }

  if (!key.startsWith('sk-')) {
    console.error('Voxidian: Invalid OpenAI API key format. Must start with "sk-"')
    return
  }

  apiKey = key
  openaiClient = new OpenAI({ apiKey, dangerouslyAllowBrowser: true })
  console.log('Voxidian: OpenAI API key initialized.')
}

// Helper: create a new note with a unique filename (DRY)
async function createNewNote(app: App, title: string, content: string): Promise<TFile> {
  const trimmedTitle = title.trim() || 'Untitled Voice Note'

  // Get existing files with their full paths
  const existingFiles = app.vault.getMarkdownFiles().map((file) => file.path)

  // Generate a unique filename
  const finalName = getUniqueNoteName(existingFiles, trimmedTitle)

  // Normalize the path to ensure proper file creation
  const path = normalizePath(finalName)

  const file = await app.vault.create(path, content)
  new Notice(`Created note: ${file.basename}`)
  return file
}

// Main entry point - process voice note
export async function processVoiceNoteForPlugin(app: App, voicenoteBase64: string): Promise<TFile | void> {
  if (!apiKey) {
    new Notice('OpenAI API Key not configured in Voxidian settings. Please set it first.')
    console.error('Voxidian: OpenAI API key not initialized for processVoiceNoteForPlugin.')
    return
  }

  try {
    // Create an audio blob from base64
    const blob = base64ToBlob(voicenoteBase64, 'audio/webm')

    // Transcribe the audio using OpenAI's API directly
    new Notice('Transcribing audio...')
    const transcript = await transcribeAudio(blob)

    if (!transcript || transcript.trim() === '') {
      new Notice('Transcription failed or resulted in empty text.')
      return
    }

    // Get existing file paths for context
    const existingFiles = app.vault.getMarkdownFiles().map((file) => file.path)

    // Analyze the transcript using OpenAI
    new Notice('Analyzing transcript...')
    const analysis = await analyzeTranscript(transcript, existingFiles)

    let targetFile: TFile
    // Delegate action based on instruction type
    if (analysis.instruction.type === 'append_daily') {
      new Notice('Processing as daily note...')
      targetFile = await appendToDailyNote(app, analysis.content)
    } else if (analysis.instruction.type === 'append_to_page') {
      const page = analysis.instruction.target_page?.trim() || analysis.title
      new Notice(`Appending to page: ${page}`)
      targetFile = await appendToPage(app, page, analysis.content)
    } else {
      targetFile = await createNewNote(app, analysis.title, analysis.content)
    }

    return targetFile
  } catch (error) {
    console.error('Error processing voice note:', error)
    new Notice(`Error: ${error instanceof Error ? error.message : String(error)}`)
    return
  }
}

// Helper: Convert base64 to Blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  // Handle possible data URL prefix
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64

  const byteCharacters = atob(base64Data)
  const byteArrays = []

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512)
    const byteNumbers = new Array(slice.length)

    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i)
    }

    const byteArray = new Uint8Array(byteNumbers)
    byteArrays.push(byteArray)
  }

  return new Blob(byteArrays, { type: mimeType })
}

// Transcribe audio using fetch directly
async function transcribeAudio(audioBlob: Blob): Promise<string> {
  try {
    const formData = new FormData()
    formData.append('file', audioBlob, 'recording.webm')
    formData.append('model', 'gpt-4o-transcribe')
    formData.append('language', 'en')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`)
    }

    const data = await response.json()
    return data.text || ''
  } catch (error) {
    console.error('Transcription error:', error)
    throw new Error(`Transcription failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// Analyze transcript using OpenAI SDK Responses API (gpt-4o-mini) (DRY)
async function analyzeTranscript(transcript: string, existingFiles: string[]): Promise<VoiceNoteAnalysis> {
  if (!openaiClient) {
    throw new Error('OpenAI client not initialized')
  }
  // Call the shared analysis function
  return performTranscriptAnalysis(openaiClient, transcript, existingFiles)
}

// Helper: Append to daily note
async function appendToDailyNote(app: App, content: string): Promise<TFile> {
  const today = new Date().toISOString().slice(0, 10)
  const dailyNotePath = normalizePath(`${today}.md`)

  const file = app.vault.getAbstractFileByPath(dailyNotePath)

  if (file instanceof TFile) {
    const oldContent = await app.vault.read(file)
    const newContent = `${oldContent}\n\n---\n\n${content}`
    await app.vault.modify(file, newContent)
    new Notice(`Appended to daily note: ${file.basename}`)
    return file
  } else {
    // Create new daily note
    const newFile = await app.vault.create(dailyNotePath, content)
    new Notice(`Daily note created: ${newFile.basename}`)
    return newFile
  }
}

// Helper: Append to specific page
async function appendToPage(app: App, pageName: string, content: string): Promise<TFile> {
  // Ensure .md extension
  let path = pageName.toLowerCase().endsWith('.md') ? pageName : `${pageName}.md`

  path = normalizePath(path)

  // Try to find the file
  let file = app.vault.getAbstractFileByPath(path)

  // If not found by exact path, try case-insensitive basename search
  if (!(file instanceof TFile)) {
    const basename = pageName.toLowerCase().replace(/\.md$/i, '')
    const possibleFile = app.vault.getMarkdownFiles().find((f) => f.basename.toLowerCase() === basename)

    if (possibleFile) {
      file = possibleFile
      path = possibleFile.path
    }
  }

  if (file instanceof TFile) {
    const oldContent = await app.vault.read(file)
    const newContent = `${oldContent}\n\n${content}`
    await app.vault.modify(file, newContent)
    new Notice(`Appended to: ${file.basename}`)
    return file
  } else {
    // Create new file
    const newFile = await app.vault.create(path, content)
    new Notice(`Note created: ${newFile.basename}`)
    return newFile
  }
}
