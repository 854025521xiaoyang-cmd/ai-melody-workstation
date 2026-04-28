import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import * as Tone from 'tone'
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Mic,
  Music4,
  Pause,
  Piano,
  Play,
  RefreshCw,
  Shuffle,
  Sparkles,
  Volume2,
  Wand2,
} from 'lucide-react'

const styles = ['流行', '民谣', '摇滚', '爵士', '布鲁斯', '拉丁']
const instruments = ['钢琴', '吉他', '弦乐', 'Synth', 'Pad', 'Bell', 'Soft EP']
const keys = ['C major', 'A minor', 'D minor', 'G major']
const durations = ['2小节', '4小节']
const timeSignatures = ['2/4', '4/4', '3/4', '6/8']
const tempoOptions = [60, 72, 84, 96, 108, 120, 132, 144]

const tagBank = [
  '治愈', '副歌感', '深夜', '海边', '下雨', '电影感', '梦幻', '韩剧OST', '游乐园感', '首尔夜晚',
  '孤独', '甜感', '失落', '温柔', '城市夜景', '夏天', '公路', '青春', '舞台感', '复古',
  '轻快', '暗色', '告白', '雨后', '日落', '桥段', '主歌', '预副歌', '记忆点', '氛围感',
  '松弛', '热烈', '浪漫', '摇摆', '蓝调', '拉丁律动', '民谣叙事', '摇滚推进', '爵士和声', '钢琴独奏',
]

const initialTags = tagBank.slice(0, 15)

const scales = {
  'C major': ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
  'A minor': ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'],
  'D minor': ['D4', 'E4', 'F4', 'G4', 'A4', 'Bb4', 'C5', 'D5'],
  'G major': ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4'],
}

