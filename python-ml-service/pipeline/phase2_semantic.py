import json
import os
import re
import time
from google import genai
from google.genai import types
from google.api_core.exceptions import ResourceExhausted
from typing import List
from dotenv import load_dotenv

# Load env variables for Gemini API Key
load_dotenv(dotenv_path='../.env.local')

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
gemini_client = None
if api_key:
    gemini_client = genai.Client(api_key=api_key)
else:
    print("WARNING: GEMINI_API_KEY not found in .env.local")

MAX_RETRIES = 3
BASE_DELAY  = 2  # giây

def call_gemini_with_backoff(prompt: str, config: types.GenerateContentConfig) -> str:
    """Gọi Gemini với exponential backoff khi bị giới hạn tốc độ hoặc quá tải."""
    if not gemini_client:
        raise ValueError("Gemini client not initialized")
    for attempt in range(MAX_RETRIES):
        try:
            response = gemini_client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=config
            )
            # Sleep 1s sau mỗi lần gọi thành công để throttle (giữ dưới 60 req/phút)
            time.sleep(1)
            return response.text
        except (ResourceExhausted, Exception) as e:
            error_str = str(e)
            is_rate_limit = (
                isinstance(e, ResourceExhausted) or 
                '429' in error_str or 
                'RESOURCE_EXHAUSTED' in error_str or
                '503' in error_str
            )
            if is_rate_limit and attempt < MAX_RETRIES - 1:
                wait = BASE_DELAY * (2 ** attempt)   # 2s, 4s, 8s
                print(f"[WARN] Gemini 429/503 — thử lại {attempt+1}/{MAX_RETRIES} sau {wait}s. Chi tiết: {error_str}")
                time.sleep(wait)
            else:
                print(f"[ERROR] Đã vượt giới hạn Gemini hoặc lỗi không thể thử lại. Chi tiết: {error_str}")
                raise e
    return ""

# Bo 66 Nganh nghe chuan thi truong
CORE_DOMAINS = [
    "An toàn lao động", "Bán hàng kỹ thuật", "Bán lẻ / Tiêu dùng", "Bảo hiểm",
    "Bất động sản", "Biên / Phiên dịch", "Bưu chính / Viễn thông", "Chăm sóc khách hàng",
    "Chứng khoán / Vàng / Ngoại tệ", "Cơ khí / Chế tạo / Tự động hóa", "Công nghệ cao",
    "Cơ điện / Mạng điện", "Dầu khí / Hóa chất", "Dệt may / Da giày", "Dịch vụ khách hàng",
    "Du lịch", "Dược phẩm / Công nghệ sinh học", "Giáo dục / Đào tạo", "Hàng gia dụng",
    "Hàng hải", "Hàng không", "Hành chính / Văn phòng", "Hóa học / Sinh học",
    "Hoạch định / Dự án", "In ấn / Xuất bản", "IT Phần cứng / Mạng", "IT Phần mềm",
    "Kế toán / Kiểm toán", "Khách sạn / Nhà hàng", "Kiến trúc", "Kinh doanh / Bán hàng",
    "Logistics / Vận tải / Kho vận", "Luật / Pháp lý", "Marketing / Truyền thông / PR",
    "Môi trường / Xử lý chất thải", "Mỹ phẩm / Trang sức", "Nghệ thuật / Điện ảnh",
    "Ngân hàng / Tài chính", "Ngoại giao / Ngoại thương", "Nhân sự", "Nông / Lâm / Ngư nghiệp",
    "Phi chính phủ / Phi lợi nhuận", "Phát triển thị trường", "Quản lý chất lượng (QA/QC)",
    "Quản lý điều hành", "Sản xuất / Vận hành sản xuất", "Thiết kế / Mỹ thuật",
    "Thiết kế nội thất", "Thời trang", "Thủ công mỹ nghệ", "Thư ký / Trợ lý",
    "Thực phẩm / Đồ uống", "Tổ chức sự kiện / Quà tặng", "Tư vấn", "Xây dựng",
    "Xuất nhập khẩu", "Y tế / Chăm sóc sức khỏe", "Bảo vệ / Vệ sĩ / An ninh",
    "Chăm sóc sắc đẹp / Spa", "Giúp việc / Phục vụ", "Lao động phổ thông",
    "Nghệ thuật / Giải trí", "Tài xế / Lái xe / Giao nhận", "Thợ thủ công / Thợ máy",
    "Thể dục / Thể thao", "Sinh viên / Thực tập sinh"
]

