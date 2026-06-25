import "@testing-library/jest-dom/vitest";

// @supabase/realtime-js runs a constructor-availability check at module load
// time. On Node 24 + happy-dom this otherwise throws before any test executes.
// We never open a realtime connection in tests, so a no-op constructor is enough.
if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
  class WebSocketStub {}
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocketStub;
}
