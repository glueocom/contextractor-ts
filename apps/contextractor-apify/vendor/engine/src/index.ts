import * as native from '@contextractor/engine-native';

export type OutputFormat = 'txt' | 'markdown' | 'json' | 'html';

export const SUPPORTED_FORMATS: readonly OutputFormat[] = ['txt', 'markdown', 'json', 'html'];

export const DEFAULT_FORMATS: readonly OutputFormat[] = ['txt', 'markdown', 'json'];

/**
 * Configuration mirroring the Python `TrafilaturaConfig` dataclass.
 *
 * `xml`/`xmltei` are temporarily unsupported — see CLAUDE.md.
 */
export interface TrafilaturaConfig {
    fast: boolean;
    favorPrecision: boolean;
    favorRecall: boolean;
    includeComments: boolean;
    includeTables: boolean;
    includeImages: boolean;
    includeFormatting: boolean;
    includeLinks: boolean;
    deduplicate: boolean;
    targetLanguage: string | null;
    withMetadata: boolean;
    onlyWithMetadata: boolean;
    teiValidation: boolean;
    pruneXpath: string | string[] | null;
    urlBlacklist: string[] | null;
    authorBlacklist: string[] | null;
    dateExtractionParams: Record<string, unknown> | null;
}

export const DEFAULT_CONFIG: Readonly<TrafilaturaConfig> = Object.freeze({
    fast: false,
    favorPrecision: false,
    favorRecall: false,
    includeComments: true,
    includeTables: true,
    includeImages: false,
    includeFormatting: true,
    includeLinks: true,
    deduplicate: false,
    targetLanguage: null,
    withMetadata: true,
    onlyWithMetadata: false,
    teiValidation: false,
    pruneXpath: null,
    urlBlacklist: null,
    authorBlacklist: null,
    dateExtractionParams: null,
});

export interface ExtractionResult {
    content: string;
    format: OutputFormat;
}

export interface Metadata {
    title: string | null;
    author: string | null;
    date: string | null;
    description: string | null;
    sitename: string | null;
    language: string | null;
    url: string | null;
    hostname: string | null;
    categories: string[] | null;
    tags: string[] | null;
    license: string | null;
    image: string | null;
    pageType: string | null;
}

const EMPTY_METADATA: Readonly<Metadata> = Object.freeze({
    title: null,
    author: null,
    date: null,
    description: null,
    sitename: null,
    language: null,
    url: null,
    hostname: null,
    categories: null,
    tags: null,
    license: null,
    image: null,
    pageType: null,
});

function toNativeConfig(c: TrafilaturaConfig): native.TrafilaturaConfig {
    return {
        fast: c.fast,
        favorPrecision: c.favorPrecision,
        favorRecall: c.favorRecall,
        includeComments: c.includeComments,
        includeTables: c.includeTables,
        includeImages: c.includeImages,
        includeFormatting: c.includeFormatting,
        includeLinks: c.includeLinks,
        deduplicate: c.deduplicate,
        targetLanguage: c.targetLanguage ?? undefined,
        withMetadata: c.withMetadata,
        onlyWithMetadata: c.onlyWithMetadata,
        teiValidation: c.teiValidation,
        urlBlacklist: c.urlBlacklist ?? undefined,
        authorBlacklist: c.authorBlacklist ?? undefined,
    };
}

function normalizeMetadata(m: native.Metadata): Metadata {
    return {
        title: m.title ?? null,
        author: m.author ?? null,
        date: m.date ?? null,
        description: m.description ?? null,
        sitename: m.sitename ?? null,
        language: m.language ?? null,
        url: m.url ?? null,
        hostname: m.hostname ?? null,
        categories: m.categories ?? null,
        tags: m.tags ?? null,
        license: m.license ?? null,
        image: m.image ?? null,
        pageType: m.pageType ?? null,
    };
}

function assertFormat(f: string): asserts f is OutputFormat {
    if (!SUPPORTED_FORMATS.includes(f as OutputFormat)) {
        throw new Error(
            `Unsupported output format: ${f}. Supported: ${SUPPORTED_FORMATS.join(', ')}`,
        );
    }
}

export interface ExtractCallOptions {
    url?: string;
    format?: OutputFormat;
}

export interface ExtractAllCallOptions {
    url?: string;
    formats?: readonly OutputFormat[];
}

export class ContentExtractor {
    readonly config: TrafilaturaConfig;

    constructor(config?: Partial<TrafilaturaConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /** Extract content in the requested format. Returns `null` when extraction fails. */
    extract(html: string, opts: ExtractCallOptions = {}): ExtractionResult | null {
        const format = opts.format ?? 'txt';
        assertFormat(format);
        try {
            const res = native.extract(html, {
                url: opts.url,
                format,
                config: toNativeConfig(this.config),
            });
            if (!res.content) {
                return null;
            }
            return { content: res.content, format };
        } catch {
            return null;
        }
    }

    /** Extract metadata only. Returns an all-null Metadata on failure. */
    extractMetadata(html: string, url?: string): Metadata {
        try {
            return normalizeMetadata(native.extractMetadata(html, url));
        } catch {
            return { ...EMPTY_METADATA };
        }
    }

    /**
     * Extract content in multiple formats. Returns a partial map; failed
     * formats are omitted. Default formats: `txt`, `markdown`, `json`.
     */
    extractAllFormats(
        html: string,
        opts: ExtractAllCallOptions = {},
    ): Partial<Record<OutputFormat, ExtractionResult>> {
        const formats = opts.formats ?? DEFAULT_FORMATS;
        const out: Partial<Record<OutputFormat, ExtractionResult>> = {};
        for (const fmt of formats) {
            assertFormat(fmt);
            const r = this.extract(html, { url: opts.url, format: fmt });
            if (r) {
                out[fmt] = r;
            }
        }
        return out;
    }
}

/** Camel-/snake-case → snake → camel normalizer used to accept JSON / API input. */
export function normalizeConfigKeys(
    input: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
    if (!input) return {};
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
        const camel = key.includes('_')
            ? key.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())
            : key;
        out[camel] = value;
    }
    return out;
}

/** Build a `TrafilaturaConfig` from user JSON. Unknown keys are ignored. */
export function configFromJson(
    data: Record<string, unknown> | null | undefined,
): TrafilaturaConfig {
    if (!data) return { ...DEFAULT_CONFIG };
    const normalized = normalizeConfigKeys(data);
    const cfg: TrafilaturaConfig = { ...DEFAULT_CONFIG };
    for (const key of Object.keys(DEFAULT_CONFIG) as (keyof TrafilaturaConfig)[]) {
        if (key in normalized && normalized[key] !== null && normalized[key] !== undefined) {
            // biome-ignore lint/suspicious/noExplicitAny: dynamic projection from validated key set
            (cfg as any)[key] = normalized[key];
        }
    }
    return cfg;
}

/** Default config as a JSON-serializable object (camelCase keys). */
export function getDefaultConfig(): TrafilaturaConfig {
    return { ...DEFAULT_CONFIG };
}

export type { ExtractionResult as ExtractionResultLike };
