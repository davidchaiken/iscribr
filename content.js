// Track the last hovered image element (for mouse users)
let lastHoveredImage = null;
let lastImageUrl = null;

// Track the focused element (for screen reader users)
let focusedElement = null;

// Track Pinterest navigation state
let pinterestNavigationState = {
  clickedPinId: null,
  clickedPinElement: null,
  clickedPinUrl: null,
  lastFeedUrl: null
};

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

// Track Pinterest Pin clicks for navigation state
document.addEventListener('click', function(e) {
  if (window.location.hostname.includes('pinterest.com') && !window.location.pathname.includes('/pin/')) {
    // Only track clicks on feed pages, not closeup pages
    const pinElement = e.target.closest('[data-test-id="pin"]') || 
                      e.target.closest('[data-test-id="pinWrapper"]') ||
                      e.target.closest('[data-test-id="pinrep"]') ||
                      e.target.closest('a[href*="/pin/"]');
    
    if (pinElement) {
      // Find the image within the pin
      const pinImage = pinElement.querySelector('img[src*="pinimg"]');
      if (pinImage) {
        // Extract Pin ID from the link href or current URL
        const linkElement = pinElement.querySelector('a[href*="/pin/"]') || pinElement.closest('a[href*="/pin/"]');
        const pinId = linkElement ? extractPinIdFromUrl(linkElement.href) : null;
        const imageUrl = getImageUrl(pinImage);
        
        console.log('[Alt Texter] Pinterest Pin clicked on feed:', {
          pinId: pinId,
          imageUrl: imageUrl,
          element: pinImage,
          currentUrl: window.location.href
        });
        
        // Store the clicked pin state
        pinterestNavigationState.clickedPinId = pinId;
        pinterestNavigationState.clickedPinElement = pinImage;
        pinterestNavigationState.clickedPinUrl = imageUrl;
        pinterestNavigationState.lastFeedUrl = window.location.href;
      }
    }
  }
}, true);

// Helper function to extract Pin ID from URL
function extractPinIdFromUrl(url) {
  const match = url.match(/\/pin\/(\d+)/);
  return match ? match[1] : null;
}

