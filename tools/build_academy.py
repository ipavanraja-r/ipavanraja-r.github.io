#!/usr/bin/env python3
"""
Build academy/courses.json from the course folders in academy/courses/.

    python tools/build_academy.py            # rebuild once
    python tools/build_academy.py --watch    # rebuild whenever anything changes (Ctrl+C to stop)

Layout
------
academy/courses/<course-slug>/course.md      the course + its syllabus (required)
academy/courses/<course-slug>/<lesson>.md    one file per lesson
academy/courses/<course-slug>/images/        optional pictures for lessons

Folders starting with "_" (like _template) are ignored.

course.md
---------
    ---
    title: Modern Web Application Exploitation
    code: WEB-301
    subtitle: Breaking and fixing the modern web
    level: Intermediate            # Beginner | Intermediate | Advanced
    duration: 12 hours
    color: "#ff2a4a"               # accent for the book cover
    tags: [web, owasp, ctf]
    order: 1                       # position in the library (optional)
    outcomes:
      - First thing students will be able to do
      - Second thing
    prerequisites:
      - What they should know first
    draft: false
    ---
    A paragraph or two describing the course (Markdown).

    ## Foundations                 <- every "##" heading is a chapter (module)
    One optional line describing the chapter.
    - how-the-web-talks: How the web talks: HTTP     <- "slug: Title" = a lesson
    - cookies-and-sessions: Cookies & sessions
    - Burp Suite setup                               <- title only: slug is generated

A lesson is *available* when <course>/<slug>.md exists (and isn't `draft: true`).
Otherwise it shows in the syllabus as *planned / coming soon*.

Lesson front matter (all optional):
    ---
    title: Cookies & sessions     # defaults to the syllabus title
    summary: One-line description
    duration: 15                  # minutes (otherwise estimated from word count)
    objectives:
      - What the student will learn
    module: 2                     # only for lessons NOT in the syllabus: chapter to add it to
    draft: false
    ---

Standard library only.
"""
from __future__ import annotations

import json
import re
import sys
import time
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COURSES_DIR = ROOT / "academy" / "courses"
OUT = ROOT / "academy" / "courses.json"
WPM = 200

FM_RE = re.compile(r"^﻿?---\s*\n(.*?)\n---\s*\n?", re.S)


def slugify(s: str) -> str:
    s = re.sub(r"[^\w\s-]", "", s.lower()).strip()
    return re.sub(r"[\s_]+", "-", s)[:60] or "lesson"


def parse_scalar(v: str):
    v = v.strip()
    q = re.match(r"""^(["'])(.*)\1(\s+#.*)?$""", v)
    if q:
        return q.group(2)
    v = re.sub(r"\s+#.*$", "", v)
    if v.startswith("[") and v.endswith("]"):
        return [x.strip().strip("'\"") for x in v[1:-1].split(",") if x.strip()]
    if v.lower() in ("true", "yes"):
        return True
    if v.lower() in ("false", "no"):
        return False
    if re.fullmatch(r"-?\d+", v):
        return int(v)
    return v


def parse_front_matter(text: str) -> tuple[dict, str]:
    text = text.replace("\r\n", "\n")
    m = FM_RE.match(text)
    if not m:
        return {}, text
    meta: dict = {}
    key = None
    for line in m.group(1).splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        item = re.match(r"^\s+-\s+(.*)$", line)
        if item and key:                       # block list item under the last key
            if not isinstance(meta.get(key), list):
                meta[key] = []
            meta[key].append(parse_scalar(item.group(1)))
            continue
        if ":" in line and not line.startswith(" "):
            k, _, v = line.partition(":")
            key = k.strip()
            meta[key] = parse_scalar(v) if v.strip() else []
    # empty lists that never got items become empty strings → normalise
    return meta, text[m.end():]


def plain_words(md: str) -> int:
    md = re.sub(r"```.*?```", " ", md, flags=re.S)
    md = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", md)
    md = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", md)
    md = re.sub(r"[#>*_`~|-]", " ", md)
    return len(md.split())


def first_paragraph(md: str, limit: int = 200) -> str:
    for block in re.split(r"\n\s*\n", md):
        b = block.strip()
        if b and not b.startswith(("#", "```", "!", "|", ">", "-", "*", "1.", "<")):
            t = re.sub(r"\s+", " ", re.sub(r"[*_`]|\[([^\]]*)\]\([^)]*\)", lambda m: m.group(1) or "", b))
            return t if len(t) <= limit else t[:limit].rsplit(" ", 1)[0] + "…"
    return ""


def parse_syllabus(body: str):
    """Split course.md body into description + modules/lessons."""
    description, modules, cur = [], [], None
    for raw in body.split("\n"):
        line = raw.rstrip()
        h = re.match(r"^##\s+(.+)$", line)
        if h:
            cur = {"title": h.group(1).strip(), "summary": "", "lessons": []}
            modules.append(cur)
            continue
        if cur is None:
            description.append(raw)
            continue
        li = re.match(r"^\s*[-*]\s+(.+)$", line)
        if li:
            txt = li.group(1).strip()
            m = re.match(r"^([a-z0-9][a-z0-9-]*)\s*:\s*(.+)$", txt)
            if m:
                cur["lessons"].append({"slug": m.group(1), "title": m.group(2).strip()})
            else:
                cur["lessons"].append({"slug": slugify(txt), "title": txt})
        elif line.strip() and not cur["lessons"] and not line.startswith("#"):
            cur["summary"] = (cur["summary"] + " " + line.strip()).strip()
    return "\n".join(description).strip(), modules


