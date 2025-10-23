export async function captureWebMBlob(canvas: HTMLCanvasElement, durationMs: number, fps = 30): Promise<Blob> {
  if (!canvas) throw new Error("Canvas not provided")
  if (!durationMs || durationMs <= 0) throw new Error("Invalid duration")

  const stream = canvas.captureStream(fps)
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm"
  const recorder = new MediaRecorder(stream, { mimeType: mime })
  const chunks: BlobPart[] = []

  return new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data)
    }
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }))
    recorder.onerror = (e) => reject(e)
    recorder.start()

    // Safety margin to ensure the last frame is flushed
    const timeout = window.setTimeout(() => {
      try {
        recorder.stop()
      } catch (e) {
        reject(e)
      } finally {
        window.clearTimeout(timeout)
      }
    }, durationMs + 150)
  })
}
