"use client";

import { useEffect, useMemo, useRef } from "react";
import { buildHtmlSkinStepPreviewDocument, HTML_SKIN_SAMPLE_TOKENS } from "@mvn/shared";

export type SkinPreviewScreen = {
  id: string;
  html: string;
  css: string;
  hasVideoSlot: boolean;
  hasNextVideoSlot: boolean;
  titleOnly: boolean;
  title?: string;
  version?: number;
};

export function SkinCardThumbnail({
  previewScreen,
  tone,
  name,
}: {
  previewScreen: SkinPreviewScreen | null;
  tone: string;
  name: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const srcdoc = useMemo(() => {
    if (!previewScreen) return null;
    const baseHref = typeof window !== "undefined" ? `${window.location.origin}/` : "/";
    return buildHtmlSkinStepPreviewDocument({
      screens: [previewScreen],
      screenId: previewScreen.id,
      tokens: HTML_SKIN_SAMPLE_TOKENS,
      videoUrl: previewScreen.hasVideoSlot ? "/skins/neon-arcade/mvn_shoulder_press.mp4" : null,
      nextVideoUrl: previewScreen.hasNextVideoSlot ? "/skins/neon-arcade/mvn_shoulder_press.mp4" : null,
      baseHref,
    });
  }, [previewScreen]);

  useEffect(() => {
    if (!srcdoc) return;
    const wrap = wrapRef.current;
    const iframe = iframeRef.current;
    if (!wrap || !iframe) return;
    const relayout = () => {
      const width = wrap.clientWidth;
      if (!width) return;
      const scale = width / 1920;
      iframe.style.transform = `scale(${scale})`;
      wrap.style.height = `${1080 * scale}px`;
    };
    relayout();
    const observer = new ResizeObserver(relayout);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [srcdoc]);

  if (!previewScreen || !srcdoc) {
    return (
      <div
        className="shot"
        style={{
          background: tone,
          borderRadius: 8,
          aspectRatio: "16/9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: "#fff",
            textShadow: "0 1px 2px #000",
            padding: 8,
            textAlign: "center",
          }}
        >
          {previewScreen ? name : "화면 없음"}
        </span>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      style={{
        position: "relative",
        width: "100%",
        overflow: "hidden",
        borderRadius: 8,
        background: "#000",
      }}
    >
      <iframe
        ref={iframeRef}
        title={`${name} 미리보기`}
        sandbox=""
        srcDoc={srcdoc}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1920,
          height: 1080,
          border: 0,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}