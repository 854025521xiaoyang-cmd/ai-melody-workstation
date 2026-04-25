import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import * as Tone from 'tone'
import {
  AudioLines,
  Bot,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  FileMusic,
  FolderOpen,
  House,
  LoaderCircle,
  LogIn,
  Music4,
  Pause,
  Piano,
  Play,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Volume2,
  Wand2,
  Waves,
} from 'lucide-react'

const API_BASE = (() => {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE.replace(/\/$/, '')
  if (typeof window !== 'undefined' && window.location.port === '4174') return 'http://localhost:8000'
  return ''
})()

const SAMPLE_AUDIO = {
  name: 'NINE PERCENT - Good Things.mp3',
  url: '/test-audio/NINE PERCENT - Good Things.mp3',
}

const moods = ['温柔', '忧伤', '浪漫', '梦幻', '神秘', '轻快', '韩系抒情']
const styles = ['流行', '电影感', 'Lo-fi', '电子', '古典', '抒情钢琴', 'K-Ballad']
const instruments = ['钢琴', '吉他', '弦乐', 'Synth', 'Pad', 'Bell', 'Soft EP']
const quickTags = ['治愈', '副歌感', '深夜', '海边', '下雨', '电影感', 'Lo-fi', '梦幻', '韩剧OST', '游乐园感', '首尔夜晚']
const keys = ['C major', 'A minor', 'D minor', 'G major']
const creationModes = ['作词创作', '哼唱创作', '大师创作']
const workbenchOptions = [
  { key: 'piano', label: '钢琴工作站' },
  { key: 'guitar', label: '吉他 Agent' },
]

const workbenchConfigs = {
  piano: {
    eyebrow: 'AI 生成 + AI 辅助创作',
    title: 'AI 旋律共创 Demo',
    description: '面向钢琴与旋律写作的工作台，适合从一句灵感快速生成多个旋律版本，再继续续写、改编与保存项目。',
    promptPlaceholder: '输入一句灵感，例如：做一段深夜下雨、孤独感明显的钢琴旋律',
    generateLabel: '生成旋律',
    resultLead: '每个版本都可以真实播放，也支持 AI 续写 / AI 改编 / AI 配和弦 / 换风格',
    presetCards: [
      { title: '韩系抒情', description: '更温柔、流畅，适合主歌与情绪铺垫。', patch: { prompt: '做一段韩系抒情、像深夜游乐园灯光一样温柔的钢琴旋律', mood: '韩系抒情', style: 'K-Ballad', instrument: 'Soft EP', keyValue: 'A minor', duration: '16小节', bpm: 74, creationMode: '哼唱创作' } },
      { title: '电影感钢琴', description: '更有画面感，适合片头、桥段与情绪推进。', patch: { prompt: '做一段有夜色和画面感的电影感钢琴旋律，适合片头推进', mood: '梦幻', style: '电影感', instrument: '钢琴', keyValue: 'D minor', duration: '16小节', bpm: 82, creationMode: '大师创作' } },
    ],
  },
  guitar: {
    eyebrow: 'AEROBAND GUITAR AGENT',
    title: '把用户灵感快速转成可演奏的吉他音乐草稿',
    description: '',
    promptPlaceholder: '例如：带一点夜色感的流行吉他旋律，适合副歌前推进，有记忆点。',
    generateLabel: '生成',
    resultLead: '3 个可试听、可继续编辑、可导出的吉他方向。',
    presetCards: [
      { title: 'K-pop', description: '更亮、更抓耳，适合舞台感强的主旋律线条。', patch: { prompt: '做一段带有舞台感和记忆点的 K-pop 吉他主旋律，适合副歌前推进', mood: '梦幻', style: '流行', instrument: '吉他', keyValue: 'A minor', duration: '16小节', bpm: 112, creationMode: '大师创作' } },
      { title: '美式街头青春', description: '更松弛、更有律动，适合夜色与街头氛围。', patch: { prompt: '做一段带有夜晚城市感、情绪拉扯和记忆点的主旋律吉他草稿', mood: '轻快', style: 'Lo-fi', instrument: '吉他', keyValue: 'A minor', duration: '16小节', bpm: 104, creationMode: '哼唱创作' } },
    ],
  },
}

const styleOptionsByMode = {
  piano: styles,
  guitar: ['流行', 'Lo-fi', '电影感', '电子'],
}

const moodOptionsByMode = {
  piano: moods,
  guitar: ['梦幻', '轻快', '浪漫', '神秘', '忧伤'],
}

const instrumentOptionsByMode = {
  piano: instruments,
  guitar: ['吉他', '钢琴', 'Pad', 'Bell', 'Synth'],
}

const STAFF_WIDTH = 920
const STAFF_HEIGHT = 260
const STAFF_LEFT = 72
const STAFF_TOP = 56
const LINE_GAP = 24
const NOTE_SPACING = 30

const navItems = [
  { key: 'home', label: '首页', icon: House },
  { key: 'core', label: '听歌识谱', icon: Music4 },
  { key: 'tools', label: 'AI 创作', icon: Sparkles },
  { key: 'projects', label: '项目管理', icon: FolderOpen },
  { key: 'settings', label: '设置', icon: Settings2 },
]

function createDefaultCompose(mode = 'piano') {
  const preset = workbenchConfigs[mode].presetCards[0].patch
  return {
    productMode: mode,
    ...preset,
  }
}

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json') ? await response.json() : await response.text()
  if (!response.ok) {
    const message = typeof body === 'string' ? body : body.detail || body.error || '请求失败'
    throw new Error(message)
  }
  return body
}

function formatSeconds(value) {
  return `${Number(value).toFixed(2)}秒`
}

