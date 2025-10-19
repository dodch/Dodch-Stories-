/***************************************************************************************************
 *                                   ** DO NOT COPY - ALL RIGHTS RESERVED **
 *
 * This code is the exclusive property of Dodch Stories and its owner. Unauthorized copying,
 * reproduction, modification, distribution, or any form of use of this code, in whole or in part,
 * is strictly prohibited.
 *
 * The intellectual property rights, including copyright, for this software are protected by
 * international laws and treaties. Any infringement of these rights will be pursued to the
 * fullest extent of the law, which may include civil and criminal charges.
 *
 * Copyright (c) 2024 Dodch Stories. All rights reserved.
 ***************************************************************************************************/
const loadingScreen = document.getElementById("loading-screen");
const loadPercentageText = document.querySelector(".loading-percentage");
const body = document.body;
// FIX: Create a unique key for each story to namespace saved progress.
// This prevents progress from one story from conflicting with another.
const storyKey = document.title.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/\s+/g, '-');
let currentLanguage = 'en';
let anonymousUserId = null; // NEW: To store the user's unique ID
let allSavedProgress = {};
let tempSavedWordId = '';
let tempSavedWordText = '';
let highlightedWordElement = null;
let isDarkMode = false;
let storyObserver; // For paragraph animations
let performanceLevel = 3; // Default to highest

// --- NEW: Unified Performance System (mirrors main script) ---
async function benchmarkPerformance() {
    // REFACTOR: Run the benchmark multiple times and average the result for more stability.
    // This prevents one-off stutters from unfairly lowering the performance level.
    const runs = 3;
    let totalFps = 0;

    for (let i = 0; i < runs; i++) {
        const fps = await new Promise(resolve => {
            const testElement = document.createElement('div');
            testElement.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
            document.body.appendChild(testElement);

            let frameCount = 0;
            const duration = 500; // Shorter duration, but run multiple times.

            function animate(time) {
                const progress = (time % duration) / duration;
                testElement.style.transform = `translate(${progress * 10}px, ${progress * 10}px)`;
                frameCount++;
            }

            const startTime = performance.now();
            function runTest(now) {
                if (now - startTime < duration) {
                    animate(now);
                    requestAnimationFrame(runTest);
                } else {
                    const averageFps = frameCount / (duration / 1000);
                    document.body.removeChild(testElement);
                    resolve(averageFps);
                }
            }
            requestAnimationFrame(runTest);
        });
        totalFps += fps;
        // Brief pause between runs to let the system settle.
        if (i < runs - 1) {
            await new Promise(res => setTimeout(res, 100));
        }
    }

    const averageFps = totalFps / runs;
    return averageFps;
}

async function determinePerformanceLevel() {
    // --- Step 1: Check for system-level user preferences ---
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        console.log("Performance Level 1 (Low): User prefers reduced motion.");
        return 1;
    }
    if (navigator.connection && navigator.connection.saveData) {
        console.log("Performance Level 1 (Low): Data saver enabled.");
        return 1;
    }

    // --- Step 2: Run the benchmark for an objective performance score ---
    const averageFps = await benchmarkPerformance();
    console.log(`Benchmark Result: ~${Math.round(averageFps)} FPS`);

    // --- REFACTOR: Revert to a simpler 2-tier system (Low/High) for clarity. ---
    let level;
    if (averageFps < 48) { // A single threshold for Low vs. High.
        level = 1; // Low (struggles to maintain a high frame rate)
    } else {
        level = 2; // High (generally smooth)
    }

    console.log(`Auto-determined Performance Level: ${level} (1=Low, 2=High)`);
    return level;
}


// FIX: Add a flag to prevent immediate re-triggering of the popup on mobile.
// This will block the "ghost click" that happens after a touch event.
let blockPopupTrigger = false;

