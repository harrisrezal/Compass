"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";
import type { HazardLevel } from "./HazardCard";

interface HazardMapData {
  user_lat_lng: [number, number];
  active_overlays: string[];
  evacuation_route?: { trigger: string } | null;
  nearby_resources?: Array<{ name: string; type: string; lat: number; lng: number }>;
}

interface Props {
  mapData: HazardMapData;
  hazardLevels: Record<string, HazardLevel>;
}

const OVERLAY_COLORS: Record<HazardLevel, string> = {
  LOW:      "#4CAF50",
  MODERATE: "#FFC107",
  HIGH:     "#FF5722",
  CRITICAL: "#F44336",
};

const OVERLAY_OPACITY: Record<HazardLevel, number> = {
  LOW:      0.2,
  MODERATE: 0.3,
  HIGH:     0.4,
  CRITICAL: 0.5,
};

const HAZARD_LABELS: Record<string, string> = {
  psps:       "⚡ PSPS Zone",
  wildfire:   "🔥 Wildfire",
  flood:      "🌊 Flood",
  heat:       "🌡️ Heat",
  earthquake: "🫨 Seismic",
};

export default function HazardMap({ mapData, hazardLevels }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>(
    () => Object.fromEntries(mapData.active_overlays.map((k) => [k, true]))
  );
  const [loadError, setLoadError] = useState(false);
  const circlesRef = useRef<Record<string, google.maps.Circle>>({});

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setLoadError(true);
      return;
    }

    // Guard against double-init: setOptions must only be called before the
    // Maps script loads. Navigating between pages that both render HazardMap
    // (e.g. /hazards → /dashboard) would call it twice and trigger the
    // "didn't load Google Maps correctly" error.
    if (typeof window !== "undefined" && !window.google?.maps) {
      setOptions({ key: apiKey, v: "weekly" });
    }

    Promise.all([
      importLibrary("maps"),
      importLibrary("places"),
      importLibrary("routes"),
    ]).then(() => {
      if (!mapRef.current) return;

      const [lat, lng] = mapData.user_lat_lng;

      const map = new google.maps.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 11,
        mapTypeId: "roadmap",
        styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
      });
      googleMapRef.current = map;

      // User location pin
      new google.maps.Marker({
        position: { lat, lng },
        map,
        title: "Your Location",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#1E40AF",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
          scale: 10,
        },
      });

      // Draw hazard radius circles as overlay proxies
      // (In production these would be real GeoJSON polygons from the APIs)
      mapData.active_overlays.forEach((hazardKey) => {
        const level = hazardLevels[hazardKey] ?? "LOW";
        if (level === "LOW") return;

        const radiusKm: Record<string, number> = {
          psps:       15,
          wildfire:   8,
          flood:      5,
          heat:       25,
          earthquake: 20,
        };

        const circle = new google.maps.Circle({
          strokeColor: OVERLAY_COLORS[level],
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: OVERLAY_COLORS[level],
          fillOpacity: OVERLAY_OPACITY[level],
          map,
          center: { lat, lng },
          radius: (radiusKm[hazardKey] ?? 10) * 1000,
          visible: visibleLayers[hazardKey] ?? true,
        });

        circlesRef.current[hazardKey] = circle;
      });

      // Nearby resources (HIGH/CRITICAL hazards only)
      const highOrCritical = mapData.active_overlays.filter(
        (k) => hazardLevels[k] === "HIGH" || hazardLevels[k] === "CRITICAL"
      );

      if (highOrCritical.length > 0 && typeof google !== "undefined") {
        const service = new google.maps.places.PlacesService(map);
        const resourceTypes = [
          { type: "hospital", icon: "🏥", label: "Hospital" },
          { type: "gas_station", icon: "⛽", label: "Gas Station" },
        ];

        resourceTypes.forEach(({ type, icon, label }) => {
          service.nearbySearch(
            { location: { lat, lng }, radius: 10000, type },
            (results, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                results.slice(0, 3).forEach((place) => {
                  if (!place.geometry?.location) return;
                  new google.maps.Marker({
                    position: place.geometry.location,
                    map,
                    title: `${icon} ${place.name}`,
                    label: { text: icon, fontSize: "18px" },
                    icon: {
                      path: google.maps.SymbolPath.CIRCLE,
                      fillColor: "#FFFFFF",
                      fillOpacity: 0.9,
                      strokeColor: "#374151",
                      strokeWeight: 1,
                      scale: 12,
                    },
                  });
                });
              }
            }
          );
        });
      }

      // Evacuation route (WILDFIRE or FLOOD CRITICAL)
      if (mapData.evacuation_route) {
        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: { strokeColor: "#DC2626", strokeWeight: 5 },
        });

        // Route away from hazard — head north-west by default
        const safePoint = { lat: lat + 0.3, lng: lng - 0.2 };
        directionsService.route(
          {
            origin: { lat, lng },
            destination: safePoint,
            travelMode: google.maps.TravelMode.DRIVING,
          },
          (result, status) => {
            if (status === "OK" && result) {
              directionsRenderer.setDirections(result);
            }
          }
        );
      }
    }).catch(() => setLoadError(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toggle circle visibility when checkbox changes
  useEffect(() => {
    Object.entries(circlesRef.current).forEach(([key, circle]) => {
      circle.setVisible(visibleLayers[key] ?? false);
    });
  }, [visibleLayers]);

  if (loadError) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 h-64 flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
        <span className="text-3xl">🗺️</span>
        <p>Map requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Layer toggles */}
      {mapData.active_overlays.length > 0 && (
        <div className="bg-white border-b border-slate-100 px-4 py-2 flex flex-wrap gap-2">
          {mapData.active_overlays.map((key) => {
            const level = hazardLevels[key] ?? "LOW";
            if (level === "LOW") return null;
            return (
              <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={visibleLayers[key] ?? true}
                  onChange={(e) =>
                    setVisibleLayers((prev) => ({ ...prev, [key]: e.target.checked }))
                  }
                  className="rounded"
                  style={{ accentColor: OVERLAY_COLORS[level] }}
                />
                <span className="text-xs font-medium text-slate-700">
                  {HAZARD_LABELS[key] ?? key}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {/* Map */}
      <div ref={mapRef} style={{ height: 420, width: "100%" }} />
    </div>
  );
}
