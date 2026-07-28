/**
 * Website CRM Visitor Tracker
 * Tracks active engagement time per page view and sends accurate metrics to Google Sheets.
 */
(function () {
  // =========================================================================
  // CONFIGURATION: Replace with your deployed Google Apps Script Web App URL
  // =========================================================================
  const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyHsqCuadgTZzelj2RIVWW8rE_b_BdONgm3Wy0BsDNcPAJ5O1PPVXPPQyWuq4o3xJPE/exec";

  // 1. Get or Generate Persistent Visitor ID
  function getVisitorId() {
    let visitorId = localStorage.getItem("crm_visitor_id");
    if (!visitorId) {
      visitorId =
        "visitor-" +
        Math.random().toString(36).substring(2, 10) +
        "-" +
        Math.random().toString(36).substring(2, 8);
      localStorage.setItem("crm_visitor_id", visitorId);
    }
    return visitorId;
  }

  // 2. Track Active Time Spent (Pauses when user leaves tab)
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

  // 3. Extract Metadata (Title, Product Code, Traffic Source)
  function getPageMetadata() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check URL params or meta tags for product code
    const productCode =
      urlParams.get("product_code") ||
      urlParams.get("sku") ||
      urlParams.get("id") ||
      "N/A";

    const title = document.title
      ? document.title.split("|")[0].trim()
      : "Browsing Main Catalogue";

    let trafficSource = "Direct";
    if (document.referrer) {
      if (!document.referrer.includes(window.location.hostname)) {
        trafficSource = document.referrer;
      } else {
        trafficSource = "Internal";
      }
    }

    return {
      title: title,
      productCode: productCode,
      trafficSource: trafficSource
    };
  }

  // 4. Send Payload on Page Exit
  let isFlushed = false;

  function flushSessionData() {
    if (isFlushed) return;

    if (isTabVisible) {
      totalActiveTimeMs += Date.now() - startTime;
    }

    const durationSeconds = Math.round(totalActiveTimeMs / 1000);

    // Skip short bounces (under 1 second)
    if (durationSeconds < 1) return;

    isFlushed = true;

    const meta = getPageMetadata();
    const payload = {
      visitor_id: getVisitorId(),
      timestamp: new Date().toLocaleString("en-GB"),
      product_title: meta.title,
      product_code: meta.productCode,
      time_spent_sec: durationSeconds,
      page_url: window.location.href,
      traffic_source: meta.trafficSource
    };

    const blobPayload = new Blob([JSON.stringify(payload)], {
      type: "text/plain;charset=UTF-8"
    });

    // Use sendBeacon for reliable delivery during page unload
    if (navigator.sendBeacon && WEBHOOK_URL.startsWith("http")) {
      navigator.sendBeacon(WEBHOOK_URL, blobPayload);
    } else if (WEBHOOK_URL.startsWith("http")) {
      fetch(WEBHOOK_URL, {
        method: "POST",
        body: JSON.stringify(payload),
        keepalive: true
      });
    }
  }

  // Bind exit events
  window.addEventListener("pagehide", flushSessionData);
  window.addEventListener("beforeunload", flushSessionData);
})();