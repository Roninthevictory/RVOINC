// Firebase V11 Modular Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    getRedirectResult,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// Import firestore is not needed as data is static for this example, but keep the auth setup.

// ----------------------------------------------------------------------
// CRITICAL FIX: HARDCODING FIREBASE CONFIG FOR GOOGLE SITES EMBEDS
// ----------------------------------------------------------------------
const FIREBASE_CONFIG = {
    // FIREBASE CONFIGURATION PROVIDED BY USER (Placeholder/Fallback):
    apiKey: "AIzaSyATMtyx9nuwIcv-OWODFIQA4NOtDzqTqJc",
    authDomain: "rvoincwebsite.firebaseapp.com",
    projectId: "rvoincwebsite",
    storageBucket: "rvoincwebsite.firebasestorage.app",
    messagingSenderId: "675340459793",
    appId: "1:675340459793:web:89dd0ecce1f1c3ee1336b0"
};

// Toggle visibility for sections directly from this configuration object
const SECTION_CONFIG = {
    home: true,
    services: true,
    subscriptions: true,
    "digital-design": true,
    "graphic-design": true,
    affiliates: true,
    "tech-partners": true,
    "business-partners": true,
    "important-links": true,
    "services-coming-soon": true,
    "not-found": true
};

// This logic ensures we use the canvas global if available, but falls back to the hardcoded config
const firebaseConfig = (() => {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
        try {
            // This block is used in the Canvas environment
            return JSON.parse(__firebase_config);
        } catch (e) {
            console.error("Failed to parse __firebase_config, using hardcoded config.");
        }
    }
    // This block is used when embedded outside of Canvas (like Google Sites)
    if (FIREBASE_CONFIG.apiKey.startsWith("AIzaSyA")) {
        console.warn("Using placeholder Firebase config. Authentication will work but only if you replace the API key with your actual one.");
    }
    return FIREBASE_CONFIG;
})();

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
// ----------------------------------------------------------------------

let app = null;
let auth = null;
let isLoggedIn = false;
let currentUser = null;
let isFirebaseReady = false; // Flag to check if Firebase auth has completed its initial check

// DOM elements
const authModal = document.getElementById('auth-modal');
const authStatusBtn = document.getElementById('auth-status-btn');
const logoutBtn = document.getElementById('logout-btn');
const authTitle = document.getElementById('auth-title');
const authSubmitBtn = document.getElementById('auth-submit');
const authToggleBtn = document.getElementById('auth-toggle');
const authErrorDiv = document.getElementById('auth-error');

let isSigningUp = false;

// Function to set up Firebase and perform initial authentication
async function setupFirebase() {
    if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("AIzaSyA")) {
        console.warn("Firebase configuration is potentially incomplete. Auth will proceed with caution.");
    }

    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);

        // --- 1. HANDLE REDIRECT RESULT (for Google Auth) ---
        const result = await getRedirectResult(auth);
        if (result) {
            console.log("SUCCESS: User returned after Google redirect sign-in:", result.user.email);
            hideAuthModal();
        }

        // Initial sign-in with custom token or anonymously
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken).catch(e => console.error("Custom token sign-in failed:", e));
        } else {
            await signInAnonymously(auth).catch(e => console.error("Anonymous sign-in failed:", e));
        }

        // Set up Auth State Listener (Modular V11 syntax)
        onAuthStateChanged(auth, (user) => {
            isLoggedIn = !!user && !user.isAnonymous; // Consider only non-anonymous users as 'logged in' for full site features
            currentUser = user;
            isFirebaseReady = true; // Auth check completed
            updateUIForAuthState();
            // CRITICAL: Re-render dynamic content (buttons) on auth state change
            renderServices(allServices);
            renderSubscriptions(subscriptionPlans);
            console.log("Firebase Auth State Changed. User is logged in:", isLoggedIn);
        });

    } catch (error) {
        console.error("CRITICAL ERROR: Firebase initialization or initial sign-in failed:", error);
        isFirebaseReady = true;
    }
}