// FIX: Add state variables to differentiate between a tap and a scroll/drag gesture on touch devices.
let isDragging = false;
const pointerDownPos = { x: 0, y: 0 };
const dragThreshold = 10; // The number of pixels the pointer must move to be considered a drag.

// contentMap will be defined in each story's HTML file

const lightBackgroundDiv = document.querySelector('.fixed-background.light-background');
const darkBackgroundDiv = document.querySelector('.fixed-background.dark-background');
const contentDiv = document.getElementById('content');
const textContainer = document.getElementById('text-container');
const titleElement = document.getElementById('title');
const backHomeButton = document.getElementById('back-home-button');
const languageButtons = document.querySelectorAll('#ar-button, #fr-button, #en-button');
const saveButton = document.getElementById('save-progress-button');
const popupDivInner = document.getElementById('popup').querySelector('div');

function clearSavedProgress() {
    // NEW: Remove the bookmark from Firebase
    if (window.firebase && anonymousUserId) {
        const bookmarkRef = window.firebase.ref(window.firebase.db, `bookmarks/${anonymousUserId}/${storyKey}/${currentLanguage}`);
        window.firebase.remove(bookmarkRef);
        // The onValue listener will automatically clear the local state and icon
    } else { // Fallback to localStorage if Firebase isn't ready
        if (allSavedProgress[storyKey]) delete allSavedProgress[storyKey][currentLanguage];
        updateBookmarkIconState(); // Update the icon to show no bookmark is saved.
    }
}

/**
 * REFACTOR: New function to check for a saved bookmark and update the icon's color.
 * This centralizes the logic for making the bookmark icon red when active.
 */
function updateBookmarkIconState() {
    const saveButtonIcon = document.querySelector('#save-progress-button svg');
    if (!saveButtonIcon) return;
    const savedProgressForCurrentLang = allSavedProgress?.[storyKey]?.[currentLanguage];
    if (savedProgressForCurrentLang && savedProgressForCurrentLang.id) {
        saveButtonIcon.classList.add('active');
    } else {
        saveButtonIcon.classList.remove('active');
    }
}

