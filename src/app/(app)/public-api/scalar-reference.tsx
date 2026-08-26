"use client";

import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { buildOpenApiDocument } from "./openapi-document";

const emptySubscribe = () => () => {};

/**
 * Scalar API reference (Swagger-style interactive docs) for the frozen Public
 * API. Rendered only after mount: the Vue-based widget isn't meant to be
 * server-rendered, and the dark-mode flag depends on the resolved theme,
 * which next-themes only knows on the client.
 */
export function ScalarReference({ serverUrl }: { serverUrl: string }) {
  const { resolvedTheme } = useTheme();
  // The canonical is-hydrated check — false on the server, true on the client,
  // with no setState-in-effect.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <div className="flex h-96 items-center justify-center text-sm text-muted-foreground">
        กำลังโหลดเอกสาร API…
      </div>
    );
  }

  return (
    <ApiReferenceReact
      // Scalar applies darkMode at mount — updateConfiguration() after the
      // fact leaves the colors stale. Remounting on theme flips is the
      // reliable way to switch, and it happens rarely enough not to matter.
      key={resolvedTheme ?? "light"}
      configuration={{
        spec: { content: buildOpenApiDocument(serverUrl) },
        darkMode: resolvedTheme === "dark",
        hideClientButton: true,
      }}
    />
  );
}
