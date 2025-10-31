# iScribr

This Chrome extension improves the experience on Pinterest (and maybe other web applications)
by allowing the user to request image descriptions using the Option-I (MacOS) or Alt-I (Windows)
key sequence. It is based on the [Alt-texter](https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/functional-samples/ai.gemini-on-device-alt-texter) sample Chrome extension, which demonstrates how to use on-device multimodal AI with Gemini Nano - image understanding. The code for the modifications was written with the [Cursor](https://cursor.com/home) integrated development environment.

## Overview

This extension adds a context menu entry for images on the web to generate an image description that is displayed in a popup window. The design is tuned to provide the image description (typically with a screen reader such as VoiceOver) to the user as quickly as possible.

The extension also provides navigation improvements for Pinterest.
* The "Skip to content" banner that appears on Pinterest when the user hits the Tab key for the first time redirects to the top left Pin in the feed rather than to a control element.
* After returning to a feed from a Pin closeup, the focus returns to the Pin from the closeup rather than reverting to the Pin in the top left corner of the screen. Focusing on the Pin selected for a closeup matches the designed flow of Pinterest.

## Running this extension

1. Clone this repository.
1. Load this directory in Chrome as an [unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).
1. Hit Option-I on MacOS or Alt-I on Windows. It is sometimes (but not always) also possible to right click an image and select "Describe Image."
