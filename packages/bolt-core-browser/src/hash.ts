/**
 * Compute SHA-256 hash of data.
 */
export async function sha256(data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  if (data instanceof Uint8Array) {
    return await crypto.subtle.digest('SHA-256', data as unknown as BufferSource);
  }
  return await crypto.subtle.digest('SHA-256', data);
}

/**
 * Convert ArrayBuffer to hex string.
 */
export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Compute SHA-256 hash of a File or Blob and return hex string.
 */
export async function hashFile(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await sha256(buffer);
  return bufferToHex(hash);
}
