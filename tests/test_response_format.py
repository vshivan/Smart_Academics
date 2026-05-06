"""
Shared response envelope tests — verifies ok(), fail(), paginated()
work correctly across all services.

Run with:
    pytest tests/test_response_format.py -v
"""
import os
import sys
import json
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend", "shared"))

from response import ok, fail, paginated


class TestOkResponse:
    def test_success_true(self):
        r = ok({"key": "value"})
        body = json.loads(r.body)
        assert body["success"] is True

    def test_data_present(self):
        r = ok({"items": [1, 2, 3]})
        body = json.loads(r.body)
        assert body["data"] == {"items": [1, 2, 3]}

    def test_error_is_null(self):
        r = ok({"x": 1})
        body = json.loads(r.body)
        assert body["error"] is None

    def test_default_status_200(self):
        r = ok({})
        assert r.status_code == 200

    def test_custom_status_code(self):
        r = ok({}, status_code=201)
        assert r.status_code == 201

    def test_none_data(self):
        r = ok(None)
        body = json.loads(r.body)
        assert body["data"] is None

    def test_list_data(self):
        r = ok([1, 2, 3])
        body = json.loads(r.body)
        assert body["data"] == [1, 2, 3]

    def test_meta_included(self):
        r = ok({"x": 1}, meta={"page": 1, "total": 100})
        body = json.loads(r.body)
        assert body["meta"]["page"] == 1
        assert body["meta"]["total"] == 100

    def test_meta_null_by_default(self):
        r = ok({"x": 1})
        body = json.loads(r.body)
        assert body["meta"] is None

    def test_nested_data(self):
        data = {"user": {"id": "u1", "role": "faculty"}, "permissions": ["upload_syllabus"]}
        r = ok(data)
        body = json.loads(r.body)
        assert body["data"]["user"]["role"] == "faculty"
        assert "upload_syllabus" in body["data"]["permissions"]


class TestFailResponse:
    def test_success_false(self):
        r = fail("NOT_FOUND", "Resource not found")
        body = json.loads(r.body)
        assert body["success"] is False

    def test_data_is_null(self):
        r = fail("ERROR", "Something went wrong")
        body = json.loads(r.body)
        assert body["data"] is None

    def test_error_code(self):
        r = fail("VALIDATION_ERROR", "Invalid input")
        body = json.loads(r.body)
        assert body["error"]["code"] == "VALIDATION_ERROR"

    def test_error_message(self):
        r = fail("NOT_FOUND", "Paper not found")
        body = json.loads(r.body)
        assert body["error"]["message"] == "Paper not found"

    def test_default_status_400(self):
        r = fail("BAD_REQUEST", "Bad input")
        assert r.status_code == 400

    def test_custom_status_404(self):
        r = fail("NOT_FOUND", "Not found", status_code=404)
        assert r.status_code == 404

    def test_custom_status_403(self):
        r = fail("FORBIDDEN", "Access denied", status_code=403)
        assert r.status_code == 403

    def test_custom_status_500(self):
        r = fail("INTERNAL_SERVER_ERROR", "Unexpected error", status_code=500)
        assert r.status_code == 500

    def test_details_included(self):
        r = fail("VALIDATION_ERROR", "Invalid", details={"field": "email", "issue": "required"})
        body = json.loads(r.body)
        assert body["error"]["details"]["field"] == "email"

    def test_details_null_by_default(self):
        r = fail("ERROR", "msg")
        body = json.loads(r.body)
        assert body["error"]["details"] is None


class TestPaginatedResponse:
    def test_success_true(self):
        r = paginated([1, 2, 3], total=100, page=1, page_size=20)
        body = json.loads(r.body)
        assert body["success"] is True

    def test_data_is_items(self):
        items = [{"id": 1}, {"id": 2}]
        r = paginated(items, total=50, page=1, page_size=20)
        body = json.loads(r.body)
        assert body["data"] == items

    def test_meta_total(self):
        r = paginated([], total=100, page=1, page_size=20)
        body = json.loads(r.body)
        assert body["meta"]["total"] == 100

    def test_meta_page(self):
        r = paginated([], total=100, page=3, page_size=20)
        body = json.loads(r.body)
        assert body["meta"]["page"] == 3

    def test_meta_page_size(self):
        r = paginated([], total=100, page=1, page_size=25)
        body = json.loads(r.body)
        assert body["meta"]["page_size"] == 25

    def test_meta_total_pages(self):
        r = paginated([], total=100, page=1, page_size=20)
        body = json.loads(r.body)
        assert body["meta"]["total_pages"] == 5

    def test_meta_total_pages_ceiling(self):
        # 101 items / 20 per page = 6 pages (ceiling)
        r = paginated([], total=101, page=1, page_size=20)
        body = json.loads(r.body)
        assert body["meta"]["total_pages"] == 6

    def test_status_200(self):
        r = paginated([], total=0, page=1, page_size=20)
        assert r.status_code == 200

    def test_empty_list(self):
        r = paginated([], total=0, page=1, page_size=20)
        body = json.loads(r.body)
        assert body["data"] == []
        assert body["meta"]["total"] == 0
        assert body["meta"]["total_pages"] == 0
