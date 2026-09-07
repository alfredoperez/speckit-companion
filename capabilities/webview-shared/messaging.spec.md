# Messaging — Living Spec

> Adopted from existing code on 2026-07-19. Requirements describe observed behavior and have not been individually verified against tests.

## Purpose

How a webview sends work to the extension: one typed dispatcher, generic over the protocol it carries.

## Requirements

### Webviews talk to the extension through one typed channel

Consumers MUST send extension-bound messages through the shared dispatcher rather than reaching for the host bridge directly. A single funnel is what makes message shapes type-checked, lets tests stub one seam instead of every call site, and leaves room to add cross-cutting behaviour (logging, de-duplication, rate limiting) without touching consumers.

#### Scenario: a component needs to trigger extension work
- **WHEN** it must notify the extension
- **THEN** it dispatches a typed message through the shared channel
- **AND** the host bridge handle does not appear inline in the component

The shared dispatcher SHALL be generic over the protocol it sends, defaulting to the spec viewer's. A dispatcher pinned to one webview's message union is not shareable: a second webview could only adopt it by widening the first one's union, which is how a shared primitive becomes a coupling.

#### Scenario: a second webview adopts the shared dispatcher
- **WHEN** it sends messages from its own protocol
- **THEN** they type-check against that protocol
- **AND** the spec viewer's message union is unchanged