// --------------------------------------------------------------------------------
// UI AND AUTHENTICATION HANDLERS
// --------------------------------------------------------------------------------

function updateUIForAuthState() {
    authStatusBtn.classList.remove('hidden'); // Always show the general button
    authStatusBtn.onclick = null;

    if (isLoggedIn) {
        // User is authenticated (Email/Google)
        authStatusBtn.textContent = currentUser.email ? currentUser.email.split('@')[0] : 'Profile';
        authStatusBtn.classList.remove('glow-button', 'text-white');
        authStatusBtn.classList.add('card-bg', 'border', 'border-gray-700', 'text-gray-200');
        authStatusBtn.onclick = () => navigateTo('subscriptions'); // Example: Go to profile/subscriptions
        logoutBtn.classList.remove('hidden');
    } else {
        // User is anonymous or logged out
        authStatusBtn.textContent = 'Sign In';
        authStatusBtn.classList.remove('card-bg', 'border', 'border-gray-700', 'text-gray-200');
        authStatusBtn.classList.add('glow-button', 'text-white');
        authStatusBtn.onclick = showAuthModal;
        logoutBtn.classList.add('hidden');
    }
}

function showAuthModal(initialError = null) {
    authModal.classList.remove('hidden');
    // Ensure the modal starts in Sign In mode
    isSigningUp = false;
    updateAuthModalUI();
    // Clear general error when modal opens
    authErrorDiv.textContent = '';
    authErrorDiv.classList.remove('text-green-500');
    authErrorDiv.classList.add('text-red-500');

    if (initialError) {
        authErrorDiv.textContent = initialError;
        authErrorDiv.classList.remove('hidden');
    } else {
        authErrorDiv.classList.add('hidden');
    }
}

function hideAuthModal() {
    authModal.classList.add('hidden');
}

function updateAuthModalUI() {
    authTitle.textContent = isSigningUp ? 'Sign Up' : 'Sign In';
    authSubmitBtn.textContent = isSigningUp ? 'Create Account' : 'Sign In';
    authToggleBtn.textContent = isSigningUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up";
}

async function handleAuthAction() {
    if (!auth) {
        showAuthError("Firebase is not initialized.");
        return;
    }

    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    authErrorDiv.classList.add('hidden');

    if (!email || !password) {
        showAuthError("Please enter both email and password.");
        return;
    }

    try {
        if (isSigningUp) {
            await createUserWithEmailAndPassword(auth, email, password);
            console.log("Account created and signed in successfully.");
        } else {
            await signInWithEmailAndPassword(auth, email, password);
            console.log("Signed in successfully.");
        }
        hideAuthModal();
    } catch (error) {
        let errorMessage = error.message;
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'This email is already in use. Try signing in.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'The email address is not valid.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password should be at least 6 characters.';
        } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = 'Invalid email or password.';
        }
        showAuthError(errorMessage);
    }
}

async function handleGoogleSignIn() {
    if (!auth) {
        showAuthError("Firebase is not initialized.");
        return;
    }
    try {
        const provider = new GoogleAuthProvider();
        // Since the environment is an iframe, using signInWithPopup is safer than redirect.
        await signInWithPopup(auth, provider);
        hideAuthModal();
        console.log("Signed in with Google successfully.");
    } catch (error) {
        console.error("Google sign-in failed:", error);
        showAuthError("Google Sign-In failed. Please try again.");
    }
}

async function handleSignOut() {
    if (auth) {
        try {
            await signOut(auth);
            // Sign in anonymously again to maintain session context
            await signInAnonymously(auth);
            console.log("Signed out and switched to anonymous.");
            navigateTo('home');
        } catch (error) {
            console.error("Sign out failed:", error);
        }
    }
}

function showAuthError(message) {
    authErrorDiv.textContent = message;
    authErrorDiv.classList.remove('hidden');
}

// --------------------------------------------------------------------------------
// PURCHASE & SUBSCRIPTION HANDLERS
// --------------------------------------------------------------------------------

/**
 * Unified handler for service action buttons (Buy Now or Get Quote)
 */
