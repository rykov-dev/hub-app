/** Larger sides are scaled down to this; plenty for a phone screen. */
const MAX_SIDE = 1600;
const QUALITY = 0.85;
/** The bucket's limit (supabase/migrations/*_mvp_entries_quests.sql). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));

/**
 * Downsizes a picked or shared image to JPEG, so photos from a phone camera
 * fit the bucket and load fast. Throws a message for the user if it can't.
 */
export const prepareImage = async (file: Blob): Promise<Blob> => {
  if (!file.type.startsWith('image/')) throw new Error('Это не изображение.');
  // Animated GIFs would lose their animation on a canvas; keep small ones as is.
  if (file.type === 'image/gif' && file.size <= MAX_IMAGE_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    if (ALLOWED.includes(file.type) && file.size <= MAX_IMAGE_BYTES) return file;
    throw new Error('Не получилось открыть изображение: формат не поддерживается.');
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Не получилось обработать изображение.');
  // JPEG has no transparency: put PNG cut-outs on white rather than black.
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await toBlob(canvas, 'image/jpeg');
  if (!blob) throw new Error('Не получилось обработать изображение.');
  if (blob.size > MAX_IMAGE_BYTES) throw new Error('Изображение слишком большое (больше 5 МБ).');
  return blob;
};