function changeLanguage(lang, fromLoad = false, isThemeChange = false) {
    // REFACTOR: Allow theme changes to bypass the fade animation check.
    if (contentDiv.classList.contains('content-fading') && !fromLoad && !isThemeChange) return;

    if (currentLanguage === lang && !fromLoad) {
         return;
    }
    // First, reset all buttons to unselected state
    languageButtons.forEach(button => {
        button.classList.add('unselected-language');
        button.classList.remove('selected-language');
    });
    // Then, apply selected state to the new button
    const newButton = document.getElementById(`${lang}-button`);
    if(newButton) {
        newButton.classList.remove('unselected-language');
        newButton.classList.add('selected-language');
    }
    currentLanguage = lang;
    if (!fromLoad) {
         localStorage.setItem('preferredLanguage', lang);
    }
    const content = contentMap[lang];

    const updateContent = () => {
        if (lang === 'ar') {
            contentDiv.dir = 'rtl';
            titleElement.style.textAlign = 'right';
            document.getElementById('popup').querySelector('.flex.items-center').dir = 'rtl';
            document.getElementById('popup-text').dir = 'rtl';
            textContainer.style.textAlign = 'right';
        } else {
            contentDiv.dir = 'ltr';
            titleElement.style.textAlign = 'left';
            document.getElementById('popup').querySelector('.flex.items-center').dir = 'ltr';
            document.getElementById('popup-text').dir = 'ltr';
            textContainer.style.textAlign = 'left';
        }
        titleElement.textContent = content.title;
        textContainer.innerHTML = '';
        const rawTextElement = document.getElementById(content.rawTextId);
        const rawText = rawTextElement ? rawTextElement.textContent.trim() : '';
        if (rawText) {
            const lines = rawText.split('\n');
            let isFirstWordOfStory = true;
            lines.forEach((line, lIndex) => {
                const trimmedLine = line.trim();
                const pElement = document.createElement('p');
                pElement.classList.add('mb-4', 'text-lg', 'leading-relaxed');

                if (trimmedLine === '') {
                    pElement.innerHTML = '&nbsp;';
                } else {
                    if (trimmedLine !== '⸻') {
                        if (performanceLevel > 1) {
                            pElement.classList.add('story-anim-item');
                        }
                        if (isFirstWordOfStory) {
                            const firstWordMatch = trimmedLine.match(/\S+/);
                            if (firstWordMatch) {
                                const firstWord = firstWordMatch[0];
                                const firstLetter = firstWord.charAt(0);
                                const restOfWord = firstWord.substring(1);
                                const afterFirstWord = trimmedLine.substring(firstWordMatch.index + firstWord.length);

                                const dropCapSpan = document.createElement('span');
                                dropCapSpan.className = 'drop-cap';
                                dropCapSpan.textContent = firstLetter;
                                if (lang === 'ar') {
                                    dropCapSpan.style.float = 'right';
                                    dropCapSpan.style.marginLeft = '0.5rem';
                                }
                                pElement.appendChild(dropCapSpan);

                                const firstWordSpan = document.createElement('span');
                                firstWordSpan.textContent = restOfWord;
                                const uniqueId = `word-l${lIndex}-p0`;
                                firstWordSpan.id = uniqueId;
                                firstWordSpan.classList.add('cursor-pointer');
                                firstWordSpan.addEventListener('pointerup', (e) => {
                                    e.preventDefault();
                                    if (!isDragging) {
                                        handleWordClick(uniqueId, firstWord.trim());
                                    }
                                });
                                pElement.appendChild(firstWordSpan);
                                
                                const remainingWords = afterFirstWord.trim().split(/\s+/);
                                pElement.appendChild(document.createTextNode(' '));
                                remainingWords.forEach((word, wIndex) => {
                                    if (word) {
                                        const wordSpan = document.createElement('span');
                                        const uniqueId = `word-l${lIndex}-p${wIndex + 1}`;
                                        wordSpan.id = uniqueId;
                                        wordSpan.textContent = word;
                                        wordSpan.classList.add('cursor-pointer');
                                        wordSpan.addEventListener('pointerup', (e) => {
                                            e.preventDefault();
                                            if (!isDragging) {
                                                handleWordClick(uniqueId, wordSpan.textContent.trim());
                                            }
                                        });
                                        pElement.appendChild(wordSpan);
                                        pElement.appendChild(document.createTextNode(' '));
                                    }
                                });
                                isFirstWordOfStory = false;
                            } else {
                                pElement.textContent = trimmedLine;
                            }
                        } else {
                            const words = trimmedLine.split(/\s+/);
                            words.forEach((word, wIndex) => {
                                if (word) {
                                    const wordSpan = document.createElement('span');
                                    const uniqueId = `word-l${lIndex}-p${wIndex}`;
                                    wordSpan.id = uniqueId;
                                    wordSpan.textContent = word;
                                    wordSpan.classList.add('cursor-pointer');
                                    wordSpan.addEventListener('pointerup', (e) => {
                                        e.preventDefault();
                                        if (!isDragging) {
                                            handleWordClick(uniqueId, wordSpan.textContent.trim());
                                        }
                                    });
                                    pElement.appendChild(wordSpan);
                                    pElement.appendChild(document.createTextNode(' '));
                                }
                            });
                        }
                    } else {
                        pElement.textContent = trimmedLine;
                    }
                }
                textContainer.appendChild(pElement);
            });
        } else {
             const noTextElement = document.createElement('p');
             noTextElement.classList.add('text-center', 'text-xl', 'text-gray-500');
             noTextElement.textContent = `No text available for ${lang.toUpperCase()}. Please add content to the raw text div.`;
             textContainer.appendChild(noTextElement);
             console.warn(`No raw text found for language: ${lang}`);
        }
        textContainer.removeEventListener('pointerdown', onPointerDown);
        textContainer.addEventListener('pointerdown', onPointerDown);
        if (!window.hasPointerMoveListener) {
            window.addEventListener('pointermove', onPointerMove, { passive: true });
            window.hasPointerMoveListener = true;
        }
        if (!window.hasScrollEndListener) {
            window.addEventListener('scrollend', () => { isDragging = false; });
            window.hasScrollEndListener = true;
        }
        setupStoryObserver();
        document.querySelector('#popup-title').textContent = content.savePosition;
        document.getElementById('popup').querySelector('.bg-green-500').textContent = content.save;
        document.getElementById('popup').querySelector('.bg-red-500').textContent = content.exit;
        updateBookmarkIconState();
        highlightWord();
        const savedProgressForCurrentLang = allSavedProgress[storyKey] ? allSavedProgress[storyKey][currentLanguage] : null;
        if (fromLoad && savedProgressForCurrentLang && savedProgressForCurrentLang.id) {
              setTimeout(() => {
                  scrollToSavedWord(false, false);
              }, 100);
        }
    };

    // REFACTOR: On initial page load, build the content immediately without a fade animation.
    // For subsequent language changes, use the fade-out/fade-in animation.
    if (fromLoad) {
        updateContent();
        // FIX: On initial load, explicitly remove the 'content-fading' class
        // to ensure the content becomes visible. This was the root cause of the bug.
        contentDiv.classList.remove('content-fading');
    } else {
        contentDiv.classList.add('content-fading');
        setTimeout(() => {
            updateContent();
            // After content is updated, remove the fading class to trigger the fade-in.
            contentDiv.classList.remove('content-fading');
        }, 500); // This timeout must match the CSS transition duration.
    }

    // If this is just a theme change, we don't want to fade, just re-apply styles.
    if (isThemeChange) {
        contentDiv.classList.remove('content-fading');
    }
}

