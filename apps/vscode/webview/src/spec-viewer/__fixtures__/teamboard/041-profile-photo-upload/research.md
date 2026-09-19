# Research: Profile photo upload

## Resize in the browser, or on the server?

**Decision: on the server.**

Browser resizing is faster to feel and impossible to trust. Two members on
two phones produce two different images from the same file. The server is
the only place a 256 by 256 square is guaranteed.

## Which image library?

**Decision: sharp.**

Already a dependency of the CSV export thumbnailer. No new supply chain.

## Where does validation run?

**Decision: before the body is read.**

Express 5 gives us the content length up front. A 500 MB file is refused
without ever being buffered.

## Where does the old object go?

**Decision: deleted after the swap commits.**

Deleting first would lose a photo if the write failed. Deleting after leaves
at most one orphan, and the weekly sweep already collects those.
