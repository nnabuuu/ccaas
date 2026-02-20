<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  videoUrl: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['upload', 'update:playing'])

// Player state
const videoRef = ref<HTMLVideoElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const isMuted = ref(false)
const isFullscreen = ref(false)
const showControls = ref(true)
const controlsTimeout = ref<ReturnType<typeof setTimeout> | null>(null)

// Mini player state
const isMiniPlayer = ref(false)
const miniPlayerPosition = ref({ x: 20, y: 20 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

// Upload state
const uploading = ref(false)
const uploadProgress = ref(0)
const fileInput = ref<HTMLInputElement | null>(null)

// Computed
const formattedCurrentTime = computed(() => formatTime(currentTime.value))
const formattedDuration = computed(() => formatTime(duration.value))
const progressPercent = computed(() => {
  if (duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

// Format time as mm:ss
function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Player controls
const togglePlay = () => {
  if (!videoRef.value) return
  if (isPlaying.value) {
    videoRef.value.pause()
  } else {
    videoRef.value.play()
  }
}

const handlePlay = () => {
  isPlaying.value = true
  emit('update:playing', true)
}

const handlePause = () => {
  isPlaying.value = false
  emit('update:playing', false)
}

const handleTimeUpdate = () => {
  if (videoRef.value) {
    currentTime.value = videoRef.value.currentTime
  }
}

const handleLoadedMetadata = () => {
  if (videoRef.value) {
    duration.value = videoRef.value.duration
  }
}

const handleEnded = () => {
  isPlaying.value = false
  emit('update:playing', false)
}

const seekTo = (e: MouseEvent) => {
  if (!videoRef.value || !duration.value) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  videoRef.value.currentTime = percent * duration.value
}

const toggleMute = () => {
  if (!videoRef.value) return
  videoRef.value.muted = !videoRef.value.muted
  isMuted.value = videoRef.value.muted
}

const setVolume = (e: MouseEvent) => {
  if (!videoRef.value) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  volume.value = Math.max(0, Math.min(1, percent))
  videoRef.value.volume = volume.value
  if (volume.value > 0) {
    isMuted.value = false
    videoRef.value.muted = false
  }
}

const toggleFullscreen = async () => {
  if (!videoRef.value) return
  try {
    if (!document.fullscreenElement) {
      await videoRef.value.requestFullscreen()
      isFullscreen.value = true
    } else {
      await document.exitFullscreen()
      isFullscreen.value = false
    }
  } catch (err) {
    console.error('Fullscreen error:', err)
  }
}

// Mini player
const enableMiniPlayer = () => {
  if (!isPlaying.value || !props.videoUrl) return
  isMiniPlayer.value = true
}

const disableMiniPlayer = () => {
  isMiniPlayer.value = false
}

const expandFromMini = () => {
  isMiniPlayer.value = false
}

// Dragging for mini player
const startDrag = (e: MouseEvent) => {
  isDragging.value = true
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  dragOffset.value = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
}

const handleDrag = (e: MouseEvent) => {
  if (!isDragging.value) return
  const x = window.innerWidth - e.clientX + dragOffset.value.x - 320
  const y = window.innerHeight - e.clientY + dragOffset.value.y - 180
  miniPlayerPosition.value = {
    x: Math.max(20, Math.min(window.innerWidth - 340, x)),
    y: Math.max(20, Math.min(window.innerHeight - 200, y))
  }
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// Upload handling
const triggerUpload = () => {
  fileInput.value?.click()
}

const handleFileSelect = async (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // Validate file type
  if (!file.type.startsWith('video/')) {
    alert('Please select a video file')
    return
  }

  // Validate file size (max 500MB)
  if (file.size > 500 * 1024 * 1024) {
    alert('Video file must be less than 500MB')
    return
  }

  emit('upload', file)
  target.value = '' // Reset input
}

// Show/hide controls on hover
const showControlsTemporarily = () => {
  showControls.value = true
  if (controlsTimeout.value) clearTimeout(controlsTimeout.value)
  if (isPlaying.value) {
    controlsTimeout.value = setTimeout(() => {
      showControls.value = false
    }, 3000)
  }
}

// Expose methods for parent
defineExpose({
  enableMiniPlayer,
  disableMiniPlayer,
  isPlaying
})

onMounted(() => {
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
})

onUnmounted(() => {
  if (controlsTimeout.value) clearTimeout(controlsTimeout.value)
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
})
</script>

<template>
  <!-- Main Player -->
  <div
    v-if="!isMiniPlayer"
    class="video-player"
    @mousemove="showControlsTemporarily"
    @mouseleave="showControls = !isPlaying"
  >
    <!-- Upload Placeholder -->
    <div v-if="!videoUrl" class="upload-placeholder" @click="triggerUpload">
      <div class="upload-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      </div>
      <span class="upload-text">Click to upload video</span>
      <span class="upload-hint">MP4, WebM, MOV up to 500MB</span>
      <input
        ref="fileInput"
        type="file"
        accept="video/*"
        class="file-input"
        @change="handleFileSelect"
      />
    </div>

    <!-- Video Element -->
    <template v-else>
      <video
        ref="videoRef"
        :src="videoUrl"
        class="video-element"
        @play="handlePlay"
        @pause="handlePause"
        @timeupdate="handleTimeUpdate"
        @loadedmetadata="handleLoadedMetadata"
        @ended="handleEnded"
        @click="togglePlay"
      />

      <!-- Controls Overlay -->
      <div :class="['controls-overlay', { visible: showControls }]">
        <!-- Play/Pause Button (center) -->
        <button class="center-play" @click="togglePlay">
          <svg v-if="!isPlaying" width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <svg v-else width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/>
            <rect x="14" y="4" width="4" height="16"/>
          </svg>
        </button>

        <!-- Bottom Controls -->
        <div class="bottom-controls">
          <!-- Progress Bar -->
          <div class="progress-bar" @click="seekTo">
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"/>
            </div>
          </div>

          <div class="controls-row">
            <!-- Left Controls -->
            <div class="controls-left">
              <button class="control-btn" @click="togglePlay">
                <svg v-if="!isPlaying" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16"/>
                  <rect x="14" y="4" width="4" height="16"/>
                </svg>
              </button>

              <!-- Volume -->
              <div class="volume-control">
                <button class="control-btn" @click="toggleMute">
                  <svg v-if="isMuted || volume === 0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <line x1="23" y1="9" x2="17" y2="15"/>
                    <line x1="17" y1="9" x2="23" y2="15"/>
                  </svg>
                  <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  </svg>
                </button>
                <div class="volume-slider" @click="setVolume">
                  <div class="volume-track">
                    <div class="volume-fill" :style="{ width: (isMuted ? 0 : volume * 100) + '%' }"/>
                  </div>
                </div>
              </div>

              <span class="time-display">{{ formattedCurrentTime }} / {{ formattedDuration }}</span>
            </div>

            <!-- Right Controls -->
            <div class="controls-right">
              <button class="control-btn" @click="toggleFullscreen">
                <svg v-if="!isFullscreen" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>

  <!-- Mini Player -->
  <Teleport to="body">
    <div
      v-if="isMiniPlayer && videoUrl"
      class="mini-player"
      :style="{ right: miniPlayerPosition.x + 'px', bottom: miniPlayerPosition.y + 'px' }"
    >
      <div class="mini-header" @mousedown="startDrag">
        <span class="mini-title">{{ title || 'Video' }}</span>
        <div class="mini-actions">
          <button class="mini-btn" @click="expandFromMini" title="Expand">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          </button>
          <button class="mini-btn" @click="disableMiniPlayer" title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <video
        :src="videoUrl"
        class="mini-video"
        autoplay
        @click="togglePlay"
      />
      <div class="mini-controls">
        <button class="mini-play-btn" @click="togglePlay">
          <svg v-if="!isPlaying" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/>
            <rect x="14" y="4" width="4" height="16"/>
          </svg>
        </button>
        <div class="mini-progress">
          <div class="mini-progress-fill" :style="{ width: progressPercent + '%' }"/>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.video-player {
  position: relative;
  width: 100%;
  aspect-ratio: 16/9;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.upload-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #1f2937;
  cursor: pointer;
  transition: background 0.2s;
}

.upload-placeholder:hover {
  background: #374151;
}

.upload-icon {
  color: #9ca3af;
}

.upload-text {
  color: #e5e7eb;
  font-size: 16px;
  font-weight: 500;
}

.upload-hint {
  color: #6b7280;
  font-size: 13px;
}

.file-input {
  display: none;
}

.video-element {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.controls-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(transparent 60%, rgba(0,0,0,0.7));
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.controls-overlay.visible {
  opacity: 1;
}

.center-play {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.5);
  border: none;
  border-radius: 50%;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  cursor: pointer;
  transition: transform 0.15s, background 0.15s;
}

.center-play:hover {
  transform: translate(-50%, -50%) scale(1.1);
  background: rgba(0,0,0,0.7);
}

.bottom-controls {
  padding: 0 12px 12px;
}

.progress-bar {
  padding: 8px 0;
  cursor: pointer;
}

.progress-track {
  height: 4px;
  background: rgba(255,255,255,0.3);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  transition: width 0.1s linear;
}

.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.controls-left,
.controls-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.15s;
}

.control-btn:hover {
  background: rgba(255,255,255,0.2);
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.volume-slider {
  width: 60px;
  padding: 4px 0;
  cursor: pointer;
}

.volume-track {
  height: 4px;
  background: rgba(255,255,255,0.3);
  border-radius: 2px;
  overflow: hidden;
}

.volume-fill {
  height: 100%;
  background: white;
}

.time-display {
  color: white;
  font-size: 12px;
  font-family: monospace;
}

/* Mini Player */
.mini-player {
  position: fixed;
  width: 320px;
  background: #1f2937;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0,0,0,0.4);
  z-index: 9999;
}

.mini-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #111827;
  cursor: move;
}

.mini-title {
  color: #e5e7eb;
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.mini-actions {
  display: flex;
  gap: 4px;
}

.mini-btn {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.mini-btn:hover {
  color: white;
  background: rgba(255,255,255,0.1);
}

.mini-video {
  width: 100%;
  aspect-ratio: 16/9;
  object-fit: contain;
  background: #000;
}

.mini-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #111827;
}

.mini-play-btn {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 4px;
}

.mini-progress {
  flex: 1;
  height: 4px;
  background: rgba(255,255,255,0.2);
  border-radius: 2px;
  overflow: hidden;
}

.mini-progress-fill {
  height: 100%;
  background: #3b82f6;
}
</style>
