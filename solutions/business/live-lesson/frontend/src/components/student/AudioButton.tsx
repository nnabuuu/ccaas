import { useState, useRef, useEffect } from 'react'

// Global reference to currently playing audio — ensures only one plays at a time
let globalAudio: HTMLAudioElement | null = null
let globalStop: (() => void) | null = null

interface Props {
  src: string
}

export default function AudioButton({ src }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (audioRef.current) {
        audioRef.current.pause()
        if (globalAudio === audioRef.current) {
          globalAudio = null
          globalStop = null
        }
        audioRef.current = null
      }
    }
  }, [])

  const handleClick = () => {
    if (state === 'playing') {
      audioRef.current?.pause()
      setState('paused')
      return
    }

    if (state === 'paused' && audioRef.current) {
      audioRef.current.play()
      setState('playing')
      return
    }

    // Stop any other playing audio
    if (globalStop) globalStop()

    const audio = new Audio(src)
    audioRef.current = audio
    globalAudio = audio
    globalStop = () => {
      audio.pause()
      audio.currentTime = 0
      setState('idle')
    }

    setState('loading')

    audio.addEventListener('canplaythrough', () => {
      if (audioRef.current === audio) {
        setState('playing')
      }
    }, { once: true })

    audio.addEventListener('ended', () => {
      if (audioRef.current === audio) {
        setState('idle')
        if (globalAudio === audio) {
          globalAudio = null
          globalStop = null
        }
      }
    })

    audio.addEventListener('error', () => {
      if (audioRef.current === audio) {
        setState('idle')
      }
    })

    audio.play().catch(() => setState('idle'))
  }

  const icon = state === 'loading' ? '⏳' : state === 'playing' ? '⏸' : '▶'
  const cls = `stu-audio-btn${state === 'playing' ? ' playing' : ''}`

  return (
    <button className={cls} onClick={handleClick} title={state === 'playing' ? 'Pause' : 'Play audio'}>
      {icon}
    </button>
  )
}
