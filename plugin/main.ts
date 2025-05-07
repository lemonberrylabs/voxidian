import { App, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian'

import { initializeOpenAI, processVoiceNoteForPlugin } from './lib/voxidian'

// Define the structure for your plugin settings
interface VoxidianPluginSettings {
  openAiApiKey: string
}

// Define the default settings
const DEFAULT_SETTINGS: VoxidianPluginSettings = {
  openAiApiKey: '',
}

// Define a type for MediaRecorder errors if not globally available
interface MediaRecorderErrorEvent extends Event {
  readonly error: DOMException
}

// Main plugin class
export default class VoxidianPlugin extends Plugin {
  settings!: VoxidianPluginSettings // Using the ! to tell TypeScript this will be initialized

  // Helper method to handle voice recording flow, including modal and processing
  private handleVoiceRecord = () => {
    if (!this.settings.openAiApiKey) {
      new Notice('OpenAI API key is not set. Please configure it in the Voxidian plugin settings.')
      return
    }
    const modal = new AudioRecordingModal(this.app, async (base64Audio: string) => {
      if (!base64Audio) {
        new Notice('No audio data recorded or provided.')
        return
      }
      try {
        new Notice('Processing voice recording...')
        const base64Content = base64Audio.split(',')[1]
        const result = await processVoiceNoteForPlugin(this.app, base64Content)
        if (result) {
          new Notice('Voice note processed and saved successfully!')
        }
      } catch (error) {
        console.error('Error processing voice note:', error)
        new Notice(`Error processing voice note: ${error instanceof Error ? error.message : String(error)}`)
      }
    })
    modal.open()
  }

  async onload() {
    console.log('Loading Voxidian plugin - initialization started')

    try {
      // 1. Load settings
      await this.loadSettings()
      console.log('Voxidian: settings loaded successfully')

      // 2. Add settings tab
      this.addSettingTab(new VoxidianSettingTab(this.app, this))
      console.log('Voxidian: settings tab added')

      // 3. Initialize ribbon icon with recording functionality
      const ribbonIconEl = this.addRibbonIcon('mic', 'Record Voice Note (Voxidian)', this.handleVoiceRecord)
      ribbonIconEl.addClass('voxidian-ribbon-class')
      console.log('Voxidian: ribbon icon added')

      // 4. Add a basic command
      this.addCommand({
        id: 'voxidian-record',
        name: 'Record Voice Note',
        callback: this.handleVoiceRecord,
      })
      console.log('Voxidian: command added')

      // 5. Delayed OpenAI initialization to avoid startup issues
      setTimeout(() => {
        try {
          console.log('Voxidian: Attempting delayed OpenAI initialization')
          initializeOpenAI(this.settings.openAiApiKey)
        } catch (error) {
          console.error('Voxidian: Failed delayed OpenAI initialization:', error)
        }
      }, 3000)

      console.log('Voxidian plugin loaded successfully')
    } catch (error) {
      console.error('Voxidian: Error during initialization:', error)
      new Notice('Voxidian: Error during initialization. Check developer console for details.')
    }
  }

  onunload() {
    console.log('Unloading Voxidian plugin')
    // Here, you might want to ensure any active media streams are stopped if the plugin is unloaded during recording.
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }
}

// Settings tab class
class VoxidianSettingTab extends PluginSettingTab {
  plugin: VoxidianPlugin

  constructor(app: App, plugin: VoxidianPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this

    containerEl.empty()

    containerEl.createEl('h2', { text: 'Voxidian Plugin Settings' })

    new Setting(containerEl)
      .setName('OpenAI API Key')
      .setDesc('Enter your OpenAI API key (starts with sk-...).')
      .addText((text) =>
        text
          .setPlaceholder('sk-...')
          .setValue(this.plugin.settings.openAiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openAiApiKey = value.trim()
            await this.plugin.saveSettings()
            initializeOpenAI(this.plugin.settings.openAiApiKey)
          })
      )
  }
}

// Modal for direct audio recording
class AudioRecordingModal extends Modal {
  onSubmit: (base64Audio: string) => void
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private mediaStream: MediaStream | null = null
  // Flag to prevent submission when the modal is cancelled
  private cancelled: boolean = false

  private statusDisplayEl: HTMLElement
  private recordButton: HTMLButtonElement
  private pauseButton: HTMLButtonElement
  private resumeButton: HTMLButtonElement
  private stopButton: HTMLButtonElement

