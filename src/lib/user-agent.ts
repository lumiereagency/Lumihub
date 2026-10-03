// Traduz o user-agent em algo que a pessoa reconhece: "Chrome no Windows".
export function describeUserAgent(ua: string | null | undefined): { label: string; mobile: boolean } {
  if (!ua) return { label: "Dispositivo desconhecido", mobile: false };
  const s = ua.toLowerCase();
  const browser = s.includes("edg/")
    ? "Edge"
    : s.includes("opr/") || s.includes("opera")
      ? "Opera"
      : s.includes("samsungbrowser")
        ? "Samsung Internet"
        : s.includes("crios") || (s.includes("chrome/") && !s.includes("chromium"))
          ? "Chrome"
          : s.includes("fxios") || s.includes("firefox")
            ? "Firefox"
            : s.includes("safari")
              ? "Safari"
              : s.includes("headless") || s.includes("playwright")
                ? "Navegador automatizado"
                : "Navegador";
  const os = s.includes("iphone")
    ? "iPhone"
    : s.includes("ipad")
      ? "iPad"
      : s.includes("android")
        ? "Android"
        : s.includes("windows")
          ? "Windows"
          : s.includes("mac os x") || s.includes("macintosh")
            ? "Mac"
            : s.includes("linux")
              ? "Linux"
              : null;
  const mobile = /iphone|android|mobile|ipad/.test(s);
  return { label: os ? `${browser} no ${os}` : browser, mobile };
}
