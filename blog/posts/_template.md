---
title: Your post title goes here
date: 2026-01-01
tags: [research, iot]
summary: One or two sentences. Shown on the blog index, the homepage strip, and under the title.
featured: false
draft: true
---

<!--
  HOW TO PUBLISH A POST
  1. Copy this file to  blog/posts/my-new-post.md  (lowercase, dashes, no spaces).
  2. Edit the front matter above. Remove `draft: true` (or set it to false) when it's ready.
  3. Run  python tools/build_blog.py  to refresh the post list
     (or  python tools/build_blog.py --watch  while writing).
     On GitHub, the "Build blog index" action does this for you on every push.
  4. It's live at  blog/?p=my-new-post

  Files starting with "_" (like this one) are never published.
  Images: put them in blog/images/ and reference them as  images/name.png
-->

The first paragraph gets a big green drop cap automatically. Write normally in **Markdown**:
*italic*, **bold**, `inline code`, and [links](https://example.org).

## A section heading

Every `##` and `###` heading shows up in the sticky table of contents on the left.

### A sub-section

- Bullet lists
- Work as expected

1. Numbered lists
2. Too

## Linking to other posts

Link to another post by its filename: [[hello-world]], or with your own text: [[hello-world|my first post]].

## Code blocks

Fenced code with a language gets syntax highlighting and a copy button:

```python
def hello(name: str) -> str:
    return f"hello, {name}"
```

```bash
nmap -sV -p- 10.10.10.10
```

## Callouts

> [!NOTE]
> Neutral information.

> [!TIP]
> A helpful hint.

> [!WARNING]
> Something to be careful about.

> [!DANGER]
> Don't run this in production.

A plain blockquote becomes a big centred pull quote, the magazine kind:

> If it took a day to figure out, it deserves ten minutes of writing.

## Tables

| Field     | Value   |
|-----------|---------|
| Protocol  | 5G NR   |
| Bandwidth | 20 MHz  |

## Images

![Alt text describing the image](images/example.png)
*Caption text in italics directly under the image.*

---

A horizontal rule (three dashes) becomes a decorative ◆ ◆ ◆ divider.
