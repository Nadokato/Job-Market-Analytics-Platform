const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://vn.joboko.com/tim-viec-lam');
    const html = await page.evaluate(() => {
        const aTags = Array.from(document.querySelectorAll('a[href*="/viec-lam-"]'));
        let res = [];
        for (let i=0; i<Math.min(3, aTags.length); i++) {
            const container = aTags[i].closest('article, li, .job-item, .item, .box-job, .job-card') || aTags[i].parentElement?.parentElement || aTags[i];
            
            res.push({
                href: aTags[i].href,
                containerHTML: container.outerHTML.substring(0, 1500)
            });
        }
        return res;
    });
    html.forEach(h => console.log('\n\n--- ' + h.href + '\n' + h.containerHTML));
    await browser.close();
})();
