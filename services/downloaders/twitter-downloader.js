const puppeteer = require('puppeteer');

class TwitterDownloader {
    constructor() {
        this.baseUrl = 'https://tweeload.com';
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
    }

    async getDownloadLink(tweetUrl) {
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
            
            // Wait until network is idle and page is fully loaded
            await page.goto(this.baseUrl, {
                waitUntil: ['networkidle0', 'domcontentloaded', 'load']
            });

            // Wait for and fill the URL input with explicit wait
            await page.waitForSelector('input#url', { visible: true, timeout: 30000 });
            await page.evaluate((url) => {
                document.querySelector('input#url').value = url;
            }, tweetUrl);

            // Ensure the button is clickable
            await page.waitForSelector('button.btn.btn--primary', { 
                visible: true,
                timeout: 30000 
            });

            // Click with retry mechanism
            try {
                await Promise.race([
                    page.click('button.btn.btn--primary'),
                    page.evaluate(() => {
                        document.querySelector('button.btn.btn--primary').click();
                    })
                ]);
            } catch (error) {
                // Fallback click method if others fail
                await page.mouse.click(
                    await page.$eval('button.btn.btn--primary', el => {
                        const rect = el.getBoundingClientRect();
                        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
                    })
                );
            }

            // Wait for the download link with increased timeout
            await page.waitForSelector('a.btn.download__item__info__actions__button', {
                visible: true,
                timeout: 60000 // 1 minute timeout
            });
            
            // Wait for network idle to ensure the link is fully processed
            await page.waitForNetworkIdle();
            
            // Get download information with retry mechanism
            let downloadData = null;
            for (let i = 0; i < 3; i++) {
                try {
                    downloadData = await page.evaluate(() => {
                        const downloadLink = document.querySelector('a.btn.download__item__info__actions__button');
                        if (!downloadLink || !downloadLink.href) {
                            throw new Error('Download link not found or invalid');
                        }
                        
                        // Determine content type based on URL or other indicators
                        const isVideo = downloadLink.href.includes('video');
                        const isGif = downloadLink.href.includes('gif');
                        const isImage = downloadLink.href.includes('image');
                        
                        let type = 'unknown';
                        if (isVideo) type = 'video';
                        else if (isGif) type = 'gif';
                        else if (isImage) type = 'image';

                        return {
                            type: type,
                            url: downloadLink.href
                        };
                    });
                    
                    if (downloadData && downloadData.url) {
                        break;
                    }
                } catch (error) {
                    if (i === 2) throw error; // Throw on last attempt
                    // Wait for network idle instead of timeout
                    await page.waitForNetworkIdle();
                }
            }

            await browser.close();

            if (!downloadData || !downloadData.url) {
                throw new Error('Failed to get download link');
            }

            return {
                success: true,
                message: `${downloadData.type} download link found`,
                data: {
                    type: downloadData.type,
                    url: downloadData.url
                }
            };

        } catch (error) {
            return {
                success: false,
                message: error.message || 'An error occurred while processing the download',
                data: null
            };
        }
    }
}

module.exports = TwitterDownloader; 