import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AlimtalkClient from "./AlimtalkClient";

export default async function SellerAlimtalkPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <AlimtalkClient />;
}
