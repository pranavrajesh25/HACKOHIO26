// Normalize browser WebM/MP4 recordings to the transcription model's WAV input.
export async function recordingToWav(blob: Blob) {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const length = Math.min(16000 * 60, Math.floor(decoded.duration * 16000));
    if (!length) throw new Error("The recording was empty. Please try again.");
    const offline = new OfflineAudioContext(1, length, 16000);
    const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
    const samples = (await offline.startRendering()).getChannelData(0);
    const bytes = new ArrayBuffer(44 + samples.length * 2); const view = new DataView(bytes);
    const text = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    text(0, "RIFF"); view.setUint32(4, bytes.byteLength - 8, true); text(8, "WAVE"); text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) { const sample = Math.max(-1, Math.min(1, samples[i])); view.setInt16(44 + i * 2, sample < 0 ? sample * 32768 : sample * 32767, true); }
    return new Blob([bytes], { type: "audio/wav" });
  } finally { await context.close(); }
}
