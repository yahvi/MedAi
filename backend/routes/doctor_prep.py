from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote_plus

import requests
from flask import Blueprint, g, jsonify, request

from services.auth_service import require_auth
from services.modules_ai import generate_doctor_prep
from services.storage import get_storage

doctor_prep_bp = Blueprint("doctor_prep", __name__, url_prefix="/api/doctor-prep")

OSM_USER_AGENT = "MedAi-MedicalAssistant/1.0 (local-dev)"

EMERGENCY_HELPLINES = [
    {"label_en": "National Emergency", "label_hi": "राष्ट्रीय आपातकाल", "number": "112"},
    {"label_en": "Ambulance", "label_hi": "एम्बुलेंस", "number": "108"},
    {"label_en": "Health Helpline", "label_hi": "स्वास्थ्य हेल्पलाइन", "number": "104"},
]


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)


def _geocode_city(city: str) -> Optional[Tuple[float, float, str]]:
    resp = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": city, "format": "json", "limit": 1},
        headers={"User-Agent": OSM_USER_AGENT},
        timeout=8,
    )
    resp.raise_for_status()
    items = resp.json()
    if not items:
        return None
    top = items[0]
    return float(top["lat"]), float(top["lon"]), top.get("display_name", city)


def _format_osm_address(tags: Dict[str, Any]) -> str:
    parts = [
        tags.get("addr:housenumber"),
        tags.get("addr:street"),
        tags.get("addr:suburb") or tags.get("addr:neighbourhood"),
        tags.get("addr:city") or tags.get("addr:town"),
        tags.get("addr:state"),
        tags.get("addr:postcode"),
    ]
    cleaned = [str(p).strip() for p in parts if p]
    return ", ".join(cleaned) or tags.get("addr:full") or ""


def _fetch_osm_nearby(
    lat: float,
    lon: float,
    radius_m: int = 6000,
    specialty_filter: str = "",
) -> List[Dict[str, Any]]:
    query = f"""
    [out:json][timeout:12];
    (
      node["amenity"~"hospital|clinic|doctors"](around:{radius_m},{lat},{lon});
      way["amenity"~"hospital|clinic|doctors"](around:{radius_m},{lat},{lon});
    );
    out center 40;
    """
    resp = requests.post(
        "https://overpass-api.de/api/interpreter",
        data={"data": query},
        headers={"User-Agent": OSM_USER_AGENT},
        timeout=14,
    )
    resp.raise_for_status()
    elements = resp.json().get("elements", [])

    spec_low = (specialty_filter or "").lower().strip()
    seen_names = set()
    places: List[Dict[str, Any]] = []

    for el in elements:
        tags = el.get("tags") or {}
        name = (tags.get("name") or tags.get("name:en") or "").strip()
        if not name:
            continue
        key = name.lower()
        if key in seen_names:
            continue
        seen_names.add(key)

        el_lat = el.get("lat") if el.get("lat") is not None else (el.get("center") or {}).get("lat")
        el_lon = el.get("lon") if el.get("lon") is not None else (el.get("center") or {}).get("lon")
        if el_lat is None or el_lon is None:
            continue

        amenity = (tags.get("amenity") or "hospital").lower()
        speciality = (
            tags.get("healthcare:speciality")
            or tags.get("speciality")
            or ("Doctor / Practice" if amenity == "doctors" else "Multi-Specialty Hospital" if amenity == "hospital" else "Medical Clinic")
        )
        speciality_pretty = str(speciality).replace(";", ", ").replace("_", " ").title()

        if spec_low and spec_low != "all":
            haystack = f"{name} {speciality_pretty} {amenity}".lower()
            if spec_low not in haystack and not (spec_low == "hospital" and amenity == "hospital"):
                # Keep general hospitals when filtering by medical specialty so results remain useful
                if amenity != "hospital":
                    continue

        phone = (
            tags.get("phone")
            or tags.get("contact:phone")
            or tags.get("contact:mobile")
            or tags.get("mobile")
            or ""
        )
        website = tags.get("website") or tags.get("contact:website") or ""
        opening_hours = tags.get("opening_hours") or ""
        emergency = str(tags.get("emergency", "")).lower() == "yes"
        address = _format_osm_address(tags)
        dist_km = _haversine_km(lat, lon, float(el_lat), float(el_lon))

        # Infer if entry itself is a named doctor practice
        is_doctor = amenity == "doctors" or name.lower().startswith("dr.") or name.lower().startswith("dr ")

        maps_query = quote_plus(f"{name} {address}" if address else name)
        places.append(
            {
                "id": f"osm-{el.get('type', 'n')}-{el.get('id')}",
                "name": name,
                "category": "doctor" if is_doctor else amenity,
                "specialty": speciality_pretty,
                "phone": str(phone).strip(),
                "address": address,
                "website": str(website).strip(),
                "opening_hours": str(opening_hours).strip(),
                "emergency": emergency,
                "distance_km": dist_km,
                "lat": float(el_lat),
                "lon": float(el_lon),
                "maps_url": f"https://www.google.com/maps/search/?api=1&query={maps_query}",
                "doctors_search_url": f"https://www.google.com/maps/search/?api=1&query={quote_plus(name + ' doctors contact')}",
                "source": "openstreetmap",
            }
        )

    # Sort: entries with phone numbers and closer distance prioritized cleanly by distance
    places.sort(key=lambda p: (p["distance_km"], 0 if p["phone"] else 1))
    return places[:18]


@doctor_prep_bp.get("")
@require_auth
def list_preps():
    store = get_storage()
    return jsonify({"preps": store.list_doctor_preps(g.current_user["id"])})


