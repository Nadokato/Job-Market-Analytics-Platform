"""
Script Pipeline Chuẩn Hóa Offline - Thay thế hoàn toàn npm run migrate:all
Xử lý TẤT CẢ bản ghi chưa được chuẩn hóa (null) hoặc bị gán sai ('Khác')
Chạy 100% Offline - Không cần FastAPI server - Không cần Gemini API
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv(dotenv_path='../.env.local')

from pipeline.phase1_clean import clean_company_name, clean_location
from pipeline.phase2_semantic import SemanticNormalizer
from pipeline.phase3_hash import generate_job_hash
from pipeline.phase4_upsert import get_supabase_client

supabase = get_supabase_client()
normalizer = SemanticNormalizer()

# "Khác" in unicode to avoid Windows encoding issues
KHAC = "Kh\u00e1c"

PAGE_SIZE = 1000

def fetch_unprocessed_jobs():
    """Lấy tất cả bản ghi chưa chuẩn hóa (null) hoặc bị sai ('Khác')."""
    all_rows = []
    
    # Batch 1: Null records (brand new, never processed)
    print("Step 1/2: Fetching NULL records (new unprocessed jobs)...")
    sys.stdout.flush()
    offset = 0
    while True:
        rows = (
            supabase.table('jobs')
            .select('url, tieu_de, cong_ty, dia_diem, nganh_nghe_goc, mo_ta_cong_viec, ky_nang, muc_luong, logo, hinh_thuc_lam_viec')
            .is_('nganh_nghe_chuan_hoa', 'null')
            .order('url')
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
            .data
        )
        if not rows:
            break
        all_rows.extend(rows)
        print(f"  Fetched {len(rows)} null rows (total: {len(all_rows)})")
        sys.stdout.flush()
        offset += PAGE_SIZE
        if len(rows) < PAGE_SIZE:
            break

    # Batch 2: "Khác" records (processed but failed)
    print(f"Step 2/2: Fetching 'Khac' records (incorrectly tagged jobs)...")
    sys.stdout.flush()
    offset = 0
    while True:
        rows = (
            supabase.table('jobs')
            .select('url, tieu_de, cong_ty, dia_diem, nganh_nghe_goc, mo_ta_cong_viec, ky_nang, muc_luong, logo, hinh_thuc_lam_viec')
            .eq('nganh_nghe_chuan_hoa', KHAC)
            .order('url')
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
            .data
        )
        if not rows:
            break
        all_rows.extend(rows)
        print(f"  Fetched {len(rows)} 'Khac' rows (total: {len(all_rows)})")
        sys.stdout.flush()
        offset += PAGE_SIZE
        if len(rows) < PAGE_SIZE:
            break

    return all_rows


def normalize_and_save(rows: list):
    """Chuẩn hóa và lưu từng bản ghi vào Supabase."""
    total = len(rows)
    fixed = 0
    errors = 0

    print(f"\nStarting normalization for {total} records...")
    sys.stdout.flush()

    for i, row in enumerate(rows):
        url = row.get('url', '')
        title = row.get('tieu_de') or ''
        company = row.get('cong_ty') or ''
        location = row.get('dia_diem') or ''
        category = row.get('nganh_nghe_goc') or ''
        desc = row.get('mo_ta_cong_viec') or ''
        current_skills = row.get('ky_nang') or []

        try:
            # Phase 1: Clean company & location
            norm_company = clean_company_name(company)
            norm_location = clean_location(location)

            # Phase 2: Normalize tag (Gemini nếu có, Rule-based nếu không)
            new_tag = normalizer.normalize_tag(title, category, desc)

            # Phase 2b: Extract skills (chỉ nếu chưa có)
            new_skills = current_skills if current_skills else normalizer.extract_skills_json(desc)

            # Phase 3: Generate hash
            job_hash = generate_job_hash(norm_company, title, norm_location)

            # Phase 4: Upsert to Supabase
            supabase.table('jobs').update({
                'job_hash_id': job_hash,
                'cong_ty_goc': company,
                'cong_ty_chuan_hoa': norm_company,
                'dia_diem_goc': location,
                'dia_diem_chuan_hoa': norm_location,
                'nganh_nghe_goc': category,
                'nganh_nghe_chuan_hoa': new_tag,
                'ky_nang': new_skills,
            }).eq('url', url).execute()

            fixed += 1

        except Exception as e:
            errors += 1
            print(f"ERROR [{i+1}] {url[:60]}: {e}")
            sys.stdout.flush()

        if (i + 1) % 100 == 0 or (i + 1) == total:
            print(f"Progress: {i+1}/{total} (fixed={fixed}, errors={errors})")
            sys.stdout.flush()

    return fixed, errors


def main():
    print("=" * 55)
    print("  JOB MARKET - OFFLINE NORMALIZATION PIPELINE")
    print("  Replaces: npm run migrate:all + FastAPI server")
    print("=" * 55)
    sys.stdout.flush()

    # Fetch all unprocessed records
    rows = fetch_unprocessed_jobs()
    
    if not rows:
        print("\nAll records already normalized! Nothing to do.")
        sys.stdout.flush()
        return

    print(f"\nTotal records to process: {len(rows)}")
    sys.stdout.flush()

    # Normalize and save
    fixed, errors = normalize_and_save(rows)

    print("\n" + "=" * 55)
    print(f"  DONE! Fixed={fixed}, Errors={errors}")
    print("=" * 55)
    sys.stdout.flush()


if __name__ == "__main__":
    main()
