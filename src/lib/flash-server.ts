import "server-only";
import { headers } from "next/headers";
import { bukaFlash, type FlashData } from "@/lib/flash";

/** Baca flash yang diteruskan middleware lewat header x-rn-flash. */
export async function ambilFlash(): Promise<FlashData> {
    const h = await headers();
    return (await bukaFlash(h.get("x-rn-flash"))) ?? {};
}
