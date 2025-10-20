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
// Disable right-click menu
document.addEventListener('contextmenu', event => event.preventDefault());

// --- NEW: Anti-Inspection and DevTools Detection ---

/**
 * This function attempts to detect if the browser's developer tools are open.
 * It works by using a `debugger` statement, which only pauses execution when
 * the developer tools are active. By measuring the time it takes to get past
 * this statement, we can infer if the tools are open and then reload the page.
 */
function detectAndReloadOnDevTools() {
    const threshold = 160; // Time in milliseconds to assume DevTools is open.

    function check() {
        const startTime = performance.now();
        // This line will only cause a pause if DevTools is open.
        debugger;
        const endTime = performance.now();

        if (endTime - startTime > threshold) {
            // DevTools is open, reload the page immediately.
            window.location.reload();
        }
    }

    // Run the check on an interval to constantly monitor for DevTools.
    setInterval(check, 1000);
}

// Block common keyboard shortcuts for opening DevTools.
document.addEventListener('keydown', function(e) {
    // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
    if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) || (e.ctrlKey && e.keyCode === 85)) {
        e.preventDefault();
        window.location.reload();
    }
});

// Global variables to store data and grid elements
let panels = [];
let allStories = [];
let showingFavorites = false;
let anonymousUserId = null; // NEW: To store the user's unique ID for favorites
const body = document.body;
let backgroundSets = []; // To store background image data
let performanceLevel = 3; // Default to highest

// --- NEW: Simplified 3-Tier Performance System ---
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

function applyPerformanceStyles(level) {
    // Remove any existing performance level classes before adding the new one.
    for (let i = 1; i <= 3; i++) { // REFACTOR: Loop through all 3 possible levels.
        document.body.classList.remove(`perf-level-${i}`);
    }
    document.body.classList.add(`perf-level-${level}`);
}

// New function to add tap animation
function addTapAnimation(element) {
  element.addEventListener('pointerdown', () => {
    element.classList.add('squash');
  });
  element.addEventListener('pointerup', () => {
    element.classList.remove('squash');
    element.classList.remove('jello');
    void element.offsetWidth; // force reflow to restart animation
    element.classList.add('jello');
  });
  element.addEventListener('pointerleave', () => {
    element.classList.remove('squash');
  });
}

// Helper function to highlight matching text
function highlightText(text, query) {
  if (!query) return text;
  const regex = new RegExp(query, 'gi');
  return text.replace(regex, (match) => `<span class="highlight">${match}</span>`);
}

function updateNoFavoritesMessageState() {
  const favoritePanels = document.querySelectorAll('.glass-container.favorited');
  const noFavoritesMessage = document.getElementById('no-favorites-message');
  if (showingFavorites && favoritePanels.length === 0) {
    noFavoritesMessage.classList.add('show');
  } else {
    noFavoritesMessage.classList.remove('show');
  }
}

function updatePanelVisibility(panel, shouldShow, searchQuery) {
  const titleEl = panel.querySelector('.title');
  const descriptionEl = panel.querySelector('.description');
  const creatorEl = panel.querySelector('.story-creator');
  const dateEl = panel.querySelector('.creation-date');
  const pillEl = panel.querySelector('.new-pill');

  // Store original text in a data attribute if it doesn't exist
  if (!titleEl.dataset.originalTitle) {
      titleEl.dataset.originalTitle = titleEl.textContent;
  }
  if (!descriptionEl.dataset.originalDescription) {
      descriptionEl.dataset.originalDescription = descriptionEl.textContent;
  }
  if (!creatorEl.dataset.originalCreator) {
      creatorEl.dataset.originalCreator = creatorEl.textContent;
  }
  if (!dateEl.dataset.originalDate) {
      dateEl.dataset.originalDate = dateEl.textContent;
  }
  if (pillEl && !pillEl.dataset.originalStatus) {
      pillEl.dataset.originalStatus = pillEl.textContent;
  }

  // Apply highlighting to all searchable fields
  titleEl.innerHTML = highlightText(titleEl.dataset.originalTitle, searchQuery);
  descriptionEl.innerHTML = highlightText(descriptionEl.dataset.originalDescription, searchQuery);
  creatorEl.innerHTML = highlightText(creatorEl.dataset.originalCreator, searchQuery);
  dateEl.innerHTML = highlightText(dateEl.dataset.originalDate, searchQuery);
  if (pillEl) {
      pillEl.innerHTML = highlightText(pillEl.dataset.originalStatus, searchQuery);
  }

  if (shouldShow) {
    panel.style.display = 'flex';
    panel.classList.remove('panel-hidden');
  } else {
    panel.classList.add('panel-hidden');
    panel.style.display = 'none';
  }
}

// Function to filter and render panels based on search query
function filterAndRenderPanels() {
  const searchBar = document.getElementById('searchInput');
  const searchQuery = searchBar.value.toLowerCase();
  panels.forEach(panel => {
    // Get all the content to be searched
    const title = panel.querySelector('.title').dataset.originalTitle.toLowerCase();
    const description = panel.querySelector('.description').dataset.originalDescription.toLowerCase();
    const creator = panel.querySelector('.story-creator').textContent.toLowerCase().replace('made by ', '');
    const date = panel.querySelector('.creation-date').textContent.toLowerCase();
    const pillElement = panel.querySelector('.new-pill');
    const status = pillElement ? pillElement.textContent.toLowerCase() : '';

    const isFavorite = panel.classList.contains('favorited');

    // Update the search logic to check all fields
    const isMatch = title.includes(searchQuery) || 
                    description.includes(searchQuery) ||
                    creator.includes(searchQuery) ||
                    date.includes(searchQuery) ||
                    status.includes(searchQuery);

    const shouldShow = isMatch && (!showingFavorites || isFavorite);
    updatePanelVisibility(panel, shouldShow, searchQuery);
  });
  updateNoFavoritesMessageState();
  saveState();
}

