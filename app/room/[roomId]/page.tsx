"use client";

import { useRef, useState, memo, type PointerEvent as PE } from "react";
import { useParams } from "next/navigation";
import { getStroke } from "perfect-freehand";
import { LiveObject } from "@liveblocks/client";
import {
  RoomProvider, ClientSideSuspense, useOthers, useMyPresence, useStorage, useMutation, initialStorage,
} from "@/liveblocks.config";
import type { Stroke } from "@/types";

const COLORS = ["#111827", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"];
const NOTE_COLORS = ["#fef08a", "#fbcfe8", "#bae6fd", "#bbf7d0"];
const SIZE = 6;

const toPath = (s: Stroke) => {
  const o = getStroke(s.points as number[][], {
    size: s.size, thinning: 0.6, smoothing: 0.5, streamline: 0.5,
    simulatePressure: s.points[0]?.[2] === 0.5,
  });
  if (!o.length) return "";
  const d = o.reduce<(string | number)[]>(
    (a, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      a.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return a;
    },
    ["M", ...o[0], "Q"]
  );
  return [...d, "Z"].join(" ");
};

const Cursor = ({ x, y, color, name }: { x: number; y: number; color: string; name: string }) => (
  <div
    className="pointer-events-none fixed left-0 top-0 z-50 flex items-start transition-transform duration-75"
    style={{ transform: `translate(${x}px,${y}px)` }}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill={color} stroke="#fff" strokeWidth="1.5">
      <path d="M5 3l14 8-6 2-2 6z" />
    </svg>
    <span className="ml-1 mt-3 rounded-full px-2 py-0.5 text-xs font-medium text-white shadow" style={{ background: color }}>
      {name}
    </span>
  </div>
);

const StickyNote = memo(function StickyNote({ id }: { id: string }) {
  const note = useStorage((r) => r.notes.find((n) => n.id === id));
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const patch = useMutation(({ storage }, p: Partial<{ x: number; y: number; text: string }>) => {
    storage.get("notes").find((n) => n.get("id") === id)?.update(p);
  }, [id]);
  const remove = useMutation(({ storage }) => {
    const l = storage.get("notes");
    const i = l.findIndex((n) => n.get("id") === id);
    if (i >= 0) l.delete(i);
  }, [id]);

  if (!note) return null;
  return (
    <div
      className="fixed z-10 flex h-40 w-44 flex-col rounded-md shadow-lg"
      style={{ left: note.x, top: note.y, background: note.color }}
    >
      <div
        className="flex h-6 cursor-grab touch-none items-center justify-between rounded-t-md bg-black/10 px-1.5 active:cursor-grabbing"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { dx: e.clientX - note.x, dy: e.clientY - note.y };
        }}
        onPointerMove={(e) => drag.current && patch({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy })}
        onPointerUp={() => (drag.current = null)}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-black/40">Note</span>
        <button
          className="text-sm leading-none text-black/50 hover:text-black"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => remove()}
          aria-label="Delete note"
        >
          ×
        </button>
      </div>
      <textarea
        className="flex-1 resize-none bg-transparent p-2 text-sm text-gray-900 outline-none"
        value={note.text}
        placeholder="Type…"
        onChange={(e) => patch({ text: e.target.value })}
      />
    </div>
  );
});

function Board() {
  const [me, setMe] = useMyPresence();
  const [color, setColor] = useState(COLORS[0]);
  const others = useOthers();
  const strokes = useStorage((r) => r.strokes);
  const noteIds = useStorage((r) => r.notes.map((n) => n.id), (a, b) => a.length === b.length && a.every((v, i) => v === b[i]));
  const draft = useRef<Stroke | null>(null);

  const addStroke = useMutation(({ storage }, s: Stroke) => { storage.get("strokes").push(s); }, []);
  const clear = useMutation(({ storage }) => { storage.get("strokes").clear(); storage.get("notes").clear(); }, []);
  const addNote = useMutation(({ storage }) => {
    storage.get("notes").push(new LiveObject({
      id: crypto.randomUUID(),
      x: window.innerWidth / 2 - 88 + Math.random() * 80 - 40,
      y: window.innerHeight / 2 - 80 + Math.random() * 80 - 40,
      text: "",
      color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
    }));
  }, []);

  const pos = (e: PE) => ({ x: e.clientX, y: e.clientY });

  const down = (e: PE<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draft.current = { points: [[e.clientX, e.clientY, e.pressure]], color, size: SIZE };
    setMe({ draft: draft.current, cursor: pos(e) });
  };
  const move = (e: PE<SVGSVGElement>) => {
    if (draft.current) {
      draft.current = { ...draft.current, points: [...draft.current.points, [e.clientX, e.clientY, e.pressure]] };
      setMe({ draft: draft.current, cursor: pos(e) });
    } else setMe({ cursor: pos(e) });
  };
  const up = () => {
    if (!draft.current) return;
    if (draft.current.points.length > 1) addStroke(draft.current);
    draft.current = null;
    setMe({ draft: null });
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-neutral-50 [background-image:radial-gradient(#d4d4d8_1px,transparent_1px)] [background-size:20px_20px]">
      <svg
        className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={() => setMe({ cursor: null })}
      >
        {strokes.map((s, i) => <path key={i} d={toPath(s as Stroke)} fill={s.color} />)}
        {others.map(({ connectionId, presence }) =>
          presence.draft ? <path key={connectionId} d={toPath(presence.draft)} fill={presence.draft.color} opacity={0.8} /> : null
        )}
        {me.draft && <path d={toPath(me.draft)} fill={me.draft.color} />}
      </svg>

      {noteIds.map((id) => <StickyNote key={id} id={id} />)}

      {others.map(({ connectionId, presence }) =>
        presence.cursor ? <Cursor key={connectionId} {...presence.cursor} color={presence.color} name={presence.name} /> : null
      )}

      <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-black/5 bg-white/90 px-3 py-2 shadow-xl backdrop-blur">
        {COLORS.map((c) => (
          <button
            key={c}
            aria-label={c}
            onClick={() => setColor(c)}
            className={`h-7 w-7 rounded-full transition ${color === c ? "scale-110 ring-2 ring-offset-2 ring-gray-900" : "hover:scale-110"}`}
            style={{ background: c }}
          />
        ))}
        <span className="mx-1 h-6 w-px bg-gray-200" />
        <button onClick={() => addNote()} className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-yellow-100">
          + Note
        </button>
        <button onClick={() => clear()} className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
          Clear
        </button>
        <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{others.length + 1} online</span>
      </div>
    </main>
  );
}

export default function Page() {
  const { roomId } = useParams<{ roomId: string }>();
  const [init] = useState(() => ({
    cursor: null,
    draft: null,
    name: `User ${Math.floor(Math.random() * 900 + 100)}`,
    color: COLORS[1 + Math.floor(Math.random() * (COLORS.length - 1))],
  }));

  return (
    <RoomProvider id={`whiteboard:${roomId}`} initialPresence={init} initialStorage={initialStorage}>
      <ClientSideSuspense fallback={<div className="grid h-screen place-items-center text-gray-400">Loading…</div>}>
        <Board />
      </ClientSideSuspense>
    </RoomProvider>
  );
}
