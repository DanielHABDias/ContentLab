export function Logo({ compact = false }) {
  return (
    <div className="brand" aria-label="Content Lab">
      <svg className="brand-mark" viewBox="0 0 48 48" role="img" aria-hidden="true">
        <defs>
          <pattern id="dots" width="5" height="5" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="currentColor" />
          </pattern>
        </defs>
        <path className="mark-blue" d="M7 5h30l6 6v25l-7 7H7l-3-4V10z" />
        <path className="mark-red" d="M10 8h27l4 5v21l-7 6H10L7 37V13z" />
        <path className="mark-ink" d="M13 12h22l2 3v17l-5 4H13l-2-2V15z" />
        <path className="mark-cut" d="M17 17h14v4h-9v7h9v4H17z" />
        <path className="mark-dots" d="M11 11h26v26H11z" />
      </svg>
      {!compact && <span><strong>CONTENT</strong><em>LAB</em></span>}
    </div>
  );
}
