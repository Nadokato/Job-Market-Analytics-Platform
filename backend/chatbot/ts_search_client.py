"""
TS Backend Search Client — HTTP proxy to the Next.js backend.

Instead of Python talking to Elasticsearch directly, Python calls
the TS backend's internal search endpoint, which uses the battle-tested
helpers.ts to construct ES queries.

Flow:
    Python → GET /api/internal/search?keyword=X&locations=Y → TS → ES → results
"""

from __future__ import annotations

import logging
from typing import Optional

import requests

logger = logging.getLogger(__name__)

DEFAULT_TS_URL = "http://localhost:3000"
SEARCH_ENDPOINT = "/api/internal/search"
REQUEST_TIMEOUT = 30


class TSSearchClient:
    """HTTP client for calling the Next.js TS backend search API.

    Translates Adapter A's tool-call params (SearchJobsParams) into
    query parameters for the TS internal search endpoint, which
    executes the actual Elasticsearch query using helpers.ts.
    """

    def __init__(self, base_url: str = DEFAULT_TS_URL, timeout: int = REQUEST_TIMEOUT):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._session = requests.Session()
        # Internal requests bypass auth/rate-limiting
        self._session.headers.update({
            "X-Internal-Token": "chatbot-internal",
            "User-Agent": "CareerIntel-Chatbot/1.0",
        })

    def search_jobs(self, params: dict) -> dict:
        """Search jobs via the TS backend.

        Args:
            params: Adapter A SearchJobsParams as dict. Keys:
                - keyword (str|None): Search keyword
                - location (str|None): City name
                - min_salary (int|None): Min salary in millions VND
                - max_salary (int|None): Max salary in millions VND
                - experience (str|None): Experience bucket label
                - work_type (str|None): Work type label

        Returns:
            Dict with keys: "jobs" (list), "total" (int),
            "page" (int), "totalPages" (int).

        Raises:
            RuntimeError: If TS backend is unreachable or returns error.
        """
        query_params = self._build_query_params(params)
        url = f"{self.base_url}{SEARCH_ENDPOINT}"

        logger.info(f"Calling TS search: {url} with params: {query_params}")

        try:
            resp = self._session.get(url, params=query_params, timeout=self.timeout)

            if resp.status_code != 200:
                error_body = resp.text[:500]
                raise RuntimeError(
                    f"TS search failed: {resp.status_code} — {error_body}"
                )

            data = resp.json()
            logger.info(
                f"TS search returned {data.get('total', 0)} results "
                f"(page {data.get('page', 1)})"
            )
            return data

        except requests.exceptions.ConnectionError as e:
            raise RuntimeError(
                f"Cannot connect to TS backend at {url}. "
                "Is the Next.js dev server running? Start with: npm run dev"
            ) from e

        except requests.exceptions.Timeout:
            raise RuntimeError(
                f"TS backend search timed out after {self.timeout}s"
            )

    def _build_query_params(self, params: dict) -> dict:
        """Convert Adapter A SearchJobsParams → TS search query params.

        The TS endpoint expects:
            keyword (string), locations[] (array), categories[] (array),
            workTypes[] (array), levels[] (array), experiences[] (array),
            salaryBuckets[] (array), page (int).

        Adapter A params use slightly different names, so we translate.
        """
        qp: dict = {}

        # keyword → keyword
        keyword = params.get("keyword")
        if keyword:
            qp["keyword"] = keyword

        # location → locations[] (TS uses array)
        location = params.get("location")
        if location:
            qp["locations"] = location

        # min_salary/max_salary → salaryBuckets[]
        min_sal = params.get("min_salary")
        max_sal = params.get("max_salary")
        buckets = self._salary_to_buckets(min_sal, max_sal)
        if buckets:
            qp["salaryBuckets"] = buckets

        # experience → experiences[]
        experience = params.get("experience")
        if experience:
            qp["experiences"] = experience

        # work_type → workTypes[]
        work_type = params.get("work_type")
        if work_type:
            qp["workTypes"] = work_type

        return qp

    @staticmethod
    def _salary_to_buckets(
        min_sal: Optional[int], max_sal: Optional[int]
    ) -> list[str]:
        """Convert integer salary range (millions VND) to bucket labels.

        Mirrors the logic from backend/elasticsearch/helpers.ts getSalaryBuckets().

        Salary ranges:
            0 – 3 triệu, 3 – 5 triệu, 5 – 10 triệu,
            10 – 20 triệu, 20 – 50 triệu, Trên 50 triệu
        """
        if min_sal is None and max_sal is None:
            return []

        RANGES = [
            ("0 – 3 triệu", 0, 3),
            ("3 – 5 triệu", 3, 5),
            ("5 – 10 triệu", 5, 10),
            ("10 – 20 triệu", 10, 20),
            ("20 – 50 triệu", 20, 50),
            ("Trên 50 triệu", 50, float("inf")),
        ]

        lo = min_sal if min_sal is not None else (max_sal or 0)
        hi = max_sal if max_sal is not None else (min_sal or 0)

        buckets = []
        for label, r_min, r_max in RANGES:
            if r_max == float("inf"):
                if hi > r_min:
                    buckets.append(label)
            else:
                if lo < r_max and hi >= r_min:
                    buckets.append(label)

        return buckets

    def check_health(self) -> bool:
        """Check if the TS backend is reachable."""
        try:
            resp = self._session.get(
                f"{self.base_url}{SEARCH_ENDPOINT}",
                params={"keyword": "", "page": "1"},
                timeout=5,
            )
            return resp.status_code == 200
        except Exception:
            return False
