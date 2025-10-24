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
import { GOOGLE_FONTS, FONT_CATEGORIES, isGoogleFont as checkIsGoogleFont } from "../utils/google-fonts"

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

// Optimized font verification with caching
const fontTestCache = new Map<string, boolean>()
function testFontWorks(fontName: string): boolean {
  // Check cache first for performance
  if (fontTestCache.has(fontName)) {
    return fontTestCache.get(fontName)!
  }

  try {
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 30
    const ctx = canvas.getContext('2d')!

    // Optimized test string (shorter for performance)
    const testString = 'ABCabc123'

    // Test with target font
    ctx.font = `16px "${fontName}"`
    const targetWidth = ctx.measureText(testString).width

    // Test with Arial fallback
    ctx.font = '16px Arial'
    const arialWidth = ctx.measureText(testString).width

    // Font works if it renders differently from Arial
    const works = Math.abs(targetWidth - arialWidth) > 0.5

    // Cache result for future use
    fontTestCache.set(fontName, works)

    return works
  } catch (error) {
    // Cache negative result too
    fontTestCache.set(fontName, false)
    return false
  }
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

// Helper function to create safe filename from text
function createSafeFilename(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .slice(0, 20) // Limit length to 20 characters
}

export default function FontSwitcherCanvas() {
  // Controls with localStorage persistence
  const [text, setText] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('typecut-text') || "@sanjogsays"
    }
    return "@sanjogsays"
  })
  const [durationSec, setDurationSec] = useState(() => {
    if (typeof window !== 'undefined') {
      return Number(localStorage.getItem('typecut-duration')) || 3
    }
    return 3
  })
  const [switchCount, setSwitchCount] = useState(() => {
    if (typeof window !== 'undefined') {
      return Number(localStorage.getItem('typecut-switchCount')) || 20
    }
    return 20
  })
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return Number(localStorage.getItem('typecut-fontSize')) || 80
    }
    return 80
  })
  const [selectedFonts, setSelectedFonts] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('typecut-selectedFonts')
      return saved ? JSON.parse(saved) : CURATED_FONTS.slice(0, 5)
    }
    return CURATED_FONTS.slice(0, 5)
  })
  const [playing, setPlaying] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [exportKind, setExportKind] = useState<"webm" | "gif" | "ae" | null>(null)
  const [exportProgress, setExportProgress] = useState(0)
  const transparentBg = true // Always transparent background
  const [bgColor, setBgColor] = useState("#ffffff")
  const [textColor, setTextColor] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('typecut-textColor') || "#111111"
    }
    return "#111111"
  })
  const localFontFamiliesRef = useRef<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [systemFontAccessAllowed, setSystemFontAccessAllowed] = useState(false)
  const [allowSystemFonts, setAllowSystemFonts] = useState(false)
  const [allowGoogleFonts, setAllowGoogleFonts] = useState(true)
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

  // Persist settings to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('typecut-text', text)
    }
  }, [text])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('typecut-duration', durationSec.toString())
    }
  }, [durationSec])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('typecut-switchCount', switchCount.toString())
    }
  }, [switchCount])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('typecut-fontSize', fontSize.toString())
    }
  }, [fontSize])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('typecut-selectedFonts', JSON.stringify(selectedFonts))
    }
  }, [selectedFonts])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('typecut-textColor', textColor)
    }
  }, [textColor])

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
      ; (async () => {
        await loadSystemFontCatalog()
      })()
  }, [allowSystemFonts, systemFontAccessAllowed, sysFontStatus, toast])

  // Canvas references
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const lastFontIndexRef = useRef<number>(-1)

  // Smart text-based dimensions with generous padding
  const calculateOptimalDimensions = useCallback(() => {
    // Create temporary canvas to measure text
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return { width: 640, height: 640 }

    // Test with largest expected font to get maximum bounds
    const testFontSize = fontSize
    tempCtx.font = `${testFontSize}px "Inter", system-ui, sans-serif`

    // Measure text dimensions
    const textMetrics = tempCtx.measureText(text)
    const textWidth = textMetrics.width
    const textHeight = testFontSize // Approximate height based on font size

    // Add generous padding (40% of font size horizontal, 20% vertical, minimum 60px horizontal, 30px vertical)
    const paddingX = Math.max(60, testFontSize * 0.4)
    const paddingY = Math.max(30, testFontSize * 0.2) // Half the vertical padding

    // Calculate optimal dimensions
    const optimalWidth = Math.ceil(textWidth + (paddingX * 2))
    const optimalHeight = Math.ceil(textHeight + (paddingY * 2))

    // Ensure minimum dimensions for readability
    const minWidth = 320
    const minHeight = 200

    return {
      width: Math.max(minWidth, optimalWidth),
      height: Math.max(minHeight, optimalHeight)
    }
  }, [text, fontSize])

  const { width: baseWidth, height: baseHeight } = calculateOptimalDimensions()

  // Calculate scale to fit preview container (max 800px width, 600px height for preview)
  const maxPreviewWidth = 800
  const maxPreviewHeight = 600
  const scaleX = baseWidth > maxPreviewWidth ? maxPreviewWidth / baseWidth : 1
  const scaleY = baseHeight > maxPreviewHeight ? maxPreviewHeight / baseHeight : 1
  const previewScale = Math.min(scaleX, scaleY, 1) // Never scale up, only down

  // Canvas dimensions (full size for export quality)
  const cssWidth = baseWidth
  const cssHeight = baseHeight

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

  // Note: If switchCount < effectiveFonts.length, some fonts won't appear
  // This is expected behavior - user controls both values

  // Build a font sequence that cycles through fonts in order
  // Example: 8 fonts, 20 switches = [font1, font2, font3, font4, font5, font6, font7, font8, font1, font2, font3, font4, font5, font6, font7, font8, font1, font2, font3, font4]
  const fontSequence = useMemo(() => {
    if (effectiveFonts.length < 2) return effectiveFonts

    const sequence: string[] = []

    // Simply cycle through fonts in order for the specified number of switches
    for (let i = 0; i < switchCount; i++) {
      const fontIndex = i % effectiveFonts.length
      sequence.push(effectiveFonts[fontIndex])
    }

    // Font sequence built: cycles through all selected fonts in order

    return sequence
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

    // Store DPR for export consistency
    canvas.dataset.dpr = dpr.toString()
  }, [])

  // Performance optimization refs
  const fontLoadingTimeoutRef = useRef<NodeJS.Timeout>()
  const loadedFontsCache = useRef<Set<string>>(new Set())
  const fontVerificationCache = useRef<Map<string, boolean>>(new Map())

  useEffect(() => {
    // Clear previous timeout to debounce rapid changes
    if (fontLoadingTimeoutRef.current) {
      clearTimeout(fontLoadingTimeoutRef.current)
    }

    fontLoadingTimeoutRef.current = setTimeout(async () => {
      const uniques = Array.from(new Set(fontSequence)).slice(0, 16) // Reduced from 32 to 16

      // Batch font loading for better performance
      const fontLoadPromises = uniques.map(async (f) => {
        // Skip if already loaded
        if (loadedFontsCache.current.has(f)) return

        try {
          const isLocalOrSystem = localFontFamiliesRef.current.has(f) || availableSystemFonts.includes(f)
          const isGoogleFontCheck = GOOGLE_FONTS.includes(f) || CURATED_FONTS.includes(f)

          if (isGoogleFontCheck && !isLocalOrSystem) {
            await ensureGoogleFontLoaded(f)
          }

          await (document as any).fonts.load(`400 ${fontSize}px "${f}"`)
          loadedFontsCache.current.add(f) // Cache successful loads
        } catch {
          // Silently ignore font loading errors
        }
      })

      // Load fonts in parallel instead of sequentially
      await Promise.allSettled(fontLoadPromises)
    }, 300) // 300ms debounce

    return () => {
      if (fontLoadingTimeoutRef.current) {
        clearTimeout(fontLoadingTimeoutRef.current)
      }
    }
  }, [fontSequence, fontSize, availableSystemFonts])

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

      // Only redraw if font actually changed (performance optimization)
      if (idx === lastFontIndexRef.current) {
        // Same font, just schedule next frame
        if (elapsed < durationSec * 1000 && playing) {
          rafRef.current = requestAnimationFrame(drawFrame)
        } else if (elapsed >= durationSec * 1000 && playing) {
          startRef.current = nowMs
          rafRef.current = requestAnimationFrame(drawFrame)
        }
        return
      }

      // Minimal console logging for performance
      if (process.env.NODE_ENV === 'development' && idx % 10 === 0) {
        console.log(`Font: "${currentFont}"`)
      }

      // Clear and redraw only when font changes
      ctx.clearRect(0, 0, cssWidth, cssHeight)

      // Optionally draw background (optimized)
      if (!transparentBg) {
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, cssWidth, cssHeight)
      }

      // Optimized text rendering
      ctx.fillStyle = textColor
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.imageSmoothingEnabled = false

      // Cache font string to avoid repeated concatenation
      const fontString = `${fontSize}px "${currentFont}"`
      ctx.font = fontString

      // Use cached coordinates
      const x = Math.round(cssWidth / 2)
      const y = Math.round(cssHeight / 2)

      ctx.fillText(text, x, y)

      // Update font index
      lastFontIndexRef.current = idx

      // Schedule next frame
      if (elapsed < durationSec * 1000 && playing) {
        rafRef.current = requestAnimationFrame(drawFrame)
      } else if (elapsed >= durationSec * 1000 && playing) {
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
    try {
      const pool = new Set<string>([
        ...CURATED_FONTS,
        ...(allowGoogleFonts ? GOOGLE_FONTS : []),
        ...localFontFamilies,
        ...(allowSystemFonts ? availableSystemFonts : []),
      ])
      const normalized = Array.from(pool)
        .map((n) => n.trim())
        .filter((n) => n.length > 0)

      // Skip verification for randomization - it's too slow and filters out valid fonts
      // Just shuffle and pick directly from the pool
      const limit = 8
      const shuffled = shuffleArray(normalized)
      const pick = shuffled.slice(0, Math.min(limit, shuffled.length))

      const ensured = pick.length >= 2 ? pick : [...pick, ...CURATED_FONTS].slice(0, Math.max(2, pick.length))

      setSelectedFonts(ensured)

      // Optimized font verification with reduced logging and batching
      setTimeout(async () => {
        const workingFonts: string[] = []

        // Batch font verification for better performance
        const verificationPromises = ensured.map(async (f) => {
          try {
            const isSystemFont = availableSystemFonts.includes(f) || localFontFamilies.includes(f)
            const isGoogleFontCheck = checkIsGoogleFont(f) || CURATED_FONTS.includes(f)

            if (isGoogleFontCheck) {
              // Google/Web fonts - optimized loading
              try {
                await ensureGoogleFontLoaded(f)
                await (document as any).fonts.load(`400 ${fontSize}px "${f}"`)
                return { font: f, success: true, type: 'Google' }
              } catch {
                return { font: f, success: false, type: 'Google' }
              }
            } else if (isSystemFont) {
              // System fonts - quick test
              try {
                const works = testFontWorks(f)
                return { font: f, success: works, type: 'System' }
              } catch {
                return { font: f, success: false, type: 'System' }
              }
            } else {
              // Unknown fonts - test with timeout
              try {
                await Promise.race([
                  (document as any).fonts.load(`400 ${fontSize}px "${f}"`),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
                ])
                const works = testFontWorks(f)
                return { font: f, success: works, type: 'Unknown' }
              } catch {
                return { font: f, success: false, type: 'Unknown' }
              }
            }
          } catch {
            return { font: f, success: false, type: 'Error' }
          }
        })

        // Process all verifications in parallel
        const results = await Promise.allSettled(verificationPromises)

        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.success) {
            workingFonts.push(result.value.font)
          }
        })

        // Update selection with working fonts (reduced logging)
        if (workingFonts.length >= 2) {
          setSelectedFonts(workingFonts)
          if (process.env.NODE_ENV === 'development') {
            console.log(`✓ Randomized to ${workingFonts.length} fonts`)
          }
        }
      }, 50) // Reduced timeout from 100ms to 50ms

    } catch (error) {
      console.error("Error randomizing fonts:", error)
      toast({
        title: "Randomization failed",
        description: "Could not randomize fonts. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Export via MediaRecorder (WebM). Simple, fast MVP.
  async function handleExportWebM() {
    const canvas = canvasRef.current
    if (!canvas) return

    try {
      setExporting(true)
      setExportKind("webm")

      // Ensure animation is playing during recording
      const wasPlaying = playing
      setPlaying(true)

      // Reset animation to start
      startRef.current = null
      lastFontIndexRef.current = -1

      // Small delay to ensure animation starts
      await new Promise(resolve => setTimeout(resolve, 100))

      const blob = await captureWebMBlob(canvas, durationSec * 1000, 30)

      // Restore original playing state
      if (!wasPlaying) setPlaying(false)

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const safeText = createSafeFilename(text)
      a.download = `type-cut-${safeText}.webm`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      toast({
        title: "WebM exported",
        description: transparentBg ? "Your animation with transparent background is ready." : "Your animation is ready."
      })
    } catch (err) {
      console.error("[v0] export webm error:", err)
      toast({
        title: "WebM export failed",
        description: err instanceof Error ? err.message : "Try a shorter duration or fewer switches.",
        variant: "destructive",
      })
    } finally {
      setExportKind(null)
      setExporting(false)
    }
  }

  // Removed unused FFmpeg function

  async function handleExportGIF() {
    try {
      setExporting(true)
      setExportKind("gif")
      setExportProgress(0)

      const canvas = canvasRef.current
      if (!canvas) throw new Error("Canvas not available")

      toast({
        title: "Creating high-res GIF...",
        description: "Rendering with hard edges for maximum crispness"
      })

      // Import gifenc - modern, faster GIF encoder
      const { GIFEncoder, quantize, applyPalette } = await import('gifenc')

      // Create a dedicated HIGH-RESOLUTION canvas for GIF export with smart cropping
      // This eliminates DPR scaling issues and ensures pixel-perfect rendering
      const exportCanvas = document.createElement('canvas')
      const exportScale = 2 // 2x resolution for crisp text

      // Use smart text-based dimensions for export
      const exportDimensions = calculateOptimalDimensions()
      exportCanvas.width = exportDimensions.width * exportScale
      exportCanvas.height = exportDimensions.height * exportScale

      const exportCtx = exportCanvas.getContext('2d', {
        willReadFrequently: true,
        alpha: true,
        desynchronized: false // Force synchronous rendering for consistency
      })
      if (!exportCtx) throw new Error("Export canvas context not available")

      // Configure export context for MAXIMUM crispness
      exportCtx.setTransform(exportScale, 0, 0, exportScale, 0, 0)

      // CRITICAL: Disable ALL smoothing and anti-aliasing
      exportCtx.imageSmoothingEnabled = false
      // @ts-ignore - textRenderingOptimization is experimental
      if ('textRenderingOptimization' in exportCtx) {
        exportCtx.textRenderingOptimization = 'geometricPrecision' // Sharp edges
      }
      // @ts-ignore - fontKerning is experimental  
      if ('fontKerning' in exportCtx) {
        exportCtx.fontKerning = 'none'
      }

      // CRITICAL: Use EXACT same timing as preview for consistency
      const totalDurationMs = durationSec * 1000
      const frameRate = 10 // 10 FPS for smooth animation
      const frameDuration = 1000 / frameRate // 100ms per frame
      const frameCount = Math.ceil(totalDurationMs / frameDuration)

      const wasPlaying = playing
      setPlaying(false) // Stop preview animation

      // Step 1: Capture frames with HARD EDGES (0-50% progress)
      toast({
        title: "Capturing frames...",
        description: `Rendering ${frameCount} frames at 2x resolution with hard edges`
      })

      const frames: ImageData[] = []
      for (let i = 0; i < frameCount; i++) {
        const elapsed = i * frameDuration
        const idx = Math.floor(elapsed / msPerSwitch) % Math.max(1, fontSequence.length)
        const currentFont = fontSequence[idx] || effectiveFonts[0] || "Inter"

        // Clear with transparency using export dimensions
        exportCtx.clearRect(0, 0, exportDimensions.width, exportDimensions.height)

        // Draw solid background if needed (NO gradients, NO anti-aliasing)
        if (!transparentBg) {
          exportCtx.fillStyle = bgColor
          exportCtx.fillRect(0, 0, exportDimensions.width, exportDimensions.height)
        }

        // CRITICAL: Text rendering with HARD EDGES
        exportCtx.fillStyle = textColor
        exportCtx.textAlign = "center"
        exportCtx.textBaseline = "middle"

        // Force pixel-perfect positioning using export dimensions
        const x = Math.floor(exportDimensions.width / 2) + 0.5 // +0.5 for crisp pixel alignment
        const y = Math.floor(exportDimensions.height / 2) + 0.5

        // Use integer font size to avoid sub-pixel scaling
        const crispFontSize = Math.floor(fontSize)
        exportCtx.font = `${crispFontSize}px "${currentFont}", monospace` // Add monospace fallback for consistency

        // Render text with hard edges
        exportCtx.fillText(text, x, y)

        // Capture high-res frame data
        frames.push(exportCtx.getImageData(0, 0, exportCanvas.width, exportCanvas.height))

        setExportProgress(Math.round((i + 1) / frameCount * 50))

        if (i % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1))
        }
      }

      setPlaying(wasPlaying)

      // Step 2: Create MINIMAL color palette for hard edges (50-60% progress)
      toast({
        title: "Creating minimal palette...",
        description: "Using only essential colors for hard edges"
      })
      setExportProgress(55)

      // Use VERY FEW colors to force hard edges (no intermediate colors = no blur)
      const paletteSize = transparentBg ? 16 : 8 // Minimal colors for maximum crispness
      const palette = quantize(frames[0].data, paletteSize, {
        format: 'rgb444', // Lower color depth = harder edges
        oneBitAlpha: transparentBg,
        clearAlpha: transparentBg,
        clearAlphaThreshold: 128 // Sharp alpha cutoff
      })
      setExportProgress(60)

      // Step 3: Encode with hard edges (60-95% progress)
      toast({
        title: "Encoding with hard edges...",
        description: "Creating crisp animated GIF"
      })

      const gif = GIFEncoder()

      for (let i = 0; i < frames.length; i++) {
        // Apply palette with minimal dithering for hard edges
        const indexed = applyPalette(frames[i].data, palette)

        gif.writeFrame(indexed, exportCanvas.width, exportCanvas.height, {
          palette,
          delay: Math.round(frameDuration / 10),
          dispose: 2, // Clear frame for clean transitions
          transparent: transparentBg
        })

        setExportProgress(Math.round(60 + (i + 1) / frames.length * 35))

        if (i % 2 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1))
        }
      }

      // Step 4: Finalize
      toast({
        title: "Finalizing...",
        description: "Preparing crisp GIF download"
      })
      setExportProgress(95)

      gif.finish()
      const buffer = gif.bytes()
      setExportProgress(98)

      const blob = new Blob([buffer as any], { type: 'image/gif' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const safeText = createSafeFilename(text)
      link.download = `type-cut-${safeText}.gif`
      link.href = url
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setExportProgress(100)

      toast({
        title: "Crisp GIF exported!",
        description: `${frameCount} frames, ${(blob.size / 1024).toFixed(0)}KB - 2x resolution with hard edges`
      })

      await new Promise(resolve => setTimeout(resolve, 500))

      setExportKind(null)
      setExporting(false)
      setExportProgress(0)

    } catch (err) {
      console.error("[v0] export gif error:", err)
      toast({
        title: "GIF export failed",
        description: err instanceof Error ? err.message : "Try using WebM export for better results.",
        variant: "destructive",
      })
    } finally {
      setExportKind(null)
      setExporting(false)
      setExportProgress(0)
    }
  }

  // Removed complex GIF encoder - using WebM instead for reliability

  // Removed the complex and buggy GIF encoder functions
  // The GIF export now uses a simpler approach that doesn't hang the browser

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

      // Use optimized dimensions for After Effects
      const aeDimensions = calculateOptimalDimensions()

      const jsx = `// TypeCut AE Script (generated with optimized dimensions)
(function(){
  app.beginUndoGroup("TypeCut");
  var proj = app.project || app.newProject();
  var comp = proj.items.addComp("TypeCut", ${aeDimensions.width}, ${aeDimensions.height}, 1.0, ${durationSec}, ${fps});
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
      const safeText = createSafeFilename(text)
      a.download = `type-cut-${safeText}.jsx`
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
      ; (document as any).fonts.add(face)
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
      const names = Array.from(new Set(fonts.map((f: any) => f.fullName))) as string[]
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
    const isCurrentlySelected = selectedFonts.includes(name)

    if (isCurrentlySelected) {
      // Remove from selected fonts
      setSelectedFonts((prev) => prev.filter(f => f !== name))
    } else {
      // Add to selected fonts (limit to 50)
      setSelectedFonts((prev) => {
        const newList = [...prev, name]
        return newList.slice(0, 50)
      })
    }
  }

  // Build a combined catalog: curated + google fonts + installed locals + system (if available)
  const catalog = useMemo(() => {
    const s = new Set<string>([
      ...CURATED_FONTS,
      ...(allowGoogleFonts ? GOOGLE_FONTS : []),
      ...localFontFamilies,
      ...(allowSystemFonts ? availableSystemFonts : []),
      ...selectedFonts, // include selected so they can be managed
    ])
    return Array.from(s).sort((a, b) => a.localeCompare(b))
  }, [allowGoogleFonts, availableSystemFonts, localFontFamilies, selectedFonts, allowSystemFonts])

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
    <div className="rounded-lg border overflow-hidden max-w-7xl mx-auto">
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
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
                  onValueChange={(v: number[]) => setDurationSec(v[0] ?? 3)}
                />
              </div>

              <div className="space-y-2">
                <Label>Switch count: {switchCount}</Label>
                <Slider
                  value={[switchCount]}
                  min={2}
                  max={100}
                  step={1}
                  onValueChange={(v: number[]) => setSwitchCount(v[0] ?? 20)}
                />
              </div>

              <div className="space-y-2">
                <Label>Text size: {fontSize}px</Label>
                <Slider value={[fontSize]} min={48} max={240} step={2} onValueChange={(v: number[]) => setFontSize(v[0] ?? 80)} />
              </div>

              <div className="space-y-2">
                <Label>Text color</Label>
                <Input id="text-color" type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-20" />
              </div>



              <div className="flex items-center justify-between gap-3">
                <label htmlFor="allow-google-fonts" className="text-sm font-medium">
                  Google Fonts ({GOOGLE_FONTS.length} fonts)
                </label>
                <Switch
                  id="allow-google-fonts"
                  checked={allowGoogleFonts}
                  onCheckedChange={setAllowGoogleFonts}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <label htmlFor="allow-system-fonts" className="text-sm font-medium">
                  System fonts
                </label>
                <Switch
                  id="allow-system-fonts"
                  checked={allowSystemFonts}
                  onCheckedChange={(v: boolean) => {
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
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setFontSearch(e.target.value)
                        if (!fontDropdownOpen) setFontDropdownOpen(true)
                      }}
                      onFocus={() => setFontDropdownOpen(true)}
                      onClick={() => setFontDropdownOpen(true)}
                      onMouseDown={() => setFontDropdownOpen(true)}
                      onKeyDown={(e: React.KeyboardEvent) => {
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
                    onOpenAutoFocus={(e: Event) => e.preventDefault()}
                    onCloseAutoFocus={(e: Event) => e.preventDefault()}
                  >
                    <Command shouldFilter={false}>
                      <CommandList id="font-command-list" className="max-h-[400px] overflow-y-auto">
                        <CommandEmpty>No fonts found.</CommandEmpty>
                        <CommandGroup heading="Fonts">
                          {filteredCatalog.map((name) => {
                            const checked = selectedFonts.includes(name)
                            const isGoogle = checkIsGoogleFont(name) || CURATED_FONTS.includes(name)
                            const isSystem = availableSystemFonts.includes(name)
                            const isLocal = localFontFamilies.includes(name)

                            return (
                              <CommandItem
                                key={name}
                                value={name}
                                // prevent input blur before selection toggles state
                                onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
                                onSelect={() => toggleChecked(name)}
                                className="flex items-center gap-2 py-3"
                              >
                                <Checkbox
                                  checked={checked}
                                  // prevent focus/blur ripple by handling mouse down
                                  onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
                                  onCheckedChange={() => toggleChecked(name)}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate font-medium">{name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {isGoogle ? "Google" : isSystem ? "System" : isLocal ? "Local" : ""}
                                    </span>
                                  </div>
                                  <div
                                    className="text-sm text-muted-foreground mt-1 truncate"
                                    style={{ fontFamily: `"${name}", system-ui, sans-serif` }}
                                  >
                                    The quick brown fox jumps
                                  </div>
                                </div>
                              </CommandItem>
                            )
                          })}
                        </CommandGroup>
                      </CommandList>
                      <div className="p-2 border-t text-xs text-muted-foreground text-center">
                        Check fonts to add them automatically
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
                variant="outline"
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
                {exporting && exportKind === "gif" ? `Exporting… ${exportProgress}%` : "Export GIF"}
              </Button>
              <Button
                variant="outline"
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
