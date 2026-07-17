import { HomeClient } from "./HomeClient";
import { listNotebookCards } from "@/lib/supabase";
import type { DashboardNotebookCard } from "@/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  let cards: DashboardNotebookCard[] = [];
  let error = false;

  try {
    cards = await listNotebookCards();
  } catch {
    error = true;
  }

  return <HomeClient cards={cards} error={error} />;
}
