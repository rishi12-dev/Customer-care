from datetime import date, timedelta
import warnings
from app.services.excel_service import EXPECTED_HEADERS, _parse_date, apply_delay_rule, normalize_status, preview_excel
import pandas as pd
from io import BytesIO


def workbook_bytes(headers=None):
    frame = pd.DataFrame([{header: "value" for header in (headers or EXPECTED_HEADERS)}])
    buffer = BytesIO()
    frame.to_excel(buffer, index=False)
    return buffer.getvalue()


def test_preview_accepts_exact_headers():
    result = preview_excel(workbook_bytes())
    assert result["valid"] is True
    assert result["records"] == 1


def test_preview_rejects_wrong_headers():
    result = preview_excel(workbook_bytes(["ORDER NO", "BAD"]))
    assert result["valid"] is False
    assert "Excel headers must match" in result["errors"][0]


def test_delay_rule_marks_overdue_undelivered_orders():
    assert apply_delay_rule("In Transit", date.today() - timedelta(days=1), None) == "Delayed"


def test_normalizes_courier_status_text():
    assert normalize_status("Delivered to consignee - Code Verified delivery") == "Delivered"


def test_parse_date_accepts_indian_excel_format_without_warning():
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        assert _parse_date("31.12.2026") == date(2026, 12, 31)

    messages = [str(item.message) for item in caught]
    assert not any("Parsing dates" in message for message in messages)
