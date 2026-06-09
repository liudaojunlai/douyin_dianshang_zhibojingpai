import { useRef, useState, useEffect } from 'react'

// 本地视频（Nginx 直连，无跨域/网络问题）
const DEFAULT_VIDEO = '/videos/live_bg.mp4'

// 备选视频（外网可用源，当本地视频加载失败时尝试）
const FALLBACK_VIDEOS = [
  'https://media.w3.org/2010/05/sintel/trailer.mp4',
]

interface LiveVideoPlayerProps {
  /** 自定义视频 URL，留空则使用默认演示视频 */
  videoUrl?: string
  /** 主播昵称（用于画面中央水印） */
  anchorName?: string
  /** 在线人数 */
  onlineCount?: number
}

export default function LiveVideoPlayer({
  videoUrl,
  anchorName = '直播间',
  onlineCount = 0,
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
        width: '100%', height: '100%',
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
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      overflow: 'hidden', background: '#000'
    }}>
      <video
        ref={videoRef}
        src={currentSrc}
        muted
        loop
        playsInline
        preload="auto"
        onError={handleError}
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover',
          opacity: videoReady ? 1 : 0,
          transition: 'opacity 0.5s ease'
        }}
      />

      {/* 视频加载中的骨架屏 */}
      {!videoReady && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#111'
        }}>
          <div style={{
            width: 48, height: 48, border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: '#ff2442', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
        </div>
      )}

      {/* 底部渐变遮罩，让 UI 文字更清晰 */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
        pointerEvents: 'none'
      }} />

      {/* 左上角视频源水印 */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        color: 'rgba(255,255,255,0.3)', fontSize: 11,
        pointerEvents: 'none', letterSpacing: 1
      }}>
        {videoReady ? '📡 LIVE · 模拟直播画面' : '⏳ 加载中...'}
      </div>
    </div>
  )
}