  constructor(app: App, onSubmit: (base64Audio: string) => void) {
    super(app)
    this.onSubmit = onSubmit
  }

  async onOpen() {
    // Reset cancellation flag on open
    this.cancelled = false
    const { contentEl } = this
    contentEl.empty()
    contentEl.createEl('h2', { text: 'Record Voice Note' })

    this.statusDisplayEl = contentEl.createEl('p', { text: 'Status: Idle' })

    const controlsEl = contentEl.createDiv({ cls: 'voxidian-controls' })

    this.recordButton = controlsEl.createEl('button', { text: 'Record' })
    this.recordButton.onclick = () => this.startRecording()

    this.pauseButton = controlsEl.createEl('button', { text: 'Pause' })
    this.pauseButton.onclick = () => this.pauseRecording()
    this.pauseButton.disabled = true

    this.resumeButton = controlsEl.createEl('button', { text: 'Resume' })
    this.resumeButton.onclick = () => this.resumeRecording()
    this.resumeButton.disabled = true

    this.stopButton = controlsEl.createEl('button', { text: 'Stop & Save' })
    this.stopButton.onclick = () => this.stopRecording()
    this.stopButton.disabled = true

    const buttons: HTMLButtonElement[] = [this.recordButton, this.pauseButton, this.resumeButton, this.stopButton]
    buttons.forEach((btn: HTMLButtonElement) => {
      btn.style.margin = '5px'
    })

    // start recording immediately when modal opens
    this.startRecording()
  }

  private async startRecording() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.audioChunks = []
      this.mediaRecorder = new MediaRecorder(this.mediaStream)

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.onstop = async () => {
        // Do nothing if modal was cancelled
        if (this.cancelled) return
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64String = reader.result as string
          this.onSubmit(base64String)
        }
        reader.onerror = (error) => {
          console.error('FileReader error:', error)
          new Notice('Error converting audio to base64.')
          this.onSubmit('')
        }
        reader.readAsDataURL(audioBlob)
        this.cleanupMedia()
        this.close()
      }

      this.mediaRecorder.onerror = (event: Event | MediaRecorderErrorEvent) => {
        let message = 'Unknown recording error'
        if ('error' in event && event.error instanceof DOMException) {
          message = event.error.message
        }
        console.error('MediaRecorder error:', event)
        new Notice('Error during recording: ' + message)
        this.cleanupMedia()
        this.updateButtonStates('idle')
      }

      this.mediaRecorder.start()
      this.updateButtonStates('recording')
      this.statusDisplayEl.setText('Status: Recording...')
    } catch (err) {
      console.error('Error accessing microphone:', err)
      new Notice('Error accessing microphone. Please ensure permission is granted.')
      this.cleanupMedia()
      this.updateButtonStates('idle')
    }
  }

  private pauseRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause()
      this.updateButtonStates('paused')
      this.statusDisplayEl.setText('Status: Paused')
    }
  }

  private resumeRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume()
      this.updateButtonStates('recording')
      this.statusDisplayEl.setText('Status: Recording...')
    }
  }

  private stopRecording() {
    if (this.mediaRecorder && (this.mediaRecorder.state === 'recording' || this.mediaRecorder.state === 'paused')) {
      this.mediaRecorder.stop()
      this.updateButtonStates('stopped')
      this.statusDisplayEl.setText('Status: Processing...')
    }
  }

  private updateButtonStates(state: 'idle' | 'recording' | 'paused' | 'stopped') {
    this.recordButton.disabled = state === 'recording' || state === 'paused'
    this.pauseButton.disabled = state !== 'recording'
    this.resumeButton.disabled = state !== 'paused'
    this.stopButton.disabled = state === 'idle' || state === 'stopped'
  }

  private cleanupMedia() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }
    this.mediaRecorder = null
    this.audioChunks = []
  }

  onClose() {
    // Mark as cancelled to prevent submission
    this.cancelled = true
    this.cleanupMedia()
    const { contentEl } = this
    contentEl.empty()
    if (this.statusDisplayEl) this.statusDisplayEl.setText('Status: Idle')
    if (this.recordButton) this.updateButtonStates('idle')
  }
}

// Remove or comment out the old VoiceInputModal if it exists
/*
class VoiceInputModal extends Modal {
  // ... previous implementation ...
}
*/