function handleServiceActionUnified(event) {
    const button = event.currentTarget;
    const actionType = button.getAttribute('data-action-type');
    const serviceName = button.getAttribute('data-service-name');
    const stripeLink = button.getAttribute('data-link');

    if (!isLoggedIn) {
        showAuthModal("Please sign in to proceed with this service.");
        return;
    }

    if (actionType === 'purchase' && stripeLink) {
        // Redirect to Stripe checkout
        window.open(stripeLink, '_blank');
    } else if (actionType === 'quote') {
        // Handle quote request (could open a contact form or modal)
        alert(`Quote requested for: ${serviceName}\n\nPlease contact us via email or our contact form to discuss your project requirements.`);
    }
}

/**
 * Handler for subscription plan purchase buttons
 */
function handleSubscriptionAttempt(event) {
    const button = event.currentTarget;
    const planName = button.getAttribute('data-plan-name');
    const stripeLink = button.getAttribute('data-link');

    if (!isLoggedIn) {
        showAuthModal("Please sign in to subscribe to a plan.");
        return;
    }

    if (stripeLink) {
        // Redirect to Stripe checkout
        window.open(stripeLink, '_blank');
    } else {
        alert(`Starting ${planName} subscription...\n\nPlease contact us to complete your subscription setup.`);
    }
}

// --------------------------------------------------------------------------------
// VIEW SWITCHING LOGIC (Multipage Simulation)
// --------------------------------------------------------------------------------

function isSectionEnabled(sectionId) {
    if (!sectionId) return false;
    if (Object.prototype.hasOwnProperty.call(SECTION_CONFIG, sectionId)) {
        return SECTION_CONFIG[sectionId];
    }
    return true;
}

function applySectionConfiguration() {
    Object.entries(SECTION_CONFIG).forEach(([sectionId, isEnabled]) => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.dataset.enabled = String(isEnabled);
            if (!isEnabled) {
                section.classList.add('hidden');
            }
        }
    });

    document.querySelectorAll('[data-target]').forEach(element => {
        const targetId = element.getAttribute('data-target');
        if (isSectionEnabled(targetId)) {
            element.classList.remove('hidden');
            element.removeAttribute('disabled');
            element.setAttribute('aria-hidden', 'false');
        } else {
            element.classList.add('hidden');
            element.setAttribute('disabled', 'true');
            element.setAttribute('aria-hidden', 'true');
        }
    });
}

/**
 * Switches the displayed content section and updates the active navigation link.
 * @param {string} targetId - The ID of the section to display (e.g., 'home', 'services').
 */
function navigateTo(targetId) {
    // 1. Hide all content sections before showing the requested view
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });

    const targetSection = document.getElementById(targetId);
    const mainElement = document.querySelector('main');
    const sectionAllowed = isSectionEnabled(targetId);

    let resolvedTarget = targetId;

    if (targetSection && sectionAllowed) {
        targetSection.classList.remove('hidden');
        if (mainElement) {
            mainElement.scrollTo({ top: 0, behavior: 'smooth' });
        }
    } else {
        resolvedTarget = 'not-found';
        const fallbackSection = document.getElementById('not-found');
        if (fallbackSection && isSectionEnabled('not-found')) {
            fallbackSection.classList.remove('hidden');
            if (mainElement) {
                mainElement.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
        console.warn(`Attempted to navigate to unknown page ID: ${targetId}`);
    }

    // 3. Update active state of navigation links
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('data-target') === resolvedTarget) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Close mobile menu if open
    const mobileMenu = document.getElementById('mobile-menu');
    if (!mobileMenu.classList.contains('hidden')) {
        mobileMenu.classList.add('hidden');
    }
}

// --------------------------------------------------------------------------------
// DATA STRUCTURES (EXPANDED CODING SERVICES WITH STRIPE LINKS)
// --------------------------------------------------------------------------------

