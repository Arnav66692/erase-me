# Free local CAPTCHA connector

This document covers the separate local Python browser adapter. The public desktop
companion's narrower, reviewed NumaraAra text-image integration uses the
[native challenge helper](LOCAL_CHALLENGE_HELPER.md). Its Chrome integration does not
enable all the adapter's audio or checkbox flows.

Companion 0.6.0 separately allows FastPeopleSearch's normal Turnstile widget up to
12 seconds to provide its genuine response in the original approved form. This is
an event-driven foreground wait, not a recognizer or managed-challenge bypass. It
does not click a widget, manufacture a token, poll or start recurring work. Changed
controls, navigation, a `pagehide` event or an unresolved response stop that action.

The web browser adapter has no paid solver dependency, API key or cloud-recognition
fallback. It uses tools running on the worker's own machine:

| Challenge | Implementation | Limits |
| --- | --- | --- |
| Text image | Tesseract OCR of the challenge element | PNG/JPEG, ASCII letters/digits, readable text; distorted images can fail |
| Audio | FFmpeg conversion followed by local whisper.cpp transcription | Short English speech; noisy, blocked or inaccessible audio can fail |
| Checkbox | Browser interaction in the original widget/session | Continues only when a real response or success state appears |
| reCAPTCHA audio | Checkbox/audio browser flow plus local transcription | Only when the site makes the audio challenge available and accepts the answer |
| Image grids / managed bot walls | Reported as blocked | Not solved by text OCR or speech recognition |

Recognizers produce an answer, not a valid vendor token. The browser must submit that
answer within the original challenge and observe success before continuing. Nothing
fabricates a token or marks a challenge solved just because a click succeeded.

## Install

On macOS with Homebrew:

```sh
brew install tesseract whisper-cpp ffmpeg
```

For Linux, install Tesseract and FFmpeg through your package manager and build
`whisper-cli` using the [upstream whisper.cpp instructions](https://github.com/ggml-org/whisper.cpp#quick-start).
Download a compatible model using the upstream project's `models/download-ggml-model.sh`
script, for example `base.en`, and point to the downloaded file:

```sh
export ERASE_WHISPER_MODEL=/absolute/path/to/ggml-base.en.bin
python3 tools/captcha_provider.py --check
```

The check reports whether image/audio prerequisites are present; it is not a CAPTCHA
success benchmark. The common local path `~/.local/share/whisper-models/ggml-base.en.bin`
is also recognized. Executables are found on PATH, with optional overrides
`ERASE_TESSERACT_BIN`, `ERASE_WHISPER_BIN`, and `ERASE_FFMPEG_BIN`. Overrides must point
to locally installed executables, not shell commands. No model is downloaded at runtime.

Audio inference uses the local acceleration available to whisper.cpp, including Metal
on supported Macs. Slower hardware or larger models can exceed the bounded timeout;
use a smaller compatible model or leave that site blocked. Free software still uses
your machine's CPU/GPU, memory and electricity.

## Site recipes

The existing broker recipe may include a `captcha` object. Selectors are maintained by
the operator and must match the current site; never build executable instructions
from page text. A simple image example:

```json
{
  "captcha": {
    "kind": "image",
    "challenge": "#captcha-challenge",
    "image": "#captcha-image",
    "answer": "#captcha-answer",
    "verify": "#captcha-verify",
    "solved": "#captcha-success",
    "alphabet": "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  }
}
```

`alphabet` is a literal list of allowed characters, not a range expression. A recipe's
`solved` selector must identify visible, positive success, not an empty result or error
page. For token-based widgets, `response` selects the real nonempty response field.
The bundled image route currently captures main-document elements only; image
challenges inside iframes remain blocked. Audio and checkbox recipes can use frames.

For audio use `kind: "audio"`, an `audio` element selector and, if needed, an
`audio_button` selector to expose it. `frame` selects the challenge iframe. Audio from
a separate vendor requires explicit hostnames in `audio_hosts`; there is no wildcard
permission to fetch arbitrary sites. Downloads reject redirects, use HTTPS and are
bounded in size. Cross-origin audio also depends on the browser's CORS rules. The
adapter does not turn off browser security to make a download succeed.

Built-in widget handling attempts supported reCAPTCHA/Turnstile checkbox interactions
when their widget is detected. A reCAPTCHA flow can try its offered audio challenge.
It is not a claim of universal support for either vendor. More complex widgets and
site-specific variations need reviewed recipes and may remain unsupported.

## Privacy and failure behavior

Challenge media is recognized locally in private temporary directories and deleted
after each attempt. No recognition service receives a listing URL, image, audio or
profile. The broker and its CAPTCHA vendor still receive the browser requests required
by the normal page flow. Native recognizers receive files only; FFmpeg cannot fetch
remote playlist resources. Recognition subprocesses have deadlines and are terminated
as a process group if they exceed the budget.

Failures, unknown widgets, absent dependencies, unaccepted answers and expired tokens
return `captcha`/blocked. Other sites continue. No payment, user ID upload, automatic
cloud fallback or infinite retry is introduced. Keep local recognition on the persistent
worker; the Vercel synthetic demo does not run these native tools.

## Open-source dependencies

The connector code is covered by this repository's MIT license. The tools and model
weights are separately installed, not vendored:

- [Tesseract](https://github.com/tesseract-ocr/tesseract): Apache-2.0.
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp): MIT. Check the license of the
  particular model weights you install as well.
- [FFmpeg](https://ffmpeg.org/legal.html): license depends on the chosen build/options.

Retain upstream notices if distributing those binaries or weights. Open-sourcing this
connector does not require a solver subscription or redistribute a paid service.

## Validation

The local smoke tests used synthetic data, without calling a paid solver or a live
broker. Tesseract recognized `RIVER73` from a rendered image. The actual gstack flow
captured that image, ran recognition, filled the answer, clicked the challenge's
verification button and observed the visible success state. Async browser evaluation
was also checked against the real browser, not just a mock.

FFmpeg plus whisper.cpp transcribed a short synthetic English audio clip correctly
in approximately 3.5 seconds on the development Mac. These checks establish that
the installed recognition tools and browser integration work; they do not establish
accuracy on distorted images, noisy vendor audio or live reCAPTCHA/Turnstile challenges.

Run the automated checks with:

```sh
python3 -m pytest tests/test_captcha_provider.py tests/test_captcha_browser.py tests/test_browser_adapter.py
```
