"use client";

import { useRef } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from "react";
import type { SignatureAnswer } from "@reviewroom/contracts/forms";
import { normalizeSignaturePoint, shouldIgnoreMouseAfterTouch } from "./signature-input-model";
import { useTranslations } from "next-intl";

export function SignatureInput({ id, value, onChange }: { id: string; value: SignatureAnswer | undefined; onChange: (value: SignatureAnswer) => void }) {
  const t = useTranslations("editor");
  const activeGesture = useRef<{ kind: "pointer" | "touch" | "mouse"; id: number } | null>(null);
  const lastTouchAt = useRef(0);
  function coordinate(event: ReactPointerEvent<SVGSVGElement>) {
    return normalizeSignaturePoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
  }
  function pointAt(element: SVGSVGElement, clientX: number, clientY: number) {
    return normalizeSignaturePoint(clientX, clientY, element.getBoundingClientRect());
  }
  function begin(kind: "pointer" | "touch" | "mouse", id: number, point: { x: number; y: number }) {
    if (activeGesture.current !== null) return;
    activeGesture.current = { kind, id };
    onChange({ mode: "drawn", strokes: [...(value?.mode === "drawn" ? value.strokes : []), { points: [point] }] });
  }
  function append(kind: "pointer" | "touch" | "mouse", id: number, point: { x: number; y: number }) {
    const active = activeGesture.current;
    if (active?.kind !== kind || active.id !== id || value?.mode !== "drawn") return;
    const strokes = [...value.strokes];
    const last = strokes.at(-1);
    if (last && last.points.length < 1200 && strokes.reduce((sum, stroke) => sum + stroke.points.length, 0) < 1200) strokes[strokes.length - 1] = { points: [...last.points, point] };
    onChange({ mode: "drawn", strokes });
  }
  function finish(kind: "pointer" | "touch" | "mouse", id: number) {
    if (activeGesture.current?.kind === kind && activeGesture.current.id === id) activeGesture.current = null;
  }
  function start(event: ReactPointerEvent<SVGSVGElement>) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0) || activeGesture.current !== null) return;
    event.preventDefault();
    begin("pointer", event.pointerId, coordinate(event));
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* The pad still works while the pointer stays over it. */ }
  }
  function move(event: ReactPointerEvent<SVGSVGElement>) {
    if (activeGesture.current?.kind !== "pointer" || activeGesture.current.id !== event.pointerId) return;
    event.preventDefault();
    append("pointer", event.pointerId, coordinate(event));
  }
  function end(event: ReactPointerEvent<SVGSVGElement>) { finish("pointer", event.pointerId); }
  function startTouch(event: ReactTouchEvent<SVGSVGElement>) {
    if (typeof window !== "undefined" && "PointerEvent" in window) return;
    lastTouchAt.current = Date.now();
    const touch = event.changedTouches.item(0);
    if (!touch) return;
    event.preventDefault();
    begin("touch", touch.identifier, pointAt(event.currentTarget, touch.clientX, touch.clientY));
  }
  function moveTouch(event: ReactTouchEvent<SVGSVGElement>) {
    if (activeGesture.current?.kind !== "touch") return;
    event.preventDefault();
    const touch = Array.from(event.changedTouches).find((candidate) => candidate.identifier === activeGesture.current?.id);
    if (touch) append("touch", touch.identifier, pointAt(event.currentTarget, touch.clientX, touch.clientY));
  }
  function endTouch(event: ReactTouchEvent<SVGSVGElement>) {
    const touch = Array.from(event.changedTouches).find((candidate) => candidate.identifier === activeGesture.current?.id);
    if (touch) finish("touch", touch.identifier);
  }
  function startMouse(event: ReactMouseEvent<SVGSVGElement>) {
    if (typeof window !== "undefined" && "PointerEvent" in window) return;
    if (shouldIgnoreMouseAfterTouch(lastTouchAt.current, Date.now())) return;
    if (event.button !== 0) return;
    event.preventDefault();
    begin("mouse", 1, pointAt(event.currentTarget, event.clientX, event.clientY));
  }
  function moveMouse(event: ReactMouseEvent<SVGSVGElement>) {
    if (activeGesture.current?.kind !== "mouse") return;
    event.preventDefault();
    append("mouse", 1, pointAt(event.currentTarget, event.clientX, event.clientY));
  }
  function endMouse() { finish("mouse", 1); }
  const drawing = value?.mode === "drawn";
  return <div className="signature-control" id={id}>
    <div className="signature-mode" role="group" aria-label={t("signatureMethod")}>
      <button type="button" className={!drawing ? "button button-small button-primary" : "button button-small"} aria-pressed={!drawing} onClick={() => onChange({ mode: "typed", text: value?.mode === "typed" ? value.text : "" })}>{t("typeSignatureName")}</button>
      <button type="button" className={drawing ? "button button-small button-primary" : "button button-small"} aria-pressed={drawing} onClick={() => onChange({ mode: "drawn", strokes: value?.mode === "drawn" ? value.strokes : [] })}>{t("drawSignature")}</button>
    </div>
    {!drawing ? <input className="public-input signature-typed" type="text" autoComplete="name" maxLength={160} aria-label={t("typeYourSignature")} value={value?.mode === "typed" ? value.text : ""} onChange={(event) => onChange({ mode: "typed", text: event.target.value })} /> : <>
      <svg className="signature-pad" viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label={t("signatureDrawingArea")} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onTouchStart={startTouch} onTouchMove={moveTouch} onTouchEnd={endTouch} onTouchCancel={endTouch} onMouseDown={startMouse} onMouseMove={moveMouse} onMouseUp={endMouse} onMouseLeave={endMouse}>
        {value.strokes.map((stroke, index) => <polyline key={index} points={stroke.points.map((point) => `${point.x * 600},${point.y * 180}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
      </svg>
      <button className="button button-small" type="button" onClick={() => onChange({ mode: "drawn", strokes: [] })}>{t("clearSignature")}</button>
    </>}
  </div>;
}
