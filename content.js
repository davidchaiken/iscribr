// Track the last hovered image element (for mouse users)
let lastHoveredImage = null;
let lastImageUrl = null;

// Track the focused element (for screen reader users)
let focusedElement = null;

// Listen for focus changes (used by screen readers like VoiceOver)
document.addEventListener('focus', function(e) {
  focusedElement = e.target;
}, true);

document.addEventListener('blur', function(e) {
  if (focusedElement === e.target) {
    focusedElement = null;
  }
}, true);

// Function to extract image URL from an element
function getImageUrl(element) {
  if (!element) return null;
  
  // Check if it's an IMG tag
  if (element.tagName === 'IMG') {
    // For srcset, get the highest resolution
    if (element.srcset) {
      const sources = element.srcset.split(',').map(s => s.trim());
      // Get the last one (usually highest resolution)
      const lastSrc = sources[sources.length - 1];
      const url = lastSrc.split(' ')[0];
      return url;
    }
    return element.currentSrc || element.src;
  }
  
  // Check for background-image
  const bgImage = window.getComputedStyle(element).backgroundImage;
  if (bgImage && bgImage !== 'none') {
    const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
    if (match) return match[1];
  }
  
  return null;
}

// Track mouse movements to know which image the user is hovering over
document.addEventListener('mouseover', function(e) {
  const url = getImageUrl(e.target);
  if (url) {
    lastHoveredImage = e.target;
    lastImageUrl = url;
    console.log('[Alt Texter] Image detected:', url);
  }
}, true);

// Also track with more frequent updates using mousemove
document.addEventListener('mousemove', function(e) {
  // Only check every 100ms to avoid performance issues
  if (!document._lastImageCheck || Date.now() - document._lastImageCheck > 100) {
    document._lastImageCheck = Date.now();
    const element = document.elementFromPoint(e.clientX, e.clientY);
    const url = getImageUrl(element);
    if (url) {
      lastHoveredImage = element;
      lastImageUrl = url;
    }
  }
}, true);

// Helper function to find an image within or as the element
function findImageInElement(element) {
  if (!element) return null;
  
  console.log('[Alt Texter] Searching for image in element:', element.tagName, element);
  
  // Check if the element itself is an image
  const directUrl = getImageUrl(element);
  if (directUrl) {
    console.log('[Alt Texter] Element itself is an image:', directUrl);
    return { element: element, url: directUrl };
  }
  
  // Look for an img tag within the element
  const imgTag = element.querySelector('img');
  if (imgTag) {
    const imgUrl = getImageUrl(imgTag);
    if (imgUrl) {
      console.log('[Alt Texter] Found img tag inside element:', imgUrl);
      return { element: imgTag, url: imgUrl };
    }
  }
  
  // Check if element has a background image
  const bgUrl = getImageUrl(element);
  if (bgUrl) {
    console.log('[Alt Texter] Element has background image:', bgUrl);
    return { element: element, url: bgUrl };
  }
  
  console.log('[Alt Texter] No image found in element');
  return null;
}

// Pinterest-specific analysis function
function analyzePinterestPage() {
  if (!window.location.hostname.includes('pinterest.com')) {
    return null;
  }
  
  console.log('[Alt Texter] Analyzing Pinterest page structure...');
  
  // Look for common Pinterest image containers
  const possibleSelectors = [
    '[data-test-id="pin-closeup-image"]',
    '[data-test-id="pin-image"]', 
    '.PinImage',
    '.pinImage',
    'img[alt*="Pin"]',
    'img[src*="pinimg"]',
    // Look for the main content image
    'main img',
    '[role="main"] img',
    '.pin-closeup img',
    // Pinterest specific patterns
    '[data-test-id="closeup-image"]',
    '[data-test-id="pin-detail-image"]',
    'img[data-test-id*="image"]',
    // Look for large images that might be the main pin
    'img[style*="width"]',
    'img[style*="height"]'
  ];
  
  const results = [];
  
  possibleSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;
      const tabIndex = el.getAttribute('tabindex');
      const role = el.getAttribute('role');
      
      results.push({
        selector: selector,
        index: index,
        element: el,
        tagName: el.tagName,
        src: el.src || el.currentSrc,
        alt: el.alt,
        tabIndex: tabIndex,
        role: role,
        isVisible: isVisible,
        dimensions: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
        position: `${Math.round(rect.left)},${Math.round(rect.top)}`,
        // Check if it's likely the main image (largest visible image)
        isLikelyMain: isVisible && rect.width > 200 && rect.height > 200,
        // Additional accessibility info
        ariaLabel: el.getAttribute('aria-label'),
        ariaDescribedBy: el.getAttribute('aria-describedby'),
        title: el.getAttribute('title'),
        // Check parent elements for context
        parentTag: el.parentElement?.tagName,
        parentClass: el.parentElement?.className,
        parentId: el.parentElement?.id
      });
    });
  });
  
  // Sort by size to find the main image
  const visibleImages = results.filter(r => r.isVisible);
  visibleImages.sort((a, b) => {
    const aSize = a.dimensions.split('x').reduce((w, h) => w * h, 1);
    const bSize = b.dimensions.split('x').reduce((w, h) => w * h, 1);
    return bSize - aSize;
  });
  
  console.log('[Alt Texter] Pinterest analysis results:', {
    totalElements: results.length,
    visibleImages: visibleImages.length,
    mainImageCandidate: visibleImages[0],
    allResults: results
  });
  
  return {
    mainImageCandidate: visibleImages[0],
    allResults: results,
    recommendations: generateAccessibilityRecommendations(visibleImages[0])
  };
}

