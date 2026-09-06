## Purpose

A marker shown as an example inside a fenced block is not a marker.

## Requirements

### Explains the marker

Write one like this:

```markdown
### Some requirement
<!-- touches: src/example/** -->
```

That block is documentation, not a marker, and the fence also hides the `###` inside it.
