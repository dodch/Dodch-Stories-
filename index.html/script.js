// Disable right-click menu
document.addEventListener('contextmenu', event => event.preventDefault());

// Global variables to store data and grid elements
let panels = [];
let allStories = [];
let showingFavorites = false;
const body = document.body;

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
  const savedShowingFavorites = localStorage.getItem('showingFavorites');
  const savedSearchValue = localStorage.getItem('searchValue');
  const savedFavorites = JSON.parse(localStorage.getItem('favorites') || '[]');
  showingFavorites = savedShowingFavorites === 'true';
  if (showingFavorites) {
    document.getElementById('filterBtn').classList.add('active');
  }
  const searchBar = document.getElementById('searchInput');
  if (savedSearchValue) {
    searchBar.value = savedSearchValue;
  }
  if (savedFavorites.length > 0) {
    panels.forEach((panel) => {
      const title = panel.querySelector('.title').dataset.originalTitle;
      if (savedFavorites.includes(title)) {
        panel.querySelector('.favorite-btn').classList.add('active');
        panel.classList.add('favorited');
      }
    });
  }
}

function saveState() {
  const searchBar = document.getElementById('searchInput');
  localStorage.setItem('showingFavorites', showingFavorites);
  localStorage.setItem('searchValue', searchBar.value);
  const favoriteTitles = [];
  document.querySelectorAll('.glass-container .favorite-btn.active').forEach(btn => {
    const panel = btn.closest('.glass-container');
    const title = panel.querySelector('.title').dataset.originalTitle;
    favoriteTitles.push(title);
  });
  localStorage.setItem('favorites', JSON.stringify(favoriteTitles));
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
    storiesData.forEach(story => {
      const card = document.createElement('a');
      card.className = "glass-container";
      card.href = (story.path || '') + story.file; // Combine path and file for the correct link
      if (!story.file || story.file.trim() === '') {
          card.classList.add('no-link');
          card.removeAttribute('href');
      }
      card.innerHTML = `
        <div class="glass-content">
          <h3 class="title" data-original-title="${story.title}">${story.title}</h3>
          <p class="description" data-original-description="${story.description}">${story.description}</p>
        </div>
        <span class="story-length">${story.length}</span>
        <span class="creation-date">${story.date}</span>
        <p class="story-creator">made by ${story.creator}</p>
        <div class="favorite-btn glass-button-base">
          <svg viewBox="0 0 24 24">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 
            4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 
            3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </div>
      `;
      const status = story.status ? story.status : '';
      const statusColor = story.status_color ? story.status_color.toLowerCase() : '';
      if (status) {
          const newPill = document.createElement('span');
          newPill.className = "new-pill";
          newPill.textContent = status;
          if (statusColor.includes('red')) {
              newPill.classList.add('red');
          } else if (statusColor.includes('purple')) {
              newPill.classList.add('purple');
          } else if (statusColor.includes('golden')) {
              newPill.classList.add('golden');
          }
          card.appendChild(newPill);
      }
      grid.appendChild(card);
    });
    panels = [...document.querySelectorAll('.glass-container')];

    // Load saved state *after* panels are created in the DOM
    loadSavedState();

    // --- PERFORMANCE OPTIMIZATION: Use a Map for direct state lookup ---
    // This is much faster than using an array and indexOf.
    const state = new Map();
    panels.forEach(card => {
      state.set(card, {
        scaleX: 0.1, scaleY: 0.1,
        vx: 0, vy: 0,
        rotX: 0, rotY: 0,
        vrX: 0, vrY: 0,
        damping: 0.65 + Math.random() * 0.15
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

    window.addEventListener('resize', updateCardStaticProps); // Recalculate on resize

    panels.forEach((card, i) => {
        setTimeout(() => {
            const s = state.get(card);
            if (s) { // Ensure state exists before using it
              const impulse = 0.5 + Math.random() * 0.2;
              s.vy -= impulse; 
              s.vx -= (0.1 + Math.random() * 0.1);
            }
        }, i * 50);
    });

    let lastScroll = window.scrollY;
    let lastTime = performance.now();
    let pointer = { x: -9999, y: -9999 };
    let gridBounds = { top: 0, bottom: 0 }; // To cache grid position
    let isAnimating = true; // Control the animation loop
    let canStopAnimating = false; // Prevent animation from stopping too early on load

    function frame(now) {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const scrollY = window.scrollY;
      let delta = scrollY - lastScroll;
      lastScroll = scrollY;

      // --- PERFORMANCE FIX: Clamp delta to prevent jumps on sudden scrolls ---
      // This prevents the animation from overreacting to extreme scroll gestures.
      delta = clamp(delta, -150, 150);

      const vh = window.innerHeight;
      const center = scrollY + vh / 2;

      // --- PERFORMANCE OPTIMIZATION: Only do expensive hover math if pointer is near the grid ---
      // Update grid bounds only occasionally to avoid DOM reads every frame.
      if (now % 100 < 16) { // Roughly every 100ms
        const gridRect = document.getElementById('grid').getBoundingClientRect();
        gridBounds.top = gridRect.top;
        gridBounds.bottom = gridRect.bottom;
      }
      const isPointerNearGrid = pointer.y > gridBounds.top - 200 && pointer.y < gridBounds.bottom + 200;

      // --- EXTREME SMOOTHNESS: Lean animation loop ---
      let totalVelocity = 0;
      visiblePanels.forEach((card) => {
        const s = state.get(card);
        if (!s) return; // Skip if state is missing

        // Use pre-calculated offsetTop instead of getBoundingClientRect()
        const cardCenter = s.offsetTop + s.height / 2;
        const distFromCenter = Math.abs(cardCenter - center);

        // Only calculate physics if the card is reasonably close to the viewport center
        if (distFromCenter < vh) {
          const dist = distFromCenter / vh;
          // --- FIX: Reduce upward scroll stretching to prevent lag ---
          // We'll keep the scroll effect but make it less intense when scrolling up (negative delta).
          // This prevents the "jank" you see when scrolling to the top.
          const impulseMultiplier = delta < 0 ? 0.008 : 0.015; // Use a smaller multiplier for upward scroll
          const scrollImpulse = delta * impulseMultiplier * (1 - dist);

          const targetScaleYScroll = 1 - scrollImpulse;
          const targetScaleXScroll = 1 + scrollImpulse * 0.7;

          let influence = 0;
          if (isPointerNearGrid) {
              // --- PERFORMANCE FIX: Calculate pointer distance without getBoundingClientRect ---
              const dx = pointer.x - (s.offsetLeft + s.width / 2.0);
              const dy = pointer.y - (s.offsetTop - scrollY + s.height / 2.0);
              const pointerDist = Math.sqrt(dx * dx + dy * dy);
              influence = Math.max(0, 1 - pointerDist / 275); // Increased influence radius slightly
          }

          const targetScaleX = (targetScaleXScroll + (1 + 0.05 * influence)) / 2;
          const targetScaleY = (targetScaleYScroll + (1 + 0.05 * influence)) / 2;
          const d = s.damping;

          s.vx += (targetScaleX - s.scaleX) * 0.18; s.vx *= d; s.scaleX += s.vx; // Increased springiness
          s.vy += (targetScaleY - s.scaleY) * 0.18; s.vy *= d; s.scaleY += s.vy; // Increased springiness
          s.vrX += (0 - s.rotX) * 0.18; s.vrX *= d; s.rotX += s.vrX; // Increased springiness
          s.vrY += (0 - s.rotY) * 0.18; s.vrY *= d; s.rotY += s.vrY; // Increased springiness

          totalVelocity += Math.abs(s.vx) + Math.abs(s.vy) + Math.abs(s.vrX) + Math.abs(s.vrY);

          // --- PERFORMANCE FIX: Clamp scale to prevent card overlap ---
          // This prevents overlapping backdrop-filters which is very expensive to render.
          const finalScaleX = clamp(s.scaleX, 0.8, 1.15);
          const finalScaleY = clamp(s.scaleY, 0.8, 1.15);
          card.style.transform = `scaleX(${finalScaleX}) scaleY(${finalScaleY}) rotateX(${s.rotX}deg) rotateY(${s.rotY}deg)`;
        }
      });

      // Smartly continue or stop the animation loop
      if (canStopAnimating && totalVelocity < 0.001 && delta === 0 && !isPointerNearGrid) {
        isAnimating = false;
      } else {
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
        if (entry.isIntersecting) {
          visiblePanels.add(entry.target);
        } else {
          visiblePanels.delete(entry.target);
          // Reset transform for off-screen elements to be clean
          entry.target.style.transform = 'scale(1) rotateX(0deg) rotateY(0deg)';
        }
      });
    }, {
      rootMargin: '200px 0px 200px 0px' // Start animating cards 200px before they enter the screen
    });
    panels.forEach(card => observer.observe(card));

    // --- Smart Animation Triggering: Only run the loop when needed ---
    function ensureAnimating() {
      if (!isAnimating) {
        isAnimating = true;
        requestAnimationFrame(frame);
      }
    }

    // Add a listener to update the pointer coordinates for the hover effect
    window.addEventListener('pointermove', e => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        ensureAnimating();
    });
    window.addEventListener('pointerleave', () => { pointer.x = -9999; pointer.y = -9999; ensureAnimating(); });
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
      
      if (isActive) {
        searchBar.focus();
        infoContainerWrapper.classList.add('hidden'); 
      } else {
        // FIX: Ensure search is fully reset when closed
        searchBar.value = '';
        searchBar.blur();
        infoContainerWrapper.classList.remove('hidden'); 
        filterAndRenderPanels();
      }
      saveState();
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
        const panel = btn.closest('.glass-container');
        btn.classList.toggle('active');
        panel.classList.toggle('favorited');
        btn.setAttribute('aria-pressed', btn.classList.contains('active'));
        filterAndRenderPanels();
      });
    });

    initializeHeartColor();
    if (searchBar.classList.contains('active') || showingFavorites) {
      filterAndRenderPanels();
    }

    // Add jello effect on click to each grid panel
    panels.forEach(panel => {
      // We use 'pointerdown' as it feels more responsive than 'click'
      panel.addEventListener('pointerdown', () => applyJelloToGrid(panel));
    });

    const infoButton = document.getElementById('infoButton');
    const infoPanel = document.getElementById('infoPanel');
    const closeInfoButton = document.getElementById('closeInfoButton');
    addTapAnimation(infoButton);
    addTapAnimation(closeInfoButton);
    
    function toggleInfoPanel() {
      infoPanel.classList.toggle('active');
      body.classList.toggle('info-panel-open');
    }

    infoButton.addEventListener('click', toggleInfoPanel);
    closeInfoButton.addEventListener('click', toggleInfoPanel);

    // Initial check for Info button visibility if search was active on load (from saved state)
    if (searchBar.classList.contains('active')) {
      infoContainerWrapper.classList.add('hidden');
    }

    window.addEventListener('scroll', () => {
      if (document.activeElement === searchBar) {
        searchBar.blur();
      }
      ensureAnimating(); // Restart animation on scroll
    });

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

    function closeAllPanels() {
        contactPanel.classList.remove('active');
        socialPanel.classList.remove('active');
        body.classList.remove('info-panel-open');
    }

    contactBtn.addEventListener('click', () => {
        contactPanel.classList.add('active');
        body.classList.add('info-panel-open');
    });

    closeContactButton.addEventListener('click', () => {
        closeAllPanels();
    });

    openSocialButton.addEventListener('click', () => {
        contactPanel.classList.remove('active');
        setTimeout(() => {
            socialPanel.classList.add('active');
        }, 300); // Small delay to allow the first panel to fade out
    });

    closeSocialButton.addEventListener('click', () => {
        closeAllPanels();
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
    const buttonsToAnimate = [infoButton, searchButton, filterBtn, contactBtn];
    buttonsToAnimate.forEach((button, i) => {
      setTimeout(() => {
        button.classList.add('jello');
        setTimeout(() => {
          button.classList.remove('jello');
        }, 800);
      }, i * 200 + 100);
    });
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
  const isAppleDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  // If it's an Apple mobile device, do nothing. This prevents the bug.
  if (isAppleDevice) {
    return;
  }

  // For all other browsers, perform the feature check.
  if (CSS.supports('backdrop-filter', 'url("#filter-hq")')) {
    document.body.classList.add('svg-filter-supported');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  detectSVGFilterSupport(); // Check for real SVG filter support
  const loadingScreen = document.getElementById('loadingScreen');
  const bgImageUrlLight = getComputedStyle(document.documentElement).getPropertyValue('--bg-url').replace(/url\(['"]?([^'"]+)['"]?\)/, '$1').trim();
  const bgImageUrlDark = getComputedStyle(document.documentElement).getPropertyValue('--bg-url-dark').replace(/url\(['"]?([^'"]+)['"]?\)/, '$1').trim();
  const imagesToLoad = [];
  
  if (bgImageUrlLight && bgImageUrlLight.startsWith('http')) imagesToLoad.push(bgImageUrlLight);
  if (bgImageUrlDark && bgImageUrlDark.startsWith('http')) imagesToLoad.push(bgImageUrlDark);
  
  let imagesLoadedCount = 0;
  animateButtonsOnLoad();

  if (imagesToLoad.length > 0) {
    imagesToLoad.forEach(url => {
      const img = new Image();
      img.onload = img.onerror = () => {
        imagesLoadedCount++;
        if (imagesLoadedCount === imagesToLoad.length) {
          loadingScreen.classList.add('hidden');
          setupScrollPerformance();
          setTimeout(() => {
            fetchAndBuildGrid();
          }, 500);
        }
      };
      img.src = url;
    });
  } else {
    loadingScreen.classList.add('hidden');
    setupScrollPerformance();
    setTimeout(() => {
      fetchAndBuildGrid();
    }, 500);
  }
});
