interface TruckLoaderProps {
  label?: string;
}

export function TruckLoader({ label = "Loading..." }: TruckLoaderProps) {
  return (
    <div className="truck-loader" role="status" aria-live="polite">
      <div className="truck-loader__sky">
        <div className="truck-loader__road" />
        <div className="truck-loader__vehicle">
          <div className="truck-loader__box" />
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
