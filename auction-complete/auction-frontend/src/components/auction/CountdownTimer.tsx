import { useMemo } from 'react'

interface Props {
  remainMs: number
  extended?: boolean
}

export default function CountdownTimer({ remainMs, extended }: Props) {
  const { hours, minutes, seconds, urgent } = useMemo(() => {
    const total = Math.max(0, Math.floor(remainMs / 1000))
    return {
      hours:   Math.floor(total / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60,
      urgent:  total <= 10,
    }
  }, [remainMs])

  const fmt = (n: number) => String(n).padStart(2, '0')

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontFamily: '"Courier New", monospace',
      fontWeight: 900,
      fontSize: 32,
      color: urgent ? '#ef4444' : extended ? '#22c55e' : '#fbbf24',
      textShadow: '0 0 20px rgba(251,191,36,0.6)',
      animation: urgent ? 'pulse 1s infinite' : extended ? 'flashGreen 0.5s 3' : 'none',
      transition: 'color 0.3s',
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.7;transform:scale(1.05)} }
        @keyframes flashGreen { 0%,100%{color:#22c55e} 50%{color:#86efac} }
      `}</style>
      {hours > 0 && <><span>{fmt(hours)}</span><span style={{opacity:.5}}>:</span></>}
      <span>{fmt(minutes)}</span>
      <span style={{opacity:.5}}>:</span>
      <span>{fmt(seconds)}</span>
      {extended && <span style={{fontSize:14,color:'#22c55e',marginLeft:6}}>+延时</span>}
    </div>
  )
}
