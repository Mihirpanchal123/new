import type { Metadata } from "next";
import { CreateRoom } from "@/components/play/create-room";

export const metadata: Metadata = { title: "Create game", robots: { index: false } };

export default function CreatePage() {
  return <CreateRoom />;
}