// Helper function to find an image within or as the element
function findImageInElement(element) {
  if (!element) return null;
  
  console.log('[Alt Texter] Searching for image in element:', element.tagName, element);
  
  // Check if the element itself is an image
  const directUrl = getImageUrl(element);
  if (directUrl) {
    // Exclude small profile pictures
    if (element.tagName === 'IMG') {
      const rect = element.getBoundingClientRect();
      if (rect.width < 200 && rect.height < 200) {
        console.log('[Alt Texter] Skipping small image (likely profile picture):', directUrl);
        return null;
      }
    }
    console.log('[Alt Texter] Element itself is an image:', directUrl);
    return { element: element, url: directUrl };
  }
  
  // Look for an img tag within the element
  const imgTag = element.querySelector('img');
  if (imgTag) {
    const imgUrl = getImageUrl(imgTag);
    if (imgUrl) {
      // Exclude small profile pictures
      const rect = imgTag.getBoundingClientRect();
      if (rect.width < 200 && rect.height < 200) {
        console.log('[Alt Texter] Skipping small image (likely profile picture):', imgUrl);
        return null;
      }
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

// Helper function to find a video element or video within an element
function findVideoInElement(element) {
  if (!element) return null;
  
  // Check if element itself is a video
  if (element.tagName === 'VIDEO') {
    return element;
  }
  
  // Look for video tag within the element
  const videoTag = element.querySelector('video');
  return videoTag || null;
}

// Helper to check if video is large enough to be meaningful (not a thumbnail)
function isLargeEnoughVideo(video, minSize = 200) {
  try {
    const rect = video.getBoundingClientRect();
    const width = Math.max(video.videoWidth || rect.width || 0, rect.width || 0);
    const height = Math.max(video.videoHeight || rect.height || 0, rect.height || 0);
    return width >= minSize && height >= minSize;
  } catch {
    return false;
  }
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

// Manual Pinterest closeup fix function (for console use)
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

// Manual test function to debug Pinterest navigation state
window.testPinterestNavigationState = function() {
  console.log('🔍 Pinterest Navigation State:', pinterestNavigationState);
  
  if (pinterestNavigationState.clickedPinId) {
    console.log('✅ Previously clicked Pin:', {
      pinId: pinterestNavigationState.clickedPinId,
      pinUrl: pinterestNavigationState.clickedPinUrl,
      element: pinterestNavigationState.clickedPinElement
    });
  } else {
    console.log('❌ No previously clicked Pin stored');
  }
};

// Test function to manually find and focus the previously clicked Pin
window.testFindClickedPin = function() {
  console.log('🔍 Testing Pin finding logic...');
  
  if (!pinterestNavigationState.clickedPinId) {
    console.log('❌ No clicked Pin ID stored');
    return;
  }
  
  console.log('Looking for Pin ID:', pinterestNavigationState.clickedPinId);
  
  // Look for links that contain the Pin ID
  const pinLinks = document.querySelectorAll(`a[href*="/pin/${pinterestNavigationState.clickedPinId}/"]`);
  console.log('Found Pin links:', pinLinks.length);
  
  if (pinLinks.length > 0) {
    pinLinks.forEach((link, index) => {
      console.log(`Link ${index + 1}:`, {
        href: link.href,
        hasImage: !!link.querySelector('img[src*="pinimg"]'),
        imageSrc: link.querySelector('img[src*="pinimg"]')?.src
      });
    });
    
    // Try to find the image within the first matching link
    const pinLink = pinLinks[0];
    const pinImage = pinLink.querySelector('img[src*="pinimg"]');
    
    if (pinImage) {
      const rect = pinImage.getBoundingClientRect();
      console.log('Found Pin image:', {
        src: pinImage.src,
        dimensions: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
        isVisible: rect.width > 0 && rect.height > 0,
        isLargeEnough: rect.width > 100 && rect.height > 100
      });
      
      if (rect.width > 100 && rect.height > 100) {
        console.log('✅ Pin image is suitable, making it accessible...');
        
        // Make it focusable
        pinImage.setAttribute('tabindex', '0');
        pinImage.setAttribute('role', 'img');
        
        // Add descriptive alt text if empty
        if (!pinImage.alt || pinImage.alt.trim() === '') {
          pinImage.alt = 'Previously clicked Pin in feed';
        }
        
        // Focus the image
        pinImage.focus();
        
        console.log('🎯 Pin image is now focused!');
        return pinImage;
      } else {
        console.log('❌ Pin image is too small or not visible');
      }
    } else {
      console.log('❌ No image found in Pin link');
    }
  } else {
    console.log('❌ No Pin links found with that ID');
  }
  
  return null;
};

// Test function to show all Pin links on the page
window.testShowAllPinLinks = function() {
  console.log('🔍 Showing all Pin links on the page...');
  
  const allLinks = document.querySelectorAll('a[href*="/pin/"]');
  console.log(`Found ${allLinks.length} Pin links total`);
  
  const pinIds = new Set();
  allLinks.forEach((link, index) => {
    const href = link.href;
    const pinIdMatch = href.match(/\/pin\/(\d+)/);
    if (pinIdMatch) {
      pinIds.add(pinIdMatch[1]);
    }
    
    if (index < 10) { // Show first 10 for debugging
      console.log(`Link ${index + 1}:`, {
        href: href,
        pinId: pinIdMatch ? pinIdMatch[1] : 'no match',
        hasImage: !!link.querySelector('img[src*="pinimg"]')
      });
    }
  });
  
  console.log('Unique Pin IDs found:', Array.from(pinIds));
  console.log('Looking for Pin ID:', pinterestNavigationState.clickedPinId);
  console.log('Is our Pin ID in the list?', pinIds.has(pinterestNavigationState.clickedPinId));
  
  return Array.from(pinIds);
};

// Manual test function to debug image detection
window.testPinterestImageDetection = function() {
  console.log('🔍 Testing Pinterest image detection...');
  
  // Test the fallback logic directly
  const pinterestImages = findPinterestFeedImages();
  console.log('Found Pinterest images:', pinterestImages.length);
  
  if (pinterestImages.length > 0) {
    const firstPin = pinterestImages[0];
    const imageUrl = getImageUrl(firstPin);
    console.log('First Pin details:', {
      element: firstPin,
      src: firstPin.src,
      url: imageUrl,
      tabindex: firstPin.getAttribute('tabindex'),
      role: firstPin.getAttribute('role')
    });
    
    // Test if this would be detected by the message handler
    console.log('Testing message handler simulation...');
    chrome.runtime.sendMessage({action: 'get-hovered-image'}, (response) => {
      console.log('Message handler response:', response);
    });
  } else {
    console.log('❌ No Pinterest images found');
  }
};

// Manual Pinterest feed fix function (for console use)
window.fixPinterestFeedNavigation = function() {
  console.log('🔍 Searching for first Pin image in feed...');
  
  // Find all images
  const allImages = Array.from(document.querySelectorAll('img'));
  const visibleImages = allImages.filter(img => {
    const rect = img.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  
  // Filter for Pinterest images and exclude small profile images
  const pinterestImages = visibleImages.filter(img => 
    img.src && 
    img.src.includes('pinimg') &&
    img.getBoundingClientRect().width > 100 &&
    img.getBoundingClientRect().height > 100 &&
    !img.closest('[aria-hidden="true"]')
  );
  
  // Sort by position (top-left first)
  pinterestImages.sort((a, b) => {
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();
    
    if (Math.abs(aRect.top - bRect.top) > 10) {
      return aRect.top - bRect.top;
    }
    return aRect.left - bRect.left;
  });
  
  const firstPin = pinterestImages[0];
  
  if (firstPin) {
    console.log('✅ Found first Pin image:', {
      src: firstPin.src,
      dimensions: `${Math.round(firstPin.getBoundingClientRect().width)}x${Math.round(firstPin.getBoundingClientRect().height)}`,
      position: `${Math.round(firstPin.getBoundingClientRect().left)},${Math.round(firstPin.getBoundingClientRect().top)}`,
      currentTabIndex: firstPin.getAttribute('tabindex'),
      currentRole: firstPin.getAttribute('role'),
      currentAlt: firstPin.alt
    });
    
    // Make it focusable
    firstPin.setAttribute('tabindex', '0');
    firstPin.setAttribute('role', 'img');
    
    // Add descriptive alt text if empty
    if (!firstPin.alt || firstPin.alt.trim() === '') {
      firstPin.alt = 'First Pin in feed';
    }
    
    console.log('🎯 Made first Pin focusable! Try pressing Tab now.');
    console.log('📋 New attributes:', {
      tabindex: firstPin.getAttribute('tabindex'),
      role: firstPin.getAttribute('role'),
      alt: firstPin.alt
    });
    
    // Focus the image
    firstPin.focus();
    console.log('🎯 First Pin focused! You should see a focus outline.');
    
    return firstPin;
  } else {
    console.log('❌ No suitable Pinterest images found in feed');
    return null;
  }
};

// Unified Pinterest accessibility fix
function autoFixPinterestAccessibility() {
  if (!window.location.hostname.includes('pinterest.com')) {
    return;
  }
  
  console.log('[Alt Texter] Auto-fixing Pinterest accessibility...');
  
  // Detect page type and apply appropriate fix
  if (isPinterestCloseupPage()) {
    // Closeup pages are more stable, use shorter delay
    setTimeout(() => {
      fixPinterestCloseupPage();
    }, 1000);
  } else if (isPinterestFeedPage()) {
    // Feed pages need more time for dynamic content to load
    // But we want to fix BEFORE the Skip to Content banner appears (usually ~1-2 seconds)
    // Run fix earlier and with retry to beat the banner
    setTimeout(() => {
      fixPinterestFeedPage();
    }, 500); // Start earlier
    
    // Also retry after a delay in case first attempt was too early
    setTimeout(() => {
      fixPinterestFeedPage();
    }, 1500);
  }
}

// Retry logic for Pinterest feed pages (handles dynamic loading)
function fixPinterestFeedPageWithRetry() {
  console.log('[Alt Texter] Fixing Pinterest feed page with retry logic...');
  
  let attempts = 0;
  const maxAttempts = 5;
  const retryDelay = 2000; // 2 seconds between attempts
  
  function attemptFix() {
    attempts++;
    console.log(`[Alt Texter] Feed fix attempt ${attempts}/${maxAttempts}`);
    
    // Find Pinterest images
    const pinterestImages = findPinterestFeedImages();
    
    if (pinterestImages.length > 0) {
      const firstPin = pinterestImages[0];
      console.log(`[Alt Texter] Found ${pinterestImages.length} Pinterest images, using first one`);
      
      // Check if already fixed
      if (firstPin.getAttribute('tabindex') === '0') {
        console.log('[Alt Texter] Feed image already focusable');
        return;
      }
      
      makeImageAccessible(firstPin, 'First Pin in feed');
      console.log('[Alt Texter] ✅ Pinterest feed image is now keyboard accessible and focused');
    } else if (attempts < maxAttempts) {
      console.log(`[Alt Texter] No Pinterest images found, retrying in ${retryDelay}ms...`);
      setTimeout(attemptFix, retryDelay);
    } else {
      console.log('[Alt Texter] ❌ No Pinterest images found after maximum attempts');
    }
  }
  
  // Start with a longer initial delay for feed pages
  setTimeout(attemptFix, 1500);
}

// Helper function to find Pinterest feed images
function findPinterestFeedImages() {
  // Find all images
  const allImages = Array.from(document.querySelectorAll('img'));
  const visibleImages = allImages.filter(img => {
    const rect = img.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  
  // Filter for Pinterest images and exclude profile pictures and UI elements
  const pinterestImages = visibleImages.filter(img => 
    img.src && 
    img.src.includes('pinimg') &&
    img.getBoundingClientRect().width > 100 &&
    img.getBoundingClientRect().height > 100 &&
    !img.closest('[aria-hidden="true"]') &&
    // Exclude profile pictures and UI elements by position and size
    !img.closest('header') && // Exclude header elements
    !img.closest('nav') && // Exclude navigation elements
    !img.closest('[role="banner"]') && // Exclude banner elements
    // Exclude small circular images (likely profile pictures)
    !(img.getBoundingClientRect().width < 200 && img.getBoundingClientRect().height < 200) &&
    // Only include images in the main content area (below header, not in sidebar)
    img.getBoundingClientRect().top > 100 &&
    img.getBoundingClientRect().left < window.innerWidth * 0.8
  );
  
  // Sort by position (top-left first)
  pinterestImages.sort((a, b) => {
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();
    
    if (Math.abs(aRect.top - bRect.top) > 10) {
      return aRect.top - bRect.top;
    }
    return aRect.left - bRect.left;
  });
  
  return pinterestImages;
}

// Detect Pinterest closeup pages (reliable - /pin/ URLs are persistent)
function isPinterestCloseupPage() {
  return window.location.pathname.includes('/pin/');
}

// Detect Pinterest feed pages (simple approach)
function isPinterestFeedPage() {
  // If it's not a closeup page and we're on Pinterest, assume it's a feed
  return !isPinterestCloseupPage() && window.location.hostname.includes('pinterest.com');
}

// Fix Pinterest closeup pages (existing logic)
function fixPinterestCloseupPage() {
  console.log('[Alt Texter] Fixing Pinterest closeup page...');
  
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
      console.log('[Alt Texter] Closeup image already focusable');
      return;
    }
    
    makeImageAccessible(mainImage, 'Main Pin image');
    console.log('[Alt Texter] ✅ Pinterest closeup image is now keyboard accessible and focused');
  }
}

// Fix Pinterest feed pages (new logic)
function fixPinterestFeedPage() {
  console.log('[Alt Texter] Fixing Pinterest feed page...');
  
  // Check if there's already a focused image (from Skip to Content or other)
  const currentlyFocused = document.activeElement;
  if (currentlyFocused && currentlyFocused.tagName === 'IMG' && 
      currentlyFocused.src && currentlyFocused.src.includes('pinimg') &&
      currentlyFocused.getBoundingClientRect().width > 100) {
    console.log('[Alt Texter] Pin image already focused, skipping auto-fix');
    return;
  }
  
  // First, try to find the previously clicked Pin by looking for links to that Pin ID
  let targetPin = null;
  
  if (pinterestNavigationState.clickedPinId) {
    console.log('[Alt Texter] Looking for previously clicked Pin:', {
      pinId: pinterestNavigationState.clickedPinId
    });
    
    // Look for links that contain the Pin ID
    const pinLinks = document.querySelectorAll(`a[href*="/pin/${pinterestNavigationState.clickedPinId}/"]`);
    
    if (pinLinks.length > 0) {
      // Find the image within the first matching link
      const pinLink = pinLinks[0];
      const pinImage = pinLink.querySelector('img[src*="pinimg"]');
      
      if (pinImage && pinImage.getBoundingClientRect().width > 100 && pinImage.getBoundingClientRect().height > 100) {
        targetPin = pinImage;
        console.log('[Alt Texter] Found previously clicked Pin in feed via link!', {
          pinId: pinterestNavigationState.clickedPinId,
          foundUrl: targetPin.src
        });
      }
    }
    
    if (!targetPin) {
      console.log('[Alt Texter] Previously clicked Pin not found in current feed', {
        pinId: pinterestNavigationState.clickedPinId,
        pinLinksFound: pinLinks.length
      });
    }
  }
  
  // If no previously clicked Pin found, use the first Pin
  if (!targetPin) {
    const pinterestImages = findPinterestFeedImages();
    targetPin = pinterestImages[0];
    console.log('[Alt Texter] Using first Pin in feed');
  }
  
  if (targetPin) {
    // Check if already fixed
    if (targetPin.getAttribute('tabindex') === '0') {
      console.log('[Alt Texter] Feed image already focusable');
      return;
    }
    
    const altText = pinterestNavigationState.clickedPinId ? 
      'Previously clicked Pin in feed' : 
      'First Pin in feed';
    
    makeImageAccessible(targetPin, altText);
    console.log('[Alt Texter] ✅ Pinterest feed image is now keyboard accessible and focused');
  }
}

// Shared function to make any image accessible
function makeImageAccessible(imageElement, defaultAltText) {
  console.log('[Alt Texter] Making image accessible:', {
    src: imageElement.src,
    dimensions: `${Math.round(imageElement.getBoundingClientRect().width)}x${Math.round(imageElement.getBoundingClientRect().height)}`
  });
  
  // Make it focusable
  imageElement.setAttribute('tabindex', '0');
  imageElement.setAttribute('role', 'img');
  
  // Add descriptive alt text if empty
  if (!imageElement.alt || imageElement.alt.trim() === '') {
    const pageTitle = document.title || 'Pinterest';
    imageElement.alt = `${defaultAltText} - ${pageTitle}`;
  }
  
  // Focus the image automatically
  try {
    imageElement.focus();
  } catch (error) {
    console.log('[Alt Texter] Focus failed:', error.message);
  }
}

// Run auto-fix when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoFixPinterestAccessibility);
} else {
  autoFixPinterestAccessibility();
}

// Monitor for programmatic focus changes (e.g., from Skip to Content)
if (window.location.hostname.includes('pinterest.com')) {
  let lastFocusedElement = null;
  let focusChangeCount = 0;
  
  document.addEventListener('focusin', function(e) {
    const focused = e.target;
    focusChangeCount++;
    
    console.log('[Alt Texter] Focus change detected:', {
      count: focusChangeCount,
      element: focused.tagName,
      id: focused.id,
      className: focused.className?.substring(0, 50),
      role: focused.getAttribute('role'),
      isProgrammatic: !lastFocusedElement || lastFocusedElement !== focused
    });
    
    // Detect if focus moved to a non-interactive element (likely Skip to Content)
    // Skip to Content typically focuses a container or main content area
    const isRoleMain = focused.getAttribute('role') === 'main';
    const isNonInteractiveFocus = focused.tagName &&
                                   !['IMG', 'A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(focused.tagName) &&
                                   !focused.hasAttribute('tabindex') &&
                                   !focused.getAttribute('role')?.match(/button|link|img|textbox/);
    
    // On feed pages, if focus lands on something non-interactive (especially role="main"), redirect to first Pin
    if (!window.location.pathname.includes('/pin/')) {
      // Check conditions
      const shouldRedirect = (isNonInteractiveFocus || isRoleMain);
      console.log('[Alt Texter] Evaluating redirect:', {
        isRoleMain,
        isNonInteractiveFocus,
        focusChangeCount,
        shouldRedirect,
        path: window.location.pathname,
        element: focused.tagName
      });
      
      if (shouldRedirect && focusChangeCount >= 2) {
        console.log('[Alt Texter] Detected non-interactive focus (isRoleMain:', isRoleMain, ', isNonInteractive:', isNonInteractiveFocus, ')');
        // Wait a moment to see if focus settles
        setTimeout(() => {
          const stillFocused = document.activeElement;
          const stillNonInteractive = stillFocused.tagName &&
                                       !['IMG', 'A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(stillFocused.tagName) &&
                                       !stillFocused.hasAttribute('tabindex');
          const stillRoleMain = stillFocused.getAttribute('role') === 'main';
          
          console.log('[Alt Texter] After delay, checking if still non-interactive:', {
            stillNonInteractive,
            stillRoleMain,
            tagName: stillFocused.tagName,
            role: stillFocused.getAttribute('role')
          });
          
          if (stillNonInteractive || stillRoleMain) {
            console.log('[Alt Texter] Redirecting focus from non-interactive element to first Pin');
            console.log('[Alt Texter] Still focused element:', {
              tagName: stillFocused.tagName,
              role: stillFocused.getAttribute('role'),
              className: stillFocused.className?.substring(0, 50)
            });
            
            const pinterestImages = findPinterestFeedImages();
            console.log('[Alt Texter] Found Pinterest images:', pinterestImages.length);
            
            if (pinterestImages.length > 0) {
              const firstPin = pinterestImages[0];
              console.log('[Alt Texter] First Pin details:', {
                src: firstPin.src?.substring(0, 50),
                tabindex: firstPin.getAttribute('tabindex'),
                dimensions: `${Math.round(firstPin.getBoundingClientRect().width)}x${Math.round(firstPin.getBoundingClientRect().height)}`
              });
              
              if (firstPin.getAttribute('tabindex') !== '0') {
                firstPin.setAttribute('tabindex', '0');
                firstPin.setAttribute('role', 'img');
                if (!firstPin.alt || firstPin.alt.trim() === '') {
                  firstPin.alt = 'First Pin in feed';
                }
                console.log('[Alt Texter] Made first Pin focusable');
              }
              
              try {
                firstPin.focus();
                console.log('[Alt Texter] ✅ Focused first Pin after redirect');
                console.log('[Alt Texter] Active element after focus:', document.activeElement.tagName);
              } catch (error) {
                console.error('[Alt Texter] Error focusing first Pin:', error);
              }
            } else {
              console.log('[Alt Texter] ❌ No Pinterest images found to focus');
            }
          }
        }, 200);
      }
    }
    
    lastFocusedElement = focused;
  }, true);
  
  // Reset focus change count when navigating
  setInterval(() => {
    if (document.activeElement !== lastFocusedElement) {
      focusChangeCount = 0;
    }
  }, 1000);
  
  // Also periodically check if focus is stuck on non-interactive element
  let lastCheckedActive = null;
  setInterval(() => {
    const active = document.activeElement;
    
    // Check if we need to redirect focus (every 500ms)
    if (active && active !== lastCheckedActive && !window.location.pathname.includes('/pin/')) {
      const isRoleMain = active.getAttribute('role') === 'main';
      const isNonInteractive = active.tagName &&
                                !['IMG', 'A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) &&
                                !active.hasAttribute('tabindex');
      
      if ((isNonInteractive || isRoleMain) && active !== document.body) {
        console.log('[Alt Texter] Periodic check: Focus stuck on non-interactive element, redirecting...', {
          tagName: active.tagName,
          role: active.getAttribute('role'),
          className: active.className?.substring(0, 50)
        });
        
        setTimeout(() => {
          const pinterestImages = findPinterestFeedImages();
          if (pinterestImages.length > 0) {
            const firstPin = pinterestImages[0];
            if (firstPin.getAttribute('tabindex') !== '0') {
              firstPin.setAttribute('tabindex', '0');
              firstPin.setAttribute('role', 'img');
              if (!firstPin.alt || firstPin.alt.trim() === '') {
                firstPin.alt = 'First Pin in feed';
              }
            }
            firstPin.focus();
            console.log('[Alt Texter] ✅ Redirected focus to first Pin via periodic check');
          }
        }, 100);
      }
      
      lastCheckedActive = active;
    }
  }, 500);
}

// Watch for Pinterest navigation changes (SPA routing)
if (window.location.hostname.includes('pinterest.com')) {
  let currentPath = window.location.pathname;
  
  // Detect and log Skip to Content banner structure
  function detectSkipToContentBanner() {
    const selectors = [
      'a[href*="#mainContent"]',
      'a[href*="#main"]',
      'button[aria-label*="skip"]',
      'a[aria-label*="skip"]',
      '[data-test-id*="skip"]',
      '[class*="skip"]'
    ];
    
    const foundElements = [];
    
    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach((el, index) => {
            foundElements.push({
              selector: selector,
              index: index,
              tagName: el.tagName,
              href: el.href || null,
              textContent: el.textContent?.trim() || '',
              ariaLabel: el.getAttribute('aria-label') || null,
              dataTestId: el.getAttribute('data-test-id') || null,
              className: el.className || null,
              id: el.id || null,
              parent: el.parentElement?.tagName || null,
              parentClass: el.parentElement?.className || null,
              rect: {
                top: Math.round(el.getBoundingClientRect().top),
                left: Math.round(el.getBoundingClientRect().left),
                width: Math.round(el.getBoundingClientRect().width),
                height: Math.round(el.getBoundingClientRect().height)
              }
            });
          });
        }
      } catch (e) {
        // Invalid selector, skip it
      }
    });
    
    // Also search by text content
    const allLinks = Array.from(document.querySelectorAll('a, button'));
    const textMatches = allLinks.filter(el => {
      const text = el.textContent?.toLowerCase() || '';
      return text.includes('skip') || (text.includes('content') && text.length < 50);
    });
    
    textMatches.forEach(el => {
      const alreadyFound = foundElements.some(fe => fe.textContent === el.textContent?.trim());
      if (!alreadyFound) {
        foundElements.push({
          selector: 'text-content-match',
          tagName: el.tagName,
          href: el.href || null,
          textContent: el.textContent?.trim(),
          ariaLabel: el.getAttribute('aria-label') || null,
          className: el.className || null,
          id: el.id || null
        });
      }
    });
    
    if (foundElements.length > 0) {
      console.log('[Alt Texter] Skip to Content banner detected:', {
        count: foundElements.length,
        elements: foundElements,
        currentUrl: window.location.href,
        timestamp: new Date().toISOString()
      });
    }
    
    return foundElements;
  }
  
  // Intercept Skip to Content and focus on first Pin
  function interceptSkipToContent(skipContainer) {
    if (!skipContainer) {
      return;
    }
    
    // Don't re-attach if already done, but log if we try
    if (skipContainer.dataset.altTexterIntercepted) {
      console.log('[Alt Texter] Skip container already intercepted, skipping');
      return;
    }
    
    skipContainer.dataset.altTexterIntercepted = 'true';
    
    // Log container info immediately
    console.log('[Alt Texter] Skip container info:', {
      tagName: skipContainer.tagName,
      className: skipContainer.className,
      children: skipContainer.children.length,
      innerHTML: skipContainer.innerHTML.substring(0, 200)
    });
    
    // Add click listener to the container (using capture phase to intercept early)
    const clickHandler = function(e) {
      console.log('[Alt Texter] Skip to Content activated, intercepting...');
      console.log('[Alt Texter] Event target:', e.target);
      console.log('[Alt Texter] Event type:', e.type);
      console.log('[Alt Texter] Current path:', window.location.pathname);
      
      // Let Pinterest's default behavior happen first
      setTimeout(() => {
        if (!window.location.pathname.includes('/pin/')) {
          // On feed pages, focus the first Pin
          console.log('[Alt Texter] On feed page, looking for first Pin...');
          const pinterestImages = findPinterestFeedImages();
          console.log('[Alt Texter] Found Pinterest images:', pinterestImages.length);
          
          if (pinterestImages.length > 0) {
            const firstPin = pinterestImages[0];
            console.log('[Alt Texter] First Pin element:', {
              src: firstPin.src,
              currentTabIndex: firstPin.getAttribute('tabindex'),
              dimensions: `${Math.round(firstPin.getBoundingClientRect().width)}x${Math.round(firstPin.getBoundingClientRect().height)}`
            });
            
            // Make it focusable if it isn't already
            if (firstPin.getAttribute('tabindex') !== '0') {
              firstPin.setAttribute('tabindex', '0');
              firstPin.setAttribute('role', 'img');
              if (!firstPin.alt || firstPin.alt.trim() === '') {
                firstPin.alt = 'First Pin in feed';
              }
              console.log('[Alt Texter] Made first Pin focusable');
            }
            
            // Focus the first Pin
            try {
              firstPin.focus();
              console.log('[Alt Texter] Focused on first Pin after Skip to Content');
              console.log('[Alt Texter] Active element after focus:', document.activeElement);
            } catch (error) {
              console.error('[Alt Texter] Error focusing first Pin:', error);
            }
          } else {
            console.log('[Alt Texter] No Pinterest images found to focus');
          }
        } else {
          // On closeup pages, focus the main Pin image
          const allImages = Array.from(document.querySelectorAll('img'));
          const visibleImages = allImages.filter(img => {
            const rect = img.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
          
          visibleImages.sort((a, b) => {
            const aSize = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
            const bSize = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
            return bSize - aSize;
          });
          
          const mainImage = visibleImages[0];
          if (mainImage && mainImage.getBoundingClientRect().width > 200) {
            if (mainImage.getAttribute('tabindex') !== '0') {
              mainImage.setAttribute('tabindex', '0');
              mainImage.setAttribute('role', 'img');
            }
            mainImage.focus();
            console.log('[Alt Texter] Focused on main Pin image after Skip to Content');
          }
        }
      }, 100);
    };
    
    // Attach click and keyboard listeners to container
    skipContainer.addEventListener('click', clickHandler, true);
    skipContainer.addEventListener('click', function(e) {
      console.log('[Alt Texter] Click detected on skip container or child');
      clickHandler(e);
    }, false);
    
    // Add keyboard event listeners for Enter and Space
    const keyboardHandler = function(e) {
      if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13 || e.keyCode === 32) {
        console.log('[Alt Texter] Keyboard activation detected on skip container:', e.key);
        clickHandler(e);
      }
    };
    
    skipContainer.addEventListener('keydown', keyboardHandler, true);
    skipContainer.addEventListener('keypress', keyboardHandler, true);
    skipContainer.addEventListener('keyup', keyboardHandler, true);
    
    // Log child element structure
    if (skipContainer.children.length > 0) {
      const child = skipContainer.children[0];
      console.log('[Alt Texter] Skip container child element:', {
        tagName: child.tagName,
        className: child.className,
        textContent: child.textContent?.trim(),
        hasOnClick: !!child.onclick,
        hasClickHandlers: child.getAttribute('onclick') || null
      });
    }
    
    // Also check if there's a link or button inside
    const innerLink = skipContainer.querySelector('a, button');
    if (innerLink) {
      console.log('[Alt Texter] Found inner link/button in skip container, attaching listener');
      innerLink.addEventListener('click', function(e) {
        console.log('[Alt Texter] Inner link/button clicked');
        clickHandler(e);
      }, true);
    } else {
      // No link/button found, attach to child element directly
      if (skipContainer.children.length > 0) {
        const child = skipContainer.children[0];
        console.log('[Alt Texter] Attaching listeners to child element:', child.tagName);
        child.addEventListener('click', function(e) {
          console.log('[Alt Texter] Child element clicked');
          clickHandler(e);
        }, true);
        
        // Also add keyboard listeners to child
        const childKeyboardHandler = function(e) {
          if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13 || e.keyCode === 32) {
            console.log('[Alt Texter] Keyboard activation detected on child:', e.key);
            clickHandler(e);
          }
        };
        
        child.addEventListener('keydown', childKeyboardHandler, true);
        child.addEventListener('keypress', childKeyboardHandler, true);
        child.addEventListener('keyup', childKeyboardHandler, true);
      }
    }
    
    // Also intercept focus events (Skip to Content might trigger focus)
    skipContainer.addEventListener('focus', function(e) {
      console.log('[Alt Texter] Skip container received focus');
    }, true);
    
    console.log('[Alt Texter] Skip to Content interceptor attached');
    console.log('[Alt Texter] Skip container element:', skipContainer);
    console.log('[Alt Texter] Skip container children:', skipContainer.children.length);
  }
  
  // Check for Skip to Content banner and attach interceptor
  let skipBannerCheckCount = 0;
  const skipBannerCheckInterval = setInterval(() => {
    skipBannerCheckCount++;
    const foundElements = detectSkipToContentBanner();
    
    // If we found the skip container, attach interceptor
    if (foundElements.length > 0) {
      const skipContainer = document.querySelector('[data-test-id="skipToContentContainer"]');
      if (skipContainer) {
        interceptSkipToContent(skipContainer);
        clearInterval(skipBannerCheckInterval);
      }
    }
    
    // Stop checking after 10 seconds
    if (skipBannerCheckCount > 20) {
      clearInterval(skipBannerCheckInterval);
    }
  }, 500);
  
  // Also check immediately and periodically
  setTimeout(() => {
    const skipContainer = document.querySelector('[data-test-id="skipToContentContainer"]');
    if (skipContainer) {
      console.log('[Alt Texter] Found skip container immediately, attaching interceptor');
      interceptSkipToContent(skipContainer);
    } else {
      console.log('[Alt Texter] Skip container not found immediately, will keep checking');
    }
  }, 500);
  
  // Use MutationObserver to catch skip container whenever it appears
  if (document.body) {
    const skipObserver = new MutationObserver(() => {
      const skipContainer = document.querySelector('[data-test-id="skipToContentContainer"]');
      if (skipContainer && !skipContainer.dataset.altTexterIntercepted) {
        console.log('[Alt Texter] Found skip container via MutationObserver, attaching interceptor');
        interceptSkipToContent(skipContainer);
      }
    });
    
    skipObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Also keep checking periodically
  setInterval(() => {
    const skipContainer = document.querySelector('[data-test-id="skipToContentContainer"]');
    if (skipContainer && !skipContainer.dataset.altTexterIntercepted) {
      console.log('[Alt Texter] Found skip container later, attaching interceptor');
      interceptSkipToContent(skipContainer);
    }
  }, 500);
  
  // Check for navigation changes every 500ms
  setInterval(() => {
    if (window.location.pathname !== currentPath) {
      console.log('[Alt Texter] Pinterest navigation detected:', {
        from: currentPath,
        to: window.location.pathname
      });
      
      // If navigating to a closeup page, store the Pin ID for later use
      if (window.location.pathname.includes('/pin/') && !currentPath.includes('/pin/')) {
        const pinId = extractPinIdFromUrl(window.location.href);
        console.log('[Alt Texter] Navigating to closeup page, storing Pin ID:', pinId);
        pinterestNavigationState.clickedPinId = pinId;
        pinterestNavigationState.lastFeedUrl = currentPath;
      }
      
      currentPath = window.location.pathname;
      
      // Re-run the accessibility fix for the new page
      setTimeout(() => {
        console.log('[Alt Texter] Re-running accessibility fix for new page...');
        autoFixPinterestAccessibility();
      }, 1000);
    }
  }, 500);
}

// Watch for dynamic content changes on Pinterest feed pages
if (window.location.hostname.includes('pinterest.com') && !window.location.pathname.includes('/pin/')) {
  // Wait for document.body to be available before setting up MutationObserver
  function setupMutationObserver() {
    if (document.body) {
      // Set up MutationObserver to watch for new images being added
      const observer = new MutationObserver((mutations) => {
        let hasNewImages = false;
        
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Check if the added node or its children contain Pinterest images
                if (node.querySelector && node.querySelector('img[src*="pinimg"]')) {
                  hasNewImages = true;
                }
                if (node.tagName === 'IMG' && node.src && node.src.includes('pinimg')) {
                  hasNewImages = true;
                }
              }
            });
          }
        });
        
        if (hasNewImages) {
          console.log('[Alt Texter] New Pinterest images detected, checking for fix...');
          // Check if we need to fix the first image
          const pinterestImages = findPinterestFeedImages();
          if (pinterestImages.length > 0) {
            const firstPin = pinterestImages[0];
            if (firstPin.getAttribute('tabindex') !== '0') {
              console.log('[Alt Texter] Fixing newly loaded Pinterest image');
              makeImageAccessible(firstPin, 'First Pin in feed');
            }
          }
        }
      });
      
      // Start observing
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      console.log('[Alt Texter] Set up MutationObserver for dynamic Pinterest content');
    } else {
      // Retry if document.body isn't ready yet
      setTimeout(setupMutationObserver, 100);
    }
  }
  
  setupMutationObserver();
}