// FIX: Handler for when the user first touches/clicks the text container.
function onPointerDown(e) {
    isDragging = false;
    pointerDownPos.x = e.clientX;
    pointerDownPos.y = e.clientY;
}

// FIX: Handler for when the user moves their finger/pointer.
function onPointerMove(e) {
    if (isDragging) return; // No need to check if we already know it's a drag.
    const dx = Math.abs(e.clientX - pointerDownPos.x);
    const dy = Math.abs(e.clientY - pointerDownPos.y);
    if (dx > dragThreshold || dy > dragThreshold) {
        isDragging = true;
    }
}
function handleWordClick(spanId, wordText) {
    // FIX: If the popup was just closed by a touch event, don't reopen it immediately.
    // This is the core fix for the "double popup" and "auto-save" bug on mobile.
    if (blockPopupTrigger) {
        return;
    }

    tempSavedWordId = spanId;
    tempSavedWordText = wordText;
    // FIX: Use the translated string from contentMap for the popup question.
    const content = contentMap[currentLanguage];
    const popupText = document.getElementById('popup-text');
    popupText.textContent = content.bookmarkQuestion.replace('{word}', wordText);
    popupText.classList.add('text-center'); // FIX: Center the popup question text.
    const popup = document.getElementById('popup');
    popup.style.display = 'flex'; // Show the container immediately

    const popupInner = popup.querySelector('.glass-popup');    
    // FIX: Separate the animations to prevent conflicts.
    // 1. First, apply the 'active' class to trigger the scale-up and fade-in transition.
    popupInner.classList.add('active'); 

    // 2. Then, after a short delay (allowing the first transition to start), apply the jello animation.
    setTimeout(() => {
        popupInner.classList.remove('jello');
        void popupInner.offsetWidth; // force reflow
        popupInner.classList.add('jello');
    }, 50); // 50ms delay is enough for the initial animation to begin.
}