// UPDATED: Added stripeLink to all fixed-price services
const allServices = [
    // --- Web Frontend ---
    { id: 1, name: "Responsive Static Website", description: "Full implementation of a modern, fast static site using HTML/CSS/JS.", category: "Web Frontend", tags: ["HTML", "CSS", "JavaScript", "Frontend", "Static"], icon: "monitor", price: "$29.99", stripeLink: "https://buy.stripe.com/cNicN52L06H6cMveTk9EI1D" },
    { id: 2, name: "React Component Development", description: "Building reusable, optimized components with React and functional hooks.", category: "Web Frontend", tags: ["React", "JavaScript", "Frontend", "Components"], icon: "layout-grid", price: "$35.00", stripeLink: "https://buy.stripe.com/6oUbJ1gBQ6H65k34eG9EI1B" },
    { id: 3, name: "Angular Module Development", description: "Developing structured modules and components using the Angular framework.", category: "Web Frontend", tags: ["Angular", "TypeScript", "Modules", "Frontend"], icon: "git-fork", price: "$25.00", stripeLink: "https://buy.stripe.com/aFa7sL0CSaXm5k326y9EI1C" },
    { id: 4, name: "Tailwind CSS Integration", description: "Implementing utility-first styling for rapid, responsive UI design.", category: "Web Frontend", tags: ["Tailwind", "CSS", "Frontend", "Styling"], icon: "palette", price: "$15.00", stripeLink: "https://buy.stripe.com/28EfZh71gaXm7sb7qS9EI1A" },
    { id: 5, name: "State Management Implementation (Redux/Zustand)", description: "Setting up efficient, predictable state management solutions.", category: "Web Frontend", tags: ["Redux", "Zustand", "React", "State Management"], icon: "pocket", price: "$50.00", stripeLink: "https://buy.stripe.com/28E9ATfxMfdC6o726y9EI1z" },
    { id: 6, name: "Progressive Web App (PWA) Setup", description: "Enabling offline capabilities and installability for web applications.", category: "Web Frontend", tags: ["PWA", "Web App", "Offline", "Frontend"], icon: "smartphone", price: "$100.00", stripeLink: "https://buy.stripe.com/5kQ3cv99o8PeeUDdPg9EI1y" },
    { id: 7, name: "Custom JavaScript Utility Libraries", description: "Writing modular, highly optimized vanilla JavaScript functions.", category: "Web Frontend", tags: ["JavaScript", "Library", "Optimization"], icon: "activity", price: "$50.00", stripeLink: "https://buy.stripe.com/5kQ00jbhw8PefYHbH89EI1x" },
    { id: 8, name: "Web Accessibility (A11y) Audit & Fixes", description: "Ensuring WCAG compliance for an inclusive user experience.", category: "Web Frontend", tags: ["Accessibility", "A11y", "Frontend", "WCAG"], icon: "eye", price: "$199.00", stripeLink: "https://buy.stripe.com/eVq5kDetI2qQaEnfXo9EI1w" },
    { id: 9, name: "Next.js/Gatsby Static Site Generation (SSG)", description: "Building highly performant, SEO-friendly static sites using modern frameworks.", category: "Web Frontend", tags: ["Next.js", "Gatsby", "Static Site", "Frontend"], icon: "cpu", price: "$70.00", stripeLink: "https://buy.stripe.com/fZu7sL0CSc1qfYH9z09EI1v" },
    { id: 10, name: "Web Performance Optimization (Core Web Vitals)", description: "Improving loading speed, interactivity, and visual stability for high scores.", category: "Web Frontend", tags: ["Performance", "SEO", "Core Web Vitals"], icon: "zap", price: "$49.00", stripeLink: "https://buy.stripe.com/aFa8wP99o2qQ3bVfXo9EI1u" },
    { id: 11, name: "Advanced CSS/SVG Animation (GSAP/Framer)", description: "Creating smooth, complex motion graphics and interactive UI elements.", category: "Web Frontend", tags: ["Animation", "CSS", "SVG", "GSAP", "Framer"], icon: "sparkles", price: "$100.00", stripeLink: "https://buy.stripe.com/8x26oH85k7La3bVaD49EI1t" },
    { id: 12, name: "Cross-Browser Compatibility Testing", description: "Ensuring consistent functionality and display across all major browsers.", category: "Web Frontend", tags: ["Testing", "Cross-Browser", "Compatibility"], icon: "globe", price: "$40.00", stripeLink: "https://buy.stripe.com/00w14n0CS6H63bVcLc9EI1s" },
    { id: 13, name: "Component Library Development (Storybook)", description: "Creating a centralized, documented system for UI component design.", category: "Web Frontend", tags: ["Storybook", "UI Library", "Documentation"], icon: "book-open", price: "$349", stripeLink: "https://buy.stripe.com/00w9AT4T8d5ubIr7qS9EI1r" },

    // --- Backend & API ---
    { id: 14, name: "Node.js/Express API Development", description: "Building fast and scalable RESTful APIs using the Node.js ecosystem.", category: "Web Backend", tags: ["Node.js", "Express", "API", "Backend"], icon: "server", price: "$100", stripeLink: "https://buy.stripe.com/8x27sL85kghGfYH4eG9EI1q" },
    { id: 15, name: "Python/Django Backend Development", description: "Creating robust, secure web backends with Django or Flask.", category: "Web Backend", tags: ["Python", "Django", "Flask", "Backend"], icon: "terminal", price: "$120", stripeLink: "https://buy.stripe.com/7sY00jclA5D2bIrcLc9EI1p" },
    { id: 16, name: "Microservice Architecture Design", description: "Breaking down monolithic applications into scalable, independent services.", category: "Web Backend", tags: ["Microservices", "Architecture", "Backend"], icon: "hexagon", price: "$500", stripeLink: "https://buy.stripe.com/fZucN52L05D24fZcLc9EI1o" },
    { id: 17, name: "GraphQL Endpoint Implementation", description: "Developing efficient data querying layers with GraphQL.", category: "Web Backend", tags: ["GraphQL", "API", "Backend"], icon: "link", price: "$75", stripeLink: "https://buy.stripe.com/cNi28r71g7La9AjbH89EI1n" },
    { id: 18, name: "Serverless Function Deployment (AWS Lambda/Firebase)", description: "Setting up event-driven serverless backends for cost efficiency.", category: "Web Backend", tags: ["Serverless", "AWS", "Firebase"], icon: "cloud", price: "$70", stripeLink: "https://buy.stripe.com/14A8wPbhw7La13N8uW9EI1m" },
    { id: 19, name: "Authentication and Authorization Setup (OAuth/JWT)", description: "Implementing secure user login and role-based access control.", category: "Web Backend", tags: ["OAuth", "JWT", "Auth", "Security"], icon: "lock", price: "$50", stripeLink: "https://buy.stripe.com/3cI6oHetI6H6fYHcLc9EI1l" },
    { id: 20, name: "Third-Party API Integration", description: "Connecting your system to external services (e.g., payment, weather, map APIs).", category: "Web Backend", tags: ["API", "Integration", "Backend"], icon: "plug", price: "$199", stripeLink: "https://buy.stripe.com/7sY14netI0iI4fZcLc9EI1k" },
    { id: 21, name: "(Currently Not Available) Real-time Communication (WebSockets)", description: "Implementing live updates and chat functionality.", category: "Web Backend", tags: ["WebSockets", "Realtime", "Chat"], icon: "message-square", price: "Not Available", stripeLink: null },
    { id: 22, name: "API Documentation (Swagger/OpenAPI)", description: "Creating clear, interactive documentation for your endpoints.", category: "Web Backend", tags: ["Swagger", "OpenAPI", "Docs"], icon: "book-open", price: "$50", stripeLink: "https://buy.stripe.com/8x25kDclA7La13NeTk9EI1j" },

    // --- Database ---
    { id: 23, name: "SQL Database Design & Normalization", description: "Designing optimal schemas for PostgreSQL, MySQL, or SQL Server.", category: "Database", tags: ["SQL", "PostgreSQL", "MySQL", "Schema"], icon: "database", price: "$199", stripeLink: "https://buy.stripe.com/9B6cN5clAghGcMvcLc9EI1i" },
    { id: 24, name: "NoSQL Schema Design (MongoDB/Firebase)", description: "Structuring flexible and performant NoSQL data models.", category: "Database", tags: ["NoSQL", "MongoDB", "Firebase"], icon: "layers", price: "$100", stripeLink: "https://buy.stripe.com/bJe00jclA5D26o79z09EI1h" },
    { id: 25, name: "ETL Pipeline Development", description: "Building data extraction, transformation, and loading processes.", category: "Database", tags: ["ETL", "Data", "Pipeline"], icon: "box", price: "$155", stripeLink: "https://buy.stripe.com/fZu6oH1GW0iI3bVaD49EI1g" },

    // --- Mobile ---
    { id: 26, name: "React Native Feature Implementation", description: "Adding cross-platform features to existing or new React Native apps.", category: "Mobile", tags: ["React Native", "Mobile", "Cross Platform"], icon: "app-window", price: "$100", stripeLink: "https://buy.stripe.com/8x228r71g4yY5k3cLc9EI1d" },
    { id: 27, name: "Flutter UI/Logic Development", description: "Building beautiful and performant mobile UIs with Flutter (Dart).", category: "Mobile", tags: ["Flutter", "Dart", "UI", "Mobile"], icon: "tablet", price: "$299", stripeLink: "https://buy.stripe.com/3cI28r71g9Tih2Lh1s9EI1e" },
    { id: 28, name: "Mobile Push Notification Setup", description: "Integrating Firebase Cloud Messaging (FCM) or similar services.", category: "Mobile", tags: ["Notifications", "Mobile", "Firebase"], icon: "bell", price: "$199", stripeLink: "https://buy.stripe.com/cNi8wPbhwghG27R8uW9EI1f" },

    // --- Game Development ---
    { id: 29, name: "Unity Engine 2D/3D Scene Setup", description: "Initial scene, camera, and asset integration in the Unity environment. (Assets must be provided by client.)", category: "Game Dev", tags: ["Unity", "C#", "2D", "3D", "Game"], icon: "gamepad-2", price: "$200", stripeLink: "https://buy.stripe.com/4gM4gzclA4yY3bV7qS9EI1c" },
    { id: 30, name: "C# Game Logic Scripting", description: "Writing core game mechanics and systems in optimized C# scripts.", category: "Game Dev", tags: ["Unity", "C#", "Game Logic"], icon: "code", price: "$299", stripeLink: "https://buy.stripe.com/6oU3cvgBQ5D2fYH6mO9EI1b" },
    { id: 31, name: "Basic Multiplayer Networking Setup", description: "Implementing simple peer-to-peer or server-authoritative connections.", category: "Game Dev", tags: ["Networking", "Multiplayer", "Unity"], icon: "users", price: "$500", stripeLink: "https://buy.stripe.com/fZubJ1fxMfdC5k3eTk9EI1a" },

    // --- Consulting ---
    { id: 32, name: "Technical Consulting Session", description: "One-on-one session for technical roadmap planning and architecture guidance.", category: "Consulting", tags: ["Consulting", "Architecture", "Planning"], icon: "brain", price: "FREE", stripeLink: "https://buy.stripe.com/00w14nclAghGfYH5iK9EI19" },
    { id: 33, name: "In-Depth Code Review & Refactoring", description: "Thorough review for best practices, security, and performance improvements.", category: "Consulting", tags: ["Code Review", "Security", "Optimization"], icon: "file-check", price: "$30 / Hour", stripeLink: "https://buy.stripe.com/5kQdR94T85D27sbdPg9EI18" },
    { id: 34, name: "Security Vulnerability Patching", description: "Addressing common security issues like XSS, CSRF, and SQL injection.", category: "Consulting", tags: ["Security", "Vulnerability", "Fix"], icon: "bug", price: "$50 / hour", stripeLink: "https://mock-stripe.com/buy/rvo-security-299" }
];


