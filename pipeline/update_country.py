"""Run the verified update path for one country or all safe providers."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
SAFE_COMMANDS = {
    "LU": ["pipeline/main.py", "update-luxembourg"],
    "IE": ["pipeline/main.py", "update-ireland"],
    "GB": ["pipeline/main.py", "update-uk"],
    "SE": ["pipeline/main.py", "update-sweden"],
    "FI": ["pipeline/main.py", "update-finland"],
    "NL": ["pipeline/main.py", "update-netherlands"],
}


def run_country(country: str, input_path: Path | None = None) -> dict:
    code = country.upper()
    if code in {"DE", "FR"}:
        command = [sys.executable, "pipeline/generate_provider_baselines.py"]
    elif code == "IT":
        if not input_path:
            return {
                "countryCode": code,
                "status": "authentication-required",
                "message": "Download an ED-269 JSON export from d-flight manually, then pass --input. No login is automated.",
            }
        command = [
            sys.executable,
            "pipeline/import_private_export.py",
            "--country",
            code,
            "--input",
            str(input_path),
        ]
    elif code in SAFE_COMMANDS:
        command = [sys.executable, *SAFE_COMMANDS[code]]
    else:
        return {
            "countryCode": code,
            "status": "pending",
            "message": "No verified automated and redistributable update path is configured.",
        }
    completed = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    return {
        "countryCode": code,
        "status": "updated" if completed.returncode == 0 else "failed",
        "returnCode": completed.returncode,
        "stdout": completed.stdout.strip(),
        "stderr": completed.stderr.strip(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--country")
    parser.add_argument("--input", type=Path)
    args = parser.parse_args()
    if args.country:
        results = [run_country(args.country, args.input)]
    else:
        results = [run_country(code) for code in ("DE", "FR", *SAFE_COMMANDS)]
    print(json.dumps({"results": results}, indent=2))
    failures = [item for item in results if item["status"] == "failed"]
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
