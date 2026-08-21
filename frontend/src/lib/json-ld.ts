/**
 * Serialise a value for embedding inside `<script type="application/ld+json">`.
 *
 * `JSON.stringify` alone is not safe here, and the reason is easy to miss: the
 * browser does not parse a `<script>` body as JSON. It scans for the closing
 * tag first. So a string containing `</script>` ends the element early,
 * whatever JSON thinks it is inside — and everything after it is parsed as
 * HTML.
 *
 * Both structured-data blocks on this site interpolate content into a script
 * tag through `dangerouslySetInnerHTML`, and the values are things a person
 * types: product titles, taglines, brand names, category names. Those come
 * from the admin panel rather than from a visitor, which lowers the severity
 * but does not make it a non-issue — this codebase already treats admin input
 * as untrusted where it matters (see the media upload chain, which decodes and
 * re-encodes every file "even from an admin", on the grounds that an admin
 * account is a compromise target).
 *
 * The strict CSP is a genuine second wall: an injected `<script>` carries no
 * nonce and will not execute, and inline event handlers are refused too. It is
 * not the first wall, and it should not be the only thing standing between a
 * product title and script execution.
 *
 * Escaping to `\uXXXX` keeps the JSON semantically identical — a JSON parser
 * resolves the escapes back to the same characters — while leaving nothing in
 * the byte stream that an HTML tokeniser will act on.
 */
export function jsonLd(value: unknown): string {
  return (
    JSON.stringify(value)
      // `<` alone is enough to close a tag or open a comment; escaping `>` and
      // `&` as well removes every character the HTML tokeniser reacts to.
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")
      // Valid inside a JSON string, but line terminators in JavaScript source,
      // so they break a script body a parser would otherwise accept. Written
      // as escape sequences rather than the literal characters: those are
      // invisible in an editor, and one bad copy-paste turning them into
      // spaces would make this replace every space in the document.
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029")
  );
}
