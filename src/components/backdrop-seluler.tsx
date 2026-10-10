"use client";

/*
 * Backdrop sidebar untuk mode drawer mobile — port dari
 * <div class="sidebar-backdrop" id="sidebarBackdrop" onclick="rnTutupSidebarMobile()">.
 */
export function BackdropSeluler() {
    return (
        <div
            className="sidebar-backdrop"
            id="sidebarBackdrop"
            aria-hidden="true"
            onClick={() =>
                (window as unknown as { rnTutupSidebarMobile?: () => void }).rnTutupSidebarMobile?.()
            }
        />
    );
}
