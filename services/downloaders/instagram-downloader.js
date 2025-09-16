const puppeteer = require('puppeteer');

class InstagramDownloader {
    constructor() {
        this.pageUrl = "https://fastdl.app/id";
    }

    async getDownloadLink(instagramUrl) {
        const browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
        const page = await browser.newPage();

        try {
            // Go to fastdl
            await page.goto(this.pageUrl, { waitUntil: "domcontentloaded" });

            // Fill input
            await page.type("#search-form-input", instagramUrl);

            // Click Unduh button
            await page.click(".search-form__button");

            // Wait for results
            await page.waitForSelector(".output-list__item a.button__download", {
                timeout: 20000,
            });

            // Scrape all download links
            const downloadLinks = await page.$$eval(
                ".output-list__item a.button__download",
                (anchors) => anchors.map((a) => a.href)
            );

            return {
                success: true,
                message: "Download links found",
                data: {
                    type: downloadLinks.length > 1 ? "album" : "single",
                    urls: downloadLinks
                }
            };
        } catch (err) {
            // Handle not found error
            const isTimeout = err.message.includes("Waiting for selector");
            return {
                success: false,
                message: isTimeout ? "notfound" : err.message,
                data: null
            };
        } finally {
            await browser.close();
        }
    }
}

module.exports = InstagramDownloader;
