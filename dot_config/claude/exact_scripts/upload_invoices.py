#!/usr/bin/env python3
"""
Upload invoice PDFs to PocketSmith transactions and mark them as reviewed.

Usage:
  python3 upload_invoices.py transactions.json

JSON format — array of [transaction_id, [relative_pdf_paths], label]:
  [
    [1234567890, ["2025/06/15/Some Merchant.pdf"], "Merchant (15/6/25) $99"],
    [1234567891, ["2025/06/15/Some Merchant (2).pdf"], "Merchant (15/6/25) $99"]
  ]

PDF paths are relative to INVOICES_BASE and typically follow the pattern:
  YYYY/MM/DD/Merchant Name.pdf
  YYYY/MM/DD/Merchant Name (2).pdf   ← multiple invoices same day
"""

import base64
import json
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

POCKETSMITHRC = Path.home() / ".pocketsmithrc"
API_BASE = "https://api.pocketsmith.com/v2"

INVOICES_BASE = Path.home() / "Dropbox/Documents/Personal/Invoices"

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def get_access_token() -> str:
    if not POCKETSMITHRC.exists():
        print(f"ERROR: {POCKETSMITHRC} not found")
        sys.exit(1)
    for line in POCKETSMITHRC.read_text().splitlines():
        line = line.strip()
        if line.startswith("export POCKETSMITH_TOKEN="):
            return line.split("=", 1)[1].strip().strip("'\"")
    print(f"ERROR: POCKETSMITH_TOKEN not found in {POCKETSMITHRC}")
    sys.exit(1)


def make_headers(token: str) -> dict:
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Developer-Key": token,
    }


# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------

def get_user_id(token: str) -> int:
    r = requests.get(f"{API_BASE}/me", headers=make_headers(token))
    r.raise_for_status()
    user = r.json()
    uid = user["id"]
    print(f"Logged in as: {user.get('name', user.get('login', uid))} (id={uid})")
    return uid


def create_attachment(token: str, user_id: int, pdf_path: Path) -> int | None:
    file_data = base64.b64encode(pdf_path.read_bytes()).decode("ascii")
    payload = {
        "title": pdf_path.name,
        "file_name": pdf_path.name,
        "file_data": file_data,
    }
    r = requests.post(
        f"{API_BASE}/users/{user_id}/attachments",
        headers=make_headers(token),
        json=payload,
    )
    if not r.ok:
        print(f"    ERROR creating attachment: {r.status_code} {r.text[:200]}")
        return None
    att_id = r.json()["id"]
    print(f"    Uploaded {pdf_path.name} → attachment id={att_id}")
    return att_id


def assign_attachment(token: str, transaction_id: int, attachment_id: int) -> bool:
    r = requests.post(
        f"{API_BASE}/transactions/{transaction_id}/attachments",
        headers=make_headers(token),
        json={"attachment_id": attachment_id},
    )
    if not r.ok:
        print(f"    ERROR assigning attachment {attachment_id}: {r.status_code} {r.text[:200]}")
        return False
    print(f"    Assigned attachment {attachment_id} to transaction {transaction_id}")
    return True


def confirm_transaction(token: str, transaction_id: int) -> bool:
    r = requests.put(
        f"{API_BASE}/transactions/{transaction_id}",
        headers=make_headers(token),
        json={"needs_review": False},
    )
    if not r.ok:
        print(f"    ERROR confirming transaction: {r.status_code} {r.text[:200]}")
        return False
    print(f"    Transaction {transaction_id} confirmed (needs_review=false)")
    return True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 upload_invoices.py transactions.json")
        sys.exit(1)

    json_path = Path(sys.argv[1])
    if not json_path.exists():
        print(f"ERROR: file not found: {json_path}")
        sys.exit(1)

    transactions = json.loads(json_path.read_text())
    if not transactions:
        print("Transactions file is empty — nothing to do.")
        sys.exit(0)

    token = get_access_token()
    user_id = get_user_id(token)

    print()
    results = []

    for tx_id, invoice_rel_paths, label in transactions:
        print(f"Processing: {label} (tx={tx_id})")
        success = True
        att_ids = []

        for rel_path in invoice_rel_paths:
            pdf_path = INVOICES_BASE / rel_path
            if not pdf_path.exists():
                print(f"    ERROR: file not found: {pdf_path}")
                success = False
                continue

            att_id = create_attachment(token, user_id, pdf_path)
            if att_id is None:
                success = False
                continue
            att_ids.append(att_id)

            if not assign_attachment(token, tx_id, att_id):
                success = False

        if success and att_ids:
            if not confirm_transaction(token, tx_id):
                success = False

        status = "DONE" if success else "FAILED"
        results.append((label, tx_id, status))
        print(f"  → {status}")
        print()

    print("=" * 60)
    print("Summary:")
    for label, tx_id, status in results:
        print(f"  [{status:6}] tx={tx_id}  {label}")


if __name__ == "__main__":
    main()
