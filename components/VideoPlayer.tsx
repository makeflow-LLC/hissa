"use client";

import { useState } from "react";

interface Props {
  src: string;
  gradient: string;
  emoji: string;
  title: string;
  duration: string;
}

/** يستخرج معرّف يوتيوب من صيغ الروابط الشائعة (watch / youtu.be / embed / shorts) */
function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1) || null;
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|shorts)\/([^/?]+)/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

export default function VideoPlayer({ src, gradient, emoji, title, duration }: Props) {
  const [playing, setPlaying] = useState(false);
  const ytId = youtubeId(src);

  if (playing) {
    return (
      <div className="video-frame">
        {ytId ? (
          <iframe
            className="video-el"
            src={`https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          // فيديو تجريبي placeholder — لا توجد ترجمة نصية لمحتواه
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video className="video-el" src={src} controls autoPlay playsInline />
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="video-frame video-poster"
      style={{ background: gradient }}
      onClick={() => setPlaying(true)}
      aria-label={`تشغيل فيديو: ${title}`}
    >
      <span className="video-poster-emoji" aria-hidden="true">
        {emoji}
      </span>
      <span className="video-play-btn" aria-hidden="true">
        ▶
      </span>
      <span className="video-poster-meta">
        <span className="video-poster-title">{title}</span>
        <span className="video-poster-duration">⏱ {duration}</span>
      </span>
    </button>
  );
}