// Digital Design Services Data
const digitalDesignData = [
    { id: 1, name: "RVO GridLine", description: "Architected channel layouts designed for flow, clarity, and visual precision.", category: "Structure", tags: ["Channels","Layout","Organization","Structure"], icon: "grid", price: "$0.75 / channel", stripeLink: "https://buy.stripe.com/mock-gridline" },
    { id: 2, name: "RVO TierForge", description: "Dynamic, color-coded role hierarchy for staff, boosters, and members.", category: "Roles", tags: ["Roles","Permissions","Hierarchy","Design"], icon: "shield", price: "$0.50 / role", stripeLink: "https://buy.stripe.com/mock-tierforge" },
    { id: 3, name: "RVO PermiCore", description: "Complete channel permission cleanup and security setup with logging.", category: "Security", tags: ["Permissions","Security","Access","Setup"], icon: "lock", price: "$0.25 / permission set", stripeLink: "https://buy.stripe.com/mock-permicore" },
    { id: 4, name: "RVO BotForge", description: "Professional Discord bot setup and integration with custom commands.", category: "Automation", tags: ["Bots","Automation","Setup","Integration"], icon: "cpu", price: "$1.00 / bot", stripeLink: "https://buy.stripe.com/mock-botforge" },
    { id: 5, name: "RVO SyncFlow", description: "Automated server workflows from welcome triggers to XP systems.", category: "Automation", tags: ["Automation","Bot","XP","Roles"], icon: "repeat", price: "$0.75 / feature", stripeLink: "https://buy.stripe.com/mock-syncflow" },
    { id: 6, name: "RVO VibeFrame", description: "Visual styling for your server including emojis, colors, and layout.", category: "Design", tags: ["Branding","Style","Color","Aesthetic"], icon: "palette", price: "$0.75 / element", stripeLink: "https://buy.stripe.com/mock-vibeframe" },
    { id: 7, name: "RVO EchoSet", description: "Custom identity package including icons, banners, and emoji design.", category: "Design", tags: ["Branding","Identity","Assets","Graphics"], icon: "image", price: "$1.00 / asset", stripeLink: "https://buy.stripe.com/mock-echoset" },
    { id: 8, name: "RVO SentinelCore", description: "Protection layers and anti-raid configuration for secure servers.", category: "Security", tags: ["Security","Protection","Verification","Logging"], icon: "shield-check", price: "$0.75 / layer", stripeLink: "https://buy.stripe.com/mock-sentinelcore" },
    { id: 9, name: "RVO ModStack", description: "Staff and moderation system setup with logs, tickets, and templates.", category: "Security", tags: ["Moderation","Staff","Logs","Tickets"], icon: "tools", price: "$1.00 / module", stripeLink: "https://buy.stripe.com/mock-modstack" },
    { id: 10, name: "RVO BoostNet", description: "Engagement systems including invite tracking, XP roles, and leaderboards.", category: "Engagement", tags: ["Growth","XP","Leaderboard","Invites"], icon: "rocket", price: "$0.75 / feature", stripeLink: "https://buy.stripe.com/mock-boostnet" },
    { id: 11, name: "RVO SupportLink", description: "Ticket system setup for support, orders, and feedback.", category: "Engagement", tags: ["Support","Tickets","Moderation","Workflow"], icon: "ticket", price: "$1.00 / ticket type", stripeLink: "https://buy.stripe.com/mock-supportlink" },
    { id: 12, name: "RVO EventPulse", description: "Event automation and announcement system with reminders and embeds.", category: "Engagement", tags: ["Events","Automation","Reminders","Community"], icon: "calendar", price: "$0.50 / event", stripeLink: "https://buy.stripe.com/mock-eventpulse" },
    { id: 13, name: "RVO NexusPrime", description: "Complete modular server system combining structure, automation, and design.", category: "Integrated", tags: ["FullServer","Automation","Design","Structure"], icon: "server", price: "$0.50 / element", stripeLink: "https://buy.stripe.com/mock-nexusprime" },
    { id: 14, name: "RVO CustomForge", description: "Custom-built Discord ecosystem designed from scratch for brands or large communities.", category: "Integrated", tags: ["Custom","FullServer","Brand","Automation"], icon: "hammer", price: "$0.25 / configured item", stripeLink: "https://buy.stripe.com/mock-customforge" }
];