const chordMap = {
  'C major': [['C3', 'E3', 'G3'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'], ['A3', 'C4', 'E4']],
  'A minor': [['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['C3', 'E3', 'G3'], ['G2', 'B2', 'D3']],
  'D minor': [['D3', 'F3', 'A3'], ['Bb2', 'D3', 'F3'], ['F3', 'A3', 'C4'], ['C3', 'E3', 'G3']],
  'G major': [['G2', 'B2', 'D3'], ['C3', 'E3', 'G3'], ['D3', 'F#3', 'A3'], ['E3', 'G3', 'B3']],
}

const styleIdeas = {
  流行: [
    ['City Pop Motif', '主歌记忆点', '旋律线清楚，适合继续发展成完整流行段落。'],
    ['Bright Hook Sketch', '更适合副歌', '音程更抓耳，适合放在歌曲高点。'],
    ['Late Night Verse', '情绪铺垫', '更松弛，适合主歌或过门使用。'],
  ],
  民谣: [
    ['Wooden Storyline', '民谣叙事', '旋律更像一句自然的口语表达。'],
    ['Warm Road Verse', '公路感', '适合吉他或钢琴轻伴奏。'],
    ['Soft Campfire', '温柔段落', '更适合安静的主歌或桥段。'],
  ],
  摇滚: [
    ['Neon Drive Riff', '推进感', '节奏更向前，适合鼓组进入。'],
    ['Stage Hook', '舞台感', '音符更有冲击力，适合副歌。'],
    ['Electric Verse', '预副歌动机', '适合从主歌推向副歌。'],
  ],
  爵士: [
    ['Blue Corner', '爵士和声感', '旋律有轻微摇摆，适合钢琴 trio 氛围。'],
    ['Velvet Walk', '松弛律动', '适合中速 groove。'],
    ['Moon Club Line', '夜色感', '可以继续发展成 AABA 结构。'],
  ],
  布鲁斯: [
    ['Rainy Blues Phrase', '蓝调句式', '音符更克制，适合问答式旋律。'],
    ['Slow Street Hook', '失落感', '适合低速蓝调段落。'],
    ['Dusty Turnaround', '转折句', '适合接到下一段主歌。'],
  ],
  拉丁: [
    ['Sunset Latin Line', '拉丁律动', '切分更明显，适合加入打击乐。'],
    ['Warm Island Hook', '热带感', '旋律更轻快，适合副歌。'],
    ['Night Salsa Motif', '舞动感', '适合做重复动机。'],
  ],
}

function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function mulberry32(a) {
  return function next() {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function getBarsFromDuration(duration) {
  return duration === '4小节' ? 4 : 2
}

function inferMood(prompt) {
  if (/失落|孤独|雨|下雨|深夜|蓝调/.test(prompt)) return '忧伤'
  if (/热烈|舞台|摇滚|拉丁|轻快|夏天/.test(prompt)) return '轻快'
  if (/浪漫|告白|甜|温柔/.test(prompt)) return '浪漫'
  if (/梦幻|电影|夜景|氛围/.test(prompt)) return '梦幻'
  return '温柔'
}

function inferGenerationSettings(prompt, style, instrument) {
  const seed = hashString(`${prompt}-${style}-${instrument}`)
  const baseTempo = { 流行: 96, 民谣: 84, 摇滚: 120, 爵士: 92, 布鲁斯: 78, 拉丁: 112 }[style] || 96
  return {
    mood: inferMood(prompt),
    key: keys[seed % keys.length],
    bpm: clamp(baseTempo + ((seed % 5) - 2) * 6, 60, 144),
  }
}

function pickDurations(style, bpmValue = 90) {
  if (bpmValue <= 78) return ['2n', '4n', '4n', '2n']
  if (bpmValue >= 112) {
    if (style === '拉丁') return ['8n', '16n', '8n', '16n', '4n', '8n']
    if (style === '摇滚') return ['8n', '8n', '16n', '8n', '4n']
    return ['16n', '8n', '16n', '8n', '4n']
  }
  if (style === '爵士') return ['8n', '4n', '8n', '8n']
  if (style === '民谣') return ['4n', '4n', '8n', '4n']
  return ['4n', '8n', '8n', '4n']
}

function generateSequence({ prompt, mood, style, bpm, instrument, key, variantIndex, bars }) {
  const scale = scales[key] || scales['A minor']
  const seed = hashString(`${prompt}-${mood}-${style}-${instrument}-${key}-${variantIndex}-${bpm}-${bars}`)
  const rand = mulberry32(seed)
  const durations = pickDurations(style, bpm)
  const noteCountBase = style === '摇滚' || style === '拉丁' ? 5 : style === '布鲁斯' ? 3 : 4
  const tempoBoost = bpm >= 112 ? 2 : bpm <= 78 ? -1 : 0
  const noteCount = Math.max(5, bars * Math.max(2, noteCountBase + tempoBoost) + variantIndex)
  const contourBias = mood === '忧伤' ? -0.16 : mood === '轻快' ? 0.18 : mood === '浪漫' ? 0.08 : 0
  const tempoEnergy = bpm <= 78 ? -0.1 : bpm >= 112 ? 0.18 : 0
  const sequences = []
  let currentIndex = Math.floor(scale.length / 2) - 1 + Math.floor(rand() * 2)

  for (let i = 0; i < noteCount; i += 1) {
    const jump = rand() < 0.2 + tempoEnergy ? 2 : 1
    const direction = rand() + contourBias + tempoEnergy * 0.35 > 0.5 ? 1 : -1
    currentIndex = clamp(currentIndex + direction * jump, 0, scale.length - 1)
    if (style === '流行' && i % 4 === 0) currentIndex = [2, 4, 5][Math.floor(rand() * 3)]
    if (style === '布鲁斯' && i % 5 === 4) currentIndex = Math.max(0, currentIndex - 1)
    if (style === '拉丁' && i % 3 === 2) currentIndex = Math.min(scale.length - 1, currentIndex + 1)
    sequences.push({
      note: scale[currentIndex],
      duration: durations[i % durations.length],
      velocity: clamp(0.56 + Math.max(0, tempoEnergy) + rand() * 0.22, 0.48, 0.96),
    })
  }

  return { sequences, chords: buildChords(key, bars) }
}

function buildChords(key, bars) {
  const chords = chordMap[key] || chordMap['A minor']
  return Array.from({ length: bars }).map((_, idx) => ({
    chord: chords[idx % chords.length],
    startBeat: idx * 2,
    duration: '2n',
  }))
}

function composeMelodyFromStructure(structure, key) {
  const sequences = structure.flatMap((segment) => segment.notes)
  const chords = []
  let offset = 0
  structure.forEach((segment) => {
    buildChords(key, segment.bars).forEach((chord) => chords.push({ ...chord, startBeat: chord.startBeat + offset }))
    offset += segment.bars * 2
  })
  return { sequences, chords }
}

function buildStructureFromMelody(melody, bars) {
  return [{ id: 'motif', name: '旋律草稿', bars, notes: melody.sequences }]
}

function buildVariants(prompt, style, instrument, duration, timeSignature, selectedTags) {
  const fullPrompt = [prompt, ...selectedTags].filter(Boolean).join('，')
  const inferred = inferGenerationSettings(fullPrompt, style, instrument)
  const bars = getBarsFromDuration(duration)
  const ideas = styleIdeas[style] || styleIdeas.流行

  return ideas.map(([title, tag, desc], i) => {
    const bpm = clamp(inferred.bpm + (i - 1) * 10, 60, 144)
    const key = keys[(keys.indexOf(inferred.key) + i) % keys.length]
    const melody = generateSequence({ prompt: fullPrompt, mood: inferred.mood, style, bpm, instrument, key, variantIndex: i, bars })
    const structure = buildStructureFromMelody(melody, bars)
    return {
      id: `${hashString(`${fullPrompt}-${style}-${instrument}-${duration}-${timeSignature}-${i}`)}-${i}`,
      title,
      tag,
      desc,
      bars,
      bpm,
      style,
      mood: inferred.mood,
      instrument,
      key,
      timeSignature,
      confidence: 82 + i * 4,
      aiHint: ['AI 建议：适合先保留这个动机，再做歌词与和弦。', 'AI 建议：副歌可以抬高一个八度。', 'AI 建议：可以作为过门或情绪铺垫。'][i],
      melody,
      baseMelody: melody,
      basePrompt: fullPrompt,
      baseBars: bars,
      structure,
      sourceMode: '生成',
      chorded: false,
      lyrics: null,
      rewriteCount: 0,
    }
  })
}

function continueVariant(variant) {
  const nextCount = (variant.rewriteCount || 0) + 1
  const basePrompt = variant.basePrompt || variant.title
  const usePreChorus = hashString(`${variant.id}-${nextCount}`) % 2 === 0
  const sectionNames = usePreChorus ? ['主歌', '预副歌', '副歌'] : ['主歌', '副歌']
  const sectionBars = usePreChorus
    ? [variant.baseBars, Math.max(1, Math.floor(variant.baseBars / 2)), variant.baseBars]
    : [variant.baseBars, variant.baseBars]
  const structure = sectionNames.map((name, idx) => {
    const bars = sectionBars[idx]
    const melody = idx === 0
      ? variant.baseMelody
      : generateSequence({
          prompt: `${basePrompt}-${name}-${nextCount}`,
          mood: variant.mood,
          style: variant.style,
          bpm: clamp(variant.bpm + idx * 8, 60, 144),
          instrument: variant.instrument,
          key: variant.key,
          variantIndex: hashString(`${variant.id}-${name}-${nextCount}`) % 11,
          bars,
        })
    return { id: `${name}-${idx}`, name, bars, notes: melody.sequences }
  })

  return {
    ...variant,
    id: `${variant.id.split('-cont')[0]}-cont-${nextCount}`,
    tag: usePreChorus ? '主歌+预副歌+副歌' : '主歌+副歌',
    desc: '已基于原始旋律生成歌曲结构，再次续写会重新生成结构而不是继续累加。',
    bars: sectionBars.reduce((sum, item) => sum + item, 0),
    aiHint: 'AI 已完成结构续写：每个分句按段落单独显示，可点选分句后做局部 AI 改编。',
    melody: composeMelodyFromStructure(structure, variant.key),
    structure,
    sourceMode: '续写',
    rewriteCount: nextCount,
  }
}

function rearrangePhrase(variant, phraseIndex) {
  const structure = variant.structure.map((segment, idx) => {
    if (idx !== phraseIndex) return segment
    const melody = generateSequence({
      prompt: `${variant.basePrompt}-${segment.name}-phrase-rewrite-${variant.rewriteCount || 0}`,
      mood: variant.mood === '忧伤' ? '浪漫' : variant.mood,
      style: variant.style,
      bpm: variant.bpm,
      instrument: variant.instrument,
      key: variant.key,
      variantIndex: hashString(`${variant.id}-${phraseIndex}-phrase`) % 13,
      bars: segment.bars,
    })
    return { ...segment, notes: melody.sequences, name: `${segment.name} · 改编` }
  })
  return {
    ...variant,
    tag: '局部已改编',
    desc: '已仅改编选中的分句，其他结构保持不变。',
    melody: composeMelodyFromStructure(structure, variant.key),
    structure,
  }
}

function addChordsToVariant(variant) {
  return {
    ...variant,
    chorded: true,
    aiHint: 'AI 已完成配和弦：和弦层已显示在钢琴卷帘窗底部。',
  }
}

function makeLyricLine(prompt, tags, sectionName, index) {
  const source = `${prompt} ${tags.join(' ')}`
  const moodWord = source.match(/深夜|下雨|海边|游乐园|青春|告白|孤独|温柔|热烈|日落/)?.[0] || '旋律'
  const endings = ['慢慢靠近', '留在心底', '照亮夜色', '变成回忆']
  return `${sectionName} ${index + 1}：把${moodWord}唱成一句${endings[index % endings.length]}`
}

function addLyricsToVariant(variant, prompt, selectedTags) {
  const lyrics = variant.structure.map((segment, idx) => ({
    section: segment.name,
    lines: [makeLyricLine(prompt, selectedTags, segment.name, idx), makeLyricLine(prompt, selectedTags, segment.name, idx + 1)],
  }))
  return { ...variant, lyrics, aiHint: 'AI 已根据灵感输入生成旋律歌词，可继续调整提示词后重新生成。' }
}

function noteToMidi(note) {
  const match = note.match(/^([A-G])([#b]?)(\d)$/)
  if (!match) return 60
  const [, letter, accidental, octaveText] = match
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter]
  const offset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0
  return (Number(octaveText) + 1) * 12 + base + offset
}

function durationToTicks(duration) {
  return { '16n': 120, '8n': 240, '4n': 480, '2n': 960, '1n': 1920 }[duration] || 480
}

function writeVarLen(value) {
  let buffer = value & 0x7f
  const bytes = []
  while ((value >>= 7)) {
    buffer <<= 8
    buffer |= ((value & 0x7f) | 0x80)
  }
  while (true) {
    bytes.push(buffer & 0xff)
    if (buffer & 0x80) buffer >>= 8
    else break
  }
  return bytes
}

function textBytes(text) {
  return Array.from(new TextEncoder().encode(text))
}

function createMidiBytes(variant) {
  const track = []
  const tempo = Math.round(60000000 / variant.bpm)
  const [numerator, denominatorText] = variant.timeSignature.split('/').map(Number)
  const denominatorPower = Math.log2(denominatorText)
  track.push(0x00, 0xff, 0x51, 0x03, (tempo >> 16) & 0xff, (tempo >> 8) & 0xff, tempo & 0xff)
  track.push(0x00, 0xff, 0x58, 0x04, numerator, denominatorPower, 24, 8)
  const name = textBytes(variant.title)
  track.push(0x00, 0xff, 0x03, name.length, ...name)
  variant.melody.sequences.forEach((item) => {
    const midi = noteToMidi(item.note)
    const ticks = durationToTicks(item.duration)
    track.push(0x00, 0x90, midi, Math.round(item.velocity * 100))
    track.push(...writeVarLen(ticks), 0x80, midi, 0x40)
  })
  track.push(0x00, 0xff, 0x2f, 0x00)
  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0]
  const trackHeader = [0x4d, 0x54, 0x72, 0x6b, (track.length >> 24) & 0xff, (track.length >> 16) & 0xff, (track.length >> 8) & 0xff, track.length & 0xff]
  return new Uint8Array([...header, ...trackHeader, ...track])
}

function downloadMidi(variant) {
  const blob = new Blob([createMidiBytes(variant)], { type: 'audio/midi' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${variant.title.replace(/\s+/g, '-')}.mid`
  link.click()
  URL.revokeObjectURL(url)
}

function runSelfChecks() {
  const variants = buildVariants('demo', '流行', '钢琴', '2小节', '4/4', ['治愈'])
  return [
    { name: 'hashString returns a number', pass: typeof hashString('demo') === 'number' },
    { name: 'buildVariants returns 3 variants', pass: variants.length === 3 },
    { name: 'MIDI export creates bytes', pass: createMidiBytes(variants[0]).length > 40 },
  ]
}

function Chip({ children }) {
  return <span className="chip">{children}</span>
}

function PianoRoll({ variant, selectedPhraseKey, onSelectPhrase, onPhraseRearrange }) {
  return (
    <div className="roll-sections">
      {variant.structure.map((segment, segmentIndex) => {
        const phraseKey = `${variant.id}-${segmentIndex}`
        const selected = selectedPhraseKey === phraseKey
        return (
          <div key={`${segment.id}-${segmentIndex}`} className={`phrase-row ${selected ? 'phrase-selected' : ''}`}>
            <div className="phrase-header">
              <button className="phrase-label" onClick={() => onSelectPhrase(phraseKey)}>
                {segment.name} · {segment.bars}小节
              </button>
              {selected && variant.structure.length > 1 && (
                <button className="mini-action" onClick={() => onPhraseRearrange(variant, segmentIndex)}>AI 改编</button>
              )}
            </div>
            <div className="roll-box">
              <div className="bar-axis">{Array.from({ length: segment.bars }).map((_, i) => <span key={i}>{i + 1}</span>)}</div>
              <div className="roll-grid" style={{ gridTemplateColumns: `repeat(${segment.bars}, 1fr)` }}>
                {Array.from({ length: segment.bars * 4 }).map((_, i) => <div key={i} className="roll-cell" />)}
              </div>
              {noteToPreview(segment.notes).map((note, i) => (
                <div key={`${note.left}-${i}`} className="roll-note" style={{ left: `${note.left}%`, top: `${note.top}%`, width: `${note.width}%` }} />
              ))}
              {variant.chorded && (
                <div className="chord-lane">
                  {Array.from({ length: segment.bars }).map((_, i) => <span key={i}>Chord {i + 1}</span>)}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function noteToPreview(notes) {
  const pitchOrder = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
  return notes.map((item, i) => {
    const noteName = item.note.replace('#', '').replace('b', '')
    const octave = Number(item.note.slice(-1))
    const letter = noteName[0]
    const pitchIndex = pitchOrder.indexOf(letter)
    const noteWidth = item.duration === '2n' ? 14 : item.duration === '4n' ? 9 : item.duration === '8n' ? 6 : 4
    return {
      left: 2 + (i * 92) / Math.max(1, notes.length),
      top: clamp(54 - ((octave - 3) * 10 + pitchIndex * 3), 12, 70),
      width: noteWidth,
    }
  })
}

export default function App() {
  const [prompt, setPrompt] = useState('做一段韩系抒情、像深夜游乐园灯光一样温柔的钢琴旋律')
  const [style, setStyle] = useState('流行')
  const [instrument, setInstrument] = useState('钢琴')
  const [duration, setDuration] = useState('2小节')
  const [timeSignature, setTimeSignature] = useState('4/4')
  const [tagPool, setTagPool] = useState(initialTags)
  const [selectedTags, setSelectedTags] = useState(['治愈'])
  const [recordingStatus, setRecordingStatus] = useState('未录入音频灵感')
  const [recordedAudioUrl, setRecordedAudioUrl] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(10)
  const [results, setResults] = useState([])
  const [playingId, setPlayingId] = useState(null)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [sampleStatus, setSampleStatus] = useState('未加载')
  const [sampleMode, setSampleMode] = useState('fallback')
  const [actionLoadingId, setActionLoadingId] = useState('')
  const [selectedPhraseKey, setSelectedPhraseKey] = useState('')

  const checks = useMemo(() => runSelfChecks(), [])
  const currentPartRef = useRef(null)
  const currentChordPartRef = useRef(null)
  const stopTimerRef = useRef(null)
  const pianoSamplerRef = useRef(null)
  const musicBoxSamplerRef = useRef(null)
  const leadSynthRef = useRef(null)
  const bellSynthRef = useRef(null)
  const padSynthRef = useRef(null)
  const bassSynthRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    const reverb = new Tone.Reverb({ decay: 4.5, wet: 0.28 }).toDestination()
    const delay = new Tone.FeedbackDelay('8n', 0.16).connect(reverb)
    const pianoSampler = new Tone.Sampler({
      urls: {
        A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
        A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
        A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', A4: 'A4.mp3',
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
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop())
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

  const playLead = (note, durationValue, time, velocityValue) => {
    const useSampler = sampleMode === 'samples' && pianoSamplerRef.current?.loaded
    if (useSampler) pianoSamplerRef.current.triggerAttackRelease(note, durationValue, time, velocityValue)
    else leadSynthRef.current?.triggerAttackRelease(note, durationValue, time, velocityValue)
  }

  const playAccent = (note, durationValue, time, velocityValue) => {
    const useSampler = sampleMode === 'samples' && musicBoxSamplerRef.current?.loaded
    if (useSampler) musicBoxSamplerRef.current.triggerAttackRelease(note, durationValue, time, velocityValue)
    else bellSynthRef.current?.triggerAttackRelease(note, durationValue, time, velocityValue)
  }

  const playVariant = async (variant) => {
    await ensureAudio()
    if (playingId === variant.id) return stopPlayback()
    stopPlayback()
    Tone.Transport.bpm.value = variant.bpm
    let currentTime = 0
    const events = variant.melody.sequences.map((item) => {
      const event = { time: currentTime, note: item.note, duration: item.duration, velocity: item.velocity }
      currentTime += Tone.Time(item.duration).toSeconds()
      return event
    })
    const chordEvents = variant.melody.chords.map((item) => ({
      time: Tone.Time(`${Math.max(1, item.startBeat + 1)}n`).toSeconds(),
      chord: item.chord,
      bass: item.chord[0],
      duration: item.duration,
    }))
    currentPartRef.current = new Tone.Part((time, value) => {
      playLead(value.note, value.duration, time, value.velocity)
      if (variant.chorded) playAccent(value.note, variant.bpm <= 76 ? '8n' : '16n', time + 0.05, 0.05)
    }, events).start(0)
    currentChordPartRef.current = new Tone.Part((time, value) => {
      if (!variant.chorded) return
      padSynthRef.current?.triggerAttackRelease(value.chord, value.duration, time, 0.2)
      bassSynthRef.current?.triggerAttackRelease([value.bass], variant.bpm <= 80 ? '2n' : '1n', time, 0.12)
    }, chordEvents).start(0)
    Tone.Transport.start()
    setPlayingId(variant.id)
    stopTimerRef.current = window.setTimeout(() => stopPlayback(), (currentTime + 1) * 1000)
  }

  const handleToggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      setIsRecording(false)
      setRecordingStatus('音频灵感已录入，可作为本次生成参考')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setRecordingStatus('当前浏览器不支持麦克风录入')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl)
        setRecordedAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((track) => track.stop())
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
      setRecordingStatus('正在录入电脑麦克风音频…')
    } catch {
      setRecordingStatus('麦克风未授权或不可用')
    }
  }

  const toggleTag = (tag) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]))
  }

  const randomizeTags = () => {
    const locked = selectedTags.filter((tag) => tagPool.includes(tag))
    const remaining = tagBank.filter((tag) => !locked.includes(tag))
    const rand = mulberry32(hashString(`${Date.now()}-${locked.join('-')}`))
    const shuffled = [...remaining].sort(() => rand() - 0.5)
    setTagPool([...locked, ...shuffled.slice(0, Math.max(0, 15 - locked.length))])
  }

  const handleGenerate = async () => {
    setLoading(true)
    setResults([])
    setSelectedPhraseKey('')
    setProgress(14)
    for (const step of [28, 46, 63, 79, 100]) {
      await new Promise((resolve) => setTimeout(resolve, 160))
      setProgress(step)
    }
    setResults(buildVariants(prompt, style, instrument, duration, timeSignature, selectedTags))
    setLoading(false)
  }

  const handleContinueWrite = async (variant) => {
    setActionLoadingId(`${variant.id}-continue`)
    await new Promise((resolve) => setTimeout(resolve, 300))
    const nextVariant = continueVariant(variant)
    setResults((prev) => prev.map((item) => (item.id === variant.id ? nextVariant : item)))
    setSelectedPhraseKey('')
    setActionLoadingId('')
  }

  const handlePhraseRearrange = async (variant, phraseIndex) => {
    setActionLoadingId(`${variant.id}-phrase-${phraseIndex}`)
    await new Promise((resolve) => setTimeout(resolve, 300))
    const nextVariant = rearrangePhrase(variant, phraseIndex)
    setResults((prev) => prev.map((item) => (item.id === variant.id ? nextVariant : item)))
    setActionLoadingId('')
  }

  const updateVariantSettings = (variantId, patch) => {
    setResults((prev) => prev.map((item) => {
      if (item.id !== variantId) return item
      const next = { ...item, ...patch }
      const structure = item.structure.map((segment, idx) => {
        const melody = generateSequence({
          prompt: `${next.basePrompt}-${segment.name}`,
          mood: next.mood,
          style: next.style,
          bpm: next.bpm,
          instrument: next.instrument,
          key: next.key,
          variantIndex: hashString(`${next.id}-${idx}-${next.key}-${next.bpm}`) % 17,
          bars: segment.bars,
        })
        return { ...segment, notes: melody.sequences }
      })
      return { ...next, structure, melody: composeMelodyFromStructure(structure, next.key), baseMelody: structure[0] ? { sequences: structure[0].notes, chords: buildChords(next.key, structure[0].bars) } : next.baseMelody }
    }))
  }

  const updateVariant = (variantId, updater) => {
    setResults((prev) => prev.map((item) => (item.id === variantId ? updater(item) : item)))
  }

  return (
    <div className="page">
      <div className="container">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="hero-grid">
          <div className="hero-card gradient-card">
            <div className="inline-row dim"><Sparkles size={16} /> AI 生成 + AI 辅助创作</div>
            <h1>AI 旋律共创 Demo</h1>
            <p>输入文字或录入一段电脑麦克风音频，系统会先生成 MIDI 旋律，再支持续写、配和弦、配歌词与导出 MIDI。</p>
            <div className="chip-row">
              <Chip>文字灵感</Chip>
              <Chip>音频灵感</Chip>
              <Chip>MIDI 结果</Chip>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="inline-row"><Bot size={18} /> AI 创作状态</div>
              <div className="subtle">先让旋律模块稳定可用</div>
            </div>
            <div className="panel-body stack-md">
              <div className="info-box">
                <div className="row-between"><span>AI 解析灵感</span><span className="muted">已开启</span></div>
                <div className="row-between"><span>旋律真实试听</span><span className="ok">可播放</span></div>
                <div className="row-between"><span>播放引擎</span><span className="muted">采样优先 / 合成兜底</span></div>
              </div>
              <button className="primary-btn full" onClick={ensureAudio}><Volume2 size={16} /> {audioUnlocked ? '音频已就绪' : '先启用音频'}</button>
              <div className="status-box">当前音色状态：<span className="ok">{sampleStatus}</span></div>
              <div className="status-box">
                自检结果：
                <div className="stack-sm top-gap">
                  {checks.map((check) => (
                    <div key={check.name} className="inline-row">{check.pass ? <CheckCircle2 size={14} className="ok-icon" /> : <AlertCircle size={14} className="bad-icon" />} <span>{check.name}</span></div>
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
              <div className="subtle">用户给意图，系统真实生成旋律</div>
            </div>
            <div className="panel-body stack-lg">
              <div>
                <div className="helper-text">提示：当前算法会优先识别场景、情绪、速度感和风格词。写得越像“画面 + 情绪 + 用途”，生成越稳定；也可以用下方词汇补充灵感。</div>
                <input value={prompt} onChange={(event) => setPrompt(event.target.value)} className="text-input top-gap" placeholder="例如：夜晚城市、轻微失落、适合主歌进入副歌的钢琴旋律" />
              </div>

              <div className="audio-input">
                <button className={`secondary-btn ${isRecording ? 'recording' : ''}`} onClick={handleToggleRecording}><Mic size={16} /> {isRecording ? '停止录入' : '录入音频灵感'}</button>
                <span className="tiny">{recordingStatus}</span>
                {recordedAudioUrl && <audio controls src={recordedAudioUrl} />}
              </div>

              <div>
                <div className="row-between">
                  <span className="subtle">灵感词汇（每次 15 个，选中词会保留）</span>
                  <button className="secondary-btn compact-btn" onClick={randomizeTags}><Shuffle size={15} /> 随机词汇</button>
                </div>
                <div className="chip-row top-gap">
                  {tagPool.map((tag) => (
                    <button key={tag} className={`tag-btn ${selectedTags.includes(tag) ? 'tag-active' : ''}`} onClick={() => toggleTag(tag)}>{tag}</button>
                  ))}
                </div>
              </div>

              <div className="form-grid">
                <label className="field"><span>风格</span><select value={style} onChange={(event) => setStyle(event.target.value)}>{styles.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="field"><span>乐器</span><select value={instrument} onChange={(event) => setInstrument(event.target.value)}>{instruments.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="field"><span>时长</span><select value={duration} onChange={(event) => setDuration(event.target.value)}>{durations.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="field"><span>拍号</span><select value={timeSignature} onChange={(event) => setTimeSignature(event.target.value)}>{timeSignatures.map((item) => <option key={item}>{item}</option>)}</select></label>
              </div>

              <div className="button-row">
                <button className="primary-btn flex-1" onClick={handleGenerate} disabled={loading}>{loading ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />} {loading ? '正在生成...' : '生成旋律'}</button>
              </div>

              <div className="status-box">
                <div className="row-between"><span>生成进度</span><span>{progress}%</span></div>
                <div className="progress"><div className="progress-inner" style={{ width: `${progress}%` }} /></div>
                <div className="tiny top-gap">{loading ? '正在解析灵感、推断调式速度并生成 MIDI 旋律…' : '点击后将生成 3 个可真实试听的 MIDI 旋律版本。'}</div>
              </div>
            </div>
          </div>

          <div className="stack-lg">
            <div className="panel">
              <div className="panel-header row-between header-gap">
                <div className="inline-row"><Music4 size={18} /> 生成结果</div>
              </div>
              <div className="panel-body">
                {results.length === 0 ? (
                  <div className="empty-box">还没有生成结果。先输入灵感，然后点「生成旋律」。</div>
                ) : (
                  <div className="stack-md">
                    <div className="accent-box">已生成 <strong>3 个 MIDI 旋律版本</strong>。图示为钢琴卷帘窗，保留小节轴并隐藏音高轴。</div>
                    {results.map((item, idx) => (
                      <motion.div key={item.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }} className="result-card">
                        <div className="row-between header-gap">
                          <div>
                            <div className="inline-wrap">
                              <h3 className="result-title">{item.title}</h3>
                              <Chip>{item.tag}</Chip>
                              <Chip>可试听</Chip>
                            </div>
                            <div className="result-controls top-gap-xs">
                              <label className="mini-field"><span>调式</span><select value={item.key} onChange={(event) => updateVariantSettings(item.id, { key: event.target.value })}>{keys.map((key) => <option key={key}>{key}</option>)}</select></label>
                              <label className="mini-field"><span>速度</span><select value={item.bpm} onChange={(event) => updateVariantSettings(item.id, { bpm: Number(event.target.value) })}>{tempoOptions.map((tempo) => <option key={tempo} value={tempo}>{tempo} BPM</option>)}</select></label>
                            </div>
                          </div>
                          <button className="play-btn" onClick={() => playVariant(item)}>{playingId === item.id ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}</button>
                        </div>

                        <PianoRoll
                          variant={item}
                          selectedPhraseKey={selectedPhraseKey}
                          onSelectPhrase={setSelectedPhraseKey}
                          onPhraseRearrange={handlePhraseRearrange}
                        />

                        <div className="result-meta">
                          <div>
                            <p className="muted-text">{item.desc}</p>
                            <p className="hint-text top-gap-xs">{item.aiHint}</p>
                          </div>
                          <div className="status-pill">匹配度 <strong>{item.confidence}%</strong></div>
                        </div>

                        {item.lyrics && (
                          <div className="lyrics-box">
                            {item.lyrics.map((section) => (
                              <div key={section.section}>
                                <strong>{section.section}</strong>
                                {section.lines.map((line) => <div key={line}>{line}</div>)}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="button-wrap top-gap">
                          <button className="secondary-btn" onClick={() => handleContinueWrite(item)} disabled={Boolean(actionLoadingId)}><Wand2 size={16} /> {actionLoadingId === `${item.id}-continue` ? 'AI 续写中...' : 'AI 续写'}</button>
                          <button className="secondary-btn" onClick={() => updateVariant(item.id, addChordsToVariant)}><Piano size={16} /> AI 配和弦</button>
                          <button className="secondary-btn" onClick={() => updateVariant(item.id, (variant) => addLyricsToVariant(variant, prompt, selectedTags))}><FileText size={16} /> 为旋律配歌词</button>
                          <button className="secondary-btn" onClick={() => downloadMidi(item)}><Download size={16} /> 导出 MIDI</button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-body suggestion-grid">
                {[
                  '哼唱/旋律创作：先出旋律，再补歌词，再补伴奏。',
                  '作词创作：先出歌词，再补旋律，再补伴奏。',
                  '大师创作：先出完整草稿，再做局部编辑，最后进入歌曲详情/演奏。',
                ].map((tip) => (
                  <div key={tip} className="suggestion-card"><div className="inline-row"><ChevronRight size={14} /> AI 建议</div><div className="top-gap-xs">{tip}</div></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
