"use client";

import { useRef, useState } from "react";
import { Placeholder, type Ratio } from "./Placeholder";

/**
 * Until a real `src` exists this renders the labelled placeholder. Once assets
 * land, pass `src` and `poster` and the card plays inline on click —
 * `preload="none"` means video bytes are only spent on intent.
 */
export function VideoCard({
  label,
  ratio = "9/16",
  src,
  poster,
}: {
  label: string;
  ratio?: Ratio;
  src?: string;
  poster?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  if (!src) return <Placeholder label={label} ratio={ratio} />;

  return (
    <div className="relative overflow-hidden rounded-card border-[1.5px] border-line-strong">
      <video
        ref={videoRef}
        className="w-full"
        src={src}
        poster={poster}
        preload="none"
        playsInline
        controls={playing}
        onPlay={() => setPlaying(true)}
      />
      {!playing ? (
        <button
          type="button"
          aria-label={label}
          onClick={() => videoRef.current?.play()}
          className="absolute inset-0 grid place-items-center bg-ink/20 text-4xl text-white"
        >
          <span aria-hidden="true">▶</span>
        </button>
      ) : null}
    </div>
  );
}