# Keyword map for fast rule-based matching (keyword -> CORE_DOMAIN)
KEYWORD_MAP = {
    "kế toán": "Kế toán / Kiểm toán",
    "kiểm toán": "Kế toán / Kiểm toán",
    "bảo vệ": "Bảo vệ / Vệ sĩ / An ninh",
    "an ninh": "Bảo vệ / Vệ sĩ / An ninh",
    "vệ sĩ": "Bảo vệ / Vệ sĩ / An ninh",
    "bán hàng": "Kinh doanh / Bán hàng",
    "kinh doanh": "Kinh doanh / Bán hàng",
    "sale": "Kinh doanh / Bán hàng",
    "tài xế": "Tài xế / Lái xe / Giao nhận",
    "lái xe": "Tài xế / Lái xe / Giao nhận",
    "giao hàng": "Tài xế / Lái xe / Giao nhận",
    "giao nhận": "Logistics / Vận tải / Kho vận",
    "vận tải": "Logistics / Vận tải / Kho vận",
    "logistics": "Logistics / Vận tải / Kho vận",
    "kho vận": "Logistics / Vận tải / Kho vận",
    "kỹ thuật": "Cơ khí / Chế tạo / Tự động hóa",
    "kỹ sư": "Cơ khí / Chế tạo / Tự động hóa",
    "cơ khí": "Cơ khí / Chế tạo / Tự động hóa",
    "tự động hóa": "Cơ khí / Chế tạo / Tự động hóa",
    "cơ điện": "Cơ điện / Mạng điện",
    "điện": "Cơ điện / Mạng điện",
    "công nhân": "Lao động phổ thông",
    "lao động": "Lao động phổ thông",
    "phổ thông": "Lao động phổ thông",
    "nhân sự": "Nhân sự",
    "hr": "Nhân sự",
    "tuyển dụng": "Nhân sự",
    "marketing": "Marketing / Truyền thông / PR",
    "truyền thông": "Marketing / Truyền thông / PR",
    "pr": "Marketing / Truyền thông / PR",
    "seo": "Marketing / Truyền thông / PR",
    "content": "Marketing / Truyền thông / PR",
    "phần mềm": "IT Phần mềm",
    "lập trình": "IT Phần mềm",
    "developer": "IT Phần mềm",
    "software": "IT Phần mềm",
    "it phần cứng": "IT Phần cứng / Mạng",
    "mạng": "IT Phần cứng / Mạng",
    "network": "IT Phần cứng / Mạng",
    "xây dựng": "Xây dựng",
    "công trình": "Xây dựng",
    "kiến trúc": "Kiến trúc",
    "nội thất": "Thiết kế nội thất",
    "thiết kế": "Thiết kế / Mỹ thuật",
    "đồ họa": "Thiết kế / Mỹ thuật",
    "bất động sản": "Bất động sản",
    "địa ốc": "Bất động sản",
    "giáo dục": "Giáo dục / Đào tạo",
    "giảng viên": "Giáo dục / Đào tạo",
    "giáo viên": "Giáo dục / Đào tạo",
    "gia sư": "Giáo dục / Đào tạo",
    "đào tạo": "Giáo dục / Đào tạo",
    "y tế": "Y tế / Chăm sóc sức khỏe",
    "bác sĩ": "Y tế / Chăm sóc sức khỏe",
    "điều dưỡng": "Y tế / Chăm sóc sức khỏe",
    "dược": "Dược phẩm / Công nghệ sinh học",
    "ngân hàng": "Ngân hàng / Tài chính",
    "tài chính": "Ngân hàng / Tài chính",
    "chứng khoán": "Chứng khoán / Vàng / Ngoại tệ",
    "bảo hiểm": "Bảo hiểm",
    "hành chính": "Hành chính / Văn phòng",
    "văn phòng": "Hành chính / Văn phòng",
    "thư ký": "Thư ký / Trợ lý",
    "trợ lý": "Thư ký / Trợ lý",
    "tư vấn": "Tư vấn",
    "du lịch": "Du lịch",
    "khách sạn": "Khách sạn / Nhà hàng",
    "nhà hàng": "Khách sạn / Nhà hàng",
    "phục vụ": "Giúp việc / Phục vụ",
    "giúp việc": "Giúp việc / Phục vụ",
    "spa": "Chăm sóc sắc đẹp / Spa",
    "thẩm mỹ": "Chăm sóc sắc đẹp / Spa",
    "tóc": "Chăm sóc sắc đẹp / Spa",
    "nail": "Chăm sóc sắc đẹp / Spa",
    "thực phẩm": "Thực phẩm / Đồ uống",
    "đồ uống": "Thực phẩm / Đồ uống",
    "xuất nhập khẩu": "Xuất nhập khẩu",
    "xuất khẩu": "Xuất nhập khẩu",
    "nhập khẩu": "Xuất nhập khẩu",
    "pháp lý": "Luật / Pháp lý",
    "luật": "Luật / Pháp lý",
    "chăm sóc khách hàng": "Chăm sóc khách hàng",
    "thực tập": "Sinh viên / Thực tập sinh",
    "intern": "Sinh viên / Thực tập sinh",
    "sự kiện": "Tổ chức sự kiện / Quà tặng",
    "thể thao": "Thể dục / Thể thao",
    "nông nghiệp": "Nông / Lâm / Ngư nghiệp",
    "sản xuất": "Sản xuất / Vận hành sản xuất",
    "dệt may": "Dệt may / Da giày",
    "may mặc": "Dệt may / Da giày",
    "thời trang": "Thời trang",
    "môi trường": "Môi trường / Xử lý chất thải",
    "hóa chất": "Dầu khí / Hóa chất",
    "dầu khí": "Dầu khí / Hóa chất",
    "hàng không": "Hàng không",
    "hàng hải": "Hàng hải",
    "in ấn": "In ấn / Xuất bản",
    "biên dịch": "Biên / Phiên dịch",
    "phiên dịch": "Biên / Phiên dịch",
}


