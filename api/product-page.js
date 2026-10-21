'use strict';

module.exports = function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');

        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).json({
        success: true,
        project: 'Kailash Kalamkari',
        feature: 'Product SEO Rendering',
        status: 'API working',
        message: 'Product HTML rendering not enabled yet'
    });
};
