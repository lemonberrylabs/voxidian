// TypeScript implementation of voice note processing based on Python ak/voxidian.py
import { performTranscriptAnalysis, getUniqueNoteName } from '@/lib/shared'
import type { VoiceNoteAnalysis } from '@/lib/shared'
import fs from 'fs'
import fsPromises from 'fs/promises'
import { OpenAI } from 'openai'
import os from 'os'
import path from 'path'

// Interface for GitHub API response when creating/updating a file
interface GitHubFileUpdateResponse {
  content: {
    name: string
    path: string
    sha: string
    size: number
    url: string
    html_url: string
    git_url: string
    download_url: string
    type: string
    _links: {
      self: string
      git: string
      html: string
    }
  }
  commit: {
    sha: string
    node_id: string
    url: string
    html_url: string
    author: {
      name: string
      email: string
      date: string
    }
    committer: {
      name: string
      email: string
      date: string
    }
    tree: {
      sha: string
      url: string
    }
    message: string
    parents: Array<{
      sha: string
      url: string
      html_url: string
    }>
    verification: {
      verified: boolean
      reason: string
      signature: string | null
      payload: string | null
    }
  }
}

// Interface for GitHub API request body when creating/updating a file
interface GitHubFileUpdateRequest {
  message: string
  content: string
  sha?: string
}

const openai = new OpenAI()

// Decode base64 audio string, save to temporary file, and return its path
async function decodeBase64Audio(voicenote: string): Promise<string> {
  const tempDir = os.tmpdir()
  const fileName = `voicenote_${process.pid}_${Date.now()}.webm`
  const filePath = path.join(tempDir, fileName)
  const buffer = Buffer.from(voicenote, 'base64')
  await fsPromises.writeFile(filePath, buffer)
  return filePath
}

// Transcribe the audio file using OpenAI API
async function transcribeAudio(filePath: string): Promise<string> {
  const fileStream = fs.createReadStream(filePath)
  const response = await openai.audio.transcriptions.create({
    model: 'gpt-4o-transcribe',
    file: fileStream,
    language: 'en',
  })
  return response.text
}

// List markdown files in the GitHub repository
async function getExistingFiles(ownerRepo: string, githubToken: string): Promise<string[]> {
  const url = `https://api.github.com/repos/${ownerRepo}/contents`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub API error listing files: ${res.status} ${res.statusText}: ${text}`)
  }
  const data = (await res.json()) as Array<{ name: string }>
  return data.filter((item) => item.name.endsWith('.md')).map((item) => item.name)
}

// Fetch a file's content and SHA from GitHub
async function getFileContent(
  ownerRepo: string,
  filePath: string,
  githubToken: string
): Promise<{ content: string; sha: string }> {
  const url = `https://api.github.com/repos/${ownerRepo}/contents/${filePath}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub API error fetching file ${filePath}: ${res.status} ${res.statusText}: ${text}`)
  }
  const data = await res.json()
  const decoded = Buffer.from(data.content, 'base64').toString('utf-8')
  return { content: decoded, sha: data.sha }
}

