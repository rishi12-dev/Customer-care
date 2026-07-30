interface PincodeDanceLoaderProps {
  label?: string;
}

export function PincodeDanceLoader({ label = "Checking pincode service..." }: PincodeDanceLoaderProps) {
  return (
    <div className="dance-loader" role="status" aria-live="polite">
      <img className="dance-loader__image" src="/stickers/pincode-dance.webp" alt="Dancing while checking pincode" />
      <div>
        <p className="dance-loader__label">{label}</p>
        <p className="dance-loader__subtext">Pincode data check ho raha hai...</p>
      </div>
    </div>
  );
}
