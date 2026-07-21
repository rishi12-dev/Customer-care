type StickerNoticeVariant = "wrong" | "empty";

interface StickerNoticeProps {
  message: string;
  variant: StickerNoticeVariant;
}

const stickerMap: Record<StickerNoticeVariant, { src: string; alt: string }> = {
  wrong: {
    src: "/stickers/wrong-input.jpeg",
    alt: "Wrong input",
  },
  empty: {
    src: "/stickers/no-record.webp",
    alt: "No record found",
  },
};

export function StickerNotice({ message, variant }: StickerNoticeProps) {
  const sticker = stickerMap[variant];

  return (
    <div className={`sticker-notice sticker-notice--${variant}`} role="status">
      <img src={sticker.src} alt={sticker.alt} className="sticker-notice__image" />
      <p>{message}</p>
    </div>
  );
}