class SemanticNormalizer:
    def __init__(self):
        print("Initializing SemanticNormalizer (Gemini only)...")

    def normalize_title(self, raw_title: str) -> str:
        """
        Gọt giũa title bằng Regex thay vì dùng AI để tiết kiệm chi phí.
        """
        clean_title = re.sub(r'(?i)^(tuyển gấp|tuyển dụng|tuyển|tìm gấp|tìm|cần tuyển|cơ hội việc làm|hot)\s+', '', raw_title)
        clean_title = re.sub(r'(?i)(\(|-|_|\|).*?(lương|luong|thu nhập|thưởng|bao ăn|upto|lên đến|thoả thuận|thương lượng|hot|gấp|hấp dẫn|toàn thời gian|part time|full time).*', '', clean_title)
        clean_title = re.sub(r'(?i)(lương|luong|thu nhập|thưởng|bao ăn|upto|lên đến|thoả thuận|thương lượng|hot|gấp|hấp dẫn|toàn thời gian|part time|full time).*', '', clean_title)
        return clean_title.strip()

    def normalize_tag(self, title: str, raw_tag: str, description: str) -> str:
        """
        Ánh xạ tin tuyển dụng vào 1 trong 66 nhóm ngành chuẩn.
        Ưu tiên: Gemini AI → Rule-based fallback
        """
        # Try Gemini first if available
        if gemini_client:
            try:
                prompt = f"""Bạn là chuyên gia phân loại việc làm. Hãy phân loại công việc vào ĐÚNG MỘT nhóm ngành trong danh sách sau:
{', '.join(CORE_DOMAINS)}

Chỉ trả về TÊN NHÓM NGÀNH, không giải thích gì thêm. Nếu không phù hợp, trả về 'Khác'.

Tiêu đề: {title}
Ngành nghề gốc: {raw_tag}
Mô tả (tóm tắt): {description[:400] if description else ''}"""

                result = call_gemini_with_backoff(
                    prompt=prompt,
                    config=types.GenerateContentConfig(temperature=0.0)
                ).strip()
                for domain in CORE_DOMAINS:
                    if domain.lower() == result.lower() or domain.lower() in result.lower():
                        return domain
            except Exception as e:
                error_str = str(e)
                if '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str or '503' in error_str:
                    print(f"Gemini API limit/busy. Falling back to Rule-Based Tag Normalization...")
                else:
                    print(f"Gemini error: {e}. Falling back to Rule-Based...")

        # Rule-based fallback
        return self._rule_based_tag(title, raw_tag, description)

    def _rule_based_tag(self, title: str, category: str, desc: str) -> str:
        """
        Thuật toán khớp từ khóa dự phòng khi Gemini không khả dụng.
        """
        combined = f"{title} {category}".lower()

        # Check KEYWORD_MAP first (most specific)
        for keyword, domain in KEYWORD_MAP.items():
            if keyword in combined:
                return domain

        # Check description as fallback
        if desc:
            desc_lower = desc.lower()[:500]
            for keyword, domain in KEYWORD_MAP.items():
                if keyword in desc_lower:
                    return domain

        return "Khác"

    def extract_skills_json(self, job_description: str) -> List[str]:
        """
        Trích xuất kỹ năng từ mô tả công việc.
        Ưu tiên: Gemini AI → Rule-based fallback
        """
        if not job_description or job_description == "N/A":
            return []

        # Try Gemini first if available
        if gemini_client:
            try:
                prompt = f"""Extract top 10 professional skills from this job description.
Return ONLY a JSON array of short skill strings in Vietnamese or English. No explanation.
Example: ["Excel", "Giao tiếp", "SQL", "Quản lý dự án"]

Job Description:
{job_description[:1500]}"""

                result = call_gemini_with_backoff(
                    prompt=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.0,
                        response_mime_type="application/json",
                    )
                ).strip()
                try:
                    skills = json.loads(result)
                    if isinstance(skills, list) and len(skills) > 0:
                        return skills[:10]
                except json.JSONDecodeError:
                    pass
            except Exception as e:
                error_str = str(e)
                if '429' in error_str or 'RESOURCE_EXHAUSTED' in error_str or '503' in error_str:
                    print(f"Gemini API limit/busy. Falling back to Rule-Based Skills Extraction...")
                else:
                    print(f"Gemini error: {e}. Falling back to Rule-Based...")

        # Rule-based fallback
        return self._rule_based_skills(job_description)

    def _rule_based_skills(self, desc: str) -> List[str]:
        """
        Tìm kỹ năng bằng cách khớp từ khóa trong mô tả.
        """
        if not desc:
            return []

        skill_keywords = [
            # Office tools
            "Excel", "Word", "PowerPoint", "Google Sheets", "Google Docs",
            # Languages
            "Tiếng Anh", "Tiếng Nhật", "Tiếng Trung", "Tiếng Hàn",
            # Soft skills
            "Giao tiếp", "Làm việc nhóm", "Đàm phán", "Thuyết trình",
            "Quản lý thời gian", "Giải quyết vấn đề", "Lãnh đạo", "Sáng tạo",
            "Chịu áp lực", "Tổ chức công việc",
            # Design
            "AutoCAD", "Photoshop", "Illustrator", "Figma", "SketchUp", "Revit",
            # Programming
            "Python", "Java", "C++", "C#", "JavaScript", "TypeScript", "PHP",
            "React", "Node.js", "Vue.js", "Angular", "SQL", "MySQL", "MongoDB",
            "HTML", "CSS", "AWS", "Docker", "Linux", "Git", "REST API",
            # Business
            "Kế toán", "Bán hàng", "Tư vấn", "Marketing", "SEO",
            "Facebook Ads", "Google Ads", "Content Marketing", "CRM",
            # Industry specific
            "SAP", "ERP", "Quản lý kho", "Xuất nhập khẩu", "Logistics",
            "AutoCAD", "Solidworks", "PLC", "SCADA",
        ]

        found = []
        desc_lower = desc.lower()
        for skill in skill_keywords:
            if skill.lower() in desc_lower and skill not in found:
                found.append(skill)
        return found[:10]


# Singleton instance
_normalizer = None
def get_semantic_normalizer():
    global _normalizer
    if _normalizer is None:
        _normalizer = SemanticNormalizer()
    return _normalizer
