import { redirect } from "next/navigation";

// Pogo has no account login — the product lives in iMessage. Keep old
// /login links working by sending them to the real entry point.
export default function Login() {
  redirect("/start");
}
