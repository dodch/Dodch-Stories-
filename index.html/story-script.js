const loadingScreen = document.getElementById("loading-screen");
const loadPercentageText = document.querySelector(".loading-percentage");
const body = document.body;
// FIX: Create a unique key for each story to namespace saved progress.
// This prevents progress from one story from conflicting with another.
const storyKey = document.title.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/\s+/g, '-');
let currentLanguage = 'en';
let allSavedProgress = {};
let tempSavedWordId = '';
let tempSavedWordText = '';
let highlightedWordElement = null;
let isDarkMode = false;
let storyObserver; // For paragraph animations

// FIX: Add a flag to prevent immediate re-triggering of the popup on mobile.
// This will block the "ghost click" that happens after a touch event.
let blockPopupTrigger = false;

// contentMap will be defined in each story's HTML file

const lightBackgroundDiv = document.querySelector('.fixed-background.light-background');
const darkBackgroundDiv = document.querySelector('.fixed-background.dark-background');
const contentDiv = document.getElementById('content');
const textElement = document.getElementById('text');
const titleElement = document.getElementById('title');
const backHomeButton = document.getElementById('back-home-button');
const languageButtons = document.querySelectorAll('#ar-button, #fr-button, #en-button');
const saveButton = document.getElementById('save-progress-button');
const popupDivInner = document.getElementById('popup').querySelector('div');

function clearSavedProgress() {
    if (allSavedProgress[storyKey]) {
        delete allSavedProgress[storyKey][currentLanguage];
        localStorage.setItem('allSavedProgress', JSON.stringify(allSavedProgress));
    }
}

