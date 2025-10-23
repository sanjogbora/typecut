"use client"

import type React from "react"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { captureWebMBlob } from "@/utils/capture-webm-blob" // Import captureWebMBlob function
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover" // Updated import
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"

// Utility: curated font list to start; can be expanded or randomized later.
const CURATED_FONTS = [
  "Inter",
  "Roboto",
  "Poppins",
  "Oswald",
  "Merriweather",
  "Montserrat",
  "Space Grotesk",
  "JetBrains Mono",
  "Lora",
  "Work Sans",
]

// Injects Google Fonts CSS and ensures a font is loaded before drawing.
async function ensureGoogleFontLoaded(fontFamily: string) {
  const familyParam = fontFamily.replace(/\s+/g, "+") + ":wght@400"
  const href = `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`

  // Avoid duplicate link tags
  if (!document.querySelector(`link[data-font="${fontFamily}"]`)) {
    const link = document.createElement("link")
    link.setAttribute("rel", "stylesheet")
    link.setAttribute("href", href)
    link.setAttribute("data-font", fontFamily)
    document.head.appendChild(link)
  }

  // Ask CSS Font Loading API to resolve the face by name
  // Use a conservative size to increase success rate
  try {
    await (document as any).fonts.load(`400 48px "${fontFamily}"`)
  } catch {
    // Ignore; canvas will fallback if unavailable
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function normalizeFontName(name: string): string {
  return name.trim().replace(/\s+/g, " ")
}

async function isFontUsable(family: string): Promise<boolean> {
  const fam = normalizeFontName(family)
  try {
    const fonts = (document as any).fonts
    if (fonts?.check) {
      // Quick check: if already available, we're done.
      if (fonts.check(`16px "${fam}"`)) return true
      // Try to load once; if it resolves, check again.
      await fonts.load(`400 16px "${fam}"`)
      return fonts.check(`16px "${fam}"`)
    }
  } catch {
    // If the API throws, assume usable to avoid blocking UI.
  }
  return true
}

async function verifyUsableFonts(fonts: string[]): Promise<string[]> {
  const usable: string[] = []
  for (const name of fonts) {
    try {
      if (await isFontUsable(name)) usable.push(name)
    } catch {
      usable.push(name)
    }
  }
  return usable
}

export default function FontSwitcherCanvas() {
  // Controls
  const [text, setText] = useState("@sanjogsays")
  const [durationSec, setDurationSec] = useState(3) // was 5 → 3s default
  const [switchCount, setSwitchCount] = useState(20) // 2-100
  const [fontSize, setFontSize] = useState(80) // was 120 → 80 default
  const [selectedFonts, setSelectedFonts] = useState<string[]>(CURATED_FONTS.slice(0, 5))
  const [playing, setPlaying] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportKind, setExportKind] = useState<"webm" | "gif" | "ae" | null>(null)
  const [transparentBg, setTransparentBg] = useState(true)
  const [bgColor, setBgColor] = useState("#ffffff")
  const [textColor, setTextColor] = useState("#111111") // new: text color state for drawing and control
  const localFontFamiliesRef = useRef<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [systemFontAccessAllowed, setSystemFontAccessAllowed] = useState(false)
  const [allowSystemFonts, setAllowSystemFonts] = useState(false)
  const [fontSearch, setFontSearch] = useState("")
  const [availableSystemFonts, setAvailableSystemFonts] = useState<string[]>([])
  const [localFontFamilies, setLocalFontFamilies] = useState<string[]>([])
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({})
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  const { toast } = useToast()
  const [sysFontStatus, setSysFontStatus] = useState<
    "idle" | "loading" | "ready" | "denied" | "blocked" | "unsupported" | "error"
  >("idle")

  function detectSystemFontAccessAllowed(): boolean {
    try {
      // @ts-ignore - feature is experimental
      if (typeof window === "undefined" || typeof window.queryLocalFonts !== "function") return false

      const anyDoc = document as any
      // Permissions Policy API (modern)
      const pp = anyDoc?.permissionsPolicy || anyDoc?.featurePolicy
      if (pp?.allowsFeature) {
        try {
          return !!pp.allowsFeature("local-fonts")
        } catch {
          // Some implementations throw on unknown feature; treat as disallowed
          return false
        }
      }

      // If we cannot detect policy support reliably, default to false
      // to avoid runtime errors in embedded/iframe environments.
      return false
    } catch {
      return false
    }
  }

  useEffect(() => {
    setSystemFontAccessAllowed(detectSystemFontAccessAllowed())
  }, [])

  useEffect(() => {
    if (!allowSystemFonts) return

    if (!systemFontAccessAllowed) {
      setSysFontStatus("blocked")
      setAllowSystemFonts(false)
      toast({
        title: "System fonts blocked",
        description:
          "This preview disallows local font access via Permissions Policy. Deploy top-level or enable local-fonts.",
        variant: "destructive",
      })
      return
    }

    // Guard against re-entrancy and duplicate permission prompts
    if (sysFontStatus === "loading" || sysFontStatus === "ready") return
    ;(async () => {
      await loadSystemFontCatalog()
    })()
  }, [allowSystemFonts, systemFontAccessAllowed, sysFontStatus, toast])

  // Canvas references
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const lastFontIndexRef = useRef<number>(-1)

  // Dimensions (CSS pixels). We'll scale for DPR.
  const cssWidth = 640
  const cssHeight = 640

  // Derived
  const msPerSwitch = useMemo(() => {
    const totalMs = durationSec * 1000
    return Math.max(10, Math.floor(totalMs / Math.max(2, switchCount)))
  }, [durationSec, switchCount])

  // Derive effectiveFonts (ensure >=2 by padding with curated if needed)
  const effectiveFonts = useMemo(() => {
    const unique = Array.from(new Set(selectedFonts.map(normalizeFontName)))
    if (unique.length >= 2) return unique
    const pad = CURATED_FONTS.filter((f) => !unique.includes(f))
    return unique.concat(pad).slice(0, Math.max(2, unique.length + pad.length))
  }, [selectedFonts])

  // Build a long enough font sequence to cover switches; loop if needed.
  const fontSequence = useMemo(() => {
    if (effectiveFonts.length < 2) return effectiveFonts
    const base = shuffleArray(effectiveFonts)
    const repeats = Math.ceil((switchCount + 1) / base.length)
    return Array.from({ length: repeats }, () => base).flat()
  }, [effectiveFonts, switchCount])

  // Prepare canvas with DPR scaling
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1))
    canvas.width = cssWidth * dpr
    canvas.height = cssHeight * dpr
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`

    const ctx = canvas.getContext("2d", { alpha: true })
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }, [])

  // Preload selected fonts on change
  useEffect(() => {
    let aborted = false
    ;(async () => {
      for (const f of effectiveFonts) {
        if (aborted) return
        // For curated/web fonts, inject stylesheet then load. For system/local, still warm via fonts.load.
        const isLocalOrSystem = localFontFamiliesRef.current.has(f) || availableSystemFonts.includes(f)
        if (!isLocalOrSystem) {
          await ensureGoogleFontLoaded(f)
        }
        try {
          await (document as any).fonts.load(`400 48px "${f}"`)
        } catch {
          // ignore; canvas will fallback if necessary
        }
      }
    })()
    return () => {
      aborted = true
    }
  }, [effectiveFonts, availableSystemFonts])

  // Warm up the first slice of the sequence (helps when switches > fonts)
  useEffect(() => {
    let cancelled = false
    const uniques = Array.from(new Set(fontSequence)).slice(0, 16)
    ;(async () => {
      for (const f of uniques) {
        if (cancelled) return
        try {
          await (document as any).fonts.load(`400 48px "${f}"`)
        } catch {
          // ignore
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fontSequence])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Preload all fonts in the current sequence
      const uniques = Array.from(new Set(fontSequence)).slice(0, 32)
      for (const f of uniques) {
        if (cancelled) return
        try {
          await (document as any).fonts.load(`400 ${fontSize}px "${f}"`)
        } catch {
          // ignore
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fontSequence, fontSize])

  useEffect(() => {
    if (playing) return
    startRef.current = null
    lastFontIndexRef.current = -1
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        const currentFont = fontSequence[0] || effectiveFonts[0] || "Inter"
        ctx.clearRect(0, 0, cssWidth, cssHeight)
        if (!transparentBg) {
          ctx.fillStyle = bgColor
          ctx.fillRect(0, 0, cssWidth, cssHeight)
        }
        ctx.fillStyle = textColor
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.font = `${fontSize}px "${currentFont}", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`
        ctx.fillText(text, cssWidth / 2, cssHeight / 2)
      }
    }
  }, [fontSequence, transparentBg, bgColor, textColor, fontSize, text, effectiveFonts, playing, cssWidth, cssHeight])

  const drawFrame = useCallback(
    (nowMs: number) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      if (startRef.current == null) startRef.current = nowMs
      const elapsed = nowMs - startRef.current

      // Compute the current font index for this time
      const idx = Math.floor(elapsed / msPerSwitch) % Math.max(1, fontSequence.length)
      const currentFont = fontSequence[idx] || effectiveFonts[0] || "Inter"

      // Clear
      ctx.clearRect(0, 0, cssWidth, cssHeight)

      // Optionally draw an opaque background
      if (!transparentBg) {
        ctx.save()
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, cssWidth, cssHeight)
        ctx.restore()
      }

      // Draw centered text
      ctx.fillStyle = textColor // use text color state
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.font = `${fontSize}px "${currentFont}", system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`

      const x = cssWidth / 2
      const y = cssHeight / 2
      ctx.fillText(text, x, y)

      // Optional subtle indicator if font switched this frame
      if (idx !== lastFontIndexRef.current) {
        lastFontIndexRef.current = idx
        // console.log("[v0] font ->", currentFont)
      }

      // Loop - stop after duration
      if (elapsed < durationSec * 1000 && playing) {
        rafRef.current = requestAnimationFrame(drawFrame)
      } else if (elapsed >= durationSec * 1000 && playing) {
        // Loop from start if still playing
        startRef.current = nowMs
        rafRef.current = requestAnimationFrame(drawFrame)
      }
    },
    [
      cssWidth,
      cssHeight,
      durationSec,
      fontSequence,
      fontSize,
      msPerSwitch,
      playing,
      effectiveFonts,
      text,
      transparentBg,
      bgColor,
      textColor,
    ],
  )

  // Animation lifecycle
  useEffect(() => {
    if (!playing) return
    rafRef.current = requestAnimationFrame(drawFrame)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [drawFrame, playing])

  function handlePlayPause() {
    setPlaying((p) => {
      // Restart play loop fresh
      if (!p) {
        startRef.current = null
        lastFontIndexRef.current = -1
      }
      return !p
    })
  }

  function handleRestart() {
    startRef.current = null
    lastFontIndexRef.current = -1
    setPlaying(true)
  }

  async function handleRandomize() {
    const pool = new Set<string>([
      ...CURATED_FONTS,
      ...localFontFamilies,
      ...(allowSystemFonts ? availableSystemFonts : []),
    ])
    const normalized = Array.from(pool)
      .map((n) => n.trim())
      .filter((n) => n.length > 0)

    const verified = await verifyUsableFonts(normalized)

    const limit = 8
    const shuffled = shuffleArray(verified)
    const pick = shuffled.slice(0, Math.min(limit, shuffled.length))

    const ensured = pick.length >= 2 ? pick : [...pick, ...CURATED_FONTS].slice(0, Math.min(limit, 2))

    setSelectedFonts(ensured)
    ;(async () => {
      for (const f of ensured) {
        try {
          await (document as any).fonts.load(`400 48px "${f}"`)
        } catch {
          // ignore
        }
      }
    })()
  }

  // Export via MediaRecorder (WebM). Simple, fast MVP.
  async function handleExportWebM() {
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      setExporting(true)
      setExportKind("webm")
      const blob = await captureWebMBlob(canvas, durationSec * 1000, 30) // Use captureWebMBlob function
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "rapid-font-fx.webm"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("[v0] export webm error:", err)
      alert("Export (WebM) failed. Try a shorter duration or fewer switches.")
    } finally {
      setExportKind(null)
      setExporting(false)
    }
  }

  async function loadFFmpeg() {
    const mod: any = await import("@ffmpeg/ffmpeg")
    const createFFmpeg = mod?.createFFmpeg || mod?.default?.createFFmpeg
    const fetchFile = mod?.fetchFile || mod?.default?.fetchFile
    if (!createFFmpeg || !fetchFile) {
      throw new Error("FFmpeg module not available in this environment")
    }
    return { createFFmpeg, fetchFile }
  }

  async function handleExportGIF() {
    try {
      setExporting(true)
      setExportKind("gif")

      const canvas = canvasRef.current
      if (!canvas) throw new Error("Canvas not available")

      // Capture frames from canvas animation
      const frames: ImageData[] = []
      const frameCount = Math.ceil((durationSec * 1000) / 50) // 20 fps for GIF
      const frameDuration = (durationSec * 1000) / frameCount

      // Temporarily play and capture frames
      const wasPlaying = playing
      setPlaying(true)
      startRef.current = null
      lastFontIndexRef.current = -1

      // Capture frames by rendering each frame
      for (let i = 0; i < frameCount; i++) {
        const nowMs = i * frameDuration
        drawFrame(nowMs)
        const ctx = canvas.getContext("2d")
        if (ctx) {
          frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
        }
        await new Promise((r) => setTimeout(r, 10)) // Small delay to allow rendering
      }

      // Restore playing state
      if (!wasPlaying) setPlaying(false)

      // Use gif.js to encode frames
      const gifWorkerScript = `
        self.onmessage = function(e) {
          const { frames, width, height, delay } = e.data;
          const gif = new GIF({ workers: 1, quality: 10, width, height, workerScript: undefined });
          frames.forEach(frameData => {
            const canvas = new OffscreenCanvas(width, height);
            const ctx = canvas.getContext('2d');
            ctx.putImageData(frameData, 0, 0);
            gif.addFrame(canvas, { delay });
          });
          gif.on('finished', blob => {
            self.postMessage({ blob });
          });
          gif.render();
        };
      `

      // Fallback: use a simpler approach with canvas-based GIF encoding
      // Since gif.js might not be available, we'll use a minimal GIF encoder
      const gifBlob = await encodeGIFFromFrames(frames, canvas.width, canvas.height, Math.round(frameDuration))

      const url = URL.createObjectURL(gifBlob)
      const a = document.createElement("a")
      a.href = url
      a.download = "rapid-font-fx.gif"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      toast({ title: "GIF exported", description: "Your animation is ready." })
    } catch (err) {
      console.error("[v0] export gif error:", err)
      toast({
        title: "GIF export failed",
        description: "Try a shorter duration or use WebM export instead.",
        variant: "destructive",
      })
    } finally {
      setExportKind(null)
      setExporting(false)
    }
  }

  async function encodeGIFFromFrames(
    frames: ImageData[],
    width: number,
    height: number,
    delayMs: number,
  ): Promise<Blob> {
    // Minimal GIF89a encoder
    const gif: number[] = []

    // GIF header
    gif.push(...[0x47, 0x49, 0x46]) // "GIF"
    gif.push(...[0x38, 0x39, 0x61]) // "89a"

    // Logical Screen Descriptor
    gif.push(width & 0xff, (width >> 8) & 0xff) // width
    gif.push(height & 0xff, (height >> 8) & 0xff) // height
    gif.push(0xf7) // packed fields (global color table, 256 colors)
    gif.push(0) // background color index
    gif.push(0) // aspect ratio

    // Global Color Table (256 colors, 3 bytes each)
    for (let i = 0; i < 256; i++) {
      gif.push(i, i, i) // grayscale palette
    }

    // Application Extension (for looping)
    gif.push(0x21, 0xff, 0x0b) // extension introducer, label
    gif.push(...[0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30]) // "NETSCAPE2.0"
    gif.push(0x03, 0x01, 0x00, 0x00, 0x00) // sub-block

    // Add frames
    for (const frame of frames) {
      // Graphics Control Extension
      gif.push(0x21, 0xf9, 0x04) // extension introducer, label
      gif.push(0x00) // packed fields
      gif.push(delayMs & 0xff, (delayMs >> 8) & 0xff) // delay time
      gif.push(0, 0) // transparent color index, block terminator

      // Image Descriptor
      gif.push(0x2c) // image separator
      gif.push(0, 0, 0, 0) // left, top
      gif.push(width & 0xff, (width >> 8) & 0xff) // width
      gif.push(height & 0xff, (height >> 8) & 0xff) // height
      gif.push(0) // packed fields (no local color table)

      // Image data (simplified: just use LZW compression stub)
      const imageData = frame.data
      const lzwData = lzwEncode(imageData)
      gif.push(0x08) // LZW minimum code size
      addDataSubBlocks(gif, lzwData)
    }

    // Trailer
    gif.push(0x3b)

    return new Blob([new Uint8Array(gif)], { type: "image/gif" })
  }

  function lzwEncode(data: Uint8ClampedArray): number[] {
    const result: number[] = []
    const dictSize = 256
    const dict: Record<string, number> = {}
    for (let i = 0; i < dictSize; i++) {
      dict[String.fromCharCode(i)] = i
    }

    let w = String.fromCharCode(data[0])
    for (let i = 1; i < data.length; i++) {
      const c = String.fromCharCode(data[i])
      const wc = w + c
      if (wc in dict) {
        w = wc
      } else {
        result.push(dict[w])
        dict[wc] = dictSize + Object.keys(dict).length
        w = c
      }
    }
    if (w) result.push(dict[w])
    return result
  }

  function addDataSubBlocks(gif: number[], data: number[]): void {
    for (let i = 0; i < data.length; i += 255) {
      const chunk = data.slice(i, i + 255)
      gif.push(chunk.length)
      gif.push(...chunk)
    }
    gif.push(0) // block terminator
  }

  async function handleExportAEScript() {
    try {
      setExporting(true)
      setExportKind("ae")

      const fps = 30
      // use the effective sequence that loops for the duration
      const steps = Math.max(1, Math.floor((durationSec * 1000) / msPerSwitch))
      const sequence: string[] = []
      for (let i = 0; i < steps; i++) {
        const idx = i % Math.max(1, fontSequence.length)
        sequence.push(fontSequence[idx] || effectiveFonts[0] || "Inter")
      }

      const msPerSwitchSec = msPerSwitch / 1000
      const keyframeLines = sequence
        .map((font, i) => {
          const t = Number((i * msPerSwitchSec).toFixed(3))
          return `  var doc = tdProp.value; doc.font = ${JSON.stringify(font)}; tdProp.setValueAtTime(${t}, doc);`
        })
        .join("\n")

      const jsx = `// RapidFontFX AE Script (generated)
