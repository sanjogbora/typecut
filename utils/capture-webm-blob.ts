export async function captureWebMBlob(
  canvas: HTMLCanvasElement, 
  durationMs: number, 
  fps = 30,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  if (!canvas) throw new Error("Canvas not provided")
  if (!durationMs || durationMs <= 0) throw new Error("Invalid duration")

  // Check MediaRecorder support
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") 
    ? "video/webm;codecs=vp9" 
    : MediaRecorder.isTypeSupported("video/webm") 
    ? "video/webm" 
    : null

  if (!mime) {
    throw new Error("WebM recording not supported in this browser")
  }

  const stream = canvas.captureStream(fps)
  const recorder = new MediaRecorder(stream, { 
    mimeType: mime,
    videoBitsPerSecond: 2500000 // 2.5 Mbps for good quality
  })
  const chunks: BlobPart[] = []

  return new Promise<Blob>((resolve, reject) => {
    let progressInterval: number | null = null

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        chunks.push(ev.data)
      }
    }

    recorder.onstop = () => {
      if (progressInterval) clearInterval(progressInterval)
      resolve(new Blob(chunks, { type: mime }))
    }

    recorder.onerror = (e) => {
      if (progressInterval) clearInterval(progressInterval)
      reject(e)
    }

    // Start recording
    recorder.start(100) // Collect data every 100ms

    // Progress tracking
    if (onProgress) {
      const startTime = Date.now()
      progressInterval = window.setInterval(() => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / durationMs, 1)
        onProgress(progress)
      }, 100)
    }

    // Stop recording after duration + small buffer
    const timeout = window.setTimeout(() => {
      try {
        if (recorder.state === 'recording') {
          recorder.stop()
        }
      } catch (e) {
        reject(e)
      } finally {
        window.clearTimeout(timeout)
        if (progressInterval) clearInterval(progressInterval)
      }
    }, durationMs + 200)
  })
}