function midiToNoteName(midi) {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const pitch = notes[midi % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${pitch}${octave}`
}

function diatonicIndex(midi) {
  const note = midiToNoteName(midi)
  const letter = note[0]
  const octave = Number(note.slice(-1))
  const base = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }[letter]
  return octave * 7 + base
}

function midiToY(midi) {
  const e4Index = 4 * 7 + 2
  const diff = diatonicIndex(midi) - e4Index
  return STAFF_TOP + 4 * LINE_GAP - diff * (LINE_GAP / 2)
}

function buildLedgerLines(y, x) {
  const lines = []
  const bottomLineY = STAFF_TOP + 4 * LINE_GAP
  const topLineY = STAFF_TOP

  for (let current = bottomLineY + LINE_GAP; current <= y; current += LINE_GAP) {
    lines.push({ x1: x - 14, x2: x + 14, y: current })
  }
  for (let current = topLineY - LINE_GAP; current >= y; current -= LINE_GAP) {
    lines.push({ x1: x - 14, x2: x + 14, y: current })
  }
  return lines
}

function noteToPreview(notes) {
  const pitchOrder = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  return notes.map((item, index) => {
    const source = item.note || item.name || 'C4'
    const noteName = source.replace('#', '').replace('b', '')
    const octave = Number(source.slice(-1))
    const letter = noteName[0]
    const pitchIndex = pitchOrder.indexOf(letter)
    return {
      id: `${source}-${index}`,
      left: 4 + index * 6,
      top: Math.max(8, 58 - ((octave - 3) * 10 + pitchIndex * 3)),
      width: item.duration === '2n' ? 18 : item.duration === '4n' ? 12 : 8,
    }
  })
}

function buildWaveValues(item) {
  return item.melody.sequences.map((note, index) => 22 + ((index * 13 + (note.note || 'C4').charCodeAt(0)) % 52))
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function triggerDownload(url, filename) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.target = '_blank'
  anchor.rel = 'noreferrer'
  anchor.click()
}

function useTonePlayer() {
  const [playingId, setPlayingId] = useState(null)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [sampleStatus, setSampleStatus] = useState('未加载')
  const [sampleMode, setSampleMode] = useState('fallback')
  const currentPartRef = useRef(null)
  const currentChordPartRef = useRef(null)
  const stopTimerRef = useRef(null)
  const pianoSamplerRef = useRef(null)
  const musicBoxSamplerRef = useRef(null)
  const leadSynthRef = useRef(null)
  const bellSynthRef = useRef(null)
  const padSynthRef = useRef(null)
  const bassSynthRef = useRef(null)

  useEffect(() => {
    const reverb = new Tone.Reverb({ decay: 4.5, wet: 0.28 }).toDestination()
    const delay = new Tone.FeedbackDelay('8n', 0.16).connect(reverb)

    const pianoSampler = new Tone.Sampler({
      urls: {
        A1: 'A1.mp3',
        C2: 'C2.mp3',
        'D#2': 'Ds2.mp3',
        'F#2': 'Fs2.mp3',
        A2: 'A2.mp3',
        C3: 'C3.mp3',
        'D#3': 'Ds3.mp3',
        'F#3': 'Fs3.mp3',
        A3: 'A3.mp3',
        C4: 'C4.mp3',
        'D#4': 'Ds4.mp3',
        'F#4': 'Fs4.mp3',
        A4: 'A4.mp3',
      },
      release: 1.4,
      baseUrl: 'https://tonejs.github.io/audio/salamander/',
      onload: () => {
        setSampleMode('samples')
        setSampleStatus('真实采样已就绪')
      },
      onerror: () => {
        setSampleMode('fallback')
        setSampleStatus('采样加载失败，已切到合成音色')
      },
    }).connect(reverb)

    const musicBoxSampler = new Tone.Sampler({
      urls: { C4: 'C4.mp3', E4: 'E4.mp3', G4: 'G4.mp3', C5: 'C5.mp3' },
      release: 1.8,
      baseUrl: 'https://tonejs.github.io/audio/mbox/',
      onerror: () => {
        setSampleMode('fallback')
        setSampleStatus('音乐盒采样失败，已切到合成音色')
      },
    }).connect(delay)

    const leadSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.02, decay: 0.15, sustain: 0.35, release: 0.9 }, volume: -10 }).connect(reverb)
    const bellSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle8' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.05, release: 1.4 }, volume: -18 }).connect(delay)
    const padSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.12, decay: 0.2, sustain: 0.35, release: 2.4 }, volume: -18 }).connect(reverb)
    const bassSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.02, decay: 0.1, sustain: 0.2, release: 1.2 }, volume: -21 }).connect(reverb)

    pianoSamplerRef.current = pianoSampler
    musicBoxSamplerRef.current = musicBoxSampler
    leadSynthRef.current = leadSynth
    bellSynthRef.current = bellSynth
    padSynthRef.current = padSynth
    bassSynthRef.current = bassSynth
    setSampleStatus('采样准备中')

    return () => {
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current)
      Tone.Transport.stop()
      Tone.Transport.cancel()
      currentPartRef.current?.dispose()
      currentChordPartRef.current?.dispose()
      pianoSampler.dispose()
      musicBoxSampler.dispose()
      leadSynth.dispose()
      bellSynth.dispose()
      padSynth.dispose()
      bassSynth.dispose()
      reverb.dispose()
      delay.dispose()
    }
  }, [])

  const stopPlayback = () => {
    Tone.Transport.stop()
    Tone.Transport.cancel()
    currentPartRef.current?.dispose()
    currentChordPartRef.current?.dispose()
    currentPartRef.current = null
    currentChordPartRef.current = null
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current)
    stopTimerRef.current = null
    setPlayingId(null)
  }

  const ensureAudio = async () => {
    if (Tone.context.state !== 'running') await Tone.start()
    setAudioUnlocked(true)
    try {
      await Tone.loaded()
      setSampleMode('samples')
      setSampleStatus('真实采样已就绪')
    } catch {
      setSampleMode('fallback')
      setSampleStatus('采样加载失败，已切到合成音色')
    }
  }

  const playLead = (note, duration, time, velocity) => {
    const useSampler = sampleMode === 'samples' && pianoSamplerRef.current?.loaded
    if (useSampler) pianoSamplerRef.current.triggerAttackRelease(note, duration, time, velocity)
    else leadSynthRef.current?.triggerAttackRelease(note, duration, time, velocity)
  }

  const playAccent = (note, duration, time, velocity) => {
    const useSampler = sampleMode === 'samples' && musicBoxSamplerRef.current?.loaded
    if (useSampler) musicBoxSamplerRef.current.triggerAttackRelease(note, duration, time, velocity)
    else bellSynthRef.current?.triggerAttackRelease(note, duration, time, velocity)
  }

  const playVariant = async (variant) => {
    await ensureAudio()
    if (playingId === variant.id) {
      stopPlayback()
      return
    }

    stopPlayback()
    Tone.Transport.bpm.value = variant.bpm
    let currentTime = 0
    const events = variant.melody.sequences.map((item) => {
      const event = {
        time: currentTime,
        note: item.note || item.name || 'C4',
        duration: item.duration || '4n',
        velocity: item.velocity || 0.7,
      }
      currentTime += Tone.Time(event.duration).toSeconds()
      return event
    })
    const chordEvents = (variant.melody.chords || []).map((item) => ({
      time: Tone.Time(`${item.startBeat || 0}n`).toSeconds(),
      chord: item.chord,
      bass: item.chord[0],
      duration: item.duration || '2n',
    }))

    currentPartRef.current = new Tone.Part((time, value) => {
      playLead(value.note, value.duration, time, value.velocity)
      if (variant.style === 'K-Ballad' || variant.mood === '韩系抒情') playAccent(value.note, variant.bpm <= 76 ? '8n' : '16n', time + 0.05, 0.06)
    }, events).start(0)

    currentChordPartRef.current = new Tone.Part((time, value) => {
      padSynthRef.current?.triggerAttackRelease(value.chord, value.duration, time, 0.2)
      bassSynthRef.current?.triggerAttackRelease([value.bass], variant.bpm <= 80 ? '2n' : '1n', time, 0.12)
      if (variant.style === 'K-Ballad' || variant.mood === '韩系抒情') playAccent(value.chord[1], variant.bpm <= 76 ? '4n' : '8n', time + 0.18, 0.04)
    }, chordEvents).start(0)

    Tone.Transport.start()
    setPlayingId(variant.id)
    stopTimerRef.current = window.setTimeout(() => stopPlayback(), (currentTime + 1) * 1000)
  }

  return { playingId, audioUnlocked, sampleStatus, playVariant, ensureAudio, stopPlayback }
}

function AppHeader({ authUser, backendHealthy }) {
  return (
    <header className="app-header glass-card">
      <div>
        <div className="app-eyebrow">创作 Demo 重构版</div>
        <div className="app-title">AEROBAND GUITAR AGENT</div>
      </div>
      <div className="header-actions">
        <label className="search-bar">
          <Search size={16} />
          <input placeholder="搜索项目、旋律、工具或风格" />
        </label>
        <div className="status-chip">{backendHealthy ? 'API 已连接' : 'API 未连接'}</div>
        <div className="user-pill"><UserRound size={16} /> {authUser?.email || '未登录'}</div>
      </div>
    </header>
  )
}

function SummaryCard({ title, value, hint }) {
  return (
    <div className="summary-card glass-card">
      <div className="summary-title">{title}</div>
      <div className="summary-value">{value}</div>
      <div className="tiny muted">{hint}</div>
    </div>
  )
}

function StaffPreview({ notes }) {
  const visibleNotes = notes.slice(0, 24)
  const lines = Array.from({ length: 5 }, (_, index) => STAFF_TOP + index * LINE_GAP)

  return (
    <div className="staff-shell glass-card">
      <svg viewBox={`0 0 ${STAFF_WIDTH} ${STAFF_HEIGHT}`} className="staff-svg" role="img" aria-label="识谱结果五线谱预览">
        {lines.map((y) => (
          <line key={y} x1={STAFF_LEFT} x2={STAFF_WIDTH - 40} y1={y} y2={y} className="staff-line" />
        ))}
        <text x="26" y={STAFF_TOP + 58} className="clef-mark">𝄞</text>
        {visibleNotes.map((note, index) => {
          const x = STAFF_LEFT + 56 + index * NOTE_SPACING
          const y = midiToY(note.midi)
          const ledgerLines = buildLedgerLines(y, x)
          const stemUp = y > STAFF_TOP + 2 * LINE_GAP
          return (
            <g key={`${note.start || note.startBeat}-${note.midi}-${index}`}>
              {ledgerLines.map((ledger, ledgerIndex) => (
                <line key={ledgerIndex} x1={ledger.x1} x2={ledger.x2} y1={ledger.y} y2={ledger.y} className="ledger-line" />
              ))}
              <ellipse cx={x} cy={y} rx="10" ry="7.5" className="note-head" transform={`rotate(-18 ${x} ${y})`} />
              <line x1={stemUp ? x + 8 : x - 8} x2={stemUp ? x + 8 : x - 8} y1={y} y2={stemUp ? y - 34 : y + 34} className="note-stem" />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function HomePage({ onJump, backendHealthy, projectCount }) {
  return (
    <section className="page-stack">
      <div className="section-hero glass-card">
        <div className="section-hero-title">当前应用已经收束成两条创作主线 + 一个吉他 Agent 模式</div>
        <div className="section-hero-sub">
          一条是「听歌识谱」的真实音频转谱能力，一条是「AI 创作」的参数化生成、续写、改编与项目保存。现在又把飞书里的吉他 Agent 也并进同一套创作页里了。
        </div>
      </div>
      <div className="quick-grid">
        <button className="quick-card glass-card" onClick={() => onJump('tools')}>
          <div className="quick-card-title">进入 AI 创作</div>
          <div className="tiny muted">按 PDF 思路重建的主创作页，支持生成、续写、改编、项目保存。</div>
        </button>
        <button className="quick-card glass-card" onClick={() => onJump('core')}>
          <div className="quick-card-title">进入听歌识谱</div>
          <div className="tiny muted">接 `FastAPI /api/transcribe`，上传音频后可导出 MusicXML。</div>
        </button>
        <button className="quick-card glass-card" onClick={() => onJump('projects')}>
          <div className="quick-card-title">查看项目</div>
          <div className="tiny muted">当前已保存 {projectCount} 个项目，后续可继续扩展分享与协作。</div>
        </button>
      </div>
      <div className="feature-grid">
        <div className="feature-card glass-card">
          <div className="panel-title">真实端口状态</div>
          <div className="tiny muted top-gap-xs">{backendHealthy ? '前端已对接后端接口。' : '后端未启动时页面会提示连接失败。'}</div>
        </div>
        <div className="feature-card glass-card">
          <div className="panel-title">需求修正方向</div>
          <div className="tiny muted top-gap-xs">把原 PDF 的讨论稿重构成了「可执行流程 + 可持久化项目」。</div>
        </div>
        <div className="feature-card glass-card">
          <div className="panel-title">当前版本重点</div>
          <div className="tiny muted top-gap-xs">先把所有主要按钮做成真调用，再考虑更强的模型能力接入。</div>
        </div>
      </div>
    </section>
  )
}

function CorePage({
  audioFile,
  audioUrl,
  bpm,
  setBpm,
  loading,
  error,
  result,
  onAudioChange,
  onTranscribe,
  dragActive,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}) {
  const visibleNotes = useMemo(() => result?.notes || [], [result])

  return (
    <section className="page-stack">
      <div className="section-hero glass-card">
        <div className="section-hero-title">听歌识谱</div>
        <div className="section-hero-sub">这一页保留真实后端音频转谱能力，作为另一条稳定能力线存在。</div>
      </div>
      <div className="core-grid">
        <section className="panel glass-card">
          <div className="panel-header">
            <div className="panel-title"><Upload size={18} /> 音频导入</div>
            <div className="subtle">支持拖拽与示例音频，后端返回真实识谱结果。</div>
          </div>
          <div className="panel-body stack-lg">
            <label className={`upload-box ${dragActive ? 'upload-box-active' : ''}`} onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}>
              <input type="file" accept="audio/*" onChange={onAudioChange} />
              <div className="upload-icon"><FileMusic size={20} /></div>
              <div className="upload-title">{audioFile ? audioFile.name : '选择音频文件'}</div>
              <div className="tiny muted">{dragActive ? '松手即可载入音频文件' : '支持点击选择，也支持从桌面直接拖拽进来'}</div>
            </label>
            <div className="sample-row">
              <button className="secondary-btn" onClick={() => onAudioChange(null, SAMPLE_AUDIO)}>
                <FileMusic size={18} /> 载入示例音频
              </button>
              <div className="tiny muted">示例：{SAMPLE_AUDIO.name}</div>
            </div>
            {audioUrl ? <audio controls src={audioUrl} className="audio-player" /> : null}
            <div className="field">
              <div className="row-between">
                <span>目标 BPM</span>
                <div className="bpm-pill">{bpm} BPM</div>
              </div>
              <input type="range" min="60" max="180" value={bpm} onChange={(event) => setBpm(Number(event.target.value))} />
              <div className="tiny muted top-gap-xs">它会影响 MusicXML 节奏换算，不会改变原始音频速度。</div>
            </div>
            <button className="primary-btn" onClick={onTranscribe} disabled={loading}>
              {loading ? <LoaderCircle size={18} className="spin" /> : <Waves size={18} />}
              {loading ? '正在识别并转谱...' : '开始识谱'}
            </button>
            {error ? <div className="error-box">{error}</div> : null}
            <div className="wave-card glass-card">
              <div className="panel-title"><AudioLines size={18} /> 波形参考</div>
              <div className="wave-visual">{Array.from({ length: 32 }).map((_, index) => <span key={index} style={{ height: `${26 + ((index * 17) % 58)}%` }} />)}</div>
            </div>
          </div>
        </section>
        <section className="panel glass-card">
          <div className="panel-header">
            <div className="panel-title"><Music4 size={18} /> 识谱结果展示区</div>
            <div className="subtle">识别后自动展示五线谱预览、数据摘要与导出。</div>
          </div>
          <div className="panel-body stack-lg">
            {!result ? (
              <div className="empty-box">上传音频后点「开始识谱」，这里会显示识谱结果。</div>
            ) : (
              <>
                <div className="summary-grid">
                  <SummaryCard title="识别音符" value={result.noteCount} hint="后端提取出的连续音高事件数" />
                  <SummaryCard title="导出节拍" value={`${result.bpm} BPM`} hint="用于 MusicXML 节奏换算" />
                  <SummaryCard title="首个音符" value={visibleNotes[0]?.name || '—'} hint="识别结果中的第一个音高" />
                </div>
                <StaffPreview notes={visibleNotes} />
                <div className="button-row">
                  <a className="primary-btn link-btn" href={`${API_BASE}${result.musicXmlUrl}`} target="_blank" rel="noreferrer">
                    <Download size={18} /> 下载 MusicXML
                  </a>
                </div>
                <div className="table-shell glass-card">
                  <table className="note-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>音名</th>
                        <th>MIDI</th>
                        <th>开始</th>
                        <th>结束</th>
                        <th>时长</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleNotes.slice(0, 18).map((note, index) => (
                        <tr key={`${note.start}-${index}`}>
                          <td>{index + 1}</td>
                          <td>{note.name}</td>
                          <td>{note.midi}</td>
                          <td>{formatSeconds(note.start)}</td>
                          <td>{formatSeconds(note.end)}</td>
                          <td>{formatSeconds(note.duration)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}

function ToolsPage({
  backendHealthy,
  compose,
  setCompose,
  results,
  activePreview,
  setActivePreview,
  generateLoading,
  progress,
  actionLoadingId,
  generateError,
  player,
  onGenerate,
  onAction,
  onExportMidi,
  onSaveProject,
}) {
  const modeKey = compose.productMode || 'piano'
  const workbench = workbenchConfigs[modeKey]
  const moodOptions = moodOptionsByMode[modeKey]
  const styleOptions = styleOptionsByMode[modeKey]
  const instrumentOptions = instrumentOptionsByMode[modeKey]
  const bpmTone = compose.bpm >= 128 ? '高能推进，更适合主副歌前的抓耳线条。' : compose.bpm >= 100 ? '中高速律动，适合更明确的段落推进。' : '呼吸感更强，适合铺垫和情绪段落。'
  const checks = useMemo(() => [
    { name: '生成接口已连接', pass: backendHealthy },
    { name: '播放器已就绪', pass: true },
    { name: '结果支持扩展 / 重混 / 导出 MIDI', pass: true },
  ], [backendHealthy])

  return (
    <section className="page-stack">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="hero-grid">
        <div className="hero-card gradient-card">
          <div className="inline-row dim"><Sparkles size={16} /> {workbench.eyebrow}</div>
          <h1>{workbench.title}</h1>
          {workbench.description ? <p>{workbench.description}</p> : null}
          <div className="chip-row">
            <span className="chip">一句灵感即可生成</span>
            <span className="chip">真实接口返回结果</span>
            <span className="chip">{modeKey === 'guitar' ? '可导出 MIDI + JSON' : '可试听 + 可保存项目'}</span>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <div className="inline-row"><Bot size={18} /> AI 创作状态</div>
            <div className="subtle">优先把每个按钮做成真实请求</div>
          </div>
          <div className="panel-body stack-md">
            <div className="mode-grid">
              {workbenchOptions.map((option) => (
                <button
                  key={option.key}
                  onClick={() => setCompose(createDefaultCompose(option.key))}
                  className={`mode-btn ${modeKey === option.key ? 'mode-active' : ''}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="info-box">
              <div className="row-between"><span>AI 解析灵感</span><span className="muted">{backendHealthy ? '已开启' : '未连接'}</span></div>
              <div className="row-between"><span>旋律真实试听</span><span className="ok">可播放</span></div>
              <div className="row-between"><span>播放引擎</span><span className="muted">采样优先 / 合成兜底</span></div>
            </div>
            {modeKey === 'guitar' ? null : <div className="accent-box">当前版本重点是把「输入灵感 → 生成旋律 → 试听 → 续写/改编/保存工程」完整跑通。</div>}
            <button className="primary-btn full" onClick={player.ensureAudio}><Volume2 size={16} /> {player.audioUnlocked ? '音频已就绪' : '先启用音频'}</button>
            <div className="status-box">当前音色状态：<span className="ok">{player.sampleStatus}</span></div>
            <div className="status-box">
              自检结果：
              <div className="stack-sm top-gap">
                {checks.map((check) => (
                  <div key={check.name} className="inline-row">{check.pass ? <CheckCircle2 size={14} className="ok-icon" /> : <LoaderCircle size={14} className="bad-icon" />} <span>{check.name}</span></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="content-grid">
        <div className="panel">
          <div className="panel-header">
            <div className="inline-row"><Wand2 size={18} /> 灵感输入</div>
            <div className="subtle">{modeKey === 'guitar' ? '用户给意图，系统通过真实端口生成 3 个吉他方案' : '用户给意图，系统通过真实端口生成旋律结果'}</div>
          </div>
          <div className="panel-body stack-lg">
            <div className="info-box">
              <div className="subtle title-space">快捷方向</div>
              <div className="preset-grid">
                {workbench.presetCards.map((card) => (
                  <button
                    key={card.title}
                    className="preset-card"
                    onClick={() => setCompose((prev) => ({ ...prev, productMode: modeKey, ...card.patch }))}
                  >
                    <div className="preset-title">{card.title}</div>
                    <div className="tiny muted top-gap-xs">{card.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="info-box">
              <div className="subtle title-space">创作模式</div>
              <div className="mode-grid">
                {creationModes.map((mode) => (
                  <button key={mode} onClick={() => setCompose((prev) => ({ ...prev, creationMode: mode }))} className={`mode-btn ${compose.creationMode === mode ? 'mode-active' : ''}`}>{mode}</button>
                ))}
              </div>
              <div className="tiny top-gap">当前模式：{compose.creationMode}。现在会连同参数一起保存到工程。</div>
            </div>

            <div>
              <input value={compose.prompt} onChange={(e) => setCompose((prev) => ({ ...prev, prompt: e.target.value }))} className="text-input" placeholder={workbench.promptPlaceholder} />
              <div className="chip-row top-gap">
                {quickTags.map((tag) => (
                  <button key={tag} className="tag-btn" onClick={() => setCompose((prev) => ({ ...prev, prompt: prev.prompt.includes(tag) ? prev.prompt : `${prev.prompt}，${tag}` }))}>{tag}</button>
                ))}
              </div>
            </div>

            <div className="form-grid">
              <label className="field"><span>情绪</span><select value={compose.mood} onChange={(e) => setCompose((prev) => ({ ...prev, mood: e.target.value }))}>{moodOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="field"><span>风格</span><select value={compose.style} onChange={(e) => setCompose((prev) => ({ ...prev, style: e.target.value }))}>{styleOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="field"><span>调性</span><select value={compose.keyValue} onChange={(e) => setCompose((prev) => ({ ...prev, keyValue: e.target.value }))}>{keys.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="field"><span>乐器</span><select value={compose.instrument} onChange={(e) => setCompose((prev) => ({ ...prev, instrument: e.target.value }))}>{instrumentOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>BPM <strong>{compose.bpm}</strong></span>
                <input type="range" min="60" max="160" step="1" value={compose.bpm} onChange={(e) => setCompose((prev) => ({ ...prev, bpm: Number(e.target.value) }))} />
                <div className="tiny muted">{bpmTone}</div>
              </label>
              <label className="field"><span>时长</span><select value={compose.duration} onChange={(e) => setCompose((prev) => ({ ...prev, duration: e.target.value }))}><option>4小节</option><option>8小节</option></select></label>
            </div>

            <div className="button-row">
              <button className="primary-btn flex-1" onClick={onGenerate} disabled={generateLoading}>
                {generateLoading ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />}
                {generateLoading ? '正在生成...' : workbench.generateLabel}
              </button>
              <button className="secondary-btn" onClick={() => setCompose(createDefaultCompose(modeKey))}>
                <SlidersHorizontal size={16} /> 恢复当前模式预设
              </button>
            </div>

              <div className="status-box">
              <div className="row-between"><span>生成进度</span><span>{progress}%</span></div>
              <div className="progress"><div className="progress-inner" style={{ width: `${progress}%` }} /></div>
              <div className="tiny top-gap">{generateLoading ? '正在解析灵感、推断风格并生成旋律…' : modeKey === 'guitar' ? '点击后将生成 3 个可真实试听、可导出 MIDI 的结果。' : '点击后将生成 3 个可真实试听的旋律版本。'}</div>
            </div>

            {generateError ? <div className="error-box">{generateError}</div> : null}
          </div>
        </div>

        <div className="stack-lg">
          <div className="panel">
            <div className="panel-header row-between header-gap">
              <div>
                <div className="inline-row"><Music4 size={18} /> 生成结果</div>
                <div className="subtle top-gap-xs">{workbench.resultLead}</div>
              </div>
              <div className="segmented">
                <button className={`icon-btn ${activePreview === 'wave' ? 'active' : ''}`} onClick={() => setActivePreview('wave')}>Wave</button>
                <button className={`icon-btn ${activePreview === 'roll' ? 'active' : ''}`} onClick={() => setActivePreview('roll')}>Piano Roll</button>
              </div>
            </div>
            <div className="panel-body">
              {results.length === 0 ? (
                <div className="empty-box">还没有生成结果。先输入灵感，然后点「生成旋律」。</div>
              ) : (
                <div className="stack-md">
                  <div className="accent-box">已生成 <strong>3 个真实接口返回版本</strong>。单卡片支持继续操作，并且可以保存到项目列表。</div>
                  {results.map((item, idx) => {
                    const previewNotes = noteToPreview(item.melody.sequences)
                    return (
                      <motion.div key={item.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }} className="result-card">
                        <div className="row-between header-gap">
                          <div>
                            <div className="inline-wrap">
                              <h3 className="result-title">{item.title}</h3>
                              <span className="chip">{item.tag}</span>
                              <span className="chip">可试听</span>
                            </div>
                            <div className="chip-row muted-row top-gap-xs">
                              {['mood', 'style', 'instrument', 'key'].map((field) => <span key={field} className="chip">{item[field]}</span>)}
                              <span className="chip">{item.bpm} BPM</span>
                              <span className="chip">{item.bars} 小节</span>
                              <span className="chip">{item.sourceMode}</span>
                            </div>
                          </div>
                          <button className="play-btn" onClick={() => player.playVariant(item)}>{player.playingId === item.id ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}</button>
                        </div>

                        {activePreview === 'wave' ? (
                          <div className="wave-box">{buildWaveValues(item).map((height, index) => <div key={index} className="wave-bar" style={{ height: `${height}%` }} />)}</div>
                        ) : (
                          <div className="roll-box">
                            <div className="roll-grid">{Array.from({ length: 48 }).map((_, index) => <div key={index} className="roll-cell" />)}</div>
                            {previewNotes.map((note) => <div key={note.id} className="roll-note" style={{ left: `${note.left}%`, top: `${note.top}%`, width: `${note.width}%` }} />)}
                          </div>
                        )}

                        <div className="result-meta">
                          <div>
                            <p className="muted-text">{item.desc}</p>
                            <p className="hint-text top-gap-xs">{item.aiHint}</p>
                            {item.progression ? <p className="tiny muted top-gap-xs">和弦：{item.progression.join(' - ')}</p> : null}
                          </div>
                          <div className="status-pill">匹配度 <strong>{item.confidence}%</strong></div>
                        </div>

                        <div className="button-wrap top-gap">
                          <button className="secondary-btn" onClick={() => onAction('continue', item)} disabled={Boolean(actionLoadingId)}><Wand2 size={16} /> {actionLoadingId === `${item.id}-continue` ? '处理中...' : modeKey === 'guitar' ? '继续生成' : 'AI 续写'}</button>
                          <button className="secondary-btn" onClick={() => onAction('expand', item)} disabled={Boolean(actionLoadingId)}><RefreshCw size={16} className={actionLoadingId === `${item.id}-expand` ? 'spin' : ''} /> {actionLoadingId === `${item.id}-expand` ? '扩展中...' : '扩展'}</button>
                          <button className="secondary-btn" onClick={() => onAction('remix', item)} disabled={Boolean(actionLoadingId)}><AudioLines size={16} /> {actionLoadingId === `${item.id}-remix` ? '重混中...' : modeKey === 'guitar' ? '重混' : 'AI 改编'}</button>
                          <button className="secondary-btn" onClick={() => onAction('chords', item)} disabled={Boolean(actionLoadingId)}><Piano size={16} /> {actionLoadingId === `${item.id}-chords` ? '配和弦中...' : 'AI 配和弦'}</button>
                          <button className="secondary-btn" onClick={() => onAction('restyle', item)} disabled={Boolean(actionLoadingId)}><RefreshCw size={16} className={actionLoadingId === `${item.id}-restyle` ? 'spin' : ''} /> {actionLoadingId === `${item.id}-restyle` ? '换风格中...' : '换风格'}</button>
                          <button className="secondary-btn" onClick={() => onExportMidi(item)} disabled={Boolean(actionLoadingId)}><Download size={16} /> 导出 MIDI</button>
                          <button className="secondary-btn" onClick={() => downloadJson(`${item.title}.json`, item)}><Download size={16} /> 导出结构</button>
                        </div>
                      </motion.div>
                    )
                  })}
                  <div className="button-row">
                    <button className="primary-btn" onClick={onSaveProject}><Save size={16} /> 保存当前项目</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="inline-row">模式链路 + AI 辅助创作建议</div>
              <div className="subtle">把原 PDF 中模糊的流程收成明确可执行路径</div>
            </div>
            <div className="panel-body suggestion-grid">
              {[
                '哼唱创作：先出旋律，再补歌词，再补伴奏。',
                '作词创作：先出歌词，再补旋律，再补伴奏。',
                modeKey === 'guitar' ? '吉他 Agent：先出 3 个可演奏方案，再继续生成、扩展、重混与导出。' : '大师创作：先出完整草稿，再做局部编辑，最后保存项目。',
              ].map((tip) => (
                <div key={tip} className="suggestion-card glass-card">
                  <div className="panel-title">工作流建议</div>
                  <div className="tiny muted top-gap-xs">{tip}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ProjectsPage({ projects, projectsLoading, onRefresh, onOpenProject, onRenameProject, onDeleteProject, onDownloadProject, onShareProject }) {
  return (
    <section className="page-stack">
      <div className="section-hero glass-card">
        <div className="section-hero-title">项目管理</div>
        <div className="section-hero-sub">这里接真实项目接口，支持加载、重命名、导出、分享描述、删除。</div>
      </div>
      <div className="button-row">
        <button className="secondary-btn" onClick={onRefresh} disabled={projectsLoading}><RefreshCw size={16} className={projectsLoading ? 'spin' : ''} /> 刷新项目</button>
      </div>
      <div className="project-list">
        {projects.length === 0 ? (
          <div className="empty-box">还没有保存的项目。先去 AI 创作页生成并保存一个。</div>
        ) : (
          projects.map((item) => (
            <div key={item.id} className="project-item glass-card">
              <div>
                <div className="project-title">{item.title}</div>
                <div className="tiny muted">{item.type} · {item.time} · {item.version}</div>
                <div className="tiny muted top-gap-xs">{item.summary}</div>
              </div>
              <div className="project-actions">
                <button className="icon-action" onClick={() => onOpenProject(item)}><ChevronRight size={16} /></button>
                <button className="icon-action" onClick={() => onDownloadProject(item)}><Download size={16} /></button>
                <button className="icon-action" onClick={() => onShareProject(item)}><Share2 size={16} /></button>
                <button className="icon-action" onClick={() => onRenameProject(item)}><Copy size={16} /></button>
                <button className="icon-action danger" onClick={() => onDeleteProject(item)}><Trash2 size={16} /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function SettingsPage({ authUser, settings, authForm, setAuthForm, authBusy, settingsBusy, onRegister, onLogin, onLogout, onSaveSettings }) {
  return (
    <section className="page-stack">
      <div className="section-hero glass-card">
        <div className="section-hero-title">个人设置</div>
        <div className="section-hero-sub">这里接了真实的设置保存接口，也补了登录 / 注册 / 退出。</div>
      </div>

      <div className="settings-grid">
        <div className="panel glass-card">
          <div className="panel-header">
            <div className="panel-title"><LogIn size={18} /> 账号</div>
          </div>
          <div className="panel-body stack-lg">
            <div className="status-box">当前状态：{authUser ? authUser.email : '未登录'}</div>
            <input className="text-input" placeholder="邮箱" value={authForm.email} onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))} />
            <input className="text-input" placeholder="密码（至少 6 位）" type="password" value={authForm.password} onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))} />
            <div className="button-row">
              <button className="primary-btn" onClick={onRegister} disabled={authBusy}>注册</button>
              <button className="secondary-btn" onClick={onLogin} disabled={authBusy}>登录</button>
              <button className="secondary-btn" onClick={onLogout} disabled={authBusy || !authUser}>退出</button>
            </div>
          </div>
        </div>

        <div className="panel glass-card">
          <div className="panel-header">
            <div className="panel-title"><Settings2 size={18} /> 偏好</div>
          </div>
          <div className="panel-body stack-lg">
            <label className="field">
              <span>显示名称</span>
              <input className="text-input" value={settings.displayName || ''} onChange={(e) => onSaveSettings({ ...settings, displayName: e.target.value }, false)} />
            </label>
            <label className="field">
              <span>音质设置</span>
              <select value={settings.quality || '高音质'} onChange={(e) => onSaveSettings({ ...settings, quality: e.target.value }, false)}>
                <option>高音质</option>
                <option>标准</option>
                <option>省流模式</option>
              </select>
            </label>
            <label className="field">
              <span>界面主题</span>
              <select value={settings.theme || '深色模式'} onChange={(e) => onSaveSettings({ ...settings, theme: e.target.value }, false)}>
                <option>深色模式</option>
                <option>浅色模式</option>
              </select>
            </label>
            <label className="toggle-row">
              <span>云同步</span>
              <input type="checkbox" checked={Boolean(settings.cloudSync)} onChange={(e) => onSaveSettings({ ...settings, cloudSync: e.target.checked }, false)} />
            </label>
            <div className="button-row">
              <button className="primary-btn" onClick={() => onSaveSettings(settings, true)} disabled={settingsBusy}>
                {settingsBusy ? <LoaderCircle size={16} className="spin" /> : <Save size={16} />}
                保存设置
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function BottomNav({ activeTab, onChange }) {
  return (
    <nav className="bottom-nav glass-card">
      {navItems.map((item) => {
        const Icon = item.icon
        const active = activeTab === item.key
        return (
          <button key={item.key} className={`nav-btn ${active ? 'nav-btn-active' : ''}`} onClick={() => onChange(item.key)}>
            <Icon size={18} />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default function App() {
  const player = useTonePlayer()
  const [activeTab, setActiveTab] = useState('tools')
  const [backendHealthy, setBackendHealthy] = useState(true)
  const [audioFile, setAudioFile] = useState(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [sampleAudio, setSampleAudio] = useState(null)
  const [bpm, setBpm] = useState(120)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [compose, setCompose] = useState(createDefaultCompose('piano'))
  const [results, setResults] = useState([])
  const [activePreview, setActivePreview] = useState('wave')
  const [generateLoading, setGenerateLoading] = useState(false)
  const [progress, setProgress] = useState(10)
  const [actionLoadingId, setActionLoadingId] = useState('')
  const [generateError, setGenerateError] = useState('')
  const [projects, setProjects] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [settings, setSettings] = useState({})
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [authUser, setAuthUser] = useState(null)
  const [authForm, setAuthForm] = useState({ email: '', password: '' })
  const [authBusy, setAuthBusy] = useState(false)

  const loadAudioSource = (file, presetAudio = null) => {
    if (!file && !presetAudio) return
    if (audioUrl && !sampleAudio) URL.revokeObjectURL(audioUrl)
    setAudioFile(file)
    setSampleAudio(presetAudio)
    setAudioUrl(presetAudio ? presetAudio.url : URL.createObjectURL(file))
    setResult(null)
    setError('')
  }

  const handleAudioChange = (event, presetAudio = null) => {
    const nextFile = presetAudio ? null : event?.target?.files?.[0]
    if (!nextFile && !presetAudio) return
    loadAudioSource(nextFile, presetAudio)
  }

  const handleDragEnter = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(true)
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (!dragActive) setDragActive(true)
  }

  const handleDragLeave = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const nextTarget = event.relatedTarget
    if (nextTarget && event.currentTarget.contains(nextTarget)) return
    setDragActive(false)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)
    const droppedFile = event.dataTransfer?.files?.[0]
    if (!droppedFile) return
    if (!droppedFile.type.startsWith('audio/')) {
      setError('请拖入音频文件，例如 mp3、wav、m4a。')
      return
    }
    loadAudioSource(droppedFile, null)
  }

  const loadProjects = async () => {
    setProjectsLoading(true)
    try {
      const data = await apiFetch('/api/projects')
      setProjects(data.projects || [])
      setBackendHealthy(true)
    } catch {
      setBackendHealthy(false)
    } finally {
      setProjectsLoading(false)
    }
  }

  const loadSettings = async () => {
    try {
      const data = await apiFetch('/api/settings')
      setSettings(data.settings || {})
      setBackendHealthy(true)
    } catch {
      setBackendHealthy(false)
    }
  }

  const loadMe = async () => {
    try {
      const data = await apiFetch('/api/me')
      setAuthUser(data.user || null)
      setBackendHealthy(true)
    } catch {
      setAuthUser(null)
    }
  }

  useEffect(() => {
    loadProjects()
    loadSettings()
    loadMe()
  }, [])

  const handleTranscribe = async () => {
    if (!audioFile && !sampleAudio) {
      setError('先上传一段歌曲或钢琴音频。')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const formData = new FormData()
      if (audioFile) {
        formData.append('audio', audioFile)
      } else if (sampleAudio) {
        const sampleResponse = await fetch(sampleAudio.url)
        const sampleBlob = await sampleResponse.blob()
        formData.append('audio', new File([sampleBlob], sampleAudio.name, { type: sampleBlob.type || 'audio/mpeg' }))
      }
      formData.append('bpm', String(bpm))

      const response = await fetch(`${API_BASE}/api/transcribe`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || data.error || '识谱失败')
      setResult(data)
      setBackendHealthy(true)
    } catch (err) {
      setBackendHealthy(false)
      setError(err.message || '识谱失败')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerate = async () => {
    setGenerateLoading(true)
    setGenerateError('')
    setResults([])
    setProgress(14)
    try {
      for (const step of [28, 46, 63, 79]) {
        await new Promise((resolve) => window.setTimeout(resolve, 120))
        setProgress(step)
      }
      const data = await apiFetch('/api/compose/generate', {
        method: 'POST',
        body: JSON.stringify({
          productMode: compose.productMode,
          prompt: compose.prompt,
          mood: compose.mood,
          style: compose.style,
          instrument: compose.instrument,
          key: compose.keyValue,
          duration: compose.duration,
          bpm: compose.bpm,
          creationMode: compose.creationMode,
        }),
      })
      setResults(data.variants || [])
      setProgress(100)
      setBackendHealthy(true)
    } catch (err) {
      setGenerateError(err.message || '生成失败')
      setBackendHealthy(false)
    } finally {
      setGenerateLoading(false)
    }
  }

  const replaceVariant = (currentId, nextVariant) => {
    setResults((prev) => prev.map((item) => (item.id === currentId ? nextVariant : item)))
  }

  const handleVariantAction = async (action, variant) => {
    const pathMap = {
      continue: '/api/compose/continue',
      rearrange: '/api/compose/rearrange',
      expand: '/api/compose/expand',
      remix: '/api/compose/remix',
      chords: '/api/compose/chords',
      restyle: '/api/compose/restyle',
    }
    try {
      setActionLoadingId(`${variant.id}-${action}`)
      const data = await apiFetch(pathMap[action], {
        method: 'POST',
        body: JSON.stringify({
          variant,
          nextStyle: styleOptionsByMode[variant.productMode || compose.productMode || 'piano'][(styleOptionsByMode[variant.productMode || compose.productMode || 'piano'].indexOf(variant.style) + 1) % styleOptionsByMode[variant.productMode || compose.productMode || 'piano'].length],
        }),
      })
      replaceVariant(variant.id, data.variant)
      setBackendHealthy(true)
    } catch (err) {
      setGenerateError(err.message || '操作失败')
      setBackendHealthy(false)
    } finally {
      setActionLoadingId('')
    }
  }

  const handleSaveProject = async () => {
    if (!results.length) {
      setGenerateError('先生成结果，再保存项目。')
      return
    }
    try {
      const data = await apiFetch('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: compose.prompt.slice(0, 18) || '未命名工程',
          type: compose.productMode === 'guitar' ? '吉他创作工程' : 'AI 创作工程',
          version: '版本 1',
          time: '刚刚',
          summary: `${compose.productMode === 'guitar' ? '吉他 Agent' : '钢琴工作站'} · ${compose.style} · ${compose.mood} · ${results.length} 个版本`,
          variantCount: results.length,
          payload: { compose, results },
        }),
      })
      setProjects((prev) => [data.project, ...prev])
      setActiveTab('projects')
    } catch (err) {
      setGenerateError(err.message || '保存项目失败')
    }
  }

  const handleOpenProject = (project) => {
    if (!project.payload?.compose || !project.payload?.results) return
    setCompose(project.payload.compose)
    setResults(project.payload.results)
    setActiveTab('tools')
  }

  const handleRenameProject = async (project) => {
    const nextTitle = window.prompt('输入新的项目名称', project.title)
    if (!nextTitle || nextTitle === project.title) return
    const data = await apiFetch(`/api/projects/${project.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title: nextTitle }),
    })
    setProjects((prev) => prev.map((item) => (item.id === project.id ? data.project : item)))
  }

  const handleDeleteProject = async (project) => {
    await apiFetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    setProjects((prev) => prev.filter((item) => item.id !== project.id))
  }

  const handleDownloadProject = (project) => {
    downloadJson(`${project.title}.json`, project)
  }

  const handleExportMidi = async (variant) => {
    const data = await apiFetch('/api/compose/export-midi', {
      method: 'POST',
      body: JSON.stringify({ variant }),
    })
    triggerDownload(`${API_BASE}${data.midiUrl}`, `${variant.title}.mid`)
  }

  const handleShareProject = async (project) => {
    const summary = `${project.title}\n${project.summary}\n${project.version}`
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(summary)
    }
  }

  const handleRegister = async () => {
    setAuthBusy(true)
    try {
      await apiFetch('/api/register', { method: 'POST', body: JSON.stringify(authForm) })
      await loadMe()
      await loadProjects()
      await loadSettings()
    } finally {
      setAuthBusy(false)
    }
  }

  const handleLogin = async () => {
    setAuthBusy(true)
    try {
      await apiFetch('/api/login', { method: 'POST', body: JSON.stringify(authForm) })
      await loadMe()
      await loadProjects()
      await loadSettings()
    } finally {
      setAuthBusy(false)
    }
  }

  const handleLogout = async () => {
    setAuthBusy(true)
    try {
      await apiFetch('/api/logout', { method: 'POST', body: JSON.stringify({}) })
      setAuthUser(null)
      await loadProjects()
      await loadSettings()
    } finally {
      setAuthBusy(false)
    }
  }

  const handleSaveSettings = async (nextSettings, persist = true) => {
    setSettings(nextSettings)
    if (!persist) return
    setSettingsBusy(true)
    try {
      const data = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(nextSettings),
      })
      setSettings(data.settings || nextSettings)
    } finally {
      setSettingsBusy(false)
    }
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'home':
        return <HomePage onJump={setActiveTab} backendHealthy={backendHealthy} projectCount={projects.length} />
      case 'core':
        return (
          <CorePage
            audioFile={audioFile}
            audioUrl={audioUrl}
            bpm={bpm}
            setBpm={setBpm}
            loading={loading}
            error={error}
            result={result}
            onAudioChange={handleAudioChange}
            onTranscribe={handleTranscribe}
            dragActive={dragActive}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        )
      case 'tools':
        return (
          <ToolsPage
            backendHealthy={backendHealthy}
            compose={compose}
            setCompose={setCompose}
            results={results}
            activePreview={activePreview}
            setActivePreview={setActivePreview}
            generateLoading={generateLoading}
            progress={progress}
            actionLoadingId={actionLoadingId}
            generateError={generateError}
            player={player}
            onGenerate={handleGenerate}
            onAction={handleVariantAction}
            onExportMidi={handleExportMidi}
            onSaveProject={handleSaveProject}
          />
        )
      case 'projects':
        return (
          <ProjectsPage
            projects={projects}
            projectsLoading={projectsLoading}
            onRefresh={loadProjects}
            onOpenProject={handleOpenProject}
            onRenameProject={handleRenameProject}
            onDeleteProject={handleDeleteProject}
            onDownloadProject={handleDownloadProject}
            onShareProject={handleShareProject}
          />
        )
      case 'settings':
        return (
          <SettingsPage
            authUser={authUser}
            settings={settings}
            authForm={authForm}
            setAuthForm={setAuthForm}
            authBusy={authBusy}
            settingsBusy={settingsBusy}
            onRegister={handleRegister}
            onLogin={handleLogin}
            onLogout={handleLogout}
            onSaveSettings={handleSaveSettings}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="app-shell">
      <div className="bg-blur bg-blur-a" />
      <div className="bg-blur bg-blur-b" />
      <main className="app-frame">
        <AppHeader authUser={authUser} backendHealthy={backendHealthy} />
        <motion.div key={activeTab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="page-host">
          {renderPage()}
        </motion.div>
      </main>
      <BottomNav activeTab={activeTab} onChange={setActiveTab} />
    </div>
  )
}