(function(){
  app.beginUndoGroup("RapidFontFX");
  var proj = app.project || app.newProject();
  var comp = proj.items.addComp("RapidFontFX", ${cssWidth}, ${cssHeight}, 1.0, ${durationSec}, ${fps});
  var textLayer = comp.layers.addText(${JSON.stringify(text)});
  var tdProp = textLayer.property("Source Text");
  var td = tdProp.value;
  td.fontSize = ${fontSize};
  td.fillColor = [${Number.parseInt(textColor.slice(1, 3), 16)}, ${Number.parseInt(textColor.slice(3, 5), 16)}, ${Number.parseInt(textColor.slice(5, 7), 16)}]; // add text color to AE script
  // Clear any existing keys
  while (tdProp.numKeys > 0) tdProp.removeKey(1);
${keyframeLines}
  app.endUndoGroup();
})();`

      const blob = new Blob([jsx], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "rapid-font-fx.jsx"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExportKind(null)
      setExporting(false)
    }
  }

  async function installLocalFontFromFile(file: File) {
    const buf = await file.arrayBuffer()
    const family = file.name.replace(/\.(ttf|otf|woff2?|TTF|OTF|WOFF2?)$/, "")
    const face = new FontFace(family, buf)
    await face.load()
    ;(document as any).fonts.add(face)
    localFontFamiliesRef.current.add(family)
    setLocalFontFamilies((prev) => (prev.includes(family) ? prev : [...prev, family]))
    setSelectedFonts((prev) => (prev.includes(family) ? prev : [...prev, family]))
  }

  async function loadSystemFontCatalog() {
    if (sysFontStatus === "loading" || sysFontStatus === "ready") return
    setSysFontStatus("loading")

    if (!systemFontAccessAllowed) {
      setSysFontStatus("blocked")
      setAllowSystemFonts(false)
      toast({
        title: "System fonts blocked",
        description:
          "This preview disallows local font access via Permissions Policy. Deploy top-level or enable local-fonts.",
        variant: "destructive",
      })
      return
    }

    // @ts-ignore
    if (typeof window.queryLocalFonts !== "function") {
      setSysFontStatus("unsupported")
      toast({
        title: "System fonts unsupported",
        description: "Your browser does not support Local Font Access. Try Chromium-based browsers.",
        variant: "destructive",
      })
      return
    }

    try {
      // @ts-ignore
      const fonts = await window.queryLocalFonts()
      const names = Array.from(new Set(fonts.map((f: any) => f.fullName)))
      setAvailableSystemFonts(names)
      setSysFontStatus("ready")
      toast({ title: "System fonts ready", description: `${names.length} fonts available.` })
    } catch (e: any) {
      console.error("[v0] system font access error:", e)
      if (e && (e.name === "NotAllowedError" || e.name === "AbortError")) {
        setSysFontStatus("denied")
        toast({
          title: "Permission denied",
          description: "You denied access to system fonts. You can allow it from the browser prompt.",
          variant: "destructive",
        })
      } else {
        setSysFontStatus("error")
        toast({
          title: "Could not list system fonts",
          description: "Access failed. Try again or use web/local fonts.",
          variant: "destructive",
        })
      }
    }
  }

  function toggleChecked(name: string) {
    setCheckedMap((m) => ({ ...m, [name]: !m[name] }))
  }
  function setAllChecked(value: boolean) {
    const next: Record<string, boolean> = {}
    filteredCatalog.forEach((n) => {
      next[n] = value
    })
    setCheckedMap(next)
  }
  function addCheckedToSelection() {
    const toAdd = Object.entries(checkedMap)
      .filter(([_, v]) => v)
      .map(([k]) => k)
    if (toAdd.length === 0) return
    setSelectedFonts((prev) => {
      const s = new Set(prev)
      toAdd.forEach((n) => s.add(n))
      return Array.from(s).slice(0, 50)
    })
    setFontDropdownOpen(false)
  }

  // Build a combined catalog: curated + installed locals + system (if available)
  const catalog = useMemo(() => {
    const s = new Set<string>([
      ...CURATED_FONTS,
      ...localFontFamilies,
      ...(allowSystemFonts ? availableSystemFonts : []),
      ...selectedFonts, // include selected so they can be managed
    ])
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [availableSystemFonts, localFontFamilies, selectedFonts, allowSystemFonts])

  const filteredCatalog = useMemo(() => {
    const q = fontSearch.trim().toLowerCase()
    if (!q) return catalog
    return catalog.filter((name) => name.toLowerCase().includes(q))
  }, [catalog, fontSearch])

  // Robust DnD helpers for selected fonts reordering
  function onDragStartSelected(e: React.DragEvent<HTMLLIElement>, index: number) {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = "move"
  }
  function onDragOverSelected(e: React.DragEvent<HTMLLIElement>) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }
  function onDropSelected(e: React.DragEvent<HTMLLIElement>, dropIndex: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === dropIndex) return
    setSelectedFonts((prev) => {
      const next = prev.slice()
      const [moved] = next.splice(dragIndex, 1)
      next.splice(dropIndex, 0, moved)
      return next
    })
    setDragIndex(null)
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Controls */}
          <div className="rounded-lg border p-4 md:p-5 h-full">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="text">Text</Label>
                <Input
                  id="text"
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 100))}
                  placeholder="Enter your text..."
                />
              </div>

              <div className="space-y-2">
                <Label>Duration: {durationSec}s</Label>
                <Slider
                  value={[durationSec]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={(v) => setDurationSec(v[0] ?? 3)}
                />
              </div>

              <div className="space-y-2">
                <Label>Switch count: {switchCount}</Label>
                <Slider
                  value={[switchCount]}
                  min={2}
                  max={100}
                  step={1}
                  onValueChange={(v) => setSwitchCount(v[0] ?? 20)}
                />
              </div>

              <div className="space-y-2">
                <Label>Text size: {fontSize}px</Label>
                <Slider value={[fontSize]} min={48} max={240} step={2} onValueChange={(v) => setFontSize(v[0] ?? 80)} />
              </div>

              <div className="space-y-2">
                <Label>Text color</Label>
                <Input id="text-color" type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
              </div>

              <div className="flex items-center justify-between gap-3">
                <label htmlFor="allow-system-fonts" className="text-sm font-medium">
                  Allow system fonts
                </label>
                <Switch
                  id="allow-system-fonts"
                  checked={allowSystemFonts}
                  onCheckedChange={(v) => {
                    setAllowSystemFonts(v)
                    // don't call loadSystemFontCatalog() here; effect above will handle it once.
                  }}
                  disabled={!systemFontAccessAllowed}
                />
              </div>

              {/* Add Font by Name input with popover dropdown for search + checkboxes (curated + local + system) */}
              <div className="space-y-2">
                <label htmlFor="add-font-by-name" className="text-sm font-medium">
                  Add font by name
                </label>
                <Popover open={fontDropdownOpen} onOpenChange={setFontDropdownOpen}>
                  <PopoverAnchor asChild>
                    <Input
                      id="add-font-by-name"
                      placeholder="Add font by name (e.g., Bebas Neue)"
                      value={fontSearch}
                      onChange={(e) => {
                        setFontSearch(e.target.value)
                        if (!fontDropdownOpen) setFontDropdownOpen(true)
                      }}
                      onFocus={() => setFontDropdownOpen(true)}
                      onClick={() => setFontDropdownOpen(true)}
                      onMouseDown={() => setFontDropdownOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setFontDropdownOpen(false)
                      }}
                      aria-autocomplete="list"
                      aria-controls="font-command-list"
                      aria-expanded={fontDropdownOpen}
                    />
                  </PopoverAnchor>
                  <PopoverContent
                    className="w-(--radix-popover-trigger-width) p-0"
                    align="start"
                    // prevent Radix from focusing content, which would blur the input and close the popover
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    <Command shouldFilter={false}>
                      <CommandList id="font-command-list">
                        <CommandEmpty>No fonts found.</CommandEmpty>
                        <CommandGroup heading="Fonts">
                          {filteredCatalog.slice(0, 200).map((name) => {
                            const checked = !!checkedMap[name]
                            return (
                              <CommandItem
                                key={name}
                                value={name}
                                // prevent input blur before selection toggles state
                                onMouseDown={(e) => e.preventDefault()}
                                onSelect={() => toggleChecked(name)}
                                className="flex items-center gap-2"
                              >
                                <Checkbox
                                  checked={checked}
                                  // prevent focus/blur ripple by handling mouse down
                                  onMouseDown={(e) => e.preventDefault()}
                                  onCheckedChange={() => toggleChecked(name)}
                                />
                                <span className="truncate">{name}</span>
                              </CommandItem>
                            )
                          })}
                        </CommandGroup>
                      </CommandList>
                      <div className="flex items-center gap-2 p-2 border-t">
                        <Button
                          size="sm"
                          onClick={() => {
                            addCheckedToSelection()
                            setFontDropdownOpen(false)
                          }}
                        >
                          Add selected
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAllChecked(true)}>
                          Select all
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAllChecked(false)}>
                          Clear
                        </Button>
                      </div>
                    </Command>
                  </PopoverContent>
                </Popover>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">Selected fonts (drag to reorder)</div>
                    <div className="flex items-center gap-2">
                      <Button
                        className="text-xs font-normal shadow-none border-b border-accent bg-transparent"
                        size="sm"
                        variant="outline"
                        onClick={handleRandomize}
                        aria-label="Randomize fonts"
                      >
                        🎲 Randomize
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedFonts([])}
                        aria-label="Clear selected fonts"
                      >
                        Clear all
                      </Button>
                    </div>
                  </div>
                  <ul className="flex flex-wrap gap-2">
                    {selectedFonts.map((name, idx) => (
                      <li
                        key={name + idx}
                        className="group cursor-move rounded-md px-2 py-1 border bg-card text-card-foreground flex items-center gap-2"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", String(idx))
                          onDragStartSelected(e, idx)
                        }}
                        onDragOver={onDragOverSelected}
                        onDrop={(e) => onDropSelected(e, idx)}
                        aria-grabbed={dragIndex === idx}
                      >
                        <span className="truncate max-w-[12rem]">{name}</span>
                        <button
                          type="button"
                          className="opacity-70 hover:opacity-100 transition text-xs px-1 rounded border"
                          aria-label={`Remove ${name}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedFonts((prev) => prev.filter((_, i) => i !== idx))
                          }}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border p-4 md:p-5 h-full flex flex-col items-center justify-center gap-3">
            <canvas
              ref={canvasRef}
              width={cssWidth}
              height={cssHeight}
              aria-label="Font switching preview"
              className="block max-w-full h-auto bg-background"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-background text-foreground border-accent border-2"
                onClick={handleExportWebM}
                disabled={exporting || selectedFonts.length < 2}
                aria-label="Export WebM"
              >
                {exporting && exportKind === "webm" ? "Exporting…" : "Export WebM"}
              </Button>
              <Button
                onClick={handleExportGIF}
                disabled={exporting || selectedFonts.length < 2}
                aria-label="Export GIF"
              >
                {exporting && exportKind === "gif" ? "Exporting…" : "Export GIF"}
              </Button>
              <Button
                className="text-foreground bg-background border-accent border-2"
                onClick={handleExportAEScript}
                disabled={exporting}
                aria-label="Export After Effects Script"
              >
                {exporting && exportKind === "ae" ? "Preparing…" : "Export AE .jsx"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
