#!/usr/bin/env python3
"""
Build blog/posts.json from the Markdown files in blog/posts/.

    python tools/build_blog.py            # rebuild once
    python tools/build_blog.py --watch    # rebuild whenever a post changes (Ctrl+C to stop)

Every  blog/posts/<slug>.md  becomes a post at  blog/?p=<slug>.
Files starting with "_" (like _template.md) and posts with `draft: true` are skipped.

Front matter (between --- lines at the top of the file):

    ---
    title: My post title
    date: 2026-11-14
    tags: [5g, iot, research]
    summary: One or two sentences shown on the index and under the title.
    featured: false          # optional: pin to the big featured slot
    cover: images/foo.png    # optional: path relative to blog/ (otherwise generative art)
    coverCaption: ...        # optional
    draft: false             # optional: true hides the post
    ---

No third-party packages needed: standard library only.
"""
from __future__ import annotations

import json
import re
import sys
import time
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS_DIR = ROOT / "blog" / "posts"
OUT = ROOT / "blog" / "posts.json"
WPM = 220

FM_RE = re.compile(r"^﻿?---\s*\n(.*?)\n---\s*\n?", re.S)


def parse_value(raw: str):
    v = raw.strip()
    if v.startswith("[") and v.endswith("]"):
        return [x.strip().strip("'\"") for x in v[1:-1].split(",") if x.strip()]
    if v.lower() in ("true", "yes"):
        return True
    if v.lower() in ("false", "no"):
        return False
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "'\"":
        return v[1:-1]
    return v


def parse_front_matter(text: str) -> tuple[dict, str]:
    m = FM_RE.match(text.replace("\r\n", "\n"))
    if not m:
        return {}, text
    meta: dict = {}
    for line in m.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if ":" not in line:
            continue
        key, _, val = line.partition(":")
        val = val.strip()
        q = re.match(r"""^(["'])(.*)\1(\s+#.*)?$""", val)
        if q:                                   # quoted value: keep '#' inside quotes
            val = q.group(1) + q.group(2) + q.group(1)
        else:                                   # strip trailing "# comment"
            val = re.sub(r"\s+#.*$", "", val)
        meta[key.strip()] = parse_value(val)
    return meta, text.replace("\r\n", "\n")[m.end():]


def plain_text(md: str) -> str:
    md = re.sub(r"```.*?```", " ", md, flags=re.S)          # code blocks
    md = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", md)          # images
    md = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", md)       # links -> text
    md = re.sub(r"^>\s*\[![A-Z]+\]\s*", "", md, flags=re.M)
    md = re.sub(r"[#>*_`~|-]", " ", md)
    return re.sub(r"\s+", " ", md).strip()


def first_paragraph(md: str, limit: int = 220) -> str:
    for block in re.split(r"\n\s*\n", md):
        b = block.strip()
        if b and not b.startswith(("#", "```", "!", "|", ">", "-", "*", "1.")):
            t = plain_text(b)
            return t if len(t) <= limit else t[: limit].rsplit(" ", 1)[0] + "…"
    return ""


def build() -> int:
    posts = []
    problems = []
    for f in sorted(POSTS_DIR.glob("*.md")):
        if f.name.startswith("_"):
            continue
        meta, body = parse_front_matter(f.read_text(encoding="utf-8"))
        if meta.get("draft") is True:
            continue
        slug = f.stem
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", slug):
            problems.append(f"{f.name}: filename should be lowercase-with-dashes")
        title = meta.get("title") or slug.replace("-", " ").title()
        d = str(meta.get("date") or date.fromtimestamp(f.stat().st_mtime).isoformat())
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", d):
            problems.append(f"{f.name}: date must be YYYY-MM-DD (got {d!r})")
            d = date.fromtimestamp(f.stat().st_mtime).isoformat()
        tags = meta.get("tags") or []
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",") if t.strip()]
        words = len(plain_text(body).split())
        post = {
            "slug": slug,
            "title": title,
            "date": d,
            "tags": [t.lower() for t in tags],
            "summary": meta.get("summary") or first_paragraph(body),
            "readingTime": max(1, round(words / WPM)),
            "words": words,
        }
        for opt in ("cover", "coverCaption"):
            if meta.get(opt):
                post[opt] = meta[opt]
        if meta.get("featured") is True:
            post["featured"] = True
        posts.append(post)

    posts.sort(key=lambda p: p["date"], reverse=True)
    OUT.write_text(json.dumps({"generated": date.today().isoformat(), "count": len(posts), "posts": posts}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for p in problems:
        print("  ! " + p)
    print(f"✓ {len(posts)} post(s) → {OUT.relative_to(ROOT)}")
    return 0


def watch() -> None:
    print(f"watching {POSTS_DIR.relative_to(ROOT)} … (Ctrl+C to stop)")
    last = None
    while True:
        snap = tuple(sorted((f.name, f.stat().st_mtime) for f in POSTS_DIR.glob("*.md")))
        if snap != last:
            build()
            last = snap
        time.sleep(1)


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if "--watch" in sys.argv:
        try:
            watch()
        except KeyboardInterrupt:
            pass
    else:
        sys.exit(build())
