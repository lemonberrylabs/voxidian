'use client'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatTime } from '@/lib/format-time'
import { Mic, Pause, Send, Play, X, Trash2 } from 'lucide-react'

import { useState, useRef, useEffect, useCallback } from 'react'

type RecordingState = 'not-recording' | 'recording' | 'paused' | 'sending' | 'failed'

export default function VoxidianApp() {
  const [recordingState, setRecordingState] = useState<RecordingState>('not-recording')
  const [progress, setProgress] = useState(0)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const cleanupResources = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [audioUrl])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupResources()
    }
  }, [cleanupResources])

  // Handle audio playback
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onplay = () => setIsPlaying(true)
      audioRef.current.onpause = () => setIsPlaying(false)
      audioRef.current.onended = () => setIsPlaying(false)
    }
  }, [audioUrl])

  const startRecording = async () => {
    try {
      setError(null)

      // Clean up previous resources
      cleanupResources()
      audioChunksRef.current = []

      // Get a new stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      // Start the timer
      setRecordingTime(0)
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)

      mediaRecorder.start(100) // Collect data every 100ms for smoother playback
      setRecordingState('recording')
    } catch (error) {
      console.error('Error starting recording:', error)
      setError('Could not access your microphone. Please check permissions and try again.')
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.pause()

        // Pause the timer
        if (timerRef.current) {
          clearInterval(timerRef.current)
        }

        // Create a copy of the current chunks for playback
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })

          // Clean up previous URL if it exists
          if (audioUrl) {
            URL.revokeObjectURL(audioUrl)
          }

          const url = URL.createObjectURL(audioBlob)
          setAudioUrl(url)

          // Ensure the audio element is updated with the new source
          if (audioRef.current) {
            audioRef.current.src = url
            audioRef.current.load()
          }
        }

        setRecordingState('paused')
      } catch (error) {
        console.error('Error pausing recording:', error)
        setError('Failed to pause recording. Please try again.')
      }
    }
  }

  const resumeRecording = () => {
    if (!mediaRecorderRef.current) {
      setError('Recording session expired. Please start a new recording.')
      setRecordingState('not-recording')
      return
    }

    try {
      if (mediaRecorderRef.current.state === 'paused') {
        mediaRecorderRef.current.resume()

        // Resume the timer
        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1)
        }, 1000)

        setRecordingState('recording')
      } else {
        setError('Cannot resume recording. Please start a new recording.')
        setRecordingState('not-recording')
      }
    } catch (error) {
      console.error('Error resuming recording:', error)
      setError('Failed to resume recording. Please start a new recording.')
      setRecordingState('not-recording')
    }
  }

  const sendRecording = async () => {
    if (audioChunksRef.current.length === 0) {
      setError('No audio recorded. Please try again.')
      return
    }

    setRecordingState('sending')
    setError(null)
    setProgress(0)

    try {
      // If we're still recording, pause it first
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.pause()
        if (timerRef.current) {
          clearInterval(timerRef.current)
        }
      }

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const reader = new FileReader()

      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1]

        // Use XMLHttpRequest for progress tracking
        const xhr = new XMLHttpRequest()

        // Track upload progress
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100)
            setProgress(percentComplete)
          }
        }

        // Handle completion
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setProgress(100)

            // Reset after a short delay
            setTimeout(() => {
              setRecordingState('not-recording')
              setProgress(0)
              setRecordingTime(0)
              cleanupResources()
              audioChunksRef.current = []
            }, 1000)
          } else {
            console.error('Error sending voice note:', xhr.statusText)
            setError(`Failed to send voice note: ${xhr.statusText}`)
            setRecordingState('failed')
            setProgress(0)
          }
        }

        // Handle errors
        xhr.onerror = () => {
          console.error('Network error occurred')
          setError('Network error occurred. Please check your connection and try again.')
          setRecordingState('failed')
          setProgress(0)
        }

        // Open and send the request
        xhr.open('POST', `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/send`, true)
        xhr.setRequestHeader('Content-Type', 'application/json')
        xhr.send(JSON.stringify({ voicenote: base64Audio }))
      }

      reader.readAsDataURL(audioBlob)
    } catch (error) {
      console.error('Error processing audio:', error)
      setError('Failed to process audio. Please try again.')
      setRecordingState('failed')
    }
  }

  const handleRecordButtonClick = () => {
    if (recordingState === 'not-recording') {
      startRecording()
    } else if (recordingState === 'paused') {
      resumeRecording()
    }
  }

  const handlePlayback = () => {
    if (audioRef.current && audioUrl) {
      try {
        if (isPlaying) {
          audioRef.current.pause()
        } else {
          // Make sure the audio element has the correct source
          if (audioRef.current.src !== audioUrl) {
            audioRef.current.src = audioUrl
            audioRef.current.load()
          }

          audioRef.current.play().catch((err) => {
            console.error('Error playing audio:', err)
            setError('Failed to play audio. Please try again.')
          })
        }
      } catch (error) {
        console.error('Error handling playback:', error)
        setError('Failed to play audio. Please try again.')
      }
    } else {
      setError('No audio available to play.')
    }
  }

  const cancelRecording = () => {
    setError(null)
    setRecordingState('not-recording')
    setRecordingTime(0)
    cleanupResources()
    audioChunksRef.current = []
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Voxidian</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm flex items-start">
            <span className="flex-1">{error}</span>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-red-600" onClick={() => setError(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="flex flex-col items-center space-y-6">
          {recordingState === 'sending' ? (
            <div className="w-full space-y-2">
              <p className="text-center text-gray-600 mb-2">Transcribing your voice note...</p>
              <Progress value={progress} className="w-full h-2" />
              <p className="text-center text-sm text-gray-500">{progress}% complete</p>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-6 w-full">
              {/* Recording timer */}
              {(recordingState === 'recording' || recordingState === 'paused') && (
                <div className="text-2xl font-mono font-semibold text-gray-700">{formatTime(recordingTime)}</div>
              )}

              {/* Main action buttons */}
              <div className="flex items-center justify-center space-x-4">
                {recordingState === 'recording' ? (
                  <Button
                    onClick={pauseRecording}
                    size="lg"
                    className="rounded-full w-16 h-16 flex items-center justify-center bg-red-500 hover:bg-red-600"
                    aria-label="Pause recording"
                  >
                    <Pause className="h-8 w-8" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleRecordButtonClick}
                    size="lg"
                    className="rounded-full w-16 h-16 flex items-center justify-center bg-primary hover:bg-primary/90"
                    aria-label={recordingState === 'paused' ? 'Resume recording' : 'Start recording'}
                  >
                    <Mic className="h-8 w-8" />
                  </Button>
                )}

                {audioUrl && (recordingState === 'paused' || recordingState === 'failed') && (
                  <Button
                    onClick={handlePlayback}
                    variant="outline"
                    size="icon"
                    className="rounded-full w-12 h-12"
                    aria-label={isPlaying ? 'Pause playback' : 'Play recording'}
                  >
                    {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                  </Button>
                )}

                {(recordingState === 'paused' || recordingState === 'failed') && (
                  <Button
                    onClick={cancelRecording}
                    variant="outline"
                    size="icon"
                    className="rounded-full w-12 h-12 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete recording"
                  >
                    <Trash2 className="h-6 w-6" />
                  </Button>
                )}
              </div>

              {/* Audio element for playback */}
              {audioUrl && <audio ref={audioRef} src={audioUrl} className="hidden" />}

              {/* Send button */}
              {(recordingState === 'recording' || recordingState === 'paused' || recordingState === 'failed') && (
                <Button onClick={sendRecording} className="rounded-full px-6">
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
              )}

              {/* Recording status indicator */}
              {recordingState === 'recording' && (
                <div className="flex items-center space-x-1">
                  <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
                  <p className="text-sm text-gray-500">Recording...</p>
                </div>
              )}

              {recordingState === 'paused' && <p className="text-sm text-gray-500">Recording paused</p>}
              {recordingState === 'failed' && (
                <p className="text-sm text-gray-500">Sending failed - you can try again</p>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-gray-500 text-xs mt-8">
          Record your voice notes and save them directly to Obsidian
        </p>
      </div>
    </main>
  )
}