function closePopup() {
    const popup = document.getElementById('popup');
    const popupInner = popup.querySelector('.glass-popup');
    // Remove the active class from the inner element to trigger the fade-out animation
    popupInner.classList.remove('active');
    tempSavedWordId = '';
    tempSavedWordText = '';
    // Hide the container after the animation
    setTimeout(() => {
        // Check if the popup is still meant to be hidden before setting display to none
        // FIX: On touch devices, briefly block re-opening the popup to prevent ghost clicks.
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (isTouchDevice) {
      blockPopupTrigger = true;
      setTimeout(() => { blockPopupTrigger = false; }, 300); // Unblock after a short delay.
        }
        if (!popupInner.classList.contains('active')) {
      popup.style.display = 'none';
        }
  }, 400);
}

function savePosition() {
    if (tempSavedWordId) {
        const bookmarkData = {
            id: tempSavedWordId,
            text: tempSavedWordText
        };
        // NEW: Save the bookmark to Firebase
        if (window.firebase && anonymousUserId) {
            const bookmarkRef = window.firebase.ref(window.firebase.db, `bookmarks/${anonymousUserId}/${storyKey}/${currentLanguage}`);
            window.firebase.set(bookmarkRef, bookmarkData);
            // The onValue listener will handle UI updates automatically when Firebase syncs.
        }
    }
    closePopup();
}


function scrollToSavedWord(performChecks = true, smooth = true) {
    const savedProgressForCurrentLang = allSavedProgress?.[storyKey]?.[currentLanguage];
    if (!savedProgressForCurrentLang || !savedProgressForCurrentLang.id) {
        if (performChecks) { // Only alert if the user clicked the button
            alert(contentMap[currentLanguage].noWordSaved);
        }
        return;
    }
    const savedWordId = savedProgressForCurrentLang.id;
    const savedWordText = savedProgressForCurrentLang.text;
    const targetElement = document.getElementById(savedWordId);
    if (targetElement) {
         highlightWord();
         requestAnimationFrame(() => {
            targetElement.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
         });
    } else {
        console.warn(`${contentMap[currentLanguage].wordNotFound} (ID: ${savedWordId}, Text: "${savedWordText}")`);
        if (performChecks) {
            alert(`${contentMap[currentLanguage].wordNotFound} ("${savedWordText}")`);
            const confirmClear = confirm(`Clear saved progress for ${currentLanguage.toUpperCase()}?`);
            if (confirmClear) {
                clearSavedProgress();
            }
        } else {
             console.warn(`Clearing saved progress for ${currentLanguage.toUpperCase()} due to missing element.`);
             clearSavedProgress();
        }
    }
}

function highlightWord() {
   if (highlightedWordElement) {
       highlightedWordElement.classList.remove('bg-yellow-200', 'bg-yellow-600', 'rounded', 'glow-word', 'bookmarked-word');
       // FIX: Reset inline styles on the previously highlighted word so it reverts to the default text color and shadow.
       highlightedWordElement.style.textShadow = '';
       highlightedWordElement.style.webkitTextStroke = '';
       highlightedWordElement.style.textStroke = '';
       highlightedWordElement.style.webkitTextFillColor = '';
       highlightedWordElement.style.color = '';
       highlightedWordElement = null;
   }
   const savedProgressForCurrentLang = allSavedProgress?.[storyKey]?.[currentLanguage];
   if (!savedProgressForCurrentLang || !savedProgressForCurrentLang.id) {
       return;
   }
   const savedWordId = savedProgressForCurrentLang.id;
   const targetElement = document.getElementById(savedWordId);
   if (targetElement) {
       highlightedWordElement = targetElement;
       highlightedWordElement.classList.add('rounded', 'glow-word', 'bookmarked-word');
       if (document.body.classList.contains('dark-mode')) {
           highlightedWordElement.classList.remove('bg-yellow-200');
           highlightedWordElement.classList.add('bg-yellow-600');
       } else {
           highlightedWordElement.classList.remove('bg-yellow-600');
           highlightedWordElement.classList.add('bg-yellow-200');
       }
       highlightedWordElement.style.textShadow = 'none';
       highlightedWordElement.style.webkitTextStroke = 'none';
       highlightedWordElement.style.textStroke = 'none';
       highlightedWordElement.style.webkitTextFillColor = 'initial';
       highlightedWordElement.style.color = 'initial';
   } else {
       console.warn(`Element for saved word ID "${savedWordId}" not found for highlighting in language "${currentLanguage}".`);
   }
}