function loadSavedState() {
  // This function now only loads UI state like search and filter view.
  // The "favorited" status of each card is now handled by the real-time Firebase listener.
  const savedShowingFavorites = localStorage.getItem('showingFavorites');
  const savedSearchValue = localStorage.getItem('searchValue');
  showingFavorites = savedShowingFavorites === 'true';
  if (showingFavorites) {
    document.getElementById('filterBtn').classList.add('active');
  }
  const searchBar = document.getElementById('searchInput');
  if (savedSearchValue) {
    searchBar.value = savedSearchValue;
  }
}

function saveState() {
  // This function now only saves UI state.
  const searchBar = document.getElementById('searchInput');
  localStorage.setItem('showingFavorites', showingFavorites);
  localStorage.setItem('searchValue', searchBar.value);
}

function initializeHeartColor() {
  const filterBtn = document.getElementById('filterBtn');
  const heartSvg = filterBtn.querySelector('svg');
  if (showingFavorites) {
    heartSvg.style.fill = 'var(--heart-active)';
  } else {
    heartSvg.style.fill = 'var(--heart-color)';
  }
}

async function fetchAndBuildGrid() {
  try {
    const response = await fetch('stories.json');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const storiesData = await response.json();
    allStories = storiesData; 
    const grid = document.getElementById('grid');

    grid.innerHTML = '';

    // --- NEW: Function to create a story card (used for both single stories and series parts) ---
    function createStoryCard(storyData, options = {}) {
        const card = document.createElement('a');
        card.className = "glass-container";
        // Use a special class for series parts to prevent them from being added to the main `panels` array for physics
        if (storyData.isPart) {
            card.classList.add('series-part-card');
        }
        if (options.simpleBlur) {
            card.classList.add('simple-blur');
        }

        card.href = (storyData.path || '') + storyData.file;
        // FIX: Only apply 'no-link' to actual stories, not to the series cover card.
        if ((!storyData.file || storyData.file.trim() === '') && storyData.type !== 'series') {
            card.classList.add('no-link');
            card.removeAttribute('href');
        }

        card.innerHTML = `
            <div class="favorite-overlay"></div>
            <div class="glass-content">
              <h3 class="title" data-original-title="${storyData.title}">${storyData.title}</h3>
              <p class="description" data-original-description="${storyData.description}">${storyData.description}</p>
            </div>
            <span class="story-length">${storyData.length || ''}</span>
            <span class="creation-date">${storyData.date}</span>
            <p class="story-creator">made by ${storyData.creator}</p>
            <div class="favorite-container">
              <span class="favorite-count">0</span>
              <div class="favorite-btn glass-button-base">
                <svg viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
            </div>
        `;

        const status = storyData.status ? storyData.status : '';
        const statusColor = storyData.status_color ? storyData.status_color.toLowerCase() : '';
        if (status) {
            const newPill = document.createElement('span');
            newPill.className = "new-pill";
            newPill.textContent = status;
            if (statusColor.includes('red')) newPill.classList.add('red');
            else if (statusColor.includes('purple')) newPill.classList.add('purple');
            else if (statusColor.includes('golden')) newPill.classList.add('golden');
            card.appendChild(newPill);
        }

        return card;
    }


    storiesData.forEach(story => {
      // --- NEW: Handle series and single stories differently ---
      if (story.type === 'series') {
          // Create a container for the stack
          // Create a single element that is both the card and the stack container.
          const seriesCard = createStoryCard(story);
          seriesCard.classList.add('series-stack');
          seriesCard.removeAttribute('href'); // The container itself isn't a direct link.
          seriesCard.id = story.id; // Use the new ID from JSON

          // Add click listener to the whole stack
          seriesCard.addEventListener('click', (e) => {
              // Find the card that was actually clicked on
              const clickedCard = e.target.closest('a.glass-container');
              // If the clicked element is a valid link, let the browser handle it and do nothing else.
              if (clickedCard && clickedCard.hasAttribute('href')) return;
              e.preventDefault(); // Prevent any default behavior for non-link clicks
              openSeriesModal(story);
          });
          grid.appendChild(seriesCard); // Add the unified card/stack to the grid
      } else {
          // This is a regular, single story
          const singleStoryCard = createStoryCard(story);
          grid.appendChild(singleStoryCard);
      }

      // --- Local Favorite State ---
      const title = story.title;
      const addedCard = grid.lastElementChild;
      const storyKey = title.replace(/[^a-zA-Z0-9]/g, '_');
      addedCard.dataset.storyKey = storyKey;

      // --- NEW: Firebase Realtime Database Integration for Favorites ---
      const countSpan = addedCard.querySelector('.favorite-count');
      if (countSpan && window.firebaseServices) {
          const storyRef = window.firebaseServices.ref(window.firebaseServices.db, 'stories/' + storyKey);

          // Listen for real-time updates to the favorite count
          window.firebaseServices.onValue(storyRef, (snapshot) => {
              const storyData = snapshot.val();
              const count = storyData?.favoritesCount || 0;
              const favoritedBy = storyData?.favoritedBy || {};
              
              countSpan.textContent = count;

              const isFavorited = favoritedBy[anonymousUserId] === true;
              const favoriteBtn = addedCard.querySelector('.favorite-btn');
              favoriteBtn.classList.toggle('active', isFavorited);
              addedCard.classList.toggle('favorited', isFavorited);
          });
      }

    });
    // Correctly select panels for physics, excluding those inside a series stack
    panels = [...document.querySelectorAll('.grid > .glass-container, .grid > .series-stack')];
    // Also add the series stacks to the physics simulation

    // Load saved state *after* panels are created in the DOM
    loadSavedState();

    // --- PERFORMANCE OPTIMIZATION: Use a Map for direct state lookup ---
    // This is much faster than using an array and indexOf.
    const state = new Map();
    panels.forEach(card => {
      // NEW: Disable physics for performance levels 1 and 2
      if (performanceLevel < 2) { // Now only disable for level 1
          card.classList.add('physics-disabled');
      }

      card.style.opacity = '0';
      state.set(card, {
        scaleX: 0.95, scaleY: 0.95, // Start slightly smaller for a grow effect
        vx: 0, vy: 0,
        rotX: 0, rotY: 0,
        vrX: 0, vrY: 0, 
        yOffset: 0, vyOffset: 0,
        // TUNED: Damping is crucial for the feel. A slightly lower value makes it more "springy".
        damping: 0.85 + Math.random() * 0.05
      });
    });

    // --- PERFORMANCE OPTIMIZATION: Use a Set to track only visible panels ---
    // The IntersectionObserver will add/remove panels from this set.
    const visiblePanels = new Set();

    // Helper function to clamp a value between a min and max
    function clamp(value, min, max) {
      return Math.max(min, Math.min(value, max));
    }

    // --- PERFORMANCE OPTIMIZATION: Pre-calculate static properties ---
    // We'll store properties that don't change every frame to avoid re-calculating.
    function updateCardStaticProps() {
      panels.forEach(card => {
        const s = state.get(card);
        if (s) {
          s.height = card.offsetHeight; // card's height
          s.offsetTop = card.offsetTop; // card's distance from the top of the document
          s.offsetLeft = card.offsetLeft; // card's distance from the left of the document
          s.width = card.offsetWidth; // card's width
        }
      });
    }
    // Initial calculations
    updateCardStaticProps();

    // FIX: Create a dedicated function to update grid bounds and call it on load and resize.
    // This ensures the hover effect works immediately without needing to scroll first.
    function updateGridBounds() {
        const gridRect = document.getElementById('grid').getBoundingClientRect();
        gridBounds.top = gridRect.top + window.scrollY;
        gridBounds.bottom = gridRect.bottom + window.scrollY;
    }

    // NEW: Staggered fade-in and gentle physics kick on load
    window.addEventListener('resize', () => {
        updateCardStaticProps();
        updateGridBounds();
    });
    panels.forEach((card, i) => {
        setTimeout(() => {
            card.style.opacity = '1'; // Trigger the CSS fade-in
            const s = state.get(card);
            if (s) { 
              // Apply a very gentle impulse to make the card "settle"
              s.vy -= 0.05 + Math.random() * 0.05; 
            }
        }, i * 50);
    });

    // FIX: Delay the tutorial until after the grid card animations have finished.
    // The animations take about 2 seconds to fully settle.
    setTimeout(() => {
      showTutorialOnFirstVisit();
    }, 1900); // Wait 1.9 seconds before showing the tutorial.

    let lastScroll = window.scrollY;
    let lastTime = performance.now();
    let pointer = { x: -9999, y: -9999 };
    let gridBounds = { top: 0, bottom: 0 }; // To cache grid position
    let isAnimating = true; // Control the animation loop
    // REFACTOR: This will now be used to intelligently stop the animation loop when nothing is moving.
    let canStopAnimating = false;

    // NEW: Detect if it's a touch device to adjust hover logic
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    let isTouching = false; // Track if a touch is currently active

    function frame(now) {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const scrollY = window.scrollY;
      let delta = scrollY - lastScroll; // TUNED: Reduced springiness for a smoother feel.
      lastScroll = scrollY;

      // --- PERFORMANCE FIX: Clamp delta to prevent jumps on sudden scrolls --- // TUNED: Reduced springiness for a smoother feel.
      // This prevents the animation from overreacting to extreme scroll gestures. // TUNED: Reduced springiness for a smoother feel.
      delta = clamp(delta, -150, 150);

      const vh = window.innerHeight;
      const center = scrollY + vh / 2;

      const isPointerNearGrid = pointer.y > gridBounds.top - 200 - scrollY && pointer.y < gridBounds.bottom + 200 - scrollY;

      let totalVelocity = 0;
      visiblePanels.forEach((card) => {
        const s = state.get(card);
        if (!s || card.classList.contains('physics-disabled')) return; // Skip physics if disabled

        const cardTop = typeof s.offsetTop === 'number' ? s.offsetTop : 0;
        const cardHeight = typeof s.height === 'number' ? s.height : 0;
        const cardCenter = cardTop + cardHeight / 2;
        const distFromCenter = Math.abs(cardCenter - center);

        if (distFromCenter < vh) {
          const dist = distFromCenter / vh;
          const scrollSpeed = Math.abs(delta);
          const speedFactor = clamp(1 + scrollSpeed / 150, 1, 1.5);

          // REFACTOR: Implement a "Jello" scroll effect instead of the complex physics.
          // 1. Calculate a "squash" factor based on scroll velocity (delta).
          // A negative delta (scrolling down) squashes vertically, a positive delta (scrolling up) squashes horizontally.
          const squashFactor = delta * -0.0015 * speedFactor * (1 - dist);

          // 2. Define the target scales. The card squashes on one axis and stretches on the other.
          let targetScaleX = 1 + squashFactor;
          let targetScaleY = 1 - squashFactor;

          let influence = 0;

          // 3. Calculate Hover Effect (only if not scrolling to save performance)
          if (!body.classList.contains('is-scrolling') && ((isTouchDevice && isTouching) || (!isTouchDevice && isPointerNearGrid))) {
            const cardWidth = typeof s.width === 'number' ? s.width : 0;
            const dx = pointer.x - (s.offsetLeft + cardWidth / 2.0);
            const dy = pointer.y - (cardTop - scrollY + cardHeight / 2.0);
            const pointerDist = Math.sqrt(dx * dx + dy * dy);
            influence = Math.max(0, 1 - pointerDist / 275);

            // On hover, slightly increase the scale.
            targetScaleX += 0.05 * influence;
            targetScaleY += 0.05 * influence;

            card.style.setProperty('--pointer-x', `${pointer.x - s.offsetLeft}px`);
            card.style.setProperty('--pointer-y', `${pointer.y - (s.offsetTop - scrollY)}px`);
            card.style.setProperty('--spotlight-opacity', influence);
          } else {
            card.style.setProperty('--spotlight-opacity', 0);
          }
          
          // 4. Apply Physics Simulation (Spring animation towards the target)
          const springiness = 0.1;
          const d = s.damping;

          s.vx += (targetScaleX - s.scaleX) * springiness; s.vx *= d; s.scaleX += s.vx;
          s.vy += (targetScaleY - s.scaleY) * springiness; s.vy *= d; s.scaleY += s.vy;
          
          // Reset rotation and parallax offset as they are no longer used.
          s.rotX = 0; s.rotY = 0; s.yOffset = 0;

          if (influence > 0) {
            card.style.setProperty('--pointer-x', `${pointer.x - s.offsetLeft}px`);
            card.style.setProperty('--pointer-y', `${pointer.y - (s.offsetTop - scrollY)}px`);
            card.style.setProperty('--spotlight-opacity', influence);
          }

          totalVelocity += Math.abs(s.vx) + Math.abs(s.vy);

          const finalScaleX = clamp(s.scaleX, 0.8, 1.05);
          const finalScaleY = clamp(s.scaleY, 0.8, 1.05);
          card.style.transform = `scale(${finalScaleX}, ${finalScaleY})`;
        }
      });

      // NEW: Animate button shine based on proximity
      document.querySelectorAll('.shine-button').forEach(button => {
        const rect = button.getBoundingClientRect();
        const dx = pointer.x - (rect.left + rect.width / 2);
        const dy = pointer.y - (rect.top + rect.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const influence = Math.max(0, 1 - dist / 150); // 150px is the influence radius

        button.style.setProperty('--pointer-x', `${pointer.x - rect.left}px`);
        button.style.setProperty('--pointer-y', `${pointer.y - rect.top}px`);
        button.style.setProperty('--spotlight-opacity', influence);
      });

      // FIX: Add shine effect for cards inside the series modal.
      if (seriesModal.classList.contains('active')) {
        document.querySelectorAll('#seriesModal .glass-container').forEach(card => {
            const rect = card.getBoundingClientRect();
            const dx = pointer.x - (rect.left + rect.width / 2);
            const dy = pointer.y - (rect.top + rect.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy);
            // Use the same large influence radius as the main grid cards.
            const influence = Math.max(0, 1 - dist / 275);

            card.style.setProperty('--pointer-x', `${pointer.x - rect.left}px`);
            card.style.setProperty('--pointer-y', `${pointer.y - rect.top}px`);
            card.style.setProperty('--spotlight-opacity', influence);
        });
      }

      // --- REFACTOR: Smart Animation Loop ---
      // If total velocity is very low and we're allowed to stop, then stop the loop.
      // FIX: Add a check for pointer influence. Keep animating for a short while after the pointer leaves
      // to allow the cards to smoothly settle back to their resting state.
      const isPointerInfluencing = document.querySelector('.glass-container[style*="--spotlight-opacity: 0;"]') === null;
      if (canStopAnimating && totalVelocity < 0.001 && delta === 0 && !isTouching && !isPointerInfluencing) {
        isAnimating = false;
      } else {
        // Otherwise, keep the animation going.
        requestAnimationFrame(frame);
      }
    }
    requestAnimationFrame(frame);

    // Allow the animation to stop only after the initial entrance effect has had time to run
    setTimeout(() => {
      canStopAnimating = true;
    }, 2000); // 2 seconds

    // --- PERFORMANCE OPTIMIZATION: Setup IntersectionObserver ---
    // This observer watches which cards are on screen and adds them to the `visiblePanels` set.
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const card = entry.target;
        // FIX: Always keep the animation running, but only add intersecting panels to the set for physics calculations.
        // This ensures the animation loop doesn't stop, providing a smoother scroll experience.
        if (entry.isIntersecting) {
          visiblePanels.add(card);
        } else {
          visiblePanels.delete(card);
        }
        // FIX: Ensure spotlight is off for elements that are not visible or being animated.
        card.style.setProperty('--spotlight-opacity', 0);
      });
    }, {
      rootMargin: '200px 0px 200px 0px' // Start animating cards 200px before they enter the screen
    });
    panels.forEach(card => observer.observe(card));

    // --- Smart Animation Triggering: Only run the loop when needed ---
    function ensureAnimating() {
      if (!isAnimating) {
        isAnimating = true;
        requestAnimationFrame(frame); // Restart the loop
      }
    }

    // Add a listener to update the pointer coordinates for the hover effect
    window.addEventListener('pointermove', (e) => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        ensureAnimating();
    }, { passive: true });

    // NEW: Add touch event listeners to handle the effect on mobile
    if (isTouchDevice) {
        window.addEventListener('touchstart', (e) => {
            isTouching = true;
            pointer.x = e.touches[0].clientX;
            pointer.y = e.touches[0].clientY;
            ensureAnimating();
        }, { passive: true });

        window.addEventListener('touchend', () => {
            isTouching = false; // When the finger is lifted, the touch ends
        }, { passive: true });
    }

    window.addEventListener('pointerleave', () => { 
        // FIX: Reset pointer and run the animation loop one last time to ensure all hover effects are gracefully removed.
        // This prevents the "stuck" light effect if the mouse leaves the window quickly.
        pointer.x = -9999; 
        pointer.y = -9999; 
        ensureAnimating();
    });
    // --- End Animation Setup ---

    const searchButton = document.getElementById('searchButton');
    const searchBar = document.getElementById('searchInput');
    const filterBtn = document.getElementById('filterBtn');
    const contactBtn = document.getElementById('contactBtn');
    const infoContainerWrapper = document.getElementById('infoContainerWrapper'); 
    
    addTapAnimation(contactBtn);
    addTapAnimation(filterBtn);
    addTapAnimation(searchButton);

    searchButton.addEventListener('click', () => {
      const isActive = searchBar.classList.toggle('active');
      searchButton.classList.toggle('active', isActive);
      body.classList.toggle('search-active', isActive);
      
      if (isActive) {
        searchBar.focus();
        // infoContainerWrapper.classList.add('hidden'); // This is now handled by CSS
      } else {
        // FIX: Ensure search is fully reset when closed
        searchBar.value = '';
        searchBar.blur();
        // infoContainerWrapper.classList.remove('hidden'); // This is now handled by CSS
        filterAndRenderPanels();
      }
      saveState();
    });

    // NEW: Easter egg to show the performance button
    searchBar.addEventListener('input', () => {
        const perfBtn = document.getElementById('perfBtn');
        if (searchBar.value.toLowerCase() === 'celexo5') {
            perfBtn.style.opacity = '1';
            perfBtn.style.pointerEvents = 'auto';
            perfBtn.classList.add('jello');
            setTimeout(() => {
                perfBtn.classList.remove('jello');
            }, 800);
        }
    });

    // NEW: Add a fix for mobile keyboard behavior.
    // When the search input is focused, add a class to the body to adjust fixed element positioning.
    // REFACTOR: Implement a more robust iOS keyboard layout fix.
    searchBar.addEventListener('focus', () => {
        const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (isTouchDevice) {
            // 1. Immediately capture the current scroll position.
            const scrollY = window.scrollY;
            
            // 2. Instantly apply the scroll position as an inline style to the fixed elements.
            // This "locks" them in place *before* the browser can reflow the page due to the keyboard.
            document.querySelectorAll('.top-left-fixed-wrapper, .top-right-fixed-wrapper, .floating-buttons-container').forEach(el => {
                el.style.top = `${scrollY}px`;
            });

            // 3. Use requestAnimationFrame to apply the class change on the next paint cycle.
            // This ensures the visual transition is smooth and avoids race conditions.
            requestAnimationFrame(() => {
                document.body.classList.add('keyboard-active');
            });
        }
    });
    // When the search input is blurred, remove the class.
    searchBar.addEventListener('blur', () => {
        document.body.classList.remove('keyboard-active');
        // Clean up the inline styles when the keyboard is dismissed.
        document.querySelectorAll('.top-left-fixed-wrapper, .top-right-fixed-wrapper, .floating-buttons-container').forEach(el => {
            el.style.top = '';
        });
    });

    searchBar.addEventListener('input', filterAndRenderPanels);

    filterBtn.addEventListener('click', () => {
      showingFavorites = !showingFavorites;
      const heartSvg = filterBtn.querySelector('svg');
      if (showingFavorites) {
        heartSvg.style.fill = 'var(--heart-active)';
        document.getElementById('favorites-section').scrollIntoView({ behavior: 'smooth' });
      } else {
        heartSvg.style.fill = 'var(--heart-color)';
      }
      filterAndRenderPanels();
      updateNoFavoritesMessageState();
      saveState();
    });

    document.querySelectorAll('.favorite-btn').forEach((btn) => {
      addTapAnimation(btn);
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault(); 
        if (!anonymousUserId) {
            console.error("Anonymous User ID not set. Cannot favorite.");
            return;
        }

        const panel = btn.closest('.glass-container');
        const title = panel.querySelector('.title').dataset.originalTitle;
        const countSpan = panel.querySelector('.favorite-count');
        const storyKey = panel.dataset.storyKey;

        // --- NEW: Firebase Transaction for Likes ---
        if (window.firebaseServices) {
            const storyRef = window.firebaseServices.ref(window.firebaseServices.db, 'stories/' + storyKey);

            // Use a transaction to safely update the count and user list
            window.firebaseServices.runTransaction(storyRef, (currentData) => {
                // Initialize data if the story node doesn't exist yet
                if (!currentData) {
                    currentData = { favoritesCount: 0, favoritedBy: {} };
                }
                currentData.favoritedBy = currentData.favoritedBy || {};

                const isFavorited = currentData.favoritedBy[anonymousUserId] === true;

                if (isFavorited) { // User is un-favoriting
                    currentData.favoritesCount = (currentData.favoritesCount || 1) - 1;
                    currentData.favoritedBy[anonymousUserId] = null; // Use null to delete the key in Firebase
                } else { // User is favoriting
                    currentData.favoritesCount = (currentData.favoritesCount || 0) + 1;
                    currentData.favoritedBy[anonymousUserId] = true;
                }
                return currentData;
            });
        } else {
            console.error("Firebase not available. Cannot update favorite status.");
        }

        updateNoFavoritesMessageState();

        // Animate the count change
        countSpan.classList.remove('count-animated');
        void countSpan.offsetWidth; // Force reflow to restart animation
        countSpan.classList.add('count-animated');
      });
    });

    initializeHeartColor();
    if (searchBar.classList.contains('active') || showingFavorites) {
      filterAndRenderPanels();
    }

    // NEW: Efficient function to apply a jello animation to a grid panel on click.
    function applyJelloToGrid(panel) {
      // PERFORMANCE: Prevent re-triggering the animation if it's already running.
      if (panel.classList.contains('jello-grid')) {
        return;
      }
      panel.classList.add('jello-grid');
      // EFFICIENCY: Use 'animationend' to automatically clean up the class when the animation is done.
      panel.addEventListener('animationend', () => {
        panel.classList.remove('jello-grid');
      }, { once: true }); // The { once: true } option removes the event listener automatically.
    }

    // Add jello effect on click to each grid panel
    panels.forEach(panel => {
      // TOUCH OPTIMIZATION: Use 'pointerdown' with `{ passive: true }` for maximum responsiveness on tap.
      panel.addEventListener('pointerdown', () => applyJelloToGrid(panel), { passive: true });
    });

    const infoButton = document.getElementById('infoButton');
    const infoPanel = document.getElementById('infoPanel');
    const closeInfoButton = document.getElementById('closeInfoButton');
    addTapAnimation(infoButton);
    addTapAnimation(closeInfoButton);

    // NEW: Add shine effect element to all relevant buttons
    document.querySelectorAll('.search-button, .floating-button, .info-button').forEach(button => {
        button.classList.add('shine-button');
        button.insertAdjacentHTML('beforeend', '<div class="shine-effect"></div>');
    });

    // REFACTOR: Use IntersectionObserver for panel animations.
    let panelObserver;

    function toggleInfoPanel() {
      const isActive = infoPanel.classList.toggle('active');
      body.classList.toggle('info-panel-open', isActive);
      // FIX: Toggle the close button's visibility since it's now outside the panel.
      closeInfoButton.classList.toggle('active', isActive);
      const animItems = infoPanel.querySelectorAll('.panel-anim-item');
      
      if (isActive) {
        // Ensure panel is scrollable to the top before observing
        infoPanel.scrollTop = 0;

        panelObserver = new IntersectionObserver((entries, observer) => {
          entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
              // Add a staggered delay for a nice effect as they appear
              entry.target.style.transitionDelay = `${index * 50}ms`;
              entry.target.classList.add('in-view');
              observer.unobserve(entry.target); // Stop observing once animated
            }
          });
        }, {
          root: infoPanel, // Animate within the panel itself
          rootMargin: '0px',
          threshold: 0.1   // Trigger when 10% of the item is visible
        });

        animItems.forEach(item => panelObserver.observe(item));
      } else {
        if (panelObserver) panelObserver.disconnect();
        animItems.forEach(item => item.classList.remove('in-view'));
      }
    }

    infoButton.addEventListener('click', toggleInfoPanel);
    closeInfoButton.addEventListener('click', toggleInfoPanel);

    // FIX: Add event listener to close the panel when clicking on the background/empty space.
    infoPanel.addEventListener('click', (event) => {
      // If the click target is the panel itself (the background) and not a child element...
      if (event.target === infoPanel) {
        toggleInfoPanel(); // ...close the panel.
      }
    });

    // Initial check for Info button visibility if search was active on load (from saved state)
    if (searchBar.classList.contains('active')) {
      infoContainerWrapper.classList.add('hidden');
    }

    // OPTIMIZATION: Use passive listener for scroll events.
    window.addEventListener('scroll', () => { 
      if (document.activeElement === searchBar) {
        searchBar.blur();
      }
      // OPTIMIZATION: Update grid bounds here, outside the rAF loop, to prevent layout thrashing.
      updateGridBounds();
      ensureAnimating(); // Restart animation on scroll
      // FIX: Update the scroll-y variable for the mobile keyboard fix.
      document.documentElement.style.setProperty('--scroll-y', `${window.scrollY}px`);
    }, { passive: true });

    // New logic for the Contact and Social Media pop-ups
    const contactPanel = document.getElementById('contactPanel');
    const closeContactButton = document.getElementById('closeContactButton');
    const openSocialButton = document.getElementById('openSocialButton');
    const socialPanel = document.getElementById('socialPanel');
    const closeSocialButton = document.getElementById('closeSocialButton');
    
    addTapAnimation(contactBtn);
    addTapAnimation(closeContactButton);
    addTapAnimation(openSocialButton);
    addTapAnimation(closeSocialButton);

    const submitStoryBtn = document.getElementById('submitStoryBtn');
    const tiktokBtn = document.getElementById('tiktokBtn');
    const instagramBtn = document.getElementById('instagramBtn');
    const facebookBtn = document.getElementById('facebookBtn');
    addTapAnimation(submitStoryBtn);
    addTapAnimation(openSocialButton);
    addTapAnimation(tiktokBtn);
    addTapAnimation(instagramBtn);
    addTapAnimation(facebookBtn);

    // FIX: Refactor panel logic to handle independent close buttons and click-outside-to-close.
    function closeAllPanels() {
        contactPanel.classList.remove('active');
        socialPanel.classList.remove('active');
        body.classList.remove('info-panel-open');
        // Hide all modal-related close buttons
        closeContactButton.classList.remove('active');
        closeSocialButton.classList.remove('active');
        // NEW: Also close the series modal if it's open
        closeSeriesModal();
    }

    contactBtn.addEventListener('click', () => {
        closeAllPanels(); // Ensure no other panels are open
        contactPanel.classList.add('active');
        closeContactButton.classList.add('active');
        body.classList.add('info-panel-open');
    });

    openSocialButton.addEventListener('click', () => {
        contactPanel.classList.remove('active');
        closeContactButton.classList.remove('active');
        setTimeout(() => {
            socialPanel.classList.add('active');
            closeSocialButton.classList.add('active');
        }, 300); // Small delay to allow the first panel to fade out
    });

    // Add listeners for all close buttons
    closeContactButton.addEventListener('click', closeAllPanels);
    closeSocialButton.addEventListener('click', () => {
        closeAllPanels();
    });

    // Add listeners to close panels when clicking on the background
    contactPanel.addEventListener('click', (event) => {
      if (event.target === contactPanel) {
        closeAllPanels();
      }
    });
    socialPanel.addEventListener('click', (event) => {
      if (event.target === socialPanel) {
        closeAllPanels();
      }
    });

    // FIX: Initial call to get the animation loop started on load.
    // FIX: Initial calculation of grid bounds on load.
    updateGridBounds();
    ensureAnimating();

    // --- NEW: Series Modal Logic (re-implemented cleanly) ---
    const seriesModal = document.getElementById('seriesModal');
    const closeSeriesModalButton = document.getElementById('closeSeriesModalButton');
    const seriesModalTitle = document.getElementById('seriesModalTitle');
    const seriesPartsGrid = document.getElementById('seriesPartsGrid');

    addTapAnimation(closeSeriesModalButton);

    function openSeriesModal(seriesData) {
        closeAllPanels(); // Close any other open panels

        seriesModalTitle.textContent = seriesData.title;
        seriesPartsGrid.innerHTML = ''; // Clear previous parts

        seriesData.parts.forEach(partData => {
            partData.isPart = true; // Mark as a part to apply correct classes
            const partCard = createStoryCard(partData);
            // The cards inside the modal should not be affected by physics and have no transform.
            partCard.style.transform = 'none';
            seriesPartsGrid.appendChild(partCard);
            addTapAnimation(partCard); // Add jello effect on tap
            
            // FIX: Remove the favorite button container from cards inside the series modal.
            const favoriteContainer = partCard.querySelector('.favorite-container');
            if (favoriteContainer) {
                favoriteContainer.remove();
            }
        });

        seriesModal.classList.add('active');
        closeSeriesModalButton.classList.add('active');
        body.classList.add('info-panel-open');
    }

    function closeSeriesModal() {
        seriesModal.classList.remove('active');
        closeSeriesModalButton.classList.remove('active');
        body.classList.remove('info-panel-open');
    }

    closeSeriesModalButton.addEventListener('click', closeSeriesModal);
    seriesModal.addEventListener('click', (event) => {
        if (event.target === seriesModal) {
            closeSeriesModal();
        }
    });
  } catch (error) {
    console.error('Failed to load grid ', error);
    document.getElementById('grid').innerHTML = '<p style="color:#fff;">Failed to load stories. Check that stories.json exists.</p>';
  }
}

