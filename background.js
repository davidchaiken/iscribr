chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'generateAltText',
    title: 'Generate alt text',
    contexts: ['image']
  });
});
async function generateAltText(imgSrc) {
  // Create the model (we're not checking availability here, but will simply fail with an exception
  const session = await self.LanguageModel.create({
    temperature: 0.0,
    topK: 1.0,
    expectedInputs: [{ type: 'image' }]
  });

  // Create an image bitmap to pass it to the prompt
  const response = await fetch(imgSrc);
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);

  // Run the prompt
  const prompt = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          value: `Please provide a functional, objective description of the provided image in no more than around 30 words so that someone who could not see it would be able to imagine it. If possible, follow an "object-action-context" framework. The object is the main focus. The action describes what's happening, usually what the object is doing. The context describes the surrounding environment. If there is text found in the image, do your best to transcribe the important bits, even if it extends the word count beyond 30 words. It should not contain quotation marks, as those tend to cause issues when rendered on the web. If there is no text found in the image, then there is no need to mention it. You should not begin the description with any variation of "The image".`
        },
        { type: 'image', value: imageBitmap }
      ]
    }
  ];
  return await session.prompt(prompt);
}

chrome.contextMenus.onClicked.addListener(async (info, _tab) => {
  if (info.menuItemId === 'generateAltText' && info.srcUrl) {
    console.log('[Alt Texter] Context menu clicked for image:', info.srcUrl);
    console.log('[Alt Texter] Generating alt text...');
    
    // Start opening the popup
    const [result] = await Promise.allSettled([
      generateAltText(info.srcUrl),
      chrome.action.openPopup()
    ]);
    
    if (result.status === 'fulfilled') {
      console.log('[Alt Texter] Alt text generated successfully:', result.value);
    } else {
      console.error('[Alt Texter] Error generating alt text:', result.reason.message);
    }
    
    chrome.runtime.sendMessage({
      action: 'alt-text',
      text: result.status === 'fulfilled' ? result.value : result.reason.message
    }).catch((err) => {
      // Popup closed before message could be sent - this is expected and harmless
      // Suppress the specific error to avoid cluttering the extension console
      if (!err.message?.includes('Receiving end does not exist') && 
          !err.message?.includes('Could not establish connection')) {
        // Only log unexpected errors
        console.warn('[Alt Texter] Unexpected error sending message:', err);
      }
    });
  }
});

// Handle keyboard shortcut
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'generate-alt-text') {
    console.log('[Alt Texter] Keyboard shortcut (Alt+I) pressed');
    
    // Ask the content script for the current image (focused or hovered)
    const response = await chrome.tabs.sendMessage(tab.id, { 
      action: 'get-hovered-image' 
    }).catch(() => null);
    
    // Check if a video was detected instead of an image
    if (response?.video === true) {
      console.log('[Alt Texter] Video detected:', response.detectionMethod);
      
      // If video has a poster frame, describe that instead
      if (response.posterUrl) {
        console.log('[Alt Texter] Video has poster frame, describing poster:', response.posterUrl);
        
        const isScreenReaderMode = response.detectionMethod?.includes('screen reader') || 
                                   response.detectionMethod?.includes('focused') ||
                                   response.detectionMethod?.includes('active');
        
        // Open popup first and indicate it's a video poster
        try {
          await chrome.action.openPopup();
          // Send a message immediately to set the video poster flag before generation
          chrome.runtime.sendMessage({
            action: 'set-video-poster-flag',
            isVideoPoster: true
          }).catch(() => {
            // Popup might not be ready yet, that's ok
          });
        } catch (e) {
          // Popup couldn't open
        }
        
        // Generate alt text for the poster image
        const [result] = await Promise.allSettled([
          generateAltText(response.posterUrl)
        ]);
        
        if (result.status !== 'fulfilled') {
          console.error('[Alt Texter] Error generating poster description:', result.reason.message);
        }
        
        chrome.runtime.sendMessage({
          action: 'alt-text',
          text: result.status === 'fulfilled' ? result.value : result.reason.message,
          isVideoPoster: true // Indicate this is a video poster description
        }).catch((err) => {
          // Handle popup closed error
          if (!err.message?.includes('Receiving end does not exist') && 
              !err.message?.includes('Could not establish connection')) {
            console.warn('[Alt Texter] Unexpected error:', err);
          }
        });
      } else {
        // No poster frame, show message that videos aren't supported yet
        try {
          await chrome.action.openPopup();
          chrome.runtime.sendMessage({
            action: 'alt-text',
            text: 'Video selected. Video descriptions are not yet available.'
          }).catch((err) => {
            // Handle popup closed error
            if (!err.message?.includes('Receiving end does not exist') && 
                !err.message?.includes('Could not establish connection')) {
              console.warn('[Alt Texter] Unexpected error:', err);
            }
          });
        } catch (e) {
          // Popup couldn't open
        }
      }
      return; // Don't proceed with image generation
    }
    
    if (response?.imageUrl) {
      console.log('[Alt Texter] Image URL received:', response.imageUrl);
      console.log('[Alt Texter] Detection method:', response.detectionMethod);
      console.log('[Alt Texter] Generating alt text...');
      
      // Generate alt text for the image
      const [result] = await Promise.allSettled([
        generateAltText(response.imageUrl),
        chrome.action.openPopup()
      ]);
      
      if (result.status !== 'fulfilled') {
        console.error('[Alt Texter] Error generating alt text:', result.reason.message);
      }
      
      chrome.runtime.sendMessage({
        action: 'alt-text',
        text: result.status === 'fulfilled' ? result.value : result.reason.message
      });
    } else {
      console.warn('[Alt Texter] No image detected');
      // No image detected, show error in popup
      try {
        await chrome.action.openPopup();
        chrome.runtime.sendMessage({
          action: 'alt-text',
          text: 'No image detected. Navigate to an image or hover over one and press the shortcut again.'
        }).catch((err) => {
          // Popup closed before message could be sent - this is expected and harmless
          // Suppress the specific error to avoid cluttering the extension console
          if (!err.message?.includes('Receiving end does not exist') && 
              !err.message?.includes('Could not establish connection')) {
            // Only log unexpected errors
            console.warn('[Alt Texter] Unexpected error sending message:', err);
          }
        });
      } catch (e) {
        // Popup couldn't open, that's ok
      }
    }
  }
});