function handleDarkModeChange(mediaQuery) {
    const wasDarkMode = document.documentElement.classList.contains('dark-mode');
    const isNowDarkMode = mediaQuery.matches;
    
    if (wasDarkMode === isNowDarkMode) return; // No change needed

    // FIX: Consistently add/remove the class from the <html> element only.
    // The body class was causing conflicts with CSS specificity.
    if (isNowDarkMode) {
        document.documentElement.classList.add('dark-mode');
        lightBackgroundDiv.style.opacity = 0;
        darkBackgroundDiv.style.opacity = 1;
    } else {
        document.documentElement.classList.remove('dark-mode');
        lightBackgroundDiv.style.opacity = 1;
        darkBackgroundDiv.style.opacity = 0;
    }
    // Re-apply language to update styles correctly after the theme has changed.
    // FIX: Only re-render content on theme changes that happen *after* the initial page load.
    if (document.body.classList.contains('loading')) return; // Prevent re-render on initial load. This is the key fix.
    highlightWord(); // On theme change, only re-highlight the word. The CSS variables handle all color changes automatically.
}

function addTapAnimation(element) {
  // TOUCH OPTIMIZATION: Unified tap animation logic for consistency across all pages.
  element.addEventListener('pointerdown', () => {
    element.classList.add('squash');
  });
  element.addEventListener('pointerup', () => {
    element.classList.remove('squash');
    element.classList.remove('jello');
    void element.offsetWidth; // force reflow
    element.classList.add('jello');
  });
  element.addEventListener('pointerleave', () => {
    element.classList.remove('squash');
  });
}

function setupStoryObserver() {
    if (storyObserver) {
        storyObserver.disconnect();
    }

    const animatedItems = textContainer.querySelectorAll('.story-anim-item');

    storyObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
                // FIX: Stop observing the element after it has animated in once.
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.01
    });

    // This logic now correctly calculates delays based only on animatable items.
    let visibleItemIndex = 0;
    animatedItems.forEach(item => {
        const rect = item.getBoundingClientRect();

        if (rect.top < window.innerHeight && rect.bottom >= 0) {
            // Apply a staggered delay only to items visible on load
            item.style.transitionDelay = `${visibleItemIndex * 50}ms`;
            visibleItemIndex++;
        } else {
            // Items off-screen should animate in immediately when they become visible
            item.style.transitionDelay = '0ms';
        }
        storyObserver.observe(item);
    });
}

/**
 * NEW: Initializes the proximity shine effect for all glass buttons on the page.
 * It tracks the pointer and updates CSS variables on the buttons to create a light reflection effect.
 */
