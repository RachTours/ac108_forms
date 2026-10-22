"use client";

import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { SignatureAnswer } from "@reviewroom/contracts/forms";
import { normalizeSignaturePoint } from "./signature-input-model";

export function SignatureInput({ id, value, onChange }: { id: string; value: SignatureAnswer | undefined; onChange: (value: SignatureAnswer) => void }) {
  const activePointer = useRef<number | null>(null);
  function coordinate(event: ReactPointerEvent<SVGSVGElement>) {
    return normalizeSignaturePoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
  }
  function start(event: ReactPointerEvent<SVGSVGElement>) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0) || activePointer.current !== null) return;
    event.preventDefault();
    activePointer.current = event.pointerId;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* The pad still works while the pointer stays over it. */ }
    onChange({ mode: "drawn", strokes: [...(value?.mode === "drawn" ? value.strokes : []), { points: [coordinate(event)] }] });
  }
  function move(event: ReactPointerEvent<SVGSVGElement>) {
    if (activePointer.current !== event.pointerId || value?.mode !== "drawn") return;
    event.preventDefault();
    const point = coordinate(event);
    const strokes = [...value.strokes];
    const last = strokes.at(-1);
    if (last && last.points.length < 1200 && strokes.reduce((sum, stroke) => sum + stroke.points.length, 0) < 1200) strokes[strokes.length - 1] = { points: [...last.points, point] };
    onChange({ mode: "drawn", strokes });
  }
  function end(event: ReactPointerEvent<SVGSVGElement>) { if (activePointer.current === event.pointerId) activePointer.current = null; }
  const drawing = value?.mode === "drawn";
  return <div className="signature-control" id={id}>
    <div className="signature-mode" role="group" aria-label="Signature input method">
      <button type="button" className={!drawing ? "button button-small button-primary" : "button button-small"} aria-pressed={!drawing} onClick={() => onChange({ mode: "typed", text: value?.mode === "typed" ? value.text : "" })}>Type name</button>
      <button type="button" className={drawing ? "button button-small button-primary" : "button button-small"} aria-pressed={drawing} onClick={() => onChange({ mode: "drawn", strokes: value?.mode === "drawn" ? value.strokes : [] })}>Draw signature</button>
    </div>
    {!drawing ? <input className="public-input signature-typed" type="text" autoComplete="name" maxLength={160} aria-label="Type your signature" value={value?.mode === "typed" ? value.text : ""} onChange={(event) => onChange({ mode: "typed", text: event.target.value })} /> : <>
      <svg className="signature-pad" viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label="Signature drawing area. Use a mouse, touch screen, or stylus. Type your name is available as an accessible alternative." onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
        {value.strokes.map((stroke, index) => <polyline key={index} points={stroke.points.map((point) => `${point.x * 600},${point.y * 180}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
      </svg>
      <button className="button button-small" type="button" onClick={() => onChange({ mode: "drawn", strokes: [] })}>Clear signature</button>
    </>}
  </div>;
}
