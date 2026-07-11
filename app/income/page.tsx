import { redirect } from "next/navigation";

export default function IncomePage() {
  redirect("/expenses?view=income");
}