function initializeShineEffect() {
    const shineElements = document.querySelectorAll('.glass-button-base'); // All buttons have this class
    // Disable shine effect on the Low performance level
    if (performanceLevel < 2) {
        return;
    }

    let pointer = { x: -9999, y: -9999 };
    // TOUCH OPTIMIZATION: Determine if it's a touch device once and reuse the result.
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);    let isTouching = false; // Track if a touch is currently active
    let isAnimating = false;

    function ensureAnimating() {
        if (!isAnimating) {
            isAnimating = true;
            requestAnimationFrame(updateShine);
        }
    }

    window.addEventListener('pointermove', (e) => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        ensureAnimating();
    }, { passive: true });

    if (isTouchDevice) {
        window.addEventListener('touchstart', (e) => {
            isTouching = true;
            pointer.x = e.touches[0].clientX;
            pointer.y = e.touches[0].clientY;
            ensureAnimating();
        }, { passive: true });

        window.addEventListener('touchend', () => {
            isTouching = false;
            // Keep animating for a moment to allow fade-out
            ensureAnimating();
        }, { passive: true });
    }

    window.addEventListener('pointerleave', () => {
        pointer.x = -9999;
        pointer.y = -9999;
        ensureAnimating();
    });

    window.addEventListener('scroll', ensureAnimating, { passive: true });

    function updateShine() {
        let isPointerNearAnElement = false;
        let wasTouching = isTouching; // Remember the touch state from the start of the frame.

        shineElements.forEach(elem => {
            const rect = elem.getBoundingClientRect();
            // Skip elements that are not visible
            if (rect.width === 0 && rect.height === 0) {
                elem.style.setProperty('--spotlight-opacity', 0);
                return;
            }

            const dx = pointer.x - (rect.left + rect.width / 2);
            const dy = pointer.y - (rect.top + rect.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy);
            const influence = Math.max(0, 1 - dist / 150);

            // FIX: Always update the CSS variables, but only set opacity if there's influence.
            // This ensures the fade-out animation works correctly.
            if (influence > 0) {
                isPointerNearAnElement = true;
                elem.style.setProperty('--pointer-x', `${pointer.x - rect.left}px`);
                elem.style.setProperty('--pointer-y', `${pointer.y - rect.top}px`);
                elem.style.setProperty('--spotlight-opacity', influence);
            } else {
                // When there's no influence, explicitly set opacity to 0 to trigger the fade-out.
                elem.style.setProperty('--spotlight-opacity', 0);
            }
        });

        const justReleasedTouch = wasTouching && !isTouching;
        if (isPointerNearAnElement || isTouching || justReleasedTouch) {
            requestAnimationFrame(updateShine);
        } else {
            isAnimating = false;
        }
    }
    ensureAnimating();
}

/**
 * NEW: A simple and fast hashing function to create a unique signature from the
 * FingerprintJS components. This helps create a more stable user ID.
 * @param {string} str The string to hash.
 * @returns {Promise<string>} A promise that resolves to the hex-encoded hash.
 */
async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

let load = 0;
let interval = setInterval(updateLoadingText, 30);
function updateLoadingText() {
  load++;
  if (load > 99) {
    clearInterval(interval);
    loadPercentageText.innerText = '100%';
  } else {
    loadPercentageText.innerText = `${load}%`;
  }
}

window.addEventListener('load', () => {
     if (load < 100) {
         loadPercentageText.innerText = '100%';
     }
    setTimeout(() => {
        body.classList.remove('loading');
        loadingScreen.classList.add('hidden');
        setTimeout(() => {
            loadingScreen.remove();
         }, 600);
    }, 500);
});