// Create or update a file in GitHub repository
async function createOrUpdateFile(
  ownerRepo: string,
  filePath: string,
  content: string,
  commitMessage: string,
  githubToken: string,
  sha?: string
): Promise<GitHubFileUpdateResponse> {
  const url = `https://api.github.com/repos/${ownerRepo}/contents/${filePath}`
  const body: GitHubFileUpdateRequest = {
    message: commitMessage,
    content: Buffer.from(content, 'utf-8').toString('base64'),
  }
  if (sha) {
    body.sha = sha
  }
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub API error creating/updating file ${filePath}: ${res.status} ${res.statusText}: ${text}`)
  }
  return (await res.json()) as GitHubFileUpdateResponse
}

// Append content to today's daily note
async function appendToDailyNote(
  ownerRepo: string,
  content: string,
  githubToken: string,
  existingFiles: string[]
): Promise<GitHubFileUpdateResponse> {
  const today = new Date().toISOString().slice(0, 10)
  const fileName = `${today}.md`
  if (existingFiles.includes(fileName)) {
    const { content: oldContent, sha } = await getFileContent(ownerRepo, fileName, githubToken)
    // Prepend horizontal rule as requested in prompt
    const newContent = `${oldContent}\n\n---\n\n${content}`
    return await createOrUpdateFile(
      ownerRepo,
      fileName,
      newContent,
      'Append voice note to daily note',
      githubToken,
      sha
    )
  } else {
    // Prepend horizontal rule even for new daily note
    return await createOrUpdateFile(
      ownerRepo,
      fileName,
      `---\n\n${content}`, // Add HR here too
      'Create daily note with voice note',
      githubToken
    )
  }
}

// Append content to a specific page
async function appendToPage(
  ownerRepo: string,
  targetPage: string,
  content: string,
  githubToken: string,
  existingFiles: string[]
): Promise<GitHubFileUpdateResponse> {
  // Ensure filename ends with .md *before* checking existence
  const fileName = targetPage.endsWith('.md') ? targetPage : `${targetPage}.md`

  if (existingFiles.includes(fileName)) {
    // File exists, append to it
    const { content: oldContent, sha } = await getFileContent(ownerRepo, fileName, githubToken)
    const newContent = `${oldContent}\n\n${content}`
    return await createOrUpdateFile(
      ownerRepo,
      fileName,
      newContent,
      `Append voice note to ${fileName}`,
      githubToken,
      sha
    )
  } else {
    // File does not exist, create it
    return await createOrUpdateFile(
      ownerRepo,
      fileName,
      content,
      `Create ${fileName} from voice note append instruction`,
      githubToken
    )
  }
}

// Analyze transcript using OpenAI responses.parse with Zod schema
async function analyzeTranscript(transcript: string, existingFiles: string[]): Promise<VoiceNoteAnalysis> {
  // Call the shared analysis function
  return performTranscriptAnalysis(openai, transcript, existingFiles)
}

// Main entry: process a voice note end-to-end
export async function processVoiceNote(
  voicenote: string,
  githubToken: string,
  ownerRepo: string
): Promise<GitHubFileUpdateResponse> {
  const tempPath = await decodeBase64Audio(voicenote)
  try {
    const transcript = await transcribeAudio(tempPath)
    const existing = await getExistingFiles(ownerRepo, githubToken)
    const analysis = await analyzeTranscript(transcript, existing)

    // Handle horizontal rule for daily note appending within appendToDailyNote
    if (analysis.instruction.type === 'append_daily') {
      return await appendToDailyNote(ownerRepo, analysis.content, githubToken, existing)
    } else if (analysis.instruction.type === 'append_to_page') {
      const page = analysis.instruction.target_page
      if (!page) {
        // Attempt to recover if target_page is missing but title might be it
        if (analysis.title && analysis.title.endsWith('.md')) {
          console.warn('target_page missing for append_to_page, using title as fallback:', analysis.title)
          return await appendToPage(ownerRepo, analysis.title, analysis.content, githubToken, existing)
        }
        throw new Error('target_page not provided for append_to_page instruction')
      }
      // Pass page directly, appendToPage handles adding .md if needed
      return await appendToPage(ownerRepo, page, analysis.content, githubToken, existing)
    } else {
      // 'new_note'
      const title = analysis.title.trim() || 'Untitled Note' // Use a default title if empty
      const fileName = getUniqueNoteName(existing, title)
      return await createOrUpdateFile(
        ownerRepo,
        fileName,
        analysis.content,
        `Create ${fileName} from voice recording`,
        githubToken
      )
    }
  } finally {
    try {
      await fsPromises.unlink(tempPath)
    } catch {
      // Ignore errors during cleanup
    }
  }
}
