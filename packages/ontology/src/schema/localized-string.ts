/**
 * Per Design Principle 6 (spec §1.7), every primitive that carries a
 * `displayName` accepts either a plain string (single-locale) or a
 * locale-keyed map (multi-locale). The union shape is non-breaking:
 * existing single-locale Solutions keep working unchanged; multi-locale
 * Solutions opt in by passing a Record.
 *
 * @see ../../docs/ontology/kedge-ontology-design.md (§3.0)
 */

/**
 * A display label.
 *
 * - Plain string: single-locale label (today's Chinese-only case).
 * - Map keyed by ICU locale tag ('zh-CN', 'en', 'en-US', …): resolved by
 *   `OntologyRegistry.getDisplayName(def, locale?)` with default-locale fallback.
 */
export type LocalizedString = string | Readonly<Record<string, string>>;
