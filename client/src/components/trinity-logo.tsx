export function TrinityLogo({ className = "h-8" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className="h-full w-auto"
        aria-label="Trinity Automation Logo"
      >
        {/* Trinity triangle mark - interlocking triangles */}
        <path
          d="M24 4L40 36H8L24 4Z"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          className="text-primary"
        />
        <path
          d="M16 32L24 16L32 32H16Z"
          fill="currentColor"
          className="text-primary"
          opacity="0.9"
        />
        <circle cx="24" cy="24" r="3" fill="currentColor" className="text-primary" />
      </svg>
      <div className="flex flex-col leading-none">
        <span className="text-sm font-bold tracking-[0.25em] text-foreground">TRINITY</span>
        <span className="text-xs font-medium tracking-[0.15em] text-primary">AUTOMATION</span>
      </div>
    </div>
  );
}

export function TrinityLogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-label="Trinity"
    >
      <path
        d="M24 4L40 36H8L24 4Z"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        className="text-primary"
      />
      <path
        d="M16 32L24 16L32 32H16Z"
        fill="currentColor"
        className="text-primary"
        opacity="0.9"
      />
      <circle cx="24" cy="24" r="3" fill="currentColor" className="text-primary" />
    </svg>
  );
}
