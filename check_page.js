const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('https://vn.joboko.com/tim-viec-lam');
  
  const content = await page.content();
  const nextBtn = await page.locator('.pagination a, .uc-pagination a').allTextContents();
  const nextHref = await page.locator('a:has-text("Kế tiếp"), a:has-text("Trang sau"), a:has-text("Sau"), a i.fa-angle-right, .pagination-next > a').count();

  console.log("PAGINATION A TAGS:", nextBtn);
  console.log("NEXT HREF:", nextHref);
  
  await browser.close();
})();
