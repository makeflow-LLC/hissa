export default function Stars({ rating }: { rating: number }) {
  return (
    <span className="stars" aria-label={`التقييم ${rating} من ٥`}>
      <span className="stars-base" aria-hidden="true">
        ★★★★★
      </span>
      <span
        className="stars-fill"
        aria-hidden="true"
        style={{ width: `${(rating / 5) * 100}%` }}
      >
        ★★★★★
      </span>
    </span>
  );
}
