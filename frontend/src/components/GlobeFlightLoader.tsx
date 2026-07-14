import { ClipboardCheck, MapPin, PackageSearch, Route, Truck } from "lucide-react";

interface GlobeFlightLoaderProps {
  label?: string;
}

export function GlobeFlightLoader({ label = "Checking pincode service..." }: GlobeFlightLoaderProps) {
  return (
    <div className="globe-loader" role="status" aria-live="polite">
      <div className="globe-loader__overlay" />
      <div className="globe-loader__content">
        <div className="globe-loader__brand">
          <span className="globe-loader__brand-mark">IS</span>
          <div>
            <div className="globe-loader__brand-name"><span>india</span>Shoppe</div>
            <div className="globe-loader__brand-subtitle">Where India Shops...</div>
          </div>
        </div>
        <p className="globe-loader__eyebrow">Pincode Search</p>
        <h3 className="globe-loader__title">{label}</h3>
        <p className="globe-loader__caption">Fetching zone, courier and route information</p>
        <div className="globe-loader__progress" aria-hidden="true">
          <span />
        </div>
        <div className="globe-loader__steps" aria-hidden="true">
          <div className="globe-loader__step globe-loader__step--done"><PackageSearch size={22} /><span>Validating</span></div>
          <div className="globe-loader__step globe-loader__step--done"><MapPin size={22} /><span>Finding Zone</span></div>
          <div className="globe-loader__step globe-loader__step--active"><Truck size={24} /><span>Finding Courier</span></div>
          <div className="globe-loader__step"><Route size={22} /><span>Route</span></div>
          <div className="globe-loader__step"><ClipboardCheck size={22} /><span>Results</span></div>
        </div>
        <div className="globe-loader__wait">This may take a few seconds. Please wait...</div>
      </div>
    </div>
  );
}
