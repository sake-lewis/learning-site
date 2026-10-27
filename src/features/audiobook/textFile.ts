// Imported book files (.txt, .md). `File.text()` always reads UTF-8, which turns the accents of an
// older Windows text file into "�". Read UTF-16 when a byte-order mark says so (Notepad's "Unicode"),
// UTF-8 when the bytes are valid UTF-8, and Windows-1252 otherwise.

export function decodeText(bytes: Uint8Array<ArrayBuffer>): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}
