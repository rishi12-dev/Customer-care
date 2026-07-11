import { Plane } from "lucide-react";

interface GlobeFlightLoaderProps {
  label?: string;
}

export function GlobeFlightLoader({ label = "Checking pincode service..." }: GlobeFlightLoaderProps) {
  return (
    <div className="globe-loader" role="status" aria-live="polite">
      <div className="globe-loader__stars" />
      <div className="globe-loader__stage">
        <div className="globe-loader__aura" />
        <div className="globe-loader__orbit">
          <Plane className="globe-loader__plane" size={30} />
        </div>
        <div className="globe-loader__earth">
          <div className="globe-loader__continents" />
          <div className="globe-loader__clouds" />
          <div className="globe-loader__grid" />
          <div className="globe-loader__shine" />
        </div>
      </div>
      <div className="globe-loader__label">{label}</div>
    </div>
  );
}
