/* global Translator */
const altTextInput = document.getElementById('altText');
const loading = document.getElementById('loading');
const lang = document.getElementById('lang');
let text = '';
let ariaLabelRemoved = false; // Track if we've removed aria-label for this popup session
let isResetting = false; // Prevent multiple simultaneous resets
let hasFinalText = false; // Prevent reset from overwriting final text
let controlsEnabled = false; // Track when controls become tabbable

function enableControls() {
  if (controlsEnabled) return;
  controlsEnabled = true;
  // Make textarea tabbable after user intent to navigate
  altTextInput.setAttribute('tabindex', '0');
  // Enable buttons and make them tabbable now that content is ready
  const copyCloseBtn = document.getElementById('copyClose');
  const closeBtn = document.getElementById('close');
  if (copyCloseBtn) {
    copyCloseBtn.removeAttribute('aria-hidden');
    copyCloseBtn.setAttribute('tabindex', '0');
  }
  if (closeBtn) {
    closeBtn.removeAttribute('aria-hidden');
    closeBtn.setAttribute('tabindex', '0');
  }
  // Enable language selector and show label now that content is ready
  const langSelect = document.getElementById('lang');
  if (langSelect) {
    langSelect.removeAttribute('disabled');
    langSelect.setAttribute('tabindex', '0');
    // Show the label (which contains the select)
    const langLabel = langSelect.parentElement;
    if (langLabel && langLabel.tagName === 'LABEL') {
      langLabel.removeAttribute('aria-hidden');
    }
  }
}

lang.addEventListener('change', async function () {
  // Keep textarea readonly and update it directly for translation
  altTextInput.value = 'Translating image description...';
  const originalText = text;
  text = await translate(originalText);
  altTextInput.value = text;
  hasFinalText = true;
  // Announce translation completion via single live region without moving focus
  const liveRegion = document.getElementById('liveRegion');
  if (liveRegion) {
    liveRegion.textContent = '';
    setTimeout(() => { liveRegion.textContent = text; }, 120);
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
  
  
  // Reveal textarea to a11y now that content is ready
  altTextInput.removeAttribute('aria-hidden');

  // Announce final description via single live region (polite)
  const liveRegion = document.getElementById('liveRegion');
  if (liveRegion) {
    liveRegion.textContent = '';
    setTimeout(() => { liveRegion.textContent = text; }, 120);
  }
  
  // Do not change focus here to avoid interrupting the live region announcement

  // Defer enabling controls until user presses Tab (user intent to navigate)
  const onFirstTab = (e) => {
    if (e.key === 'Tab') {
      enableControls();
    }
  };
  // Listen globally because textarea is not tabbable initially
  document.addEventListener('keydown', onFirstTab, { once: true });
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
function resetPopupForVoiceOver(forceReset = false) {
  // If we already have final text and this isn't a forced reset (popup open), don't reset
  if (hasFinalText && !forceReset) {
    return;
  }
  
  // Prevent multiple simultaneous resets
  if (isResetting) {
    return;
  }
  isResetting = true;
  
  // New popup session: clear any prior final-text state
  hasFinalText = false;
  controlsEnabled = false;
  
  // Reset textarea to initial state and hide from a11y to avoid VO announcing control type
  altTextInput.value = 'Generating image description...';
  altTextInput.setAttribute('aria-hidden', 'true');
  altTextInput.setAttribute('tabindex', '-1');
  altTextInput.setAttribute('readonly', 'readonly');
  
  // Reset the aria-label removal flag
  ariaLabelRemoved = false;
  
  // Provide an accessible name but do not rely on focusing it
  altTextInput.setAttribute('aria-label', 'Image description');
  
  // Hide buttons from VoiceOver until content is ready
  const copyCloseBtn = document.getElementById('copyClose');
  const closeBtn = document.getElementById('close');
  if (copyCloseBtn) {
    copyCloseBtn.setAttribute('tabindex', '-1');
    copyCloseBtn.setAttribute('aria-hidden', 'true');
    // Remove any existing tabIndex property
    copyCloseBtn.tabIndex = -1;
  }
  if (closeBtn) {
    closeBtn.setAttribute('tabindex', '-1');
    closeBtn.setAttribute('aria-hidden', 'true');
    // Remove any existing tabIndex property
    closeBtn.tabIndex = -1;
  }
  
  // Hide language selector and label from VoiceOver until content is ready
  const langSelect = document.getElementById('lang');
  if (langSelect) {
    langSelect.setAttribute('disabled', 'true');
    langSelect.setAttribute('tabindex', '-1');
    // Hide the label (which contains the select)
    const langLabel = langSelect.parentElement;
    if (langLabel && langLabel.tagName === 'LABEL') {
      langLabel.setAttribute('aria-hidden', 'true');
    }
  }
  
  // Reset live region and announce generating state
  const liveRegion = document.getElementById('liveRegion');
  if (liveRegion) {
    liveRegion.textContent = 'Generating image description...';
  }
  
  // Ensure single live region reflects generating state (no focus change)
  if (liveRegion) {
    liveRegion.textContent = 'Generating image description...';
  }
  
  // Do not move focus here; user can wait for the description or press Tab
  
  // Allow reset again after a brief delay
  setTimeout(() => {
    isResetting = false;
  }, 200);
}

// Call reset function when popup opens (forced reset on fresh open)
window.addEventListener('load', () => resetPopupForVoiceOver(true));

// Also reset when popup becomes visible (for cases where popup is reused)
document.addEventListener('DOMContentLoaded', function() {
  resetPopupForVoiceOver(true);
});

// Don't reset on visibilitychange or focus - preserve description if it exists

document.getElementById('copyClose').addEventListener('click', async () => {
  const altText = altTextInput.value;
  await navigator.clipboard.writeText(altText);
  window.close();
});

document.getElementById('close').addEventListener('click', () => {
  window.close();
});
