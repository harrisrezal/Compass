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

const RADIUS_KM: Record<string, number> = {
  psps:       15,
  wildfire:   8,
  flood:      5,
  heat:       25,
  earthquake: 20,
};

export default function HazardMap({ mapData, hazardLevels }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const mapsReadyRef = useRef(false);
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>(
    () => Object.fromEntries(mapData.active_overlays.map((k) => [k, true]))
  );
  const [loadError, setLoadError] = useState(false);
  const circlesRef = useRef<Record<string, google.maps.Circle>>({});

  // Reset visible layers whenever active_overlays changes (new simulation)
  useEffect(() => {
    setVisibleLayers(Object.fromEntries(mapData.active_overlays.map((k) => [k, true])));
  }, [mapData.active_overlays]);

  // One-time map initialisation
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setLoadError(true);
      return;
    }

    if (typeof window !== "undefined" && !window.google?.maps) {
      setOptions({ key: apiKey, v: "weekly" });
    }

    const [lat, lng] = mapData.user_lat_lng;

    Promise.all([
      importLibrary("maps"),
      importLibrary("places"),
      importLibrary("routes"),
      importLibrary("marker"),
    ]).then(() => {
      if (!mapRef.current) return;

      const map = new google.maps.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 11,
        mapId: "DEMO_MAP_ID",
        mapTypeId: "roadmap",
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
      });
      googleMapRef.current = map;
      mapsReadyRef.current = true;

      // User location pin
      const pinEl = document.createElement("div");
      pinEl.style.cssText =
        "width:18px;height:18px;border-radius:50%;background:#1E40AF;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)";
      new google.maps.marker.AdvancedMarkerElement({
        position: { lat, lng },
        map,
        title: "Your Location",
        content: pinEl,
      });

      // Draw initial circles
      drawCircles(map, mapData.active_overlays, hazardLevels, mapData.user_lat_lng, circlesRef.current);

      // Nearby resources (HIGH/CRITICAL only)
      const highOrCritical = mapData.active_overlays.filter(
        (k) => hazardLevels[k] === "HIGH" || hazardLevels[k] === "CRITICAL"
      );
      if (highOrCritical.length > 0) {
        const resourceTypes = [
          { includedType: "hospital",    icon: "🏥" },
          { includedType: "gas_station", icon: "⛽" },
        ];
        resourceTypes.forEach(async ({ includedType, icon }) => {
          try {
            const { places } = await google.maps.places.Place.searchNearby({
              fields: ["displayName", "location"],
              includedTypes: [includedType],
              locationRestriction: { center: { lat, lng }, radius: 10000 },
              maxResultCount: 3,
            });
            places.forEach((place) => {
              if (!place.location) return;
              const markerEl = document.createElement("div");
              markerEl.style.cssText =
                "font-size:20px;line-height:1;cursor:pointer;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.35))";
              markerEl.textContent = icon;
              new google.maps.marker.AdvancedMarkerElement({
                position: place.location,
                map,
                title: `${icon} ${place.displayName}`,
                content: markerEl,
              });
            });
          } catch {
            // Places search is best-effort
          }
        });
      }

      // Evacuation route
      if (mapData.evacuation_route) {
        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          polylineOptions: { strokeColor: "#DC2626", strokeWeight: 5 },
        });
        const safePoint = { lat: lat + 0.3, lng: lng - 0.2 };
        directionsService.route(
          { origin: { lat, lng }, destination: safePoint, travelMode: google.maps.TravelMode.DRIVING },
          (result, status) => {
            if (status === "OK" && result) directionsRenderer.setDirections(result);
          }
        );
      }
    }).catch(() => setLoadError(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-center and redraw circles when mapData or hazardLevels change after initial load
  useEffect(() => {
    if (!mapsReadyRef.current || !googleMapRef.current) return;
    const [lat, lng] = mapData.user_lat_lng;
    googleMapRef.current.setCenter({ lat, lng });

    // Remove stale circles
    Object.values(circlesRef.current).forEach((c) => c.setMap(null));
    circlesRef.current = {};

    drawCircles(googleMapRef.current, mapData.active_overlays, hazardLevels, mapData.user_lat_lng, circlesRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapData.user_lat_lng, mapData.active_overlays, hazardLevels]);

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

function drawCircles(
  map: google.maps.Map,
  activeOverlays: string[],
  hazardLevels: Record<string, HazardLevel>,
  userLatLng: [number, number],
  circlesOut: Record<string, google.maps.Circle>,
) {
  const [lat, lng] = userLatLng;
  activeOverlays.forEach((hazardKey) => {
    const level = hazardLevels[hazardKey] ?? "LOW";
    if (level === "LOW") return;
    const circle = new google.maps.Circle({
      strokeColor: OVERLAY_COLORS[level],
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: OVERLAY_COLORS[level],
      fillOpacity: OVERLAY_OPACITY[level],
      map,
      center: { lat, lng },
      radius: (RADIUS_KM[hazardKey] ?? 10) * 1000,
    });
    circlesOut[hazardKey] = circle;
  });
}