function animateButtonsOnLoad() {
    const searchButton = document.getElementById('searchButton');
    const filterBtn = document.getElementById('filterBtn');
    const contactBtn = document.getElementById('contactBtn');
    const infoButton = document.getElementById('infoButton');
    const perfBtn = document.getElementById('perfBtn'); // FIX: Get the new performance button
    const buttonsToAnimate = [infoButton, searchButton, filterBtn, contactBtn]; // FIX: Remove perfBtn from default animation
    buttonsToAnimate.forEach((button, i) => {
    // REFACTOR: Add a staggered fade-in effect similar to the grid cards.
    setTimeout(() => {
      button.style.opacity = '1';
      // FIX: Remove inline transform. CSS will now handle the initial state and animation.
      button.classList.add('jello');
      setTimeout(() => {
        button.classList.remove('jello');
      }, 800); // Remove jello class after animation
    }, i * 150 + 200); // Stagger the animation start time
    });

    // NEW: Logic for the performance button
    if (perfBtn) {
        addTapAnimation(perfBtn);
        perfBtn.addEventListener('click', () => {
            // REFACTOR: Simplify to toggle between level 1 and 2.
            let nextLevel = performanceLevel === 1 ? 2 : 1;
            console.log(`Manually setting Performance Level to: ${nextLevel}`);

            // Store the manual override in sessionStorage so it persists on the story pages.
            sessionStorage.setItem('manualPerformanceLevel', nextLevel);

            // Re-initialize the page to apply the new setting and rebuild the grid.
            isInitialized = false;
            // FIX: Pass the new level directly to initializePage to avoid race conditions.
            // This also requires rebuilding the grid after initialization.
            initializePage(nextLevel).then(() => {
                fetchAndBuildGrid();
            });
        });
    }
}

