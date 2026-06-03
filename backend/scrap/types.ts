// Represents a single raw scraped job before normalization (compatible with database schema)
export interface RawJob {
  url: string;
  tieu_de: string;
  cong_ty: string;
  dia_diem: string;
  muc_luong: string;
  logo: string;
  hinh_thuc_lam_viec: string;
  nganh_nghe: string;
  cap_bac: string;
  kinh_nghiem_lam_viec: string;
  thong_tin_tuyen_dung: {
    ngay_cap_nhat: string;
    het_han_nop: string;
    mo_ta_cong_viec: string;
    yeu_cau_cong_viec: string;
    quyen_loi: string;
    dia_diem_lam_viec: string;
  };
}

// Configuration passed to any scraper
export interface ScraperConfig {
  maxPages: number;
  delayMs: number;   // delay between requests in milliseconds
  siteUrl: string;   // base URL of the target site
  limitJobs?: number; // optional limit of jobs to scrape
}

// The contract every site-specific scraper must implement
export interface ScraperInterface {
  readonly sourceName: string;          // e.g. "joboko", "topcv"
  scrapeListings(config: ScraperConfig): Promise<RawJob[]>;
  checkJobExists(url: string): Promise<boolean>;
}
