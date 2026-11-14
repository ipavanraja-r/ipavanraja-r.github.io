# p1r3x.github.io

Personal portfolio of **I Pavanraja (p1r3x)**, PhD Researcher at Amrita Vishwa Vidyapeetham and Security Research Engineer at Amrita Cyber Labs.

A static site with no build step: plain HTML, CSS and JS.

```
index.html                portfolio (home)
certifications.html       Credential Vault page
blog/index.html           Journal: terminal-style blog (tmux index + man-page reader)
blog/posts/*.md           ← your blog posts (Markdown)
blog/posts.json           generated list of posts (don't edit by hand)
assets/data/certs.js      ← your certifications (one list, used by both pages)
assets/css/               style.css (shared theme) · certs.css · blog.css
assets/js/                main.js (shared + home) · certs.js · blog.js
tools/build_blog.py       regenerates blog/posts.json
.github/workflows/        auto-rebuilds posts.json on push
```

## Run locally

Open `index.html` with **VS Code Live Server**. Add `?noboot` to the URL to skip the boot animation while editing.
The blog and portrait need a server (not `file://`); Live Server is fine.

## Writing a blog post

1. Copy `blog/posts/_template.md` to `blog/posts/my-post-title.md` (lowercase, dashes).
2. Fill in the front matter (`title`, `date: YYYY-MM-DD`, `tags`, `summary`) and write in Markdown.
   Set `draft: true` to hide a post, or `featured: true` to pin it to the big slot.
3. Update the post list:
   ```bash
   python tools/build_blog.py           # once
   python tools/build_blog.py --watch   # keeps rebuilding while you write
   ```
4. Push. The **Build blog index** GitHub Action also rebuilds `posts.json` on every push to `blog/posts/`,
   so even if you forget step 3 the post still goes live.

It appears at `blog/?p=my-post-title`, at the top of the blog index, and in the "From the Journal" `tail` panel on the homepage.

### Search

Search covers **the full text of every post**: titles, tags, summaries, headings, paragraphs, lists, code blocks and tables.
It's built in the browser from the Markdown files themselves, so new posts are searchable as soon as they're published. There's no extra index to maintain.

- **Search bar** (top of the journal, or press `/`): live results ranked by relevance, with the matching lines shown under each post
  (`L14 § section: …snippet…`). Click a line to open the post scrolled to that spot with your words highlighted.
- **Fuzzy finder** (`Ctrl+K` on any blog page): an `fzf`-style overlay listing every matching line, with a preview.
- **Inside a post**: press `/` to find text, `n` / `N` to jump between matches, `Esc` to clear.
- Query tips: multiple words must all match; `"exact phrase"` keeps words together. If nothing matches, it falls back to
  *any word*, then to fuzzy stems, so typos like `interferance` still find "interference".
- Searches are shareable: `blog/?q=battery` or `blog/?p=<slug>&q=battery#L15`.

Reader keys: index `j`/`k` move, `Enter` open, `/` grep, `t` tag, `Esc` reset; article `j`/`k`, `space`, `n`/`N` next/prev section, `g`/`G`, `q` back.
The index also has a shell: try `help`, `ls`, `grep <word>`, `tag <name>`, `cat <n>`.

Supported extras: links between posts with `[[slug]]` or `[[slug|text]]`, code blocks with highlighting and a copy button,
`> [!NOTE]` / `[!TIP]` / `[!WARNING]` / `[!DANGER]` callouts (rendered as systemd `[ INFO ]` / `[  OK  ]` / `[ WARN ]` / `[FAILED]` lines), plain `>` blockquotes as `$ echo` quote boxes, tables,
images (put them in `blog/images/`), and an automatic table of contents built from `##` / `###` headings.
See `_template.md` for examples of each.

## Academy (courses for students)

`academy/` is a course library. Each **course** is a book: **chapters** (modules) contain numbered **lessons** (1.1, 1.2…).
The syllabus is written up front; lessons appear as "coming soon" until their file exists.

```
academy/courses/<course>/course.md     course info + the syllabus outline
academy/courses/<course>/<lesson>.md   one Markdown file per lesson
academy/courses/<course>/images/       pictures, referenced as images/name.png
academy/courses.json                   generated (don't edit by hand)
```

**Create a course:** copy `academy/courses/_template/` to `academy/courses/my-course/`, edit `course.md`
(remove `draft: true`), then run `python tools/build_academy.py` (or `--watch`).

**Syllabus format** in `course.md`: every `## Heading` is a chapter, an optional line under it describes the chapter,
and each `- slug: Lesson title` is a lesson. The lesson becomes readable when `slug.md` exists.

**Add a lesson:** create `academy/courses/<course>/<slug>.md` with optional front matter
(`title`, `summary`, `duration` in minutes, `objectives:` list). It slots into its chapter automatically.
A lesson file that isn't in the syllabus goes into chapter `module: N` from its front matter, or an "Extras" chapter.

Lessons support everything journal posts do (code, callouts, tables, images), and `[[other-lesson]]` links within the course.
Students' progress (completed lessons, where they left off) is stored in their own browser.
Reader keys: `←`/`→` previous/next lesson, `m` mark complete, `s` syllabus drawer. The green window button enters focus mode.

The **Build content indexes** GitHub Action rebuilds both `blog/posts.json` and `academy/courses.json` on push.

## Window controls

The red / amber / green dots on every terminal window work (close / minimize / maximize). Double-click a title bar to maximize, and `Esc` restores.
Defaults apply to any `.panel` with a `.panel-bar`. Pages override them with:

```js
P1R3X.win.on(".my-window", {
  close(win, wm) { /* … */ return true; },   // return true = handled, skip the default
  minimize(win, wm) { return false; },        // false = run the default too
  maximize(win, wm) { /* … */ return true; },
  reopen(win) { /* runs after a closed window is restored */ },
});
```

The closed-window job line can be customised per window with `data-stub`, `data-stub-state` and `data-reopen`
attributes, and the minimized label with `data-min-label`.

## Adding a certification

Add an entry to `assets/data/certs.js`. It shows up on the vault page, the homepage strip and the terminal `certs` command.
Optional fields: `verify` (credential URL), `credentialId`, and `image` (a scan of the certificate, e.g. `assets/certs/name.png`),
which is shown in the detail modal.

Deep link to a certificate: `certifications.html#<id>`.

## Other things to customise

- **Terminal commands**: the `CMDS` object in `assets/js/main.js`
- **Typed roles in the hero**: the `ROLES` array in `assets/js/main.js`
- **Portrait crop**: `CROP` in the `portrait()` function in `assets/js/main.js`