function setupScrollPerformance() {
  let scrollTimeout;
  const body = document.body;

  window.addEventListener('scroll', () => {
    body.classList.add('is-scrolling');
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      body.classList.remove('is-scrolling');
    }, 150); // Adjust timeout as needed
  }, { passive: true });
}

/**
 * Checks if the browser truly supports SVG filters in backdrop-filter.
 * iOS Safari incorrectly reports 'true' for CSS @supports, so a JS check is more reliable.
 * We will explicitly block Apple mobile devices from getting this feature to avoid the bug.
 * If supported, it adds a class to the body to enable enhanced filters via CSS.
 */
function detectSVGFilterSupport() {
  // FIX: Explicitly block Apple devices from getting the SVG filter to prevent rendering bugs.
  // The 'vendor' property is a reliable way to detect Safari on both macOS and iOS.
  const isApple = /Apple/.test(navigator.vendor);

  // Only apply the SVG filter if the browser supports it AND it's not an Apple device.
  if (!isApple && CSS.supports('backdrop-filter', 'url("#filter-hq")')) {
      document.body.classList.add('svg-filter-supported');
  }
}

/**
 * Shows a tutorial panel on the user's first visit.
 * Uses localStorage to track if the tutorial has been seen.
 */
function showTutorialOnFirstVisit() {
  const hasVisited = localStorage.getItem('hasVisitedBefore');
  if (hasVisited) {
    return; // Don't show tutorial if they've visited
  }

  const tutorialPanel = document.getElementById('tutorialPanel');
  const startButton = document.getElementById('tutorialStartButton');

  // Add tap animation to the start button
  addTapAnimation(startButton);

  // FIX: Set a staggered transition delay and add the 'in-view' class to trigger the animation.
  const animItems = tutorialPanel.querySelectorAll('.panel-anim-item');
  animItems.forEach((item, index) => {
    item.style.transitionDelay = `${index * 50}ms`;
    item.classList.add('in-view'); // This makes the item visible and starts the transition.
  });

  tutorialPanel.classList.add('active');
  document.body.classList.add('info-panel-open');

  function closeTutorial() {
    tutorialPanel.classList.remove('active');
    document.body.classList.remove('info-panel-open');
    localStorage.setItem('hasVisitedBefore', 'true');
    // FIX: Smoothly scroll to the main grid after closing the tutorial.
    // This moves focus away from the bottom of the screen, preventing the button
    // from being hidden by the browser's UI on mobile.
    document.getElementById('grid').scrollIntoView({ behavior: 'smooth' });
  }

  startButton.addEventListener('click', closeTutorial, { once: true });
}

