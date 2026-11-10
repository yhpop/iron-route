"""Explicit workspace-only QA; not a standalone-kit dependency. Read-only."""
import argparse,hashlib
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--workspace-root',required=True,type=Path);a=p.parse_args()
record=Path(__file__).resolve().parents[2]/'assets/art-kit/tank-reference-sha256.txt'
for line in record.read_text().splitlines():
 expected,name=line.split(None,1);f=a.workspace_root/name.strip()
 actual=hashlib.sha256(f.read_bytes()).hexdigest();assert actual==expected,(str(f),actual,expected)
 print(name.strip()+': OK (workspace-only QA)')
