const express = require('express');
const router = express.Router();
const AnimeScraper = require('../services/scrapers/anime-scraper');
const DoujinScraper = require('../services/scrapers/doujin-scraper');

const animeScraper = new AnimeScraper();
const doujinScraper = new DoujinScraper();

router.post('/nhentai', async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({
            success: false,
            message: 'Code is required',
            data: null
        });
    }

    try {
        const result = await animeScraper.scrapeImages(code);
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
            data: null
        });
    }
});

router.post('/doujin/chapters', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({
            success: false,
            message: 'URL is required',
            data: null
        });
    }

    try {
        const result = await doujinScraper.getChapterList(url);
        if (result.success) {
            result.message += '. Use /api/scrape/doujin/chapter with chapter URL to get chapter detail';
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
            data: null
        });
    }
});

router.post('/doujin/chapter', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({
            success: false,
            message: 'URL is required',
            data: null
        });
    }

    try {
        const result = await doujinScraper.getChapterDetail(url);
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