// --- NEW: Dynamic Background Changer ---
function changeBackground() {
  if (backgroundSets.length === 0) return;

  const randomIndex = Math.floor(Math.random() * backgroundSets.length);
  const selectedSet = backgroundSets[randomIndex];

  const styleElement = document.getElementById('dynamic-styles') || document.createElement('style');
  styleElement.id = 'dynamic-styles';
  styleElement.innerHTML = `
    :root {
      --bg-url: url("${selectedSet.light.url}");
      --bg-url-dark: url("${selectedSet.dark.url}");
    }
  `;
  document.head.appendChild(styleElement);
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

async function initializeUser() {
    // Revert to simple localStorage-based anonymous user ID
    anonymousUserId = localStorage.getItem('anonymousUserId');
    if (!anonymousUserId) {
        anonymousUserId = 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('anonymousUserId', anonymousUserId);
    }
    console.log("Anonymous User ID:", anonymousUserId);
    // FIX: Expose the user ID on the window object so it can be picked up by other scripts (like on the story pages).
    window.anonymousUserId = anonymousUserId;
}

let isInitialized = false; // FIX: Add a flag to prevent double initialization.
async function initializePage(manualLevelOverride = null) {
    if (isInitialized) return; // Prevent this from running more than once.
    isInitialized = true;

    // FIX: If a manual level is passed from the button click, use it directly.
    // Otherwise, check sessionStorage (for reloads) or run the benchmark.
    if (manualLevelOverride) {
        performanceLevel = manualLevelOverride;
        console.log(`Applying manually selected Performance Level: ${performanceLevel}`);
    } else {
        // FIX: On a normal page load, clear any manual setting from other pages to force a fresh benchmark.
        // This prevents the back-forward cache on iOS from incorrectly applying a level set on a story page.
        sessionStorage.removeItem('manualPerformanceLevel'); 
        const sessionLevel = sessionStorage.getItem('manualPerformanceLevel');
        if (sessionLevel) {
            performanceLevel = parseInt(sessionLevel, 10);
            console.log(`Using manually set Performance Level from session: ${performanceLevel}`);
        } else {
            performanceLevel = await determinePerformanceLevel();
        }
    }
    applyPerformanceStyles(performanceLevel);

    if (performanceLevel === 2) detectSVGFilterSupport();

    // FIX: Initialize the user ID *before* fetching the grid.
    await initializeUser();

    const loadingScreen = document.getElementById('loadingScreen');
    animateButtonsOnLoad();

    // Preload the current background images
    const bgLight = getComputedStyle(document.documentElement).getPropertyValue('--bg-url').replace(/url\(['"]?([^'"]+)['"]?\)/, '$1').trim();
    const bgDark = getComputedStyle(document.documentElement).getPropertyValue('--bg-url-dark').replace(/url\(['"]?([^'"]+)['"]?\)/, '$1').trim();
    const imagesToPreload = [bgLight, bgDark].filter(url => url && url.startsWith('http'));

    if (imagesToPreload.length > 0) {
      await Promise.all(imagesToPreload.map(url => new Promise((resolve) => {
        const img = new Image();
        img.onload = img.onerror = resolve;
        img.src = url;
      })));
    }

    // Once images are preloaded, hide loading screen and build grid
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
      setupScrollPerformance();
      setTimeout(() => {
        fetchAndBuildGrid(); // This will now handle showing the tutorial internally.
      }, 500);
    }, 500); // FIX: Added missing duration and closing parenthesis
};

async function loadDataAndInitialize() {
    try {
        const response = await fetch('backgrounds.json');
        backgroundSets = await response.json();
    } catch (error) {
        console.error("Failed to load backgrounds.json:", error);
    }
    initializePage();
}

document.addEventListener('DOMContentLoaded', loadDataAndInitialize);

// FIX: Use the 'pageshow' event to handle back/forward cache navigations.
window.addEventListener('pageshow', function(event) {
  // If the page is being loaded from the bfcache, event.persisted will be true.
  // REFACTOR: On bfcache restore, we should NOT re-run the performance benchmark.
  // The browser state is not reliable for an accurate benchmark in this case.
  // We will only re-initialize parts of the UI that need refreshing, like animations.
  if (event.persisted) {
    console.log("Page restored from bfcache. Skipping performance check.");
    // Re-trigger animations and ensure the UI is responsive without a full reload.
    updateGridBounds();
    ensureAnimating();
  }
});
