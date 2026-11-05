# Local challenge helper

Companion 0.8.0 can send NumaraAra's reviewed text-image challenge to a recognizer
running on the same computer. Tesseract supplies a candidate five-character answer;
the browser checks the original image, controls, fields and consent again before
attempting the approved submission. Recognition does not establish that the broker
accepted the answer or the request.

The native host is `org.eraseme.challenge`. It is optional, free software and starts
only for an explicit companion action. It does not run a daemon, schedule work, read
mail, upload ID, download models or call a recognition service.

## Setup

Use a source checkout and Python 3.10 or newer. Install
[Tesseract](https://github.com/tesseract-ocr/tesseract) separately; on macOS, an existing
Homebrew installation can use `brew install tesseract`. Linux users can use their
distribution's Tesseract package. The installer does not install dependencies.

1. Download companion 0.8.0, replace the extracted extension files and reload it in
   `chrome://extensions`. The eleven optional broker origins are unchanged.
2. Copy this unpacked extension's ID from that page. It must contain exactly 32
   lowercase letters from `a` through `p`; it is not a password.
3. In a terminal, from the source checkout, replace `YOUR_EXTENSION_ID` below with
   that ID. Inspect the plan, then explicitly install it:

```sh
python3 tools/install_challenge_host.py --extension-id YOUR_EXTENSION_ID --dry-run
python3 tools/install_challenge_host.py --extension-id YOUR_EXTENSION_ID --install
python3 tools/install_challenge_host.py --extension-id YOUR_EXTENSION_ID --check
```

4. In the companion popup, choose **Enable local challenge helper** to grant its
   optional `nativeMessaging` permission. In the workspace, choose **Check local
   challenge helper**.

The native-host installer supports macOS Chrome and Linux Chrome or Chromium. For
Linux Chromium, add `--browser chromium` to each command. Windows and other browsers
have no bundled installer.

Installation is per-user only. The host manifest goes under Chrome's or Chromium's
user `NativeMessagingHosts` directory; its private executable wrapper goes under
`~/.erase-me-challenge/`. The manifest allows exactly the supplied extension origin.
No administrator privilege, system service or browser launch is needed.

## Tool paths and updates

At setup, the installer resolves local executables and the optional model path to
absolute paths. It pins them in the safely quoted wrapper and supplies a bounded
system PATH. A GUI-launched Chrome process therefore does not need to inherit the
terminal's Homebrew or other tool PATH. Trusted operator overrides are
`ERASE_TESSERACT_BIN`, `ERASE_FFMPEG_BIN`, `ERASE_WHISPER_BIN` and
`ERASE_WHISPER_MODEL`; they name local files, never commands or URLs.

`--check` validates the installed wrapper and reports current `image` and `audio`
recognizer availability. Image availability needs Tesseract. Audio availability also
needs FFmpeg, whisper.cpp and a local compatible model. Audio being unavailable is
expected for a Tesseract-only installation. If tools, the checkout or the Python
location change, rerun setup with explicit replacement:

```sh
python3 tools/install_challenge_host.py --extension-id YOUR_EXTENSION_ID --install --replace
```

To remove this browser's registration and wrapper:

```sh
python3 tools/install_challenge_host.py --extension-id YOUR_EXTENSION_ID --uninstall
```

Use the same `--browser` selection and extension ID. The installer refuses unrelated,
symlinked, insecure or differently owned installation files.

## Supported challenge contract

The current Chrome contract is NumaraAra's same-origin `/captcha` image, with its
reviewed dimensions and five-character text-answer field. Only that bounded image
is sent to the local host. There is one recognition attempt, followed by an exact
image and form recheck. Changed images, unavailable tools, unreadable output and
invalid controls stop automatic submission.

The underlying provider can also recognize bounded text images and short English
audio locally. This release has no reviewed Chrome reCAPTCHA audio contract. Audio
capability is not permission to fetch arbitrary audio or operate another vendor's
widget. FastPeopleSearch submission needs the site's actual accepted Turnstile
response. The helper does not manufacture vendor tokens or guarantee passage
through managed challenges, image grids or bot walls.

For FastPeopleSearch, companion 0.6.0 watches the original approved form for at most
12 seconds while its normal widget completes. It validates the exact destination,
form, controls, fields and agreement before waiting and keeps them pinned throughout.
DOM or input changes trigger revalidation; navigation or a `pagehide` event stops the wait.
There is one foreground deadline, with no polling, recurring timer, challenge click
or new vendor permission. The helper is not involved, and no response token is
returned to the workspace. An empty or unresolved response remains blocked.

See the separate [local Python CAPTCHA connector](LOCAL_CAPTCHA.md) for that
adapter's OCR/audio interfaces. Its broader recipe API does not expand this
extension's reviewed broker contracts.

## Protocol and privacy

Each host process handles one length-prefixed native message and exits. Accepted
requests are exactly:

```json
{"action":"capabilities"}
{"action":"recognize_image","media":"BASE64_MEDIA","alphabet":""}
{"action":"recognize_audio","media":"BASE64_MEDIA"}
```

Input JSON is limited to 768 KiB; decoded media is limited to 512 KiB. File paths,
URLs, commands, extra fields, duplicate JSON keys and malformed media are rejected.
The host returns only capability booleans, a bounded answer or a generic error.
Recognizer output is kept off the framed channel and stderr. Temporary challenge
files are private and removed by the local provider after the attempt.

Profile fields, listing URLs, mailbox credentials and broker response tokens are
not part of this protocol. The normal broker page and its vendors still receive
the browser requests required by their own challenge flow. Software and model
licenses remain separate; no binaries or model weights are bundled.

## Validation

```sh
python3 -m pytest tests/test_native_challenge_host.py tests/test_install_challenge_host.py \
  tests/test_captcha_provider.py tests/test_captcha_browser.py
node --test tests/test_automatic_executor.cjs tests/test_automation_background.cjs
```

Tests use synthetic media, temporary user homes and mocked tools. A sanitized-PATH
launch test verifies the pinned setup without running OCR or changing a real browser
profile. Passing tests does not demonstrate live CAPTCHA acceptance or deletion.
