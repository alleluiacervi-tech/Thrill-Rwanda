import sanitizeHtml from "sanitize-html";

/**
 * Email HTML is written by strangers, so it is never shown as received.
 *
 * Scripts, forms, frames, event handlers and unknown URL schemes are removed.
 * Remote images are removed too unless the reader chooses to load them: a
 * remote image is how a sender learns that, and when, a message was opened.
 */

const SAFE_STYLES = {
  color: [/^[#a-z0-9(),.\s%-]+$/i],
  "background-color": [/^[#a-z0-9(),.\s%-]+$/i],
  "font-size": [/^[\d.]+(px|pt|em|rem|%)$/i],
  "font-weight": [/^(normal|bold|bolder|lighter|\d{3})$/i],
  "font-style": [/^(normal|italic|oblique)$/i],
  "font-family": [/^[a-z0-9\s,'"-]+$/i],
  "text-align": [/^(left|right|center|justify)$/i],
  "text-decoration": [/^(none|underline|line-through)$/i],
  "line-height": [/^[\d.]+(px|pt|em|rem|%)?$/i],
  width: [/^[\d.]+(px|%)$/i],
  height: [/^[\d.]+(px|%)$/i],
  "max-width": [/^[\d.]+(px|%)$/i],
  padding: [/^[\d.\spx%]+$/i],
  margin: [/^[\d.\spx%auto-]+$/i],
  border: [/^[#a-z0-9(),.\s%-]+$/i],
  "border-radius": [/^[\d.\spx%]+$/i],
  "vertical-align": [/^(top|middle|bottom|baseline)$/i],
};

const TAGS = [
  "a", "abbr", "b", "blockquote", "br", "center", "code", "div", "em", "font", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "i", "img", "li", "ol", "p", "pre", "s", "small", "span", "strike", "strong", "sub", "sup", "table",
  "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
];

export type SanitizeOptions = {
  /** Keep http(s) images. Off by default when reading mail. */
  allowRemoteImages?: boolean;
  /** Embedded images by Content-ID, as ready-made data: URIs. */
  cid?: Map<string, string>;
};

export function sanitizeEmailHtml(html: string, options: SanitizeOptions = {}): { html: string; blockedImages: number } {
  let blocked = 0;
  const out = sanitizeHtml(html, {
    allowedTags: TAGS,
    allowedAttributes: {
      a: ["href", "name", "title", "target", "rel"],
      img: ["src", "alt", "width", "height", "title"],
      font: ["color", "size", "face"],
      table: ["width", "border", "cellpadding", "cellspacing", "align", "bgcolor"],
      td: ["width", "height", "align", "valign", "bgcolor", "colspan", "rowspan"],
      th: ["width", "height", "align", "valign", "bgcolor", "colspan", "rowspan"],
      tr: ["align", "valign", "bgcolor"],
      div: ["align"],
      p: ["align"],
      "*": ["style"],
    },
    allowedStyles: { "*": SAFE_STYLES },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data", "cid"] },
    allowProtocolRelative: false,
    // Everything inside these goes too, not only the tag.
    nonTextTags: ["style", "script", "textarea", "option", "noscript", "head", "title"],
    transformTags: {
      a: (_tag, attribs) => ({
        tagName: "a",
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" },
      }),
      img: (_tag, attribs) => {
        const src = attribs.src ?? "";
        if (src.toLowerCase().startsWith("cid:")) {
          const inline = options.cid?.get(src.slice(4).replace(/^<|>$/g, ""));
          return { tagName: "img", attribs: inline ? { ...attribs, src: inline } : { alt: attribs.alt ?? "" } };
        }
        if (/^https?:/i.test(src) && !options.allowRemoteImages) {
          blocked += 1;
          return { tagName: "img", attribs: { alt: attribs.alt ?? "", title: "Image not loaded" } };
        }
        if (/^data:image\/(png|jpe?g|gif|webp);/i.test(src) || /^https?:/i.test(src)) {
          return { tagName: "img", attribs };
        }
        return { tagName: "img", attribs: { alt: attribs.alt ?? "" } };
      },
    },
  });
  return { html: out, blockedImages: blocked };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(text: string) {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1]!.toLowerCase() === "x" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/** A plain-text version for the text/plain alternative of an outgoing message. */
export function htmlToText(html: string) {
  const lines = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ");
  const bare = sanitizeHtml(lines, { allowedTags: [], allowedAttributes: {}, nonTextTags: ["style", "script"] });
  // The parser has already turned &nbsp; into a real no-break space; plain text wants an ordinary one.
  return decodeEntities(bare).replace(/ /g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/** A short excerpt, for subject-less previews and the activity log. */
export const excerpt = (text: string, max = 120) => {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};
