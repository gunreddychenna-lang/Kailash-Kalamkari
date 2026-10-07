/**
 * =========================================================================
 * KAILASH KALAMKARI - CRM TRACKER (SILENT & RESILIENT)
 * =========================================================================
 */
(function () {
  const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyN2Kzp3kxYP0uQjf6RU4yZ9KtL_WmV2gn3TVdj3a-e_EIEN5nWDvyrNOOiPfzBGAvc/exec";

  // Skip tracking on local development (localhost / 127.0.0.1)
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    return;
  }

  function getVisitorInfo() {
    let visitorId = localStorage.getItem("crm_visitor_id");
    let visitorType = "Returning";

    if (!visitorId) {
      visitorType = "New";
      visitorId = "visitor-" + Math.random().toString(36).substring(2, 10) + "-" + Math.random().toString(36).substring(2, 8);
      localStorage.setItem("crm_visitor_id", visitorId);
    }
    return { visitorId, visitorType };
  }

  function isBotTraffic() {
    const userAgent = navigator.userAgent || "";
    return /(bot|googlebot|crawler|spider|robot|crawling|lighthouse|headlesschrome)/i.test(userAgent);
  }

  function getTrafficSource() {
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get("utm_source");
    if (utmSource) return utmSource;

    if (document.referrer) {
      try {
        const refUrl = new URL(document.referrer);
        if (refUrl.hostname.includes("instagram.com")) return "ig";
        if (refUrl.hostname.includes("facebook.com") || refUrl.hostname.includes("fb.com")) return "fb";
        if (refUrl.hostname.includes("chatgpt.com")) return "chatgpt.com";
        if (refUrl.hostname.includes("google.com")) return "google";
        if (!refUrl.hostname.includes(window.location.hostname)) return refUrl.hostname;
      } catch (e) {
        return "other website";
      }
    }
    return "direct / organic";
  }

  function getBrowserName() {
    const ua = navigator.userAgent;
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("SamsungBrowser")) return "Samsung Browser";
    if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
    if (ua.includes("Edge") || ua.includes("Edg")) return "Edge";
    if (ua.includes("Chrome")) return "Google Chrome";
    if (ua.includes("Safari")) return "Safari";
    return "Google Chrome";
  }

  function sendToWebhook(payload) {
    if (!WEBHOOK_URL || !WEBHOOK_URL.startsWith("http")) return;
    try {
      const blobPayload = new Blob([JSON.stringify(payload)], { type: "text/plain;charset=UTF-8" });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(WEBHOOK_URL, blobPayload);
      } else {
        fetch(WEBHOOK_URL, { method: "POST", body: JSON.stringify(payload), keepalive: true }).catch(() => {});
      }
    } catch (e) {}
  }

  async function logInitialTraffic() {
    const { visitorId, visitorType } = getVisitorInfo();
    const isBot = isBotTraffic();

    let city = "Unknown";
    let region = "Unknown";
    let country = "India";
    let ip = "Anonymized";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const geoRes = await fetch("https://ipwho.is/", { signal: controller.signal }).catch(() => null);
      clearTimeout(timeoutId);

      if (geoRes && geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData && geoData.success !== false) {
          city = geoData.city || "Unknown";
          region = geoData.region || "Unknown";
          country = geoData.country || "India";
          ip = geoData.ip || "Anonymized";
        }
      }
    } catch (e) {}

    const payload = {
      action: "logTraffic",
      isBot: isBot,
      timestamp: new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" }).replace(",", ""),
      visitorId: visitorId,
      visitorType: visitorType,
      source: getTrafficSource(),
      browser: getBrowserName(),
      city: city,
      region: region,
      country: country,
      ip: ip,
      pageUrl: window.location.href,
      userAgent: navigator.userAgent || "Mozilla/5.0"
    };

    sendToWebhook(payload);
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    logInitialTraffic();
  } else {
    document.addEventListener("DOMContentLoaded", logInitialTraffic);
  }
})();