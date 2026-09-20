# Found, not proposed

- Escaping text a person wrote before it is put on a page. Deferred to `webview-safety`, which owns it.
- The shared component catalogue as a reuse rule ("reach for a shared control before rolling a one-off"). A build rule about how code is written, not what the product does, and no rules file was written for this area.
- The type scale, spacing scale, radius and shadow tokens. Real, but a change here needs no requirement to respect them.
- The named timing values for transitions. Same reason, and reduced motion is the part that matters.
- The fixed squared corners across all panels. A visual choice nobody can break by accident.
- The truncation trio of properties that clips a long name to one line. A CSS idiom, belongs in a rules file.
- The syntax colours for code blocks. One panel's rendering concern, not a shared floor.
- The decision to keep one panel's transient message imperative rather than queued. A justification for an implementation, not behaviour.
- The passthrough variant that routes existing colour-only pills through the shared badge. A migration seam, invisible to the person using the panel.
- The style guide stories under `src/style-guide/`. They document the palette used for captures and marketing figures, not the panels themselves; `media-pipeline` territory.
- The component stories beside each shared control. Development tooling, not shipped behaviour.
- The native title attribute standing in for a positioned tooltip. An implementation choice with a stated upgrade path, not a constraint.
- Which panel imports which stylesheet. Structure, and a change here does not need it written down.
