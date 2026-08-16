type BrandAssetProps = {
  className?: string;
};

export function QuoteBenchMark({ className = "" }: BrandAssetProps) {
  return (
    <span className={`brand-mark ${className}`.trim()} aria-hidden="true">
      {/* The platform mark is decorative wherever the adjacent product name is visible. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/quotebench-mark.png" alt="" width="180" height="180" />
    </span>
  );
}

export function QuoteBenchLogo({ className = "" }: BrandAssetProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src="/quotebench-logo.png"
      alt="QuoteBench"
      width="490"
      height="450"
    />
  );
}
