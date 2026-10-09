import "server-only";
import { headers } from "next/headers";

/** Pathname permintaan saat ini (ditetapkan middleware lewat header x-rn-path). */
export async function pathPermintaan(): Promise<string> {
    const h = await headers();
    return h.get("x-rn-path") ?? "/";
}
