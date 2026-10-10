import type { LiveList, LiveObject } from "@liveblocks/client";

export type Stroke = { points: number[][]; color: string; size: number };
export type Note = { id: string; x: number; y: number; text: string; color: string };

export type Presence = {
  cursor: { x: number; y: number } | null;
  draft: Stroke | null;
  name: string;
  color: string;
};

export type Storage = {
  strokes: LiveList<Stroke>;
  notes: LiveList<LiveObject<Note>>;
};

export type UserMeta = { id?: string; info?: { name: string } };
