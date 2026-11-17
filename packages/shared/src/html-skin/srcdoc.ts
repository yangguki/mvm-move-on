import { sanitizeHtmlSkinContent } from "./sanitize";

export type HtmlSkinSrcdocMediaOrigins = {
  imgSrc: string;
  mediaSrc: string;
  fontSrc: string;
};

const RUNTIME_SCRIPT = `
(function () {
  var TOKEN_RE = /\\{\\{([^{}]+)\\}\\}/g;
  var ALLOWED_ATTRS = { src: 1, alt: 1, width: 1, height: 1, class: 1, id: 1, style: 1, "data-mvn-video": 1, "data-mvn-next-video": 1 };
  var tokens = {};

  function esc(s) {
    if (s == null) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function applyTokens(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(function (node) {
      var t = node.textContent || "";
      if (t.indexOf("{{") === -1) return;
      node.textContent = t.replace(TOKEN_RE, function (_, key) {
        var k = String(key).trim();
        return esc(tokens[k]);
      });
    });
    root.querySelectorAll("*").forEach(function (el) {
      Array.prototype.slice.call(el.attributes || []).forEach(function (attr) {
        if (!ALLOWED_ATTRS[attr.name]) {
          el.removeAttribute(attr.name);
          return;
        }
        if (attr.value && attr.value.indexOf("{{") !== -1) {
          el.setAttribute(attr.name, attr.value.replace(TOKEN_RE, function (_, key) {
            return esc(tokens[String(key).trim()]);
          }));
        }
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
    reportVideoSlots();
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