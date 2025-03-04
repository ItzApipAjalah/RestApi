const puppeteer = require('puppeteer');

class TikTokDownloader {
    constructor() {
        this.baseUrl = 'https://snaptik.app';
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
    }

    async getDownloadLink(tiktokUrl) {
        try {
            const browser = await puppeteer.launch({
                headless: false,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--start-maximized',
                    '--window-size=1920,1080'
                ]
            });

            const page = await browser.newPage();
            
            await page.setViewport({
                width: 1920,
                height: 1080
            });
            
            await page.setUserAgent(this.userAgent);

            await page.setExtraHTTPHeaders({
                'accept-language': 'en-US,en;q=0.9',
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'sec-fetch-site': 'none',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-user': '?1',
                'sec-fetch-dest': 'document',
                'accept-encoding': 'gzip, deflate, br'
            });
            
            await page.goto(this.baseUrl);

            await page.waitForSelector('.link-input');
            await page.type('.link-input', tiktokUrl);

            await page.waitForSelector('button.button-go[type="submit"]', {visible: true});
            
            try {
                await page.evaluate(() => {
                    document.querySelector('button.button-go[type="submit"]').click();
                });
            } catch (error) {
                await page.click('button.button-go[type="submit"]', {delay: 100});
            }


            await page.waitForSelector('.download-box');
            
            // Check and get download links based on type (photos or video)
            const downloadData = await page.evaluate(() => {
                // Try to find photo download links first
                const photoLinks = Array.from(document.querySelectorAll('a[data-event="download_albumPhoto_photo"]'));
                if (photoLinks.length > 0) {
                    return {
                        type: 'photo',
                        urls: photoLinks.map(link => link.href)
                    };
                }
                
                // If no photo links, get regular video download link
                const videoLink = document.querySelector('.download-box a.button.download-file');
                return {
                    type: 'video',
                    urls: videoLink ? [videoLink.href] : []
                };
            });

            await browser.close();

            if (downloadData.urls.length === 0) {
                throw new Error('No download links found');
            }

            return {
                success: true,
                message: `${downloadData.type} download links found`,
                data: {
                    type: downloadData.type,
                    urls: downloadData.urls
                }
            };

        } catch (error) {
            return {
                success: false,
                message: error.message,
                data: null
            };
        }
    }
}

module.exports = TikTokDownloader; 