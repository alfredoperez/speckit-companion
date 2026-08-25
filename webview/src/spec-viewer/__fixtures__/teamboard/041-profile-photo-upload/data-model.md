# Data Model: Profile photo upload

## member

| Column | Type | Note |
| --- | --- | --- |
| `id` | uuid | primary key, unchanged |
| `avatar_url` | text, nullable | swapped on every successful upload |
| `avatar_updated_at` | timestamptz, nullable | new column |

## Blob layout

```
teamboard-avatars/
  <member-id>/
    <uuid>.jpg        256 x 256, quality 82
```

One object per member at any time. The previous object is deleted after the
`avatar_url` swap commits, never before.

## Validation limits

- Maximum accepted size: **5 MB**
- Accepted types: **image/jpeg**, **image/png**
- Stored type: **image/jpeg**
