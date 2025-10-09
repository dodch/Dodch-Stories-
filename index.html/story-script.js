const loadingScreen = document.getElementById("loading-screen");
const loadPercentageText = document.querySelector(".loading-percentage");
const body = document.body;
let currentLanguage = 'en';
let allSavedProgress = {};
let tempSavedWordId = '';
let tempSavedWordText = '';
let highlightedWordElement = null;
let isDarkMode = false;
let storyObserver; // For paragraph animations

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

function applyTextEffects() {
    const textSpans = textElement.querySelectorAll('span[id^="word-"]');
    const isDarkModeActive = document.body.classList.contains('dark-mode');
    textSpans.forEach(span => {
         if (!span.classList.contains('glow-word')) {
             if (isDarkModeActive) {
                 span.style.textShadow = '0 0 1px rgba(255, 255, 255, 0.5)';
                 span.style.webkitTextStroke = 'none';
                 span.style.textStroke = 'none';
                 span.style.webkitTextFillColor = 'white';
                 span.style.color = 'white';
             } else {
                 span.style.textShadow = '0 0 1px rgba(0, 0, 0, 0.5)';
                 span.style.webkitTextStroke = 'none';
                 span.style.textStroke = 'none';
                 span.style.webkitTextFillColor = 'initial';
                 span.style.color = 'inherit';
             }
         }
     });
}

function clearSavedProgress() {
     delete allSavedProgress[currentLanguage];
     localStorage.setItem('allSavedProgress', JSON.stringify(allSavedProgress));
     if (highlightedWordElement) {
        highlightedWordElement.classList.remove('bg-yellow-200', 'bg-yellow-600', 'rounded', 'glow-word');
        applyTextEffects();
        highlightedWordElement = null;
     }
     console.log(`Saved progress for ${currentLanguage.toUpperCase()} cleared.`);
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
        // Set the text color for unselected buttons
        button.style.color = body.classList.contains('dark-mode') ? 'var(--unselected-lang-text-dark)' : 'var(--unselected-lang-text-light)';
    });
    // Then, apply selected state to the new button
    const newButton = document.getElementById(`${lang}-button`);
    if(newButton) {
        newButton.classList.remove('unselected-language');
        newButton.classList.add('selected-language');
         // Set the text color for the newly selected button
        newButton.style.color = body.classList.contains('dark-mode') ? 'var(--save-button-text-dark)' : 'var(--save-button-text-light)';
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
            textElement.style.textAlign = 'right';
        } else {
            contentDiv.dir = 'ltr';
            textElement.style.textAlign = 'left';
        }
        textElement.innerHTML = '';
        if (rawText) {
            const lines = rawText.split('\n');
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
                    }
                    const wordsAndSpaces = trimmedLine.match(/\S+|\s+|[.,!?;:]/g) || [];
                    wordsAndSpaces.forEach((part, partIndex) => {
                        const span = document.createElement('span');
                        span.textContent = part;
                        const uniqueId = `word-l${lIndex}-part${partIndex}`;
                        span.id = uniqueId;
                        span.classList.add('cursor-pointer');
                        span.onclick = () => handleWordClick(uniqueId, span.textContent.trim());
                        pElement.appendChild(span);
                    });
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
        applyTextEffects();
        const savedProgressForCurrentLang = allSavedProgress[currentLanguage];
        if (fromLoad && savedProgressForCurrentLang && savedProgressForCurrentLang.id) {
              setTimeout(() => {
                  scrollToSavedWord(false, false); // On initial load, scroll instantly
              }, 100);
        }
        contentDiv.classList.remove('content-fading');
    }, 500);
}

function handleWordClick(spanId, wordText) {
    tempSavedWordId = spanId;
    tempSavedWordText = wordText;
    document.getElementById('popup-text').textContent = `${contentMap[currentLanguage].savePosition} ${contentMap[currentLanguage].atWord}: "${wordText}"?`;
    document.getElementById('popup').classList.remove('hidden');
    document.getElementById('popup').classList.remove('fade-out');
    document.getElementById('popup').classList.add('fade-in');
}

function closePopup() {
    document.getElementById('popup').classList.remove('fade-in');
    document.getElementById('popup').classList.add('fade-out');
    tempSavedWordId = '';
    tempSavedWordText = '';
    setTimeout(() => {
        document.getElementById('popup').classList.add('hidden');
    }, 300);
}

function savePosition() {
    if (tempSavedWordId) {
        allSavedProgress[currentLanguage] = {
            id: tempSavedWordId,
            text: tempSavedWordText
        };
        console.log(`${contentMap[currentLanguage].positionSaved} ${contentMap[currentLanguage].forWord}: "${tempSavedWordText}" (ID: ${tempSavedWordId}) in language "${currentLanguage}"`);
        localStorage.setItem('allSavedProgress', JSON.stringify(allSavedProgress));
        highlightWord();
    }
    closePopup();
}

function scrollToSavedWord(performChecks = true, smooth = true) {
    const savedProgressForCurrentLang = allSavedProgress[currentLanguage];
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
       applyTextEffects();
       highlightedWordElement = null;
   }
   const savedProgressForCurrentLang = allSavedProgress[currentLanguage];
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
    isDarkMode = mediaQuery.matches;
    if (isDarkMode) {
        body.classList.add('dark-mode');
        lightBackgroundDiv.style.opacity = 0;
        darkBackgroundDiv.style.opacity = 1;
    } else {
        body.classList.remove('dark-mode');
        lightBackgroundDiv.style.opacity = 1;
        darkBackgroundDiv.style.opacity = 0;
        document.documentElement.setAttribute('dir', 'ltr');
    }
    changeLanguage(currentLanguage, false);
    applyTextEffects();
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
            } else {
                // Reset the state when it goes out of view to allow re-animation
                entry.target.classList.remove('in-view'); 
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

     // Apply new tap animations to all buttons
    document.querySelectorAll('button').forEach(button => {
        addTapAnimation(button);
        // Add specific actions for each button
        if (button.id.includes('-button')) { // Language buttons
            const lang = button.id.split('-')[0];
            if (contentMap[lang]) {
                button.addEventListener('click', () => changeLanguage(lang));
            }
        } else if (button.id === 'save-progress-button') {
            button.addEventListener('click', () => scrollToSavedWord());
        } else if (button.id === 'back-home-button') {
            button.addEventListener('click', () => window.location.href = 'https://www.dodchstories.com');
        } else if (button.closest('#popup')) { // Popup buttons
            if (button.textContent.trim().toLowerCase() === 'save' || button.textContent.trim() === 'حفظ' || button.textContent.trim() === 'enregistrer') {
                button.addEventListener('click', savePosition);
            } else {
                button.addEventListener('click', closePopup);
            }
        }
    });
});