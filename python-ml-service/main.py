"""
FastAPI ML Service — Job Normalization Pipeline

NOTE: This service is NOT used in GitHub Actions CI.
It is intended for LOCAL development or future production deployment.
In CI, normalization is handled by fix_khac_offline.py (offline batch mode).
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
import json

from pipeline.phase1_clean import clean_company_name, clean_location
from pipeline.phase2_semantic import get_semantic_normalizer
from pipeline.phase3_hash import generate_job_hash
from pipeline.phase4_upsert import upsert_job

app = FastAPI(title="Job Market ML Pipeline", version="1.0.0")

class RawJobInput(BaseModel):
    url: str
    tieu_de: str
    cong_ty: str
    dia_diem: str
    mo_ta_cong_viec: Optional[str] = ""
    muc_luong: Optional[str] = "Thỏa thuận"
    logo: Optional[str] = ""
    hinh_thuc_lam_viec: Optional[str] = "Toàn thời gian"
    nganh_nghe: Optional[str] = ""
    thong_tin_tuyen_dung: Optional[dict] = None

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/api/v1/jobs/process")
def process_job(job: RawJobInput):
    """
    Nhận dữ liệu thô từ Playwright scraper, chạy qua 4 Phase chuẩn hóa và lưu vào Database.
    """
    try:
        # Phase 1: Clean Mandatory Fields
        norm_company = clean_company_name(job.cong_ty)
        norm_location = clean_location(job.dia_diem)
        
        # Phase 2: Semantic Normalization
        normalizer = get_semantic_normalizer()
        
        # Clean up title using basic Regex instead of AI
        clean_title = normalizer.normalize_title(job.tieu_de)
        
        # Extract mo_ta_cong_viec (it might be nested inside thong_tin_tuyen_dung)
        actual_description = job.mo_ta_cong_viec
        if (not actual_description or actual_description == "N/A") and job.thong_tin_tuyen_dung:
            actual_description = job.thong_tin_tuyen_dung.get("mo_ta_cong_viec", "")

        # Normalize Tag using Gemini
        norm_tag = normalizer.normalize_tag(clean_title, job.nganh_nghe, actual_description)

        # Extract Skills using Gemini
        skills = []
        if actual_description and actual_description != "N/A":
            skills = normalizer.extract_skills_json(actual_description)
            
        # Phase 3: Hashing Engine
        job_hash = generate_job_hash(norm_company, clean_title, norm_location)
        
        # Construct the final normalized object
        normalized_job_data = {
            "job_hash_id": job_hash,
            "url": job.url,
            "tieu_de": clean_title,                 # Đã dọn rác bằng Regex
            "cong_ty": job.cong_ty,                 # Required original column
            "dia_diem": job.dia_diem,               # Required original column
            "cong_ty_goc": job.cong_ty,
            "cong_ty_chuan_hoa": norm_company,
            "dia_diem_goc": job.dia_diem,
            "dia_diem_chuan_hoa": norm_location,
            "nganh_nghe_goc": job.nganh_nghe,
            "nganh_nghe_chuan_hoa": norm_tag,
            "ky_nang": skills, # Assumes jsonb column
            "muc_luong": job.muc_luong,
            "logo": job.logo,
            "hinh_thuc_lam_viec": job.hinh_thuc_lam_viec,
            "mo_ta_cong_viec": actual_description
        }
        
        # Phase 4: Efficient Upsert
        result = upsert_job(normalized_job_data)
        
        if result["success"]:
            return {
                "message": "Job processed and saved successfully.",
                "job_hash": job_hash,
                "normalized_data": normalized_job_data
            }
        else:
            raise HTTPException(status_code=500, detail=f"Database Upsert failed: {result.get('error')}")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
