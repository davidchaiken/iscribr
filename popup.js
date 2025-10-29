/* global Translator */
const altTextInput = document.getElementById('Image description');
const loading = document.getElementById('loading');
const lang = document.getElementById('lang');
let text = '';
let ariaLabelRemoved = false; // Track if we've removed aria-label for this popup session
let isResetting = false; // Prevent multiple simultaneous resets
let hasFinalText = false; // Prevent reset from overwriting final text

lang.addEventListener('change', async function () {
  // Keep textarea readonly and update it directly for translation
  altTextInput.value = 'Translating image description...';
  const originalText = text;
  text = await translate(originalText);
  altTextInput.value = text;
  hasFinalText = true;
  // Announce translation completion without moving focus
  const statusMessage = document.getElementById('statusMessage');
  if (statusMessage) {
    statusMessage.textContent = 'Translation complete';
  }
  const descLive = document.getElementById('descLive');
  if (descLive) {
    descLive.textContent = text;
  }
});

async function translate(string) {
  try {
    const translator = await Translator.create({
      sourceLanguage: 'en',
      targetLanguage: lang.value
    });
    return translator.translate(string);
  } catch (e) {
    console.error(e);
    return e.message;
  }
}

async function showAltText() {
  // Set the new text
  altTextInput.value = text;
  hasFinalText = true;
  // Keep textarea readonly so VoiceOver doesn't give editing instructions
  // loading.setAttribute('hidden', true);
  altTextInput.removeAttribute('hidden');
  
  
  // Enable buttons and make them tabbable now that content is ready
  const copyCloseBtn = document.getElementById('copyClose');
  const discardBtn = document.getElementById('discard');
  if (copyCloseBtn) {
    copyCloseBtn.removeAttribute('aria-hidden');
    copyCloseBtn.setAttribute('tabindex', '0');
  }
  if (discardBtn) {
    discardBtn.removeAttribute('aria-hidden');
    discardBtn.setAttribute('tabindex', '0');
  }
  
  // Enable language selector now that content is ready
  const langSelect = document.getElementById('lang');
  if (langSelect) {
    langSelect.removeAttribute('disabled');
    langSelect.setAttribute('tabindex', '0');
  }
  
  // Announce states via ARIA live regions without moving focus
  const statusMessage = document.getElementById('statusMessage');
  if (statusMessage) {
    statusMessage.textContent = 'Image description ready';
  }
  const descLive = document.getElementById('descLive');
  if (descLive) {
    descLive.textContent = text;
  }
}

chrome.runtime.onMessage.addListener(async function (request) {
  if (request.action === 'alt-text') {
    text = request.text;
    if (lang.value != 'en') {
      text = await translate(text);
    }
    showAltText();
  }
});

// Reset and focus the textarea when popup opens for VoiceOver
function resetPopupForVoiceOver() {
  // If final text is already present, do not reset content or aria-labels
  if (hasFinalText) {
    isResetting = false;
    return;
  }
  // Prevent multiple simultaneous resets
  if (isResetting) {
    return;
  }
  isResetting = true;
  
  // Reset textarea to initial state
  altTextInput.value = 'Generating image description...';
  altTextInput.setAttribute('readonly', 'readonly');
  
  // Reset the aria-label removal flag
  ariaLabelRemoved = false;
  
  // Provide an accessible name but do not rely on focusing it
  altTextInput.setAttribute('aria-label', 'Image description');
  
  // Hide buttons from VoiceOver until content is ready
  const copyCloseBtn = document.getElementById('copyClose');
  const discardBtn = document.getElementById('discard');
  if (copyCloseBtn) {
    copyCloseBtn.setAttribute('tabindex', '-1');
    copyCloseBtn.setAttribute('aria-hidden', 'true');
    // Remove any existing tabIndex property
    copyCloseBtn.tabIndex = -1;
  }
  if (discardBtn) {
    discardBtn.setAttribute('tabindex', '-1');
    discardBtn.setAttribute('aria-hidden', 'true');
    // Remove any existing tabIndex property
    discardBtn.tabIndex = -1;
  }
  
  // Make language selector unfocusable/disabled until content is ready
  const langSelect = document.getElementById('lang');
  if (langSelect) {
    langSelect.setAttribute('disabled', 'true');
    langSelect.setAttribute('tabindex', '-1');
  }
  
  // Clear status message
  const statusMessage = document.getElementById('statusMessage');
  if (statusMessage) {
    statusMessage.textContent = '';
  }
  
  // Announce that we're waiting for content
  if (statusMessage) {
    statusMessage.textContent = 'Generating image description';
  }
  const descLive = document.getElementById('descLive');
  if (descLive) {
    descLive.textContent = '';
  }
  
  // Allow reset again after a brief delay
  setTimeout(() => {
    isResetting = false;
  }, 200);
}

// Call reset function when popup opens
window.addEventListener('load', resetPopupForVoiceOver);

// Also reset when popup becomes visible (for cases where popup is reused)
document.addEventListener('DOMContentLoaded', function() {
  resetPopupForVoiceOver();
});

// Reset when popup window becomes visible again (for reused popups)
document.addEventListener('visibilitychange', function() {
  if (!document.hidden) {
    // Popup became visible, reset for VoiceOver
    setTimeout(resetPopupForVoiceOver, 50);
  }
});

// Also reset when window gains focus
window.addEventListener('focus', function() {
  setTimeout(resetPopupForVoiceOver, 50);
}, { once: false });

document.getElementById('copyClose').addEventListener('click', async () => {
  const altText = altTextInput.value;
  await navigator.clipboard.writeText(altText);
  window.close();
});

document.getElementById('discard').addEventListener('click', () => {
  window.close();
});
