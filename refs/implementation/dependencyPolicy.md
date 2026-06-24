# Dependency Policy

- Prefer TypeScript libraries with stable maintenance, deterministic behavior, and browser/Node compatibility where possible.
- Avoid adding heavy simulation, GIS, or rendering dependencies until MVP requirements prove they are needed.
- Generation dependencies must not introduce platform-dependent randomness.
- Export dependencies must support local operation without cloud services.
- Rust dependencies are deferred until profiling shows a TypeScript bottleneck.
- Any future AI, hosted sync, telemetry, or account dependency requires explicit product approval and privacy review.
