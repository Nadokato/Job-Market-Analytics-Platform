const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://vn.joboko.com/viec-lam-phu-trach-kinh-doanh-khu-vuc-xvi6403391');
    const html = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('a, h2, h3, div, span'));
        let res = [];
        for (const el of els) {
            if (el.textContent && el.textContent.toLowerCase().includes('bảo việt nhân thọ')) {
                res.push(`<${el.tagName} class="${el.className}">: ${el.textContent.trim().substring(0, 100)}`);
            }
        }
        return res.join('\n');
    });
    console.log(html);
    await browser.close();
})();
