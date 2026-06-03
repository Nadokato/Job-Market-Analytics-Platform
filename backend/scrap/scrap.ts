import * as fs from 'fs';
import { JobokoScraper } from './scrapers/joboko';
import { ScraperInterface, ScraperConfig, RawJob } from './types';

/**
 * Entrypoint for JobOKO scraper.
 * Reads environment variables as defaults but allows overriding via parameters
 * to maintain 100% backward compatibility with existing jobs and workflows.
 */
export async function scrapeJoboko(maxPages?: number, limitJobs?: number): Promise<RawJob[]> {
  const finalMaxPages = maxPages ?? parseInt(process.env.SCRAPER_MAX_PAGES ?? '5', 10);
  
  const scraperConfig: ScraperConfig = {
    maxPages: finalMaxPages,
    delayMs: parseInt(process.env.SCRAPER_DELAY_MS ?? '7000', 10),
    siteUrl: process.env.SCRAPER_SITE_URL ?? 'https://vn.joboko.com',
    limitJobs,
  };

  console.log(`[scrap.ts] Chạy scrapeJoboko bằng JobokoScraper...`);
  console.log(`[scrap.ts] Config: URL=${scraperConfig.siteUrl}, MaxPages=${scraperConfig.maxPages}, Delay=${scraperConfig.delayMs}ms`);

  const scraper: ScraperInterface = new JobokoScraper();
  return scraper.scrapeListings(scraperConfig);
}

/**
 * Entrypoint to verify if a job posting is still active.
 */
export async function checkJobExists(url: string): Promise<boolean> {
  const scraper: ScraperInterface = new JobokoScraper();
  return scraper.checkJobExists(url);
}

/**
 * Standard main runner for local script execution (e.g. ts-node).
 */
export async function runScraper() {
  console.log('Khởi chạy chạy thử nghiệm scraper (local)...');
  const results = await scrapeJoboko();
  fs.writeFileSync('scraped_data.json', JSON.stringify(results, null, 2), 'utf8');
  console.log(`Đã lưu file scraped_data.json từ chạy thử nghiệm local.`);
}

// Giữ lại khả năng chạy trực tiếp file này (nếu gọi bằng ts-node)
if (require.main === module) {
  runScraper().catch((err) => {
    console.error('Lỗi chạy scraper local:', err);
  });
}
