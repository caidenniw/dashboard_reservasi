import type { Metadata } from "next";
import FormLogin from "./form";
import { nextPathAman } from "@/lib/next-path";

export const metadata: Metadata = { title: "Masuk" };

/*
 * Halaman login. `searchParams` di Next.js 16 bersifat async.
 * `next` dipakai untuk redirect()->intended() pasca-login.
 */
export default async function HalamanLoginPage({
    searchParams,
}: {
    searchParams: Promise<{ next?: string }>;
}) {
    const sp = await searchParams;
    return <FormLogin next={nextPathAman(sp.next ?? "/")} />;
}
