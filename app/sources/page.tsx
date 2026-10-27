import { redirect } from "next/navigation";

/** Sources moved into Settings; old links still land there. */
export default function SourcesPage() {
  redirect("/settings");
}
