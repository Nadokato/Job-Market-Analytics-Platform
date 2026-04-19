const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://vn.joboko.com/viec-lam-phu-trach-kinh-doanh-khu-vuc-xvi6403391');
    const html = await page.evaluate(() => {
        const title = document.querySelector('h1.font-weight-bold') || document.querySelector('h1');
        const companyEls = document.querySelectorAll('a, h2, h3, div');
        let company = 'NOT FOUND';
        for (const el of companyEls) {
            if (el.textContent && el.textContent.includes('Tổng Công Ty Bảo Việt')) {
                company = `<${el.tagName} class="${el.className}">: ${el.textContent.trim()}`;
                break;
            }
        }
        
        const logoNodes = Array.from(document.querySelectorAll('img'));
        const logosStr = logoNodes.map(n => `<img class="${n.className}" src="${n.src}" data-src="${n.getAttribute('data-src') || ''}" alt="${n.alt}" />`).join('\n');
        
        return { company, logosStr };
    });
    console.log(html);
    await browser.close();
})();
