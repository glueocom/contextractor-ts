//! napi-rs binding for rs-trafilatura.
//!
//! Exposes a small TypeScript-shaped API: `extract`, `extractMetadata`,
//! `extractAllFormats`. Mirrors `packages/contextractor-engine/src/index.ts`.

#![allow(clippy::needless_pass_by_value)]
#![allow(clippy::missing_errors_doc)]

use napi::bindgen_prelude::Error as NapiError;
use napi::bindgen_prelude::Result;
use napi_derive::napi;
use rs_trafilatura::{Options, extract_with_options};
use std::collections::HashMap;

/// Subset of `rs_trafilatura::Options` exposed to JavaScript callers.
///
/// All fields are optional; missing fields fall back to `Options::default()`.
#[napi(object)]
#[derive(Default)]
pub struct TrafilaturaConfig {
    pub fast: Option<bool>,
    pub favor_precision: Option<bool>,
    pub favor_recall: Option<bool>,
    pub include_comments: Option<bool>,
    pub include_tables: Option<bool>,
    pub include_images: Option<bool>,
    pub include_formatting: Option<bool>,
    pub include_links: Option<bool>,
    pub deduplicate: Option<bool>,
    pub target_language: Option<String>,
    pub with_metadata: Option<bool>,
    pub only_with_metadata: Option<bool>,
    pub tei_validation: Option<bool>,
    pub url_blacklist: Option<Vec<String>>,
    pub author_blacklist: Option<Vec<String>>,
}

/// Per-call options for `extract` / `extractAllFormats`.
#[napi(object)]
#[derive(Default)]
pub struct ExtractOptions {
    pub url: Option<String>,
    /// One of "txt", "markdown", "json", "html". Defaults to "txt".
    pub format: Option<String>,
    pub config: Option<TrafilaturaConfig>,
}

/// Result of a single-format extraction.
#[napi(object)]
pub struct ExtractionResult {
    pub content: String,
    pub format: String,
}

/// Document metadata extracted by `rs-trafilatura`.
#[napi(object)]
#[derive(Default)]
pub struct Metadata {
    pub title: Option<String>,
    pub author: Option<String>,
    /// ISO 8601 date string (the underlying `chrono::DateTime<Utc>`).
    pub date: Option<String>,
    pub description: Option<String>,
    pub sitename: Option<String>,
    pub language: Option<String>,
    pub url: Option<String>,
    pub hostname: Option<String>,
    pub categories: Option<Vec<String>>,
    pub tags: Option<Vec<String>>,
    pub license: Option<String>,
    pub image: Option<String>,
    pub page_type: Option<String>,
}

fn build_options(cfg: Option<TrafilaturaConfig>, url: Option<String>, want_markdown: bool) -> Options {
    let mut opts = Options::default();
    if let Some(c) = cfg {
        if let Some(v) = c.favor_precision { opts.favor_precision = v; }
        if let Some(v) = c.favor_recall { opts.favor_recall = v; }
        if let Some(v) = c.include_comments { opts.include_comments = v; }
        if let Some(v) = c.include_tables { opts.include_tables = v; }
        if let Some(v) = c.include_images { opts.include_images = v; }
        if let Some(v) = c.include_formatting { opts.include_formatting = v; }
        if let Some(v) = c.include_links { opts.include_links = v; }
        if let Some(v) = c.deduplicate { opts.deduplicate = v; }
        if let Some(v) = c.target_language { opts.target_language = Some(v); }
        if let Some(v) = c.only_with_metadata { opts.only_with_metadata = v; }
        if let Some(v) = c.author_blacklist { opts.author_blacklist = Some(v); }
        // `fast`, `with_metadata`, `tei_validation`, `url_blacklist` have no
        // direct counterpart in rs-trafilatura 0.2.x — accepted for API parity
        // with the Python config but ignored downstream.
    }
    if let Some(u) = url { opts.url = Some(u); }
    if want_markdown {
        opts.output_markdown = true;
    }
    opts
}

fn extract_one(html: &str, format: &str, cfg: Option<TrafilaturaConfig>, url: Option<String>) -> Result<ExtractionResult> {
    let want_markdown = format == "markdown";
    let opts = build_options(cfg, url, want_markdown);
    let res = extract_with_options(html, &opts)
        .map_err(|e| NapiError::from_reason(format!("rs-trafilatura: {e}")))?;
    let content = match format {
        "txt" => res.content_text,
        "html" => res.content_html.unwrap_or_default(),
        "markdown" => res.content_markdown.unwrap_or_default(),
        "json" => {
            let payload = serde_json::json!({
                "content": res.content_text,
                "metadata": metadata_to_json(&res.metadata),
            });
            serde_json::to_string(&payload)
                .map_err(|e| NapiError::from_reason(format!("json: {e}")))?
        }
        other => return Err(NapiError::from_reason(format!("unsupported format: {other}"))),
    };
    Ok(ExtractionResult { content, format: format.to_string() })
}

