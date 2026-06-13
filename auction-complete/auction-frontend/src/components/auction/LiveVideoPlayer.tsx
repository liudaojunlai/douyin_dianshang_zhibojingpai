import { useRef, useState, useEffect } from 'react'

// 本地视频（Nginx 直连，无跨域/网络问题）
const DEFAULT_VIDEO = '/videos/live_bg.mp4'

// 备选视频（外网可用源，当本地视频加载失败时尝试）
const FALLBACK_VIDEOS = [
  'https://media.w3.org/2010/05/sintel/trailer.mp4',
]

interface LiveVideoPlayerProps {
  videoUrl?: string
}

export default function LiveVideoPlayer({
  videoUrl,
}: LiveVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoReady, setVideoReady] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(videoUrl || DEFAULT_VIDEO)
  const retryCount = useRef(0)

  // 当主视频加载失败时切备用
  const handleError = () => {
    if (retryCount.current < FALLBACK_VIDEOS.length) {
      setCurrentSrc(FALLBACK_VIDEOS[retryCount.current])
      retryCount.current++
    } else {
      setVideoError(true)
    }
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const play = async () => {
      try {
        await video.play()
        setVideoReady(true)
      } catch {
        // 浏览器可能阻止自动播放（需要用户交互）
        // 静音后浏览器通常允许自动播放
        video.muted = true
        try {
          await video.play()
          setVideoReady(true)
        } catch {
          setVideoError(true)
        }
      }
    }

    // 等待视频元数据加载完成
    const handleLoaded = () => {
      play()
    }

    video.addEventListener('loadedmetadata', handleLoaded)
    video.load()

    return () => {
      video.removeEventListener('loadedmetadata', handleLoaded)
      video.pause()
      video.src = ''
    }
  }, [currentSrc])

  if (videoError) {
    return (
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        color: '#666', fontSize: 16, flexDirection: 'column', gap: 12
      }}>
        <span style={{ fontSize: 48 }}>📺</span>
        <span>视频加载失败，显示模拟直播背景</span>
        <div style={{
          width: 120, height: 4, background: 'rgba(255,255,255,0.1)',
          borderRadius: 2, overflow: 'hidden', marginTop: 8
        }}>
          <div style={{
            height: '100%', width: '30%',
            background: 'linear-gradient(90deg, #ff2442, #ff6b8a)',
            borderRadius: 2,
            animation: 'slideBar 2s ease-in-out infinite'
          }} />
        </div>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      src={currentSrc}
      muted
      loop
      playsInline
      preload="auto"
      onError={handleError}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: videoReady ? 1 : 0,
        transition: 'opacity 0.5s ease'
      }}
    />
  )
}
