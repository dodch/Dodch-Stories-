/***************************************************************************************************
 *                                   ** DO NOT COPY - ALL RIGHTS RESERVED **
 *
 * This code is the exclusive property of Dodch Stories and its owner. Unauthorized copying,
 * reproduction, modification, distribution, or any form of use of this code, in whole or in part,
 * is strictly prohibited.
 *
 * Copyright (c) 2024 Dodch Stories. All rights reserved.
 ***************************************************************************************************/

/**
 * This is a shared initialization script used by all pages on the site.
 * It handles critical, pre-render tasks like security, theme detection, and background loading.
 */
(function() {
    'use strict';

    // --- 1. PREVENT FLASH OF INCORRECT THEME (FOIT) ---
    // Checks user's OS preference and applies dark-mode class to <html> before rendering.
    try {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark-mode');
        }
    } catch (e) {
        console.error("Error applying initial theme:", e);
    }

    // --- 3. UNIFIED ANTI-INSPECTION SECURITY ---
    const devToolsActive = () => {
        // Blank the page to prevent inspection.
        window.location.reload(); // Use reload for consistency with the working story pages.
    };

    const securityCheck = () => {
        const start = performance.now();
        debugger;
        const end = performance.now();
        if (end - start > 160) devToolsActive(); // Threshold from working scripts.
    };

    // Block right-click and common DevTools shortcuts
    document.addEventListener('contextmenu', event => event.preventDefault());
    window.addEventListener('keydown', e => {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || (e.ctrlKey && e.key === 'U')) {
            devToolsActive();
        }
    });

    // Run the debugger check on a fast interval, matching the working story pages.
    setInterval(securityCheck, 250);

})();