// Graphic Design Services Data
const graphicDesignData = [
    { id: 1, name: "Logo Design Package", description: "Complete logo design including concept development, multiple variations, and final files.", category: "Branding", tags: ["Logo", "Branding", "Identity"], icon: "circle", price: "$199.00", stripeLink: "https://buy.stripe.com/mock-graphic-1" },
];

const subscriptionPlans = [
    {
        name: "Silver VIP (Starter)",
        price: 15000,
        description: "Perfect for MVPs and small projects. Includes 40 hours of development per month.",
        features: ["40 Dev Hours/Mo", "Basic Code Review", "Email Support", "1 Active Project"],
        icon: "zap",
        color: "text-green-400",
        tagline: "Minimum Viable Product",
        stripeLink: "https://buy.stripe.com/4gMaEXbhwc1q9AjfXo9EI16",
        tagLabel: "Best Entry Package",
        tagVariant: "tertiary"
    },
    {
        name: "Gold VIP (Professional)",
        price: 40000,
        description: "Our most popular plan. Ideal for growing businesses needing dedicated support.",
        features: ["160 Dev Hours/Mo", "Dedicated Team Lead", "Priority Support (Slack)", "2 Active Projects", "CI/CD Setup"],
        icon: "trending-up",
        color: "text-red-400",
        isFeatured: true,
        tagline: "Dedicated Support Team",
        stripeLink: "https://buy.stripe.com/5kQfZh99o9Ti8wf7qS9EI15",
        tagLabel: "Recommended",
        tagVariant: "secondary"
    },
    {
        name: "Platinum VIP (Enterprise)",
        price: 105000,
        description: "Full-scale solution for complex, mission-critical projects and large teams.",
        features: ["320 Dev Hours/Mo", "Very Fast Premium Support (Under 5 Hours Response)", "On-demand Scaling", "Unlimited Projects"],
        icon: "shield",
        color: "text-blue-400",
        tagline: "Scalable Mission-Critical",
        stripeLink: "https://buy.stripe.com/bJeeVd0CS1mM8wffXo9EI14",
        tagLabel: "Ultimate Control",
        tagVariant: ""
    },
    {
        name: "RVO Pulse (Starter)",
        price: 500,
        description: "Entry-level management for small Discord servers or startup communities.",
        features: ["Monthly Optimization Check", "Bot & Role Maintenance", "Basic Security Monitoring", "Email Support"],
        icon: "activity",
        color: "text-green-400",
        tagline: "For Growing Communities",
        stripeLink: "https://buy.stripe.com/mock-rvo-pulse",
        tagLabel: "Best for Starters",
        tagVariant: "tertiary"
    },
    {
        name: "RVO Sync (Standard)",
        price: 1200,
        description: "Automation and moderation support with smart server workflows and updates.",
        features: ["Auto-Moderation Management", "Monthly System Updates", "Bot Feature Expansion", "Priority Email Support"],
        icon: "repeat",
        color: "text-yellow-400",
        tagline: "Automation for All",
        stripeLink: "https://buy.stripe.com/mock-rvo-sync",
        tagLabel: "Popular Choice",
        tagVariant: "secondary"
    },
    {
        name: "RVO Sentinel (Security+)",
        price: 2500,
        description: "Advanced server protection and moderation automation for high-activity communities.",
        features: ["Raid & Spam Defense", "Custom Logging System", "24/7 Monitoring Alerts", "Incident Response Support"],
        icon: "shield-check",
        color: "text-red-400",
        tagline: "Stay Secure & Stable",
        stripeLink: "https://buy.stripe.com/mock-rvo-sentinel",
        tagLabel: "Enhanced Protection",
        tagVariant: "secondary"
