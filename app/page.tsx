import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default function Home() {
  redirect(`/room/${Math.random().toString(36).slice(2, 10)}`);
}