fn metadata_to_json(m: &rs_trafilatura::Metadata) -> serde_json::Value {
    serde_json::json!({
        "title": m.title,
        "author": m.author,
        "date": m.date.map(|d| d.to_rfc3339()),
        "description": m.description,
        "sitename": m.sitename,
        "language": m.language,
        "url": m.url,
        "hostname": m.hostname,
        "categories": m.categories,
        "tags": m.tags,
        "license": m.license,
        "image": m.image,
        "pageType": m.page_type,
    })
}

fn metadata_to_napi(m: rs_trafilatura::Metadata) -> Metadata {
    Metadata {
        title: m.title,
        author: m.author,
        date: m.date.map(|d| d.to_rfc3339()),
        description: m.description,
        sitename: m.sitename,
        language: m.language,
        url: m.url,
        hostname: m.hostname,
        categories: if m.categories.is_empty() { None } else { Some(m.categories) },
        tags: if m.tags.is_empty() { None } else { Some(m.tags) },
        license: m.license,
        image: m.image,
        page_type: m.page_type,
    }
}

/// Extract content in a single format. Returns the rendered string in the
/// requested format plus the format name. Throws when the format is unknown
/// or `rs-trafilatura` fails.
#[napi]
pub fn extract(html: String, options: Option<ExtractOptions>) -> Result<ExtractionResult> {
    let opts = options.unwrap_or_default();
    let format = opts.format.unwrap_or_else(|| "txt".to_string());
    extract_one(&html, &format, opts.config, opts.url)
}

/// Extract metadata only.
#[napi(js_name = "extractMetadata")]
pub fn extract_metadata(html: String, url: Option<String>) -> Result<Metadata> {
    let opts = build_options(None, url, false);
    let res = extract_with_options(&html, &opts)
        .map_err(|e| NapiError::from_reason(format!("rs-trafilatura: {e}")))?;
    Ok(metadata_to_napi(res.metadata))
}

/// Extract content in multiple formats. Defaults to `["txt", "markdown", "json"]`.
/// Failed per-format extractions are omitted from the result map.
#[napi(js_name = "extractAllFormats")]
pub fn extract_all_formats(
    html: String,
    options: Option<ExtractOptions>,
) -> Result<HashMap<String, ExtractionResult>> {
    let opts = options.unwrap_or_default();
    let formats = vec!["txt".to_string(), "markdown".to_string(), "json".to_string()];
    let mut out = HashMap::new();
    for fmt in formats {
        // Fresh config clone per call (TrafilaturaConfig is Clone-less by
        // design from napi-derive — rebuild from None to avoid moves).
        let cfg = clone_config(opts.config.as_ref());
        if let Ok(res) = extract_one(&html, &fmt, cfg, opts.url.clone()) {
            out.insert(fmt, res);
        }
    }
    Ok(out)
}

fn clone_config(c: Option<&TrafilaturaConfig>) -> Option<TrafilaturaConfig> {
    c.map(|c| TrafilaturaConfig {
        fast: c.fast,
        favor_precision: c.favor_precision,
        favor_recall: c.favor_recall,
        include_comments: c.include_comments,
        include_tables: c.include_tables,
        include_images: c.include_images,
        include_formatting: c.include_formatting,
        include_links: c.include_links,
        deduplicate: c.deduplicate,
        target_language: c.target_language.clone(),
        with_metadata: c.with_metadata,
        only_with_metadata: c.only_with_metadata,
        tei_validation: c.tei_validation,
        url_blacklist: c.url_blacklist.clone(),
        author_blacklist: c.author_blacklist.clone(),
    })
}

#[cfg(test)]
#[allow(clippy::expect_used, clippy::unwrap_used)]
mod tests {
    use super::*;

    const SAMPLE_HTML: &str = "<html><head><title>Hello</title></head><body><article><p>This is a test paragraph with enough words to satisfy minimum extraction thresholds in the rs-trafilatura engine. Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p><p>A second paragraph adds more content so the scoring threshold is comfortably met by the extraction routine.</p></article></body></html>";

    #[test]
    fn extract_txt_returns_non_empty_content() {
        let res = extract(SAMPLE_HTML.to_string(), None).expect("extract");
        assert_eq!(res.format, "txt");
        assert!(!res.content.is_empty(), "expected non-empty txt content");
    }

    #[test]
    fn extract_metadata_finds_title() {
        let meta = extract_metadata(SAMPLE_HTML.to_string(), None).expect("metadata");
        assert_eq!(meta.title.as_deref(), Some("Hello"));
    }
}
