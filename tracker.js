/**
 * =========================================================================
 * KAILASH KALAMKARI — CRM TRACKER
 * =========================================================================
 */

(function () {
    const WEBHOOK_URL =
        'https://script.google.com/macros/s/AKfycbyN2Kzp3kxYP0uQjf6RU4yZ9KtL_WmV2gn3TVdj3a-e_EIEN5nWDvyrNOOiPfzBGAvc/exec';

    // Skip tracking during local development.
    if (
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1'
    ) {
        return;
    }

    function getVisitorInfo() {
        let visitorId;

        try {
            visitorId = localStorage.getItem(
                'crm_visitor_id'
            );
        } catch (_) {
            // Continue when browser storage is unavailable.
        }

        let visitorType = 'Returning';

        if (!visitorId) {
            visitorType = 'New';

            visitorId =
                'visitor-' +
                Math.random()
                    .toString(36)
                    .substring(2, 10) +
                '-' +
                Math.random()
                    .toString(36)
                    .substring(2, 8);

            try {
                localStorage.setItem(
                    'crm_visitor_id',
                    visitorId
                );
            } catch (_) {
                // Tracking must not interrupt the website.
            }
        }

        return {
            visitorId,
            visitorType
        };
    }

    function isBotTraffic() {
        const userAgent =
            navigator.userAgent || '';

        return (
            /(bot|googlebot|crawler|spider|robot|crawling|lighthouse|headlesschrome)/i
        ).test(userAgent);
    }

    function getTrafficSource() {
        const parameters = new URLSearchParams(
            window.location.search
        );

        const utmSource = parameters.get(
            'utm_source'
        );

        if (utmSource) {
            return utmSource;
        }

        if (document.referrer) {
            try {
                const referrerUrl = new URL(
                    document.referrer
                );

                const hostname =
                    referrerUrl.hostname;

                if (
                    hostname.includes(
                        'instagram.com'
                    )
                ) {
                    return 'ig';
                }

                if (
                    hostname.includes(
                        'facebook.com'
                    ) ||
                    hostname.includes(
                        'fb.com'
                    )
                ) {
                    return 'fb';
                }

                if (
                    hostname.includes(
                        'chatgpt.com'
                    )
                ) {
                    return 'chatgpt.com';
                }

                if (
                    hostname.includes(
                        'google.com'
                    )
                ) {
                    return 'google';
                }

                if (
                    !hostname.includes(
                        window.location.hostname
                    )
                ) {
                    return hostname;
                }
            } catch (_) {
                return 'other website';
            }
        }

        return 'direct / organic';
    }

    function getBrowserName() {
        const userAgent =
            navigator.userAgent;

        if (
            userAgent.includes('Firefox')
        ) {
            return 'Firefox';
        }

        if (
            userAgent.includes(
                'SamsungBrowser'
            )
        ) {
            return 'Samsung Browser';
        }

        if (
            userAgent.includes('Opera') ||
            userAgent.includes('OPR')
        ) {
            return 'Opera';
        }

        if (
            userAgent.includes('Edge') ||
            userAgent.includes('Edg')
        ) {
            return 'Edge';
        }

        if (
            userAgent.includes('Chrome')
        ) {
            return 'Google Chrome';
        }

        if (
            userAgent.includes('Safari')
        ) {
            return 'Safari';
        }

        return 'Google Chrome';
    }

    function sendToWebhook(payload) {
        if (
            !WEBHOOK_URL ||
            !WEBHOOK_URL.startsWith('http')
        ) {
            return;
        }

        try {
            const blobPayload = new Blob(
                [JSON.stringify(payload)],
                {
                    type: 'text/plain;charset=UTF-8'
                }
            );

            if (navigator.sendBeacon) {
                navigator.sendBeacon(
                    WEBHOOK_URL,
                    blobPayload
                );
            } else {
                fetch(WEBHOOK_URL, {
                    method: 'POST',
                    body: JSON.stringify(
                        payload
                    ),
                    keepalive: true
                }).catch(() => {});
            }
        } catch (_) {
            // Never interrupt browsing if tracking fails.
        }
    }

    async function logInitialTraffic() {
        const {
            visitorId,
            visitorType
        } = getVisitorInfo();

        const isBot = isBotTraffic();

        let city = 'Unknown';
        let region = 'Unknown';
        let country = 'Unknown';
        let ip = 'Anonymized';

        try {
            const controller =
                new AbortController();

            const timeoutId = setTimeout(
                () => controller.abort(),
                2000
            );

            const response = await fetch(
                'https://ipwho.is/',
                {
                    signal: controller.signal
                }
            ).catch(() => null);

            clearTimeout(timeoutId);

            if (
                response &&
                response.ok
            ) {
                const data =
                    await response.json();

                if (
                    data &&
                    data.success !== false
                ) {
                    city =
                        data.city ||
                        'Unknown';

                    region =
                        data.region ||
                        'Unknown';

                    country =
                        data.country ||
                        'Unknown';

                    ip =
                        data.ip ||
                        'Anonymized';
                }
            }
        } catch (_) {
            // Keep unknown location values if lookup fails.
        }

        const payload = {
            action: 'logTraffic',

            isBot: isBot,

            timestamp: new Date()
                .toLocaleString(
                    'en-GB',
                    {
                        timeZone: 'Asia/Kolkata'
                    }
                )
                .replace(',', ''),

            visitorId: visitorId,
            visitorType: visitorType,
            source: getTrafficSource(),
            browser: getBrowserName(),
            city: city,
            region: region,
            country: country,
            ip: ip,
            pageUrl: window.location.href,

            userAgent:
                navigator.userAgent ||
                'Mozilla/5.0'
        };

        sendToWebhook(payload);
    }

    if (
        document.readyState === 'complete' ||
        document.readyState === 'interactive'
    ) {
        logInitialTraffic();
    } else {
        document.addEventListener(
            'DOMContentLoaded',
            logInitialTraffic
        );
    }
})();