// Listen for messages from the background script asking for the current image
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get-hovered-image') {
    // Smart fallback: prioritize focused element (screen reader), then mouse hover
    let targetElement = null;
    let targetUrl = null;
    let detectionMethod = '';
    
    console.log('[Alt Texter] Image detection debug info:', {
      focusedElement: focusedElement?.tagName,
      activeElement: document.activeElement?.tagName,
      lastImageUrl: lastImageUrl,
      isPinterest: window.location.hostname.includes('pinterest.com'),
      isCloseup: window.location.pathname.includes('/pin/')
    });
    
    // First, check if there's a focused element (VoiceOver/screen reader navigation)
    if (focusedElement) {
      console.log('[Alt Texter] Checking focused element:', focusedElement.tagName);
      const imageInfo = findImageInElement(focusedElement);
      if (imageInfo) {
        targetElement = imageInfo.element;
        targetUrl = imageInfo.url;
        detectionMethod = 'focused element (screen reader)';
        console.log('[Alt Texter] Using focused element (screen reader detected)');
      } else {
        // No image found, check for video in focused element
        const videoElement = findVideoInElement(focusedElement);
        if (videoElement && isLargeEnoughVideo(videoElement)) {
          console.log('[Alt Texter] Video detected in focused element:', videoElement);
          // Try to get poster frame URL
          const posterUrl = videoElement.poster || 
                           videoElement.getAttribute('poster') || 
                           videoElement.getAttribute('data-poster') ||
                           null;
          sendResponse({
            video: true,
            detectionMethod: 'focused video (screen reader)',
            hasTargetElement: true,
            targetElement: videoElement,
            posterUrl: posterUrl
          });
          return true; // Keep channel open
        }
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
      } else {
        // No image found, check for video in active element
        const videoElement = findVideoInElement(document.activeElement);
        if (videoElement && isLargeEnoughVideo(videoElement)) {
          console.log('[Alt Texter] Video detected in active element:', videoElement);
          // Try to get poster frame URL
          const posterUrl = videoElement.poster || 
                           videoElement.getAttribute('poster') || 
                           videoElement.getAttribute('data-poster') ||
                           null;
          sendResponse({
            video: true,
            detectionMethod: 'active element (video)',
            hasTargetElement: true,
            targetElement: videoElement,
            posterUrl: posterUrl
          });
          return true;
        }
      }
    }
    
    // Fall back to mouse-hovered element
    if (!targetUrl && lastImageUrl) {
      targetElement = lastHoveredImage;
      targetUrl = lastImageUrl;
      detectionMethod = 'mouse hover';
      console.log('[Alt Texter] Falling back to mouse-hovered element');
    }
    
    // Pinterest-specific fallback: if we're on Pinterest and no image detected, try to find the main image
    if (!targetUrl && window.location.hostname.includes('pinterest.com')) {
      console.log('[Alt Texter] Pinterest fallback: searching for main image...');
      
      if (window.location.pathname.includes('/pin/')) {
        // Closeup page: find largest image
        const allImages = Array.from(document.querySelectorAll('img'));
        const visibleImages = allImages.filter(img => {
          const rect = img.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        
        visibleImages.sort((a, b) => {
          const aSize = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
          const bSize = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
          return bSize - aSize;
        });
        
        if (visibleImages[0] && visibleImages[0].getBoundingClientRect().width > 200) {
          targetElement = visibleImages[0];
          targetUrl = getImageUrl(visibleImages[0]);
          detectionMethod = 'Pinterest closeup fallback';
          console.log('[Alt Texter] Using Pinterest closeup fallback');
        }
      } else {
        // Feed page: find first Pinterest image
        const pinterestImages = findPinterestFeedImages();
        if (pinterestImages.length > 0) {
          targetElement = pinterestImages[0];
          targetUrl = getImageUrl(pinterestImages[0]);
          detectionMethod = 'Pinterest feed fallback';
          console.log('[Alt Texter] Using Pinterest feed fallback');
        }
      }
    }
    
    // If no image was found, check for videos as fallback
    if (!targetUrl) {
      // Check focused element for video
      if (focusedElement) {
        const videoElement = findVideoInElement(focusedElement);
        if (videoElement && isLargeEnoughVideo(videoElement)) {
          console.log('[Alt Texter] Video detected in focused element:', videoElement);
          sendResponse({
            video: true,
            detectionMethod: 'focused video (screen reader)',
            hasTargetElement: true,
            targetElement: videoElement
          });
          return true; // Keep channel open
        }
      }
      
      // Check activeElement for video
      if (document.activeElement && document.activeElement !== focusedElement) {
        const videoElement = findVideoInElement(document.activeElement);
        if (videoElement && isLargeEnoughVideo(videoElement)) {
          console.log('[Alt Texter] Video detected in active element:', videoElement);
          sendResponse({
            video: true,
            detectionMethod: 'active element (video)',
            hasTargetElement: true,
            targetElement: videoElement
          });
          return true;
        }
      }
      
      // Final fallback: search for videos in viewport
      const allVideos = Array.from(document.querySelectorAll('video'));
      const visibleVideos = allVideos.filter(vid => {
        const rect = vid.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && isLargeEnoughVideo(vid);
      });
      
      if (visibleVideos.length > 0) {
        console.log('[Alt Texter] Video detected via fallback search:', visibleVideos[0]);
        const videoElement = visibleVideos[0];
        // Try to get poster frame URL
        const posterUrl = videoElement.poster || 
                         videoElement.getAttribute('poster') || 
                         videoElement.getAttribute('data-poster') ||
                         null;
        // Use the first visible, large-enough video
        sendResponse({
          video: true,
          detectionMethod: 'fallback video search',
          hasTargetElement: true,
          targetElement: videoElement,
          posterUrl: posterUrl
        });
        return true;
      }
    }
    
    console.log('[Alt Texter] Detection method:', detectionMethod);
    console.log('[Alt Texter] Sending image URL to background:', targetUrl);
    
    // Additional debugging for Pinterest
    if (window.location.hostname.includes('pinterest.com')) {
      console.log('[Alt Texter] Pinterest detection summary:', {
        targetUrl: targetUrl,
        detectionMethod: detectionMethod,
        hasTargetElement: !!targetElement,
        targetElementTag: targetElement?.tagName,
        targetElementSrc: targetElement?.src
      });
    }
    
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
      liveRegion.textContent = request.text;
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