function generateAccessibilityRecommendations(mainImage) {
  if (!mainImage) return [];
  
  const recommendations = [];
  
  if (!mainImage.tabIndex || mainImage.tabIndex === '-1') {
    recommendations.push('Add tabindex="0" to make image focusable');
  }
  
  if (!mainImage.role) {
    recommendations.push('Consider adding role="img" for better screen reader support');
  }
  
  if (!mainImage.alt || mainImage.alt.trim() === '') {
    recommendations.push('Add meaningful alt text');
  }
  
  if (!mainImage.ariaLabel && !mainImage.alt) {
    recommendations.push('Add aria-label for screen reader users');
  }
  
  return recommendations;
}

// Helper function to make Pinterest analysis easily accessible from console
window.analyzePinterest = function() {
  return analyzePinterestPage();
};

// Helper function to make Pinterest image focusable from console
window.makePinterestFocusable = function() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({action: 'make-pinterest-focusable'}, resolve);
  });
};

// Manual Pinterest fix function (for console use)
window.fixPinterestTabNavigation = function() {
  console.log('🔍 Searching for main Pin image...');
  
  // Find the main image (largest visible image)
  const allImages = Array.from(document.querySelectorAll('img'));
  const visibleImages = allImages.filter(img => {
    const rect = img.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  
  // Sort by size to find the main image
  visibleImages.sort((a, b) => {
    const aSize = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
    const bSize = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
    return bSize - aSize;
  });
  
  const mainImage = visibleImages[0];
  
  if (mainImage) {
    console.log('✅ Found main Pin image:', {
      src: mainImage.src,
      dimensions: `${Math.round(mainImage.getBoundingClientRect().width)}x${Math.round(mainImage.getBoundingClientRect().height)}`,
      currentTabIndex: mainImage.getAttribute('tabindex'),
      currentRole: mainImage.getAttribute('role'),
      currentAlt: mainImage.alt
    });
    
    // Make it focusable
    mainImage.setAttribute('tabindex', '0');
    mainImage.setAttribute('role', 'img');
    
    // Add descriptive alt text if empty
    if (!mainImage.alt || mainImage.alt.trim() === '') {
      const pageTitle = document.title || 'Pinterest Pin';
      mainImage.alt = `Main Pin image - ${pageTitle}`;
    }
    
    console.log('🎯 Made image focusable! Try pressing Tab now.');
    console.log('📋 New attributes:', {
      tabindex: mainImage.getAttribute('tabindex'),
      role: mainImage.getAttribute('role'),
      alt: mainImage.alt
    });
    
    // Focus the image
    mainImage.focus();
    console.log('🎯 Image focused! You should see a focus outline.');
    
    return mainImage;
  } else {
    console.log('❌ No main image found');
    return null;
  }
};

// Auto-fix Pinterest tab navigation when page loads
function autoFixPinterestTabNavigation() {
  if (!window.location.hostname.includes('pinterest.com')) {
    return;
  }
  
  // Wait for page to fully load
  setTimeout(() => {
    console.log('[Alt Texter] Auto-fixing Pinterest tab navigation...');
    
    // Find the main image (largest visible image)
    const allImages = Array.from(document.querySelectorAll('img'));
    const visibleImages = allImages.filter(img => {
      const rect = img.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    
    // Sort by size to find the main image
    visibleImages.sort((a, b) => {
      const aSize = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
      const bSize = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
      return bSize - aSize;
    });
    
    const mainImage = visibleImages[0];
    
    if (mainImage && mainImage.getBoundingClientRect().width > 200) {
      // Check if already fixed
      if (mainImage.getAttribute('tabindex') === '0') {
        console.log('[Alt Texter] Pinterest image already focusable');
        return;
      }
      
      console.log('[Alt Texter] Making Pinterest main image focusable:', {
        src: mainImage.src,
        dimensions: `${Math.round(mainImage.getBoundingClientRect().width)}x${Math.round(mainImage.getBoundingClientRect().height)}`
      });
      
      // Make it focusable
      mainImage.setAttribute('tabindex', '0');
      mainImage.setAttribute('role', 'img');
      
      // Add descriptive alt text if empty
      if (!mainImage.alt || mainImage.alt.trim() === '') {
        // Try to extract title from page or use generic description
        const pageTitle = document.title || 'Pinterest Pin';
        mainImage.alt = `Main Pin image - ${pageTitle}`;
      }
      
      // Focus the image automatically
      try {
        mainImage.focus();
        console.log('[Alt Texter] ✅ Pinterest image is now keyboard accessible and focused');
      } catch (error) {
        console.log('[Alt Texter] ✅ Pinterest image is now keyboard accessible (focus failed:', error.message, ')');
      }
    }
  }, 1000); // Wait 1 second for page to load
}

// Run auto-fix when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoFixPinterestTabNavigation);
} else {
  autoFixPinterestTabNavigation();
}

// Listen for messages from the background script asking for the current image
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get-hovered-image') {
    // Smart fallback: prioritize focused element (screen reader), then mouse hover
    let targetElement = null;
    let targetUrl = null;
    let detectionMethod = '';
    
    // First, check if there's a focused element (VoiceOver/screen reader navigation)
    if (focusedElement) {
      console.log('[Alt Texter] Checking focused element:', focusedElement.tagName);
      const imageInfo = findImageInElement(focusedElement);
      if (imageInfo) {
        targetElement = imageInfo.element;
        targetUrl = imageInfo.url;
        detectionMethod = 'focused element (screen reader)';
        console.log('[Alt Texter] Using focused element (screen reader detected)');
      }
    }
    
    // Also check document.activeElement as a backup
    if (!targetUrl && document.activeElement && document.activeElement !== focusedElement) {
      console.log('[Alt Texter] Checking document.activeElement:', document.activeElement.tagName);
      const imageInfo = findImageInElement(document.activeElement);
      if (imageInfo) {
        targetElement = imageInfo.element;
        targetUrl = imageInfo.url;
        detectionMethod = 'active element';
        console.log('[Alt Texter] Using document.activeElement');
      }
    }
    
    // Fall back to mouse-hovered element
    if (!targetUrl && lastImageUrl) {
      targetElement = lastHoveredImage;
      targetUrl = lastImageUrl;
      detectionMethod = 'mouse hover';
      console.log('[Alt Texter] Falling back to mouse-hovered element');
    }
    
    console.log('[Alt Texter] Detection method:', detectionMethod);
    console.log('[Alt Texter] Sending image URL to background:', targetUrl);
    sendResponse({ imageUrl: targetUrl, detectionMethod: detectionMethod });
  } else if (request.action === 'announce-to-screen-reader') {
    // Create or update ARIA live region for screen reader announcement
    console.log('[Alt Texter] Announcing to screen reader:', request.text);
    
    let liveRegion = document.getElementById('alt-texter-live-region');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'alt-texter-live-region';
      liveRegion.setAttribute('aria-live', 'assertive');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.style.position = 'absolute';
      liveRegion.style.left = '-10000px';
      liveRegion.style.width = '1px';
      liveRegion.style.height = '1px';
      liveRegion.style.overflow = 'hidden';
      document.body.appendChild(liveRegion);
    }
    
    // Clear and then set the text (helps ensure it's announced)
    liveRegion.textContent = '';
    setTimeout(() => {
      liveRegion.textContent = 'Alt text: ' + request.text;
    }, 100);
    
    sendResponse({ success: true });
  } else if (request.action === 'analyze-pinterest') {
    // Analyze Pinterest page structure
    const analysis = analyzePinterestPage();
    sendResponse(analysis);
  } else if (request.action === 'make-pinterest-focusable') {
    // Attempt to make the main Pinterest image focusable
    const analysis = analyzePinterestPage();
    if (analysis && analysis.mainImageCandidate) {
      const element = analysis.mainImageCandidate.element;
      
      try {
        // Make the element focusable
        element.setAttribute('tabindex', '0');
        
        // Add role if missing
        if (!element.getAttribute('role')) {
          element.setAttribute('role', 'img');
        }
        
        // Focus the element
        element.focus();
        
        console.log('[Alt Texter] Made Pinterest image focusable and focused it');
        sendResponse({ 
          success: true, 
          element: element.tagName,
          src: element.src || element.currentSrc,
          dimensions: analysis.mainImageCandidate.dimensions
        });
      } catch (error) {
        console.error('[Alt Texter] Error making Pinterest image focusable:', error);
        sendResponse({ success: false, error: error.message });
      }
    } else {
      sendResponse({ success: false, error: 'No main image found on Pinterest page' });
    }
  }
  return true;
});

