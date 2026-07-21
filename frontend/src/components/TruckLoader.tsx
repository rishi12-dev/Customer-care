interface TruckLoaderProps {
  label?: string;
  brand?: "delhivery" | "indiashoppe" | "generic";
  stickerSrc?: string;
  stickerAlt?: string;
}

export function TruckLoader({ label = "Loading...", brand = "generic", stickerSrc, stickerAlt = "Loading sticker" }: TruckLoaderProps) {
  const brandLabel = brand === "delhivery" ? "DELHIVERY" : brand === "indiashoppe" ? "indiaShoppe" : "CourierOps";
  return (
    <div className="truck-loader" role="status" aria-live="polite">
      {stickerSrc && <img className="truck-loader__sticker" src={stickerSrc} alt={stickerAlt} />}
      <div className="truck-loader__sky">
        <div className="truck-loader__road" />
        <div className="truck-loader__vehicle">
          <div className="truck-loader__box">
            <div className={`truck-loader__logo truck-loader__logo--${brand}`}>
              {brand === "indiashoppe" ? (
                <>
                  <span className="truck-loader__logo-mark">IS</span>
                  <span><b>india</b>Shoppe</span>
                </>
              ) : (
                brandLabel
              )}
            </div>
          </div>
          <div className="truck-loader__cab">
            <div className="truck-loader__window" />
            <div className="truck-loader__light" />
          </div>
          <div className="truck-loader__wheel truck-loader__wheel--back" />
          <div className="truck-loader__wheel truck-loader__wheel--front" />
        </div>
      </div>
      <div className="truck-loader__label">{label}</div>
    </div>
  );
}