function changeLanguage(lang, fromLoad = false) {
    if (contentDiv.classList.contains('content-fading') && !fromLoad) {
         return;
    }
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
    contentDiv.classList.add('content-fading');
    const rawTextElement = document.getElementById(content.rawTextId);
    const rawText = rawTextElement ? rawTextElement.textContent.trim() : '';
    setTimeout(() => {
        titleElement.textContent = content.title;
        // The backHomeTextSpan element does not exist, so this line is removed.
        if (lang === 'ar') {
            contentDiv.dir = 'rtl';
            document.getElementById('popup-text').dir = 'rtl'; // FIX: Set popup text direction
            textElement.style.textAlign = 'right';
        } else {
            contentDiv.dir = 'ltr';
            document.getElementById('popup-text').dir = 'ltr'; // FIX: Revert popup text direction
            textElement.style.textAlign = 'left';
        }
        textElement.innerHTML = '';
        if (rawText) {
            const lines = rawText.split('\n');
            let isFirstWordOfStory = true; // Flag to handle the very first word for the drop cap
            lines.forEach((line, lIndex) => {
                const trimmedLine = line.trim();
                const pElement = document.createElement('p');
                pElement.classList.add('mb-4', 'text-lg', 'leading-relaxed');

                if (trimmedLine === '') {
                    // Use a non-breaking space to ensure the paragraph has height
                    pElement.innerHTML = '&nbsp;';
                } else {
                    // Check if the line is just the separator
                    if (trimmedLine !== '⸻') {
                        pElement.classList.add('story-anim-item');
                        
                        // REFACTOR: New, definitive drop cap logic.
                        if (isFirstWordOfStory) {
                            const firstWordMatch = trimmedLine.match(/\S+/); // Find the first sequence of non-space characters
                            if (firstWordMatch) {
                                const firstWord = firstWordMatch[0];
                                const firstLetter = firstWord.charAt(0);
                                const restOfWord = firstWord.substring(1);
                                const afterFirstWord = trimmedLine.substring(firstWordMatch.index + firstWord.length);

                                // Create the drop cap span
                                const dropCapSpan = document.createElement('span');
                                dropCapSpan.className = 'drop-cap';
                                dropCapSpan.textContent = firstLetter;
                                
                                // FIX: Adjust float for RTL languages like Arabic
                                if (lang === 'ar') {
                                    dropCapSpan.style.float = 'right';
                                    dropCapSpan.style.marginLeft = '0.5rem'; // Add some space for RTL
                                }
                                pElement.appendChild(dropCapSpan);

                                // Create a span for the rest of the word if it exists
                                const firstWordSpan = document.createElement('span');
                                firstWordSpan.textContent = restOfWord;
                                // Use a consistent ID structure for the first word.
                                const uniqueId = `word-l${lIndex}-p0`;
                                firstWordSpan.id = uniqueId;
                                firstWordSpan.classList.add('cursor-pointer');
                                // FIX: Use pointerup and prevent default to avoid double-firing on touch devices.
                                firstWordSpan.addEventListener('pointerup', (e) => {
                                    e.preventDefault(); // Prevents the browser from firing a 'click' event after the 'pointerup'.
                                    handleWordClick(uniqueId, firstWord.trim());
                                });
                                pElement.appendChild(firstWordSpan);
                                
                                // Process the rest of the line
                                const remainingWords = afterFirstWord.trim().split(/\s+/);
                                pElement.appendChild(document.createTextNode(' ')); // Add space after first word
                                remainingWords.forEach((word, wIndex) => {
                                    if (word) {
                                        const wordSpan = document.createElement('span');
                                        const uniqueId = `word-l${lIndex}-p${wIndex + 1}`;
                                        wordSpan.id = uniqueId;
                                        wordSpan.textContent = word;
                                        wordSpan.classList.add('cursor-pointer');
                                        // FIX: Use pointerup and prevent default.
                                        wordSpan.addEventListener('pointerup', (e) => {
                                            e.preventDefault();
                                            handleWordClick(uniqueId, wordSpan.textContent.trim());
                                        });
                                        pElement.appendChild(wordSpan);
                                        pElement.appendChild(document.createTextNode(' '));
                                    }
                                });

                                isFirstWordOfStory = false; // We've processed the first word, don't do it again.
                            } else {
                                pElement.textContent = trimmedLine; // Fallback for lines without words
                            }
                        } else {
                            // For all other lines, split into words and create spans
                            const words = trimmedLine.split(/\s+/);
                            words.forEach((word, wIndex) => {
                                if (word) {
                                    const wordSpan = document.createElement('span');
                                    const uniqueId = `word-l${lIndex}-p${wIndex}`;
                                    wordSpan.id = uniqueId;
                                    wordSpan.textContent = word;
                                    wordSpan.classList.add('cursor-pointer');
                                    // FIX: Use pointerup and prevent default.
                                    wordSpan.addEventListener('pointerup', (e) => {
                                        e.preventDefault();
                                        handleWordClick(uniqueId, wordSpan.textContent.trim());
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
                textElement.appendChild(pElement);
            });
        } else {
             const noTextElement = document.createElement('p');
             noTextElement.classList.add('text-center', 'text-xl', 'text-gray-500');
             noTextElement.textContent = `No text available for ${lang.toUpperCase()}. Please add content to the raw text div.`;
             textElement.appendChild(noTextElement);
             console.warn(`No raw text found for language: ${lang}`);
        }
        setupStoryObserver();
        document.getElementById('save-progress-button').textContent = content.saveProgress;
        document.getElementById('popup-title').textContent = content.savePosition;
        document.getElementById('popup').querySelector('.bg-green-500').textContent = content.save;
        document.getElementById('popup').querySelector('.bg-red-500').textContent = content.exit;
        highlightWord();
        const savedProgressForCurrentLang = allSavedProgress[storyKey] ? allSavedProgress[storyKey][currentLanguage] : null;
        if (fromLoad && savedProgressForCurrentLang && savedProgressForCurrentLang.id) {
              setTimeout(() => {
                  scrollToSavedWord(false, false); // On initial load, scroll instantly
              }, 100);
        }
        contentDiv.classList.remove('content-fading');
    }, 500);
}

function handleWordClick(spanId, wordText) {
    // FIX: If the popup was just closed by a touch event, don't reopen it immediately.
    // This is the core fix for the "double popup" and "auto-save" bug on mobile.
    if (blockPopupTrigger) {
        return;
    }

    tempSavedWordId = spanId;
    tempSavedWordText = wordText;
    document.getElementById('popup-text').textContent = `${contentMap[currentLanguage].savePosition}: "${wordText}"${contentMap[currentLanguage].questionMark}`;
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
        // FIX: Ensure the story key object exists before assigning to it.
        if (!allSavedProgress[storyKey]) {
            allSavedProgress[storyKey] = {};
        }
        allSavedProgress[storyKey][currentLanguage] = {
            id: tempSavedWordId,
            text: tempSavedWordText
        };
        console.log(`${contentMap[currentLanguage].positionSaved} "${tempSavedWordText}" (ID: ${tempSavedWordId}) in language "${currentLanguage}"`);
        localStorage.setItem('allSavedProgress', JSON.stringify(allSavedProgress));
        highlightWord();
    }
    closePopup();
}


function scrollToSavedWord(performChecks = true, smooth = true) {
    const savedProgressForCurrentLang = allSavedProgress[storyKey] ? allSavedProgress[storyKey][currentLanguage] : null;
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
       highlightedWordElement.classList.remove('bg-yellow-200', 'bg-yellow-600', 'rounded', 'glow-word');
       // FIX: Reset inline styles on the previously highlighted word so it reverts to the default text color and shadow.
       highlightedWordElement.style.textShadow = '';
       highlightedWordElement.style.webkitTextStroke = '';
       highlightedWordElement.style.textStroke = '';
       highlightedWordElement.style.webkitTextFillColor = '';
       highlightedWordElement.style.color = '';
       highlightedWordElement = null;
   }
   const savedProgressForCurrentLang = allSavedProgress[storyKey] ? allSavedProgress[storyKey][currentLanguage] : null;
   if (!savedProgressForCurrentLang || !savedProgressForCurrentLang.id) {
       return;
   }
   const savedWordId = savedProgressForCurrentLang.id;
   const targetElement = document.getElementById(savedWordId);
   if (targetElement) {
       highlightedWordElement = targetElement;
       highlightedWordElement.classList.add('rounded', 'glow-word');
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
    const wasDarkMode = body.classList.contains('dark-mode');
    const isNowDarkMode = mediaQuery.matches;

    if (wasDarkMode === isNowDarkMode) return; // No change needed

    if (isNowDarkMode) {
        body.classList.add('dark-mode');
        lightBackgroundDiv.style.opacity = 0;
        darkBackgroundDiv.style.opacity = 1;
    } else {
        body.classList.remove('dark-mode');
        lightBackgroundDiv.style.opacity = 1;
        darkBackgroundDiv.style.opacity = 0;
    }
    // Re-apply language to update styles correctly after the theme has changed.
    changeLanguage(currentLanguage, true); // Use 'true' to prevent fade-out/fade-in
    highlightWord();
}

function addTapAnimation(element) {
  element.addEventListener('pointerdown', () => {
    element.classList.add('squash');
  });
  element.addEventListener('pointerup', () => {
    element.classList.remove('squash');
    // Ensure jello animation can be re-triggered
    element.classList.remove('jello');
    void element.offsetWidth; // force reflow
    element.classList.add('jello');
  });
  // Also remove squash if the pointer leaves the button while pressed
  element.addEventListener('pointerleave', () => {
    element.classList.remove('squash');
  });
}

function setupStoryObserver() {
    if (storyObserver) {
        storyObserver.disconnect();
    }

    const animatedItems = textElement.querySelectorAll('.story-anim-item');

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
    let pointer = { x: -9999, y: -9999 };
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    let isTouching = false; // Track if a touch is currently active
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
            let influence = 0;
            if ((isTouchDevice && isTouching) || !isTouchDevice) {
                const rect = elem.getBoundingClientRect();
                // Skip elements that are not visible
                if (rect.width === 0 && rect.height === 0) {
                    elem.style.setProperty('--spotlight-opacity', 0);
                    return;
                }

                const dx = pointer.x - (rect.left + rect.width / 2);
                const dy = pointer.y - (rect.top + rect.height / 2);
                const dist = Math.sqrt(dx * dx + dy * dy);
                influence = Math.max(0, 1 - dist / 150);
                if (influence > 0) isPointerNearAnElement = true;

                elem.style.setProperty('--pointer-x', `${pointer.x - rect.left}px`);
                elem.style.setProperty('--pointer-y', `${pointer.y - rect.top}px`);
            }
            // This is the key fix: always update the opacity, setting it to 0 if there's no influence.
            elem.style.setProperty('--spotlight-opacity', influence);
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
     const savedProgressJson = localStorage.getItem('allSavedProgress');
     try {
         allSavedProgress = JSON.parse(savedProgressJson) || {};
     } catch (e) {
         console.error("Failed to parse saved progress from localStorage:", e);
         allSavedProgress = {};
         localStorage.removeItem('allSavedProgress');
     }

     const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
     handleDarkModeChange(darkModeMediaQuery);
     darkModeMediaQuery.addListener(handleDarkModeChange);

     // Set initial direction, this is the only call needed.
     document.documentElement.setAttribute('dir', 'ltr');

     const preferredLanguage = localStorage.getItem('preferredLanguage');
     let initialLangToLoad = 'en';
     if (preferredLanguage && contentMap[preferredLanguage]) {
        initialLangToLoad = preferredLanguage;
     }
     changeLanguage(initialLangToLoad, true);

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
});