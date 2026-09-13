# RadioBrowserService

The `RadioBrowserService` handles station discovery and metadata retrieval from the Radio Browser API.

It is responsible for searching stations, reading station details and keeping a usable local cache when the remote API is unavailable.

---

# Responsibilities

The RadioBrowserService is responsible for:

* Searching stations by name, country, tag or other query parameters
* Fetching station metadata
* Maintaining a recent station cache
* Falling back to cached data when the remote API is unavailable
* Reporting fetch errors without crashing the application

The RadioBrowserService does not handle playback.

---

# Architecture

The RadioBrowserService works closely with:

* `StreamManager` – receives stream URLs for selected stations
* `IPC / radioHandlers.js` – exposes station search and selection to the renderer
* `Diagnostics` – reports API failures and cache state

---

# Public Behavior

## searchStations
Searches for stations matching the given query.

Results are returned in a structured format suitable for the UI.

## getStationDetails
Returns detailed metadata for a selected station.

This may include name, URL, country, tags and other available metadata.

## refreshCache
Refreshes the local station cache from the remote API.

This is used when the application wants a more current dataset.

## getCachedStations
Returns stations from the local cache when available.

This is used as a fallback when the remote API cannot be reached.

---

# Cache and Fallback

The RadioBrowserService uses a cache to improve responsiveness and availability.

If the remote API is unreachable:

* the service may return recently cached stations
* the UI may show that station data is limited or stale
* the application continues to function without a network dependency for cached data

The cache is not treated as a permanent source of truth.

---

# Error Handling

If a request fails:

* the error is logged
* the service returns a clear failure result
* the application can continue using cached data if appropriate

Temporary network issues should not disable the whole station search permanently.

---

# Best Practices

✔ Keep search and playback responsibilities separate.

✔ Use cache as a fallback, not as the only source.

✔ Report network failures clearly.

✔ Avoid endless retry loops during outages.

✔ Keep station data structured and predictable.

---

# Related Documentation

* Application
* StreamManager
* IPC
* Diagnostics
* Radio Playback
