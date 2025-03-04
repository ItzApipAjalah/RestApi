const express = require('express');
const router = express.Router();
const TikTokDownloader = require('../services/downloaders/tiktok-downloader');
const TwitterDownloader = require('../services/downloaders/twitter-downloader');
const PinterestDownloader = require('../services/downloaders/pinterest-downloader');

const downloader = new TikTokDownloader();
const twitterDownloader = new TwitterDownloader();
const pinterestDownloader = new PinterestDownloader();

router.post('/tiktok', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({
            success: false,
            message: 'TikTok URL is required',
            data: null
        });
    }

    try {
        const result = await downloader.getDownloadLink(url);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
            data: null
        });
    }
});

router.post('/twitter', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({
            success: false,
            message: 'Twitter/X URL is required',
            data: null
        });
    }

    try {
        const result = await twitterDownloader.getDownloadLink(url);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
            data: null
        });
    }
});

router.post('/pinterest', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({
            success: false,
            message: 'Pinterest URL is required',
            data: null
        });
    }

    try {
        const result = await pinterestDownloader.getDownloadLink(url);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
            data: null
        });
    }
});

module.exports = router; 