document.addEventListener('DOMContentLoaded', () => {
    // FIX: Use a self-invoking async function to correctly handle 'await' for performance checks.
    (async () => {
        // --- REFACTOR: Use FingerprintJS for a more robust anonymous user ID ---
        try {
            // FingerprintJS should already be loaded from the main page's cache
            const fp = await window.fp.load();
            const result = await fp.get({ extendedResult: true });

            // Create a more robust ID by hashing component data.
            const components = result.components;
            const componentsString = Object.keys(components).map(key => {
                const value = components[key].value;
                return typeof value === 'object' ? JSON.stringify(value) : value;
            }).join('|');
            anonymousUserId = result.visitorId + '-' + await hashString(componentsString);

        } catch (error) {
            console.error("FingerprintJS failed on story page, falling back to localStorage:", error);
            // Fallback to the old method if FingerprintJS fails
            anonymousUserId = localStorage.getItem('anonymousUserId');
            if (!anonymousUserId) {
                anonymousUserId = 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('anonymousUserId', anonymousUserId);
            }
        }
        console.log("Anonymous User ID:", anonymousUserId);
        // This function will be called by Firebase when data is loaded or changed
        const setupInitialContent = () => {
            const preferredLanguage = localStorage.getItem('preferredLanguage');
            let initialLangToLoad = 'en';
            if (preferredLanguage && contentMap[preferredLanguage]) {
               initialLangToLoad = preferredLanguage;
            }
            changeLanguage(initialLangToLoad, true);
        };

        if (window.firebase) {
            const userBookmarksRef = window.firebase.ref(window.firebase.db, 'bookmarks/' + anonymousUserId);
            // Listen for real-time updates to this user's bookmarks
            window.firebase.onValue(userBookmarksRef, (snapshot) => {
                const data = snapshot.val();
                allSavedProgress = data || {};
                console.log("Firebase bookmarks loaded/updated:", allSavedProgress);
                // If content is already on the page, just update highlights. Otherwise, load content.
                if (textContainer.innerHTML !== '') {
                    updateBookmarkIconState();
                    highlightWord();
                } else {
                    setupInitialContent();
                }
            });
        } else {
            console.warn("Firebase not available. Falling back to localStorage for bookmarks.");
            const savedProgressJson = localStorage.getItem('allSavedProgress');
            try {
                allSavedProgress = JSON.parse(savedProgressJson) || {};
            } catch (e) {
                console.error("Failed to parse saved progress from localStorage:", e);
                allSavedProgress = {};
                localStorage.removeItem('allSavedProgress');
            }
            setupInitialContent();
        }

        // --- NEW: Run performance check first ---
        // FIX: Check for a manually set performance level from the main page.
        // REFACTOR: Read from sessionStorage to maintain consistency across the session.
        const manualLevel = sessionStorage.getItem('manualPerformanceLevel');
        if (manualLevel) { // If a manual level is found...
            performanceLevel = parseInt(manualLevel, 10);
            console.log(`Using manually set Performance Level from main page: ${performanceLevel}`);
        } else {
            performanceLevel = await determinePerformanceLevel();
        }
        console.log(`Story Page Performance Level: ${performanceLevel}`);
        document.body.classList.add(`perf-level-${performanceLevel}`);

        const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        handleDarkModeChange(darkModeMediaQuery);
        darkModeMediaQuery.addListener(handleDarkModeChange);

        // Set initial direction, this is the only call needed.
        document.documentElement.setAttribute('dir', 'ltr');

        // NEW: Initialize the shine effect for all buttons on the story page.
        initializeShineEffect();

        // Apply new tap animations to all buttons
       document.querySelectorAll('button').forEach(button => {
           addTapAnimation(button);
           // Add specific actions for each button
           if (['ar-button', 'fr-button', 'en-button'].includes(button.id)) { // Language buttons
               const lang = button.id.split('-')[0];
               if (contentMap[lang]) {
                   button.addEventListener('click', () => changeLanguage(lang));
               }
           } else if (button.id === 'save-progress-button') {
               button.addEventListener('click', () => scrollToSavedWord());
           } else if (button.id === 'back-home-button') {
               button.addEventListener('click', () => window.location.href = 'https://www.dodchstories.com');
           } else if (button.closest('#popup')) { // Popup buttons
               // FIX: Use 'pointerup' instead of 'click' for popup buttons to prevent "ghost clicks" on mobile.
               // This ensures the interaction is consistent with the word selection.
               if (button.textContent.trim().toLowerCase() === 'save' || button.textContent.trim() === 'حفظ' || button.textContent.trim() === 'enregistrer') {
                   button.addEventListener('pointerup', (e) => {
                       e.preventDefault();
                       savePosition();
                   });
               } else {
                   button.addEventListener('pointerup', closePopup);
               }
           }
       });
    })();
});