import { sanitizeHtmlSkinContent } from "./sanitize";

export type HtmlSkinSrcdocMediaOrigins = {
  imgSrc: string;
  mediaSrc: string;
  fontSrc: string;
};

const RUNTIME_SCRIPT = `
(function () {
  var TOKEN_RE = /\\{\\{([^{}]+)\\}\\}/g;
  var ALLOWED_ATTRS = { src: 1, alt: 1, width: 1, height: 1, class: 1, id: 1, style: 1, "data-mvn-video": 1, "data-mvn-next-video": 1, "data-mvn-token": 1 };
  var ATTR_TPL_PREFIX = "data-mvn-attr-tpl-";
  var tokens = {};
  var tokensLive = false;

  function esc(s) {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function tokenText(key) {
    var v = tokens[key];
    return v == null ? "" : String(v);
  }

  function fillAttrTemplate(tpl) {
    return tpl.replace(TOKEN_RE, function (_, key) {
      return esc(tokens[String(key).trim()]);
    });
  }

  function bindTextNode(node) {
    var t = node.textContent || "";
    if (t.indexOf("{{") === -1) return;
    var parent = node.parentNode;
    if (!parent) return;
    var parts = [];
    var last = 0;
    var m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(t))) {
      if (m.index > last) parts.push({ kind: "text", value: t.slice(last, m.index) });
      parts.push({ kind: "token", key: String(m[1]).trim() });
      last = m.index + m[0].length;
    }
    if (last < t.length) parts.push({ kind: "text", value: t.slice(last) });
    if (!parts.some(function (p) { return p.kind === "token"; })) return;
    var frag = document.createDocumentFragment();
    parts.forEach(function (part) {
      if (part.kind === "text") {
        frag.appendChild(document.createTextNode(part.value));
        return;
      }
      var span = document.createElement("span");
      span.setAttribute("data-mvn-token", part.key);
      span.textContent = tokenText(part.key);
      frag.appendChild(span);
    });
    parent.replaceChild(frag, node);
  }

  function applyTokens(root) {
    if (!tokensLive) {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach(bindTextNode);
      root.querySelectorAll("*").forEach(function (el) {
        Array.prototype.slice.call(el.attributes || []).forEach(function (attr) {
          if (!ALLOWED_ATTRS[attr.name] && attr.name.indexOf(ATTR_TPL_PREFIX) !== 0) {
            el.removeAttribute(attr.name);
            return;
          }
          if (attr.value && attr.value.indexOf("{{") !== -1) {
            el.setAttribute(ATTR_TPL_PREFIX + attr.name, attr.value);
            el.setAttribute(attr.name, fillAttrTemplate(attr.value));
          }
        });
      });
      tokensLive = true;
      return;
    }
    root.querySelectorAll("[data-mvn-token]").forEach(function (el) {
      var key = el.getAttribute("data-mvn-token");
      if (!key) return;
      el.textContent = tokenText(key.trim());
    });
    root.querySelectorAll("*").forEach(function (el) {
      Array.prototype.slice.call(el.attributes || []).forEach(function (attr) {
        if (attr.name.indexOf(ATTR_TPL_PREFIX) !== 0) return;
        var realName = attr.name.slice(ATTR_TPL_PREFIX.length);
        el.setAttribute(realName, fillAttrTemplate(attr.value));
      });
    });
  }

  function reportVideoSlots() {
    ["[data-mvn-video]", "[data-mvn-next-video]"].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      var r = el.getBoundingClientRect();
      parent.postMessage({
        type: "mvn:html-skin-slot",
        slot: sel.indexOf("next") >= 0 ? "next" : "main",
        rect: { left: r.left, top: r.top, width: r.width, height: r.height }
      }, "*");
    });
  }

  window.addEventListener("message", function (ev) {
    var data = ev.data;
    if (!data || data.type !== "mvn:html-skin-tokens") return;
    tokens = data.tokens || {};
    var mount = document.getElementById("mvn-screen");
    if (!mount) return;
    applyTokens(mount);
    requestAnimationFrame(function () {
      reportVideoSlots();
    });
  });
})();
`.trim();

export function newHtmlSkinNonce(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 24; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/** iframe srcdoc 본문 (sandbox allow-scripts, CSP nonce) */
export function buildHtmlSkinSrcdoc(
  rawHtml: string,
  rawCss: string,
  origins: HtmlSkinSrcdocMediaOrigins,
  nonce?: string,
): string {
  const n = nonce ?? newHtmlSkinNonce();
  const { html, css } = sanitizeHtmlSkinContent(rawHtml, rawCss);
  const csp = [
    "default-src 'none'",
    `script-src 'nonce-${n}'`,
    "style-src 'unsafe-inline'",
    `img-src ${origins.imgSrc} data:`,
    `font-src ${origins.fontSrc} data:`,
    `media-src ${origins.mediaSrc} data:`,
  ].join("; ");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}
#mvn-screen{position:relative;width:1920px;height:1080px;transform-origin:top left}
${css}
</style></head><body><div id="mvn-screen">${html}</div><script nonce="${n}">${RUNTIME_SCRIPT}</script></body></html>`;
}