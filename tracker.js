/**
 * =========================================================================
 * KAILASH KALAMKARI - CRM & VISITOR ENGAGEMENT TRACKER (tracker.js)
 * =========================================================================
 * Formatted to match your Google Sheet CRM Tabs:
 * - "Traffic Logs" (Columns A to K)
 * - "Active Sessions" (Columns A to H)
 */

(function () {
  const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyN2Kzp3kxYP0uQjf6RU4yZ9KtL_WmV2gn3TVdj3a-e_EIEN5nWDvyrNOOiPfzBGAvc/exec";

  // 1. GET OR GENERATE VISITOR ID (Exact "visitor-xxxx-xxxx" format from your sheet)
  function getVisitorInfo() {
    let visitorId = localStorage.getItem("crm_visitor_id");
    let visitorType = "Returning";

    if (!visitorId) {
      visitorType = "New";
      visitorId =
        "visitor-" +
        Math.random().toString(36).substring(2, 10) +
        "-" +
        Math.random().toString(36).substring(2, 8);
      localStorage.setItem("crm_visitor_id", visitorId);
    }

    return { visitorId, visitorType };
  }

  // 2. BOT FILTER
  function isBotTraffic() {
    const userAgent = navigator.userAgent || "";
    const botPattern = /(bot|googlebot|crawler|spider|robot|crawling|lighthouse|headlesschrome)/i;
    return botPattern.test(userAgent);
  }

  // 3. TRAFFIC SOURCE DETECTION (Captures 'ig', 'chatgpt.com', 'direct / organic', etc.)
  function getTrafficSource() {
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get("utm_source");

    if (utmSource) {
      return utmSource; // Matches 'ig', 'facebook', 'google', etc.
    }

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

  // 4. BROWSER DETECTION
  function getBrowserName() {
    const ua = navigator.userAgent;
    if (ua.includes("Firefox")) return "Firefox";
    if (ua.includes("SamsungBrowser")) return "Samsung Browser";
    if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
    if (ua.includes("Edge") || ua.includes("Edg")) return "Edge";
    if (ua.includes("Chrome") && !ua.includes("Edg")) return "Google Chrome";
    if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
    return "Google Chrome";
  }

  // 5. SEND DATA VIA BEACON OR FETCH
  function sendToWebhook(payload) {
    if (!WEBHOOK_URL || !WEBHOOK_URL.startsWith("http")) return;

    try {
      const blobPayload = new Blob([JSON.stringify(payload)], {
        type: "text/plain;charset=UTF-8"
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon(WEBHOOK_URL, blobPayload);
      } else {
        fetch(WEBHOOK_URL, {
          method: "POST",
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(() => {});
      }
    } catch (e) {}
  }

  // =========================================================================
  // TAB 1: LOG TRAFFIC (Action: "logTraffic")
  // =========================================================================
  async function logInitialTraffic() {
    const { visitorId, visitorType } = getVisitorInfo();
    const isBot = isBotTraffic();

    let city = "Unknown";
    let region = "Unknown";
    let country = "India";
    let ip = "Anonymized";

    try {
      const geoRes = await fetch("https://ipapi.co/json/", { cache: "force-cache" });
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        city = geoData.city || "Unknown";
        region = geoData.region || "Unknown";
        country = geoData.country_name || "India";
        ip = geoData.ip || "Anonymized";
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

  // =========================================================================
  // TAB 2: LOG ACTIVE ENGAGEMENT TIME (Action: "logTimeSpent")
  // =========================================================================
  let startTime = Date.now();
  let totalActiveTimeMs = 0;
  let isTabVisible = !document.hidden;

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (isTabVisible) {
        totalActiveTimeMs += Date.now() - startTime;
        isTabVisible = false;
      }
    } else {
      if (!isTabVisible) {
        startTime = Date.now();
        isTabVisible = true;
      }
    }
  });

  function getProductDetails() {
    const hash = window.location.hash || "";
    let productCode = "N/A";
    let productTitle = "Browsing Main Catalogue";

    if (hash.includes("kalamkari-") || hash.startsWith("#product/")) {
      const match = hash.match(/(?:[A-Za-z0-9_-]+-)?([A-Za-z0-9]+)$/);
      if (match && match[1]) {
        productCode = match[1];
      }
    }

    const detailTitleEl = document.getElementById("detail-title");
    if (detailTitleEl && detailTitleEl.textContent.trim()) {
      productTitle = detailTitleEl.textContent.trim();
    }

    return { productCode, productTitle };
  }

  let sessionFlushed = false;

  function flushActiveSession() {
    if (sessionFlushed) return;

    if (isTabVisible) {
      totalActiveTimeMs += Date.now() - startTime;
    }

    const durationSeconds = Math.round(totalActiveTimeMs / 1000);

    // Skip short bounces under 2 seconds (matches Code.gs)
    if (durationSeconds < 2) return;

    sessionFlushed = true;

    const { visitorId, visitorType } = getVisitorInfo();
    const { productCode, productTitle } = getProductDetails();
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    const formattedTime = `${minutes}m ${seconds}s`;

    const payload = {
      action: "logTimeSpent",
      isBot: isBotTraffic(),
      timestamp: new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" }).replace(",", ""),
      visitorId: visitorId,
      visitorType: visitorType,
      productTitle: productTitle,
      productCode: productCode,
      durationFormatted: formattedTime,
      durationSeconds: durationSeconds,
      pageUrl: window.location.href
    };

    sendToWebhook(payload);
  }

  // Handle SPA Hash Changes
  window.addEventListener("hashchange", function () {
    flushActiveSession();
    sessionFlushed = false;
    startTime = Date.now();
    totalActiveTimeMs = 0;
  });

  // Handle Page Exit
  window.addEventListener("pagehide", flushActiveSession);
  window.addEventListener("beforeunload", flushActiveSession);

  // Initialize Traffic Log
  if (document.readyState === "complete" || document.readyState === "interactive") {
    logInitialTraffic();
  } else {
    document.addEventListener("DOMContentLoaded", logInitialTraffic);
  }
})();