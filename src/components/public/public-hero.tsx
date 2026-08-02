"use client";

import { ZoomIn } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
// Static import, not src="/hero.jpg": with a basePath set, a literal src string
// is sent as-is and 404s. A static import is resolved at build time and the
// optimizer emits the basePath-correct URL for any deployment.
import heroImage from "@/../public/hero.jpg";

/**
 * Hero banner on the home page.
 *
 * Client Component only because of the click-to-zoom modal and the image-error
 * fallback — both need browser state.
 */
export function PublicHero() {
  const [errored, setErrored] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  return (
    <>
      <section className="flex h-full flex-col overflow-hidden rounded-xl border bg-muted">
        <div className="relative w-full aspect-video max-h-[230px] overflow-hidden rounded-xl bg-[#1e1b4b] lg:aspect-auto lg:h-full">
          {!errored ? (
            <button
              type="button"
              onClick={() => setZoomed(true)}
              className="group absolute inset-0 h-full w-full cursor-zoom-in"
              aria-label="ขยายรูปภาพ"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- object-contain + onError don't fit next/image here; this hero is one specific asset, not a content image. */}
              <img
                src={typeof heroImage === "string" ? heroImage : heroImage.src}
                alt="คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่"
                className="h-full w-full object-contain object-center"
                loading="eager"
                onError={() => setErrored(true)}
              />
              <span className="pointer-events-none absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                <ZoomIn className="size-3.5" aria-hidden />
                ขยาย
              </span>
            </button>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/30 to-primary/5">
              <span className="px-4 text-center text-sm text-muted-foreground">
                คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
              </span>
            </div>
          )}
        </div>
      </section>

      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent
          className="max-h-[92vh] max-w-[95vw] gap-0 overflow-auto border-none bg-black/95 p-0 sm:rounded-xl"
          onClick={() => setZoomed(false)}
        >
          <DialogTitle className="sr-only">
            คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่
          </DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element -- zoomed hero is one specific asset; no srcset needed. */}
          <img
            src={typeof heroImage === "string" ? heroImage : heroImage.src}
            alt="คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่"
            className="block h-auto max-h-[92vh] w-auto max-w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