def build() -> int:
    courses, problems = [], []
    if not COURSES_DIR.exists():
        COURSES_DIR.mkdir(parents=True)
    for cdir in sorted(p for p in COURSES_DIR.iterdir() if p.is_dir() and not p.name.startswith("_")):
        cfile = cdir / "course.md"
        if not cfile.exists():
            problems.append(f"{cdir.name}/: missing course.md (skipped)")
            continue
        meta, body = parse_front_matter(cfile.read_text(encoding="utf-8"))
        if meta.get("draft") is True:
            continue
        description, modules = parse_syllabus(body)
        if not modules:
            problems.append(f"{cdir.name}/course.md: no '## Chapter' headings, so the syllabus is empty")

        # lesson files on disk
        files = {}
        for f in sorted(cdir.glob("*.md")):
            if f.name == "course.md" or f.name.startswith("_"):
                continue
            lmeta, lbody = parse_front_matter(f.read_text(encoding="utf-8"))
            files[f.stem] = (lmeta, lbody, f)

        listed = {l["slug"] for m in modules for l in m["lessons"]}
        # lessons not in the syllabus → their `module:` chapter, else an "Extras" chapter
        for slug, (lmeta, lbody, f) in files.items():
            if slug in listed or lmeta.get("draft") is True:
                continue
            target = lmeta.get("module")
            entry = {"slug": slug, "title": lmeta.get("title") or slug.replace("-", " ").title()}
            if isinstance(target, int) and 1 <= target <= len(modules):
                modules[target - 1]["lessons"].append(entry)
                problems.append(f"{cdir.name}/{f.name}: not in syllabus, added to chapter {target}")
            else:
                if not modules or modules[-1]["title"] != "Extras":
                    modules.append({"title": "Extras", "summary": "Additional lessons outside the main syllabus.", "lessons": []})
                modules[-1]["lessons"].append(entry)
                problems.append(f"{cdir.name}/{f.name}: not in syllabus, added to 'Extras' (add it to course.md, or set module: N)")

        total = avail = minutes = words_total = 0
        for mi, m in enumerate(modules, 1):
            m["n"] = mi
            for li, l in enumerate(m["lessons"], 1):
                l["n"] = f"{mi}.{li}"
                total += 1
                hit = files.get(l["slug"])
                if hit and hit[0].get("draft") is not True:
                    lmeta, lbody, f = hit
                    words = plain_words(lbody)
                    dur = lmeta.get("duration")
                    mins = dur if isinstance(dur, int) else max(1, round(words / WPM))
                    l.update({
                        "available": True,
                        "title": lmeta.get("title") or l["title"],
                        "summary": lmeta.get("summary") or first_paragraph(lbody),
                        "minutes": mins,
                        "words": words,
                    })
                    if isinstance(lmeta.get("objectives"), list):
                        l["objectives"] = lmeta["objectives"]
                    avail += 1
                    minutes += mins
                    words_total += words
                else:
                    l["available"] = False

        tags = meta.get("tags") or []
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",") if t.strip()]
        listify = lambda v: v if isinstance(v, list) else ([v] if v else [])
        courses.append({
            "slug": cdir.name,
            "code": meta.get("code") or cdir.name.upper()[:8],
            "title": meta.get("title") or cdir.name.replace("-", " ").title(),
            "subtitle": meta.get("subtitle") or "",
            "summary": meta.get("summary") or first_paragraph(description),
            "description": description,
            "level": meta.get("level") or "All levels",
            "duration": str(meta.get("duration") or ""),
            "color": meta.get("color") or "#b26bff",
            "tags": [t.lower() for t in tags],
            "instructor": meta.get("instructor") or "I Pavanraja (p1r3x)",
            "outcomes": listify(meta.get("outcomes")),
            "prerequisites": listify(meta.get("prerequisites")),
            "order": meta.get("order") if isinstance(meta.get("order"), int) else 999,
            "updated": date.fromtimestamp(max([cfile.stat().st_mtime] + [h[2].stat().st_mtime for h in files.values()])).isoformat(),
            "modules": modules,
            "stats": {"modules": len(modules), "lessons": total, "available": avail, "minutes": minutes, "words": words_total},
        })

    courses.sort(key=lambda c: (c["order"], c["title"].lower()))
    OUT.write_text(json.dumps({"generated": date.today().isoformat(), "courses": courses}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for p in problems:
        print("  ! " + p)
    print(f"✓ {len(courses)} course(s), {sum(c['stats']['available'] for c in courses)}/{sum(c['stats']['lessons'] for c in courses)} lessons published → {OUT.relative_to(ROOT)}")
    return 0


def watch() -> None:
    print(f"watching {COURSES_DIR.relative_to(ROOT)} … (Ctrl+C to stop)")
    last = None
    while True:
        snap = tuple(sorted((str(f.relative_to(COURSES_DIR)), f.stat().st_mtime) for f in COURSES_DIR.rglob("*.md")))
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
