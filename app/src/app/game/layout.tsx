import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
          min-height: 0 !important;
          height: 100dvh !important;
          width: 100vw !important;
        }
        html {
          background: transparent !important;
          background-color: transparent !important;
          background-image: none !important;
        }
        body::before, body::after {
          display: none !important;
        }
        nextjs-portal,
        body > nextjs-portal,
        [data-nextjs-dialog-overlay],
        .__next-build-watcher,
        #__next-build-indicator {
          display: none !important;
        }
      `}</style>
      {children}
    </>
  );
}
