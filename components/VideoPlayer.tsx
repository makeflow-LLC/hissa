"use client";

import { useState } from "react";

interface Props {
  src: string;
  gradient: string;
  emoji: string;
  title: string;
  duration: string;
}

export default function VideoPlayer({ src, gradient, emoji, title, duration }: Props) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="video-frame">
        {/* فيديو تجريبي placeholder — لا توجد ترجمة نصية لمحتواه */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video className="video-el" src={src} controls autoPlay playsInline />
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