@doctor_prep_bp.post("/generate")
@require_auth
def create_prep():
    body = request.get_json(silent=True) or {}
    report_id = body.get("report_id") or None
    concerns = body.get("concerns") or []
    if isinstance(concerns, str):
        concerns = [line.strip() for line in concerns.splitlines() if line.strip()]
    visit_goal = (body.get("visit_goal") or "").strip()

    store = get_storage()
    uid = g.current_user["id"]
    report = store.get_report(uid, report_id) if report_id else None

    try:
        prep = generate_doctor_prep(report=report, concerns=concerns, visit_goal=visit_goal)
    except Exception as exc:
        return jsonify({"error": f"Unable to build doctor visit preparation: {exc}"}), 500

    saved = store.save_doctor_prep(
        uid,
        {
            "report_id": report["id"] if report else None,
            "report_title": report["title"] if report else "General Consultation",
            "concerns": concerns,
            "prep": prep,
        },
    )
    return jsonify({"doctor_prep": saved}), 201


@doctor_prep_bp.delete("/<prep_id>")
@require_auth
def delete_prep(prep_id: str):
    store = get_storage()
    if not store.delete_doctor_prep(g.current_user["id"], prep_id):
        return jsonify({"error": "Preparation sheet not found."}), 404
    return jsonify({"deleted": True, "id": prep_id})


# ---------- Nearby Hospitals & Doctors (OpenStreetMap live lookup + verified map links) ----------


@doctor_prep_bp.get("/nearby")
@require_auth
def find_nearby_healthcare():
    city = (request.args.get("city") or "").strip()
    specialty = (request.args.get("specialty") or "").strip()
    lat_raw = request.args.get("lat")
    lon_raw = request.args.get("lon")
    radius_km = min(max(float(request.args.get("radius_km") or 6), 1.0), 25.0)

    resolved_label = city
    lat: Optional[float] = None
    lon: Optional[float] = None

    try:
        if lat_raw and lon_raw:
            lat = float(lat_raw)
            lon = float(lon_raw)
            resolved_label = city or f"Your Location ({lat:.3f}, {lon:.3f})"
        elif city:
            geo = _geocode_city(city)
            if not geo:
                return jsonify(
                    {
                        "error": f"Could not find location '{city}'. Try adding a city or pincode (e.g., 'Pune, India' or '110001').",
                        "helplines": EMERGENCY_HELPLINES,
                    }
                ), 404
            lat, lon, resolved_label = geo
        else:
            return jsonify({"error": "Please enter a city/pincode or click 'Use My Location'."}), 400

        places = _fetch_osm_nearby(
            lat=lat,
            lon=lon,
            radius_m=int(radius_km * 1000),
            specialty_filter=specialty,
        )
        spec_term = (
            f"{specialty} doctors and hospitals"
            if specialty and specialty.lower() != "all"
            else "hospitals and doctors"
        )
        loc_str = city or f"{lat},{lon}"
        maps_all_url = f"https://www.google.com/maps/search/?api=1&query={quote_plus(f'{spec_term} near {loc_str}')}"

        return jsonify(
            {
                "location_label": resolved_label,
                "lat": lat,
                "lon": lon,
                "radius_km": radius_km,
                "places": places,
                "maps_all_url": maps_all_url,
                "helplines": EMERGENCY_HELPLINES,
                "source": "live-openstreetmap",
            }
        )
    except requests.RequestException:
        # Graceful offline fallback: provide direct Google Maps search links & national helplines without fabricating doctor phone numbers
        query_loc = city or (f"{lat},{lon}" if lat is not None and lon is not None else "near me")
        spec_term = specialty if specialty and specialty.lower() != "all" else "General Physician"
        return jsonify(
            {
                "location_label": query_loc,
                "places": [],
                "offline_notice": (
                    "Live nearby map directory could not be reached right now. "
                    "Use the direct Google Maps link below to view verified nearby hospitals, doctor names, and phone numbers."
                ),
                "maps_all_url": f"https://www.google.com/maps/search/?api=1&query={quote_plus(f'{spec_term} hospitals near {query_loc}')}",
                "helplines": EMERGENCY_HELPLINES,
                "source": "fallback-links",
            }
        )


# ---------- Personal Saved Doctors & Hospital Contacts ----------


@doctor_prep_bp.get("/doctors")
@require_auth
def list_saved_doctors():
    store = get_storage()
    return jsonify({"doctors": store.list_doctors(g.current_user["id"])})


@doctor_prep_bp.post("/doctors")
@require_auth
def add_saved_doctor():
    body = request.get_json(silent=True) or {}
    doctor_name = (body.get("doctor_name") or "").strip()
    hospital_name = (body.get("hospital_name") or "").strip()
    if not doctor_name and not hospital_name:
        return jsonify({"error": "Please provide a doctor name or hospital/clinic name."}), 400

    store = get_storage()
    saved = store.save_doctor(
        g.current_user["id"],
        {
            "doctor_name": doctor_name or hospital_name,
            "specialty": body.get("specialty") or "General Physician",
            "hospital_name": hospital_name,
            "phone": body.get("phone") or "",
            "address": body.get("address") or "",
            "notes": body.get("notes") or "",
        },
    )
    return jsonify({"doctor": saved}), 201


@doctor_prep_bp.delete("/doctors/<doctor_id>")
@require_auth
def remove_saved_doctor(doctor_id: str):
    store = get_storage()
    if not store.delete_doctor(g.current_user["id"], doctor_id):
        return jsonify({"error": "Saved doctor not found."}), 404
    return jsonify({"deleted": True, "id": doctor_id})
