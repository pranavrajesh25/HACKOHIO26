"use client";

import { useEffect, useRef, useState } from "react";
import { projectSuggestionSchema, type ProjectFields } from "@/lib/project-schema";
import { recordingToWav } from "@/lib/voice-audio";

export default function ProjectVoice({ onApply, disabled }: { onApply: (fields: ProjectFields) => boolean; disabled: boolean }) {
  const [phase, setPhase] = useState<"idle" | "starting" | "recording" | "processing">("idle");
  const [seconds, setSeconds] = useState(0);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [applied, setApplied] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const abort = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const objectUrl = useRef("");
  const apply = useRef(onApply);
  useEffect(() => { apply.current = onApply; }, [onApply]);
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach(track => track.stop());
    if (timer.current) clearInterval(timer.current);
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; abort.current?.abort(); URL.revokeObjectURL(objectUrl.current); if (timer.current) clearInterval(timer.current); if (recorder.current?.state === "recording") recorder.current.stop(); stream.current?.getTracks().forEach(track => track.stop()); };
  }, []);
  async function start() {
    setError(""); setPhase("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Microphone recording is unavailable in this browser. Use HTTPS or localhost, or type a description below.");
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const next = new MediaRecorder(media); recorder.current = next;
      const chunks: BlobPart[] = [];
      next.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      next.onstop = () => {
        stream.current?.getTracks().forEach(track => track.stop());
        if (timer.current) clearInterval(timer.current);
        if (mounted.current) {
          const blob = new Blob(chunks, { type: next.mimeType });
          URL.revokeObjectURL(objectUrl.current); objectUrl.current = URL.createObjectURL(blob);
          setAudio(blob); setUrl(objectUrl.current); setPhase("idle");
        }
      };
      next.onerror = () => { stop(); if (mounted.current) { setError("Recording failed. Please re-record or type a description."); setPhase("idle"); } };
      setAudio(null); setUrl(""); setTranscript(""); setApplied(false); setSeconds(0);
      next.start(); setPhase("recording");
      const began = Date.now();
      timer.current = setInterval(() => { const elapsed = Math.floor((Date.now() - began) / 1000); setSeconds(Math.min(60, elapsed)); if (elapsed >= 60) stop(); }, 200);
    } catch (e) { stream.current?.getTracks().forEach(track => track.stop()); if (mounted.current) { setPhase("idle"); setError(e instanceof Error ? e.message : "Microphone access failed. You can type a description instead."); } }
  }
  async function generate(useTranscript: boolean) {
    setPhase("processing"); setError("");
    const controller = new AbortController(); abort.current = controller;
    try {
      const body = useTranscript ? JSON.stringify({ transcript }) : await recordingToWav(audio!);
      if (!mounted.current) return;
      const response = await fetch("/api/project-voice", { method: "POST", headers: { "Content-Type": useTranscript ? "application/json" : "audio/wav" }, body, signal: controller.signal });
      const output = await response.json();
      if (!mounted.current) return;
      if (typeof output.transcript === "string") setTranscript(output.transcript);
      if (!response.ok) throw new Error(output.error || "Voice assistance failed. Please retry.");
      const result = projectSuggestionSchema.parse(output);
      if (apply.current(result.fields)) { setSuggestions(result.suggestedFields); setApplied(true); }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Voice assistance failed. Your form is unchanged."); }
    finally { if (mounted.current) setPhase("idle"); }
  }
  const working = phase !== "idle" || disabled;
  return <section className="panel form-panel" aria-label="Voice project draft">
    <h2>Describe your project out loud</h2>
    <p>Around 30 seconds is ideal; recording stops at 60 seconds. What problem are you solving, who is it for, and how could a student help?</p>
    <p className="small-print">Audio is sent to OpenRouter only when you generate a draft. We do not save the recording. AI may suggest details; review every field before saving. Nothing is published automatically.</p>
    <div className="response-actions"><button type="button" className="button secondary" disabled={working} onClick={start}>{audio ? "Re-record description" : "Record description"}</button>
      {phase === "recording" && <button type="button" className="button secondary" onClick={stop}>Stop recording</button>}
      <span role="status">{phase === "recording" ? `Recording ${seconds}s / 60s` : phase === "processing" ? "Transcribing and drafting…" : phase === "starting" ? "Waiting for microphone permission…" : audio ? `Recording ready (${seconds}s)` : ""}</span>
    </div>
    {url && <audio controls src={url} aria-label="Recorded project description" />}
    {audio && <button type="button" className="button secondary" disabled={working} onClick={() => generate(false)}>Generate project draft from recording</button>}
    <label className="field"><span>Transcript or typed project description</span><textarea rows={3} maxLength={12000} value={transcript} disabled={working} onChange={e => setTranscript(e.target.value)} placeholder="You can also type here, or edit the transcript and retry." /></label>
    <button type="button" className="button secondary" disabled={working || transcript.trim().length < 20} onClick={() => generate(true)}>Generate project draft from text</button>
    {error && <p role="alert">{error}</p>}
    {applied && <div className="notice" role="status"><p><strong>AI-suggested draft applied. Review all fields.</strong> {suggestions.length ? `Inferred or synthesized fields: ${suggestions.join(", ")}.` : "Check the draft against your description."} Nothing has been saved or published.</p></div>}
  </section>;
}
