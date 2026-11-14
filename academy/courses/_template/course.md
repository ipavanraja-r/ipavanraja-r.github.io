---
title: Course title
code: ABC-101
subtitle: One line that sells the course
level: Beginner
duration: 6 hours
color: "#b26bff"
tags: [topic, another-topic]
order: 10
outcomes:
  - Something students will be able to do after the course
  - Another concrete skill
prerequisites:
  - What students should already know
draft: true
---

<!--
  HOW TO CREATE A COURSE
  1. Copy this whole folder:  academy/courses/_template  →  academy/courses/my-course-name
  2. Edit this file: front matter above + description + syllabus below. Remove `draft: true`.
  3. Write lessons as separate files in the same folder, named after the slug in the syllabus:
        - first-lesson: My first lesson     →  first-lesson.md
     Lessons without a file show as "coming soon" in the syllabus, so you can publish the
     outline first and fill it in over time.
  4. Run  python tools/build_academy.py   (or --watch while writing).
     On GitHub the "Build content indexes" action does this on every push.
-->

A paragraph or two describing what this course is about and who it is for. Markdown works here.

## Getting started
One optional sentence describing this chapter.
- first-lesson: My first lesson
- second-lesson: The second lesson

## Going deeper
- third-lesson: A lesson that isn't written yet (shows as "coming soon")
