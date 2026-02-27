import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export interface UploadResult {
  url: string;
  name: string;
  type: string;
  size: number;
}

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export async function uploadFile(
  file: File,
  folder: string,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  if (file.size > MAX_SIZE) {
    throw new Error(`"${file.name}" es demasiado grande. Máximo 50MB.`);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${folder}/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => reject(err),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({ url, name: file.name, type: file.type, size: file.size });
      },
    );
  });
}

export function isImageType(type: string) {
  return type.startsWith('image/');
}

export function isVideoType(type: string) {
  return type.startsWith('video/');
}

export function isAudioType(type: string) {
  return type.startsWith('audio/');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
