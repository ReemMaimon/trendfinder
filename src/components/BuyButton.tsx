export function BuyButton({
  productId,
  className = "",
  label = "קנייה ב-AliExpress",
}: {
  productId: string;
  className?: string;
  label?: string;
}) {
  return (
    <a
      href={`/api/go/${productId}`}
      target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      className={`btn-primary w-full ${className}`}
      data-track="buy"
    >
      <span>{label}</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 17 17 7M17 7H9M17 7v8"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}
