// Brand mark (five meter bars on a console key) and the small equaliser used as a loading state.

export function BrandMark({ size = 30 }: { size?: number }) {
  const bars = [
    { x: 7, h: 6 },
    { x: 11, h: 12 },
    { x: 15, h: 18 },
    { x: 19, h: 11 },
    { x: 23, h: 7 },
  ];
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
      <rect x="0.5" y="0.5" width="29" height="29" rx="8.5" className="brand-mark-key" />
      {bars.map((b) => (
        <rect key={b.x} x={b.x - 1.25} y={15 - b.h / 2} width="2.5" height={b.h} rx="1.25" className="brand-mark-bar" />
      ))}
    </svg>
  );
}

/** Three bars that move while something is generating; static when motion is reduced. */
export function EqLoader({ label }: { label?: string }) {
  return (
    <span className="eq" role={label ? 'status' : undefined} aria-label={label}>
      <span />
      <span />
      <span />
    </span>
  );
}
