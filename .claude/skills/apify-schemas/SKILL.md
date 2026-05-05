---
name: apify-schemas
description: Apify Actor schema specifications for input, output, dataset, and key-value store. Use when defining or modifying `.actor/*.json` schema files.
---

# Apify Actor Schema Specifications

## Field Types (Quick Reference)

| Type | Editor | Use For |
|------|--------|---------|
| `array` | `requestListSources` | Start URLs |
| `object` | `proxy` | Proxy settings |
| `string` | `textfield` | Single line text |
| `string` | `textarea` | Multi-line text |
| `boolean` | `checkbox` | True/false options |
| `integer` | `number` | Numeric values |
| `string` | `select` | Dropdown with `enum` |

## Input Schema (`input_schema.json`)

```json
{
    "title": "<TITLE>",
    "type": "object",
    "schemaVersion": 1,
    "properties": { /* fields */ },
    "required": []
}
```

Each property: `title`, `type`, `description`, `editor`, `default`, `prefill`. For enums: add `enum` + `enumTitles`.

## Output Schema (`output_schema.json`)

```json
{
    "actorOutputSchemaVersion": 1,
    "title": "<TITLE>",
    "properties": {
        "dataset": {
            "type": "string",
            "title": "Dataset",
            "template": "{{links.apiDefaultDatasetUrl}}/items"
        }
    }
}
```

Template variables: `links.apiDefaultDatasetUrl`, `links.apiDefaultKeyValueStoreUrl`, `links.publicRunUrl`, `links.consoleRunUrl`, `links.apiRunUrl`, `run.defaultDatasetId`, `run.defaultKeyValueStoreId`.

## Dataset Schema (`dataset_schema.json`)

Referenced in `actor.json` via `storages.dataset`. Defines Console Output tab display.

```json
{
    "actorSpecification": 1,
    "fields": {},
    "views": {
        "overview": {
            "title": "Overview",
            "transformation": {
                "fields": ["name", "address", "latitude", "longitude"],
                "desc": true
            },
            "display": {
                "component": "table",
                "properties": {
                    "name": { "label": "Name", "format": "text" },
                    "address": { "label": "Address", "format": "text" },
                    "latitude": { "label": "Lat", "format": "number" },
                    "longitude": { "label": "Lng", "format": "number" }
                }
            }
        }
    }
}
```

**transformation**: `fields` (column order), `unwind`, `flatten`, `omit`, `limit`, `desc`.
**display formats**: `text`, `number`, `date`, `link`, `boolean`, `image`, `array`, `object`.

## Key-Value Store Schema

```json
{
    "actorKeyValueStoreSchemaVersion": 1,
    "title": "<TITLE>",
    "collections": {
        "<NAME>": {
            "title": "string (required)",
            "key": "exact-key OR",
            "keyPrefix": "prefix-",
            "contentTypes": ["image/jpeg"]
        }
    }
}
```

Use `key` for single keys, `keyPrefix` for collections. Not both.

## Date/Time Standards (ISO 8601)

- **Datetime** (system timestamps): `YYYY-MM-DDTHH:mm:ss.sssZ` — use `new Date().toISOString()`
- **Date-only** (content dates): `YYYY-MM-DD` — use `dateStr.split('T')[0]`
- Schema type: `"format": "date-time"` for datetime, plain `"type": "string"` for date-only
- Always UTC with `Z` suffix, no local timezone offsets
