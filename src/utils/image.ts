/**
 * Pure client-side image compression utility for mobile & offline performance.
 * Resizes images to reasonable thumbnail dimensions and converts to optimized WebP/JPEG data URLs.
 */
export async function compressImageFile(
  file: File,
  maxWidth = 320,
  maxHeight = 320,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image.'))
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Failed to read image file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Failed to decode image.'))
      img.onload = () => {
        let width = img.naturalWidth || img.width
        let height = img.naturalHeight || img.height

        if (width <= 0 || height <= 0) {
          return reject(new Error('Invalid image dimensions.'))
        }

        // Calculate aspect-ratio preserving dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          return reject(new Error('Could not initialize canvas context.'))
        }

        // High quality downscaling
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        // Prefer image/webp if supported, fallback to image/jpeg
        try {
          const webpDataUrl = canvas.toDataURL('image/webp', quality)
          if (webpDataUrl.startsWith('data:image/webp')) {
            return resolve(webpDataUrl)
          }
        } catch {
          // Fallback to jpeg below
        }

        resolve(canvas.toDataURL('image/jpeg', quality))
      }

      img.src = reader.result as string
    }

    reader.readAsDataURL(file)
  })
}
