// app.js - Enhanced with PWA functionality
document.addEventListener('DOMContentLoaded', function() {
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('SW update found!');
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showUpdateNotification();
                        }
                    });
                });
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
        
        // Listen for claiming of service worker
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                window.location.reload();
                refreshing = true;
            }
        });
    }

    // PWA Installation Prompt
    let deferredPrompt;
    const installButton = document.getElementById('installButton');
    
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later
        deferredPrompt = e;
        // Show install button if it exists
        if (installButton) {
            installButton.style.display = 'block';
            installButton.addEventListener('click', installApp);
        }
        
        // Show custom install prompt
        showInstallPrompt();
    });

    function installApp() {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                } else {
                    console.log('User dismissed the install prompt');
                }
                deferredPrompt = null;
            });
        }
    }

    function showInstallPrompt() {
        // Create a custom install prompt
        const installPrompt = document.createElement('div');
        installPrompt.className = 'alert alert-info alert-dismissible fade show position-fixed bottom-0 start-50 translate-middle-x mb-3';
        installPrompt.style.zIndex = '9999';
        installPrompt.innerHTML = `
            <i class="fas fa-download me-2"></i>
            Install ChitFund Pro for better experience
            <button type="button" class="btn btn-sm btn-primary ms-2" id="customInstallBtn">
                Install
            </button>
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(installPrompt);
        
        document.getElementById('customInstallBtn').addEventListener('click', installApp);
    }

    function showUpdateNotification() {
        const updateAlert = document.createElement('div');
        updateAlert.className = 'alert alert-warning alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
        updateAlert.style.zIndex = '9999';
        updateAlert.innerHTML = `
            <i class="fas fa-sync-alt me-2"></i>
            New version available! 
            <button type="button" class="btn btn-sm btn-outline-warning ms-2" onclick="window.location.reload()">
                Update Now
            </button>
        `;
        document.body.appendChild(updateAlert);
    }

    // Network status monitoring
    function updateOnlineStatus() {
        const statusElement = document.getElementById('networkStatus');
        if (statusElement) {
            if (navigator.onLine) {
                statusElement.innerHTML = '<i class="fas fa-wifi text-success"></i>';
                statusElement.title = 'Online';
            } else {
                statusElement.innerHTML = '<i class="fas fa-wifi-slash text-danger"></i>';
                statusElement.title = 'Offline';
                showOfflineNotification();
            }
        }
    }

    function showOfflineNotification() {
        const offlineAlert = document.createElement('div');
        offlineAlert.className = 'alert alert-warning alert-dismissible fade show position-fixed top-0 start-0 w-100';
        offlineAlert.style.zIndex = '9998';
        offlineAlert.innerHTML = `
            <i class="fas fa-wifi-slash me-2"></i>
            You are currently offline. Some features may be limited.
        `;
        document.body.appendChild(offlineAlert);
        
        // Auto remove when back online
        window.addEventListener('online', () => {
            offlineAlert.remove();
        });
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // Existing app functionality...
    // Hide loading spinner after page loads
    window.addEventListener('load', function() {
        setTimeout(() => {
            const loadingSpinner = document.getElementById('loadingSpinner');
            if (loadingSpinner) {
                loadingSpinner.style.opacity = '0';
                setTimeout(() => {
                    loadingSpinner.style.display = 'none';
                }, 500);
            }
        }, 1000);
    });

    // Add scroll animation for features
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeIn 0.8s ease-out forwards';
            }
        });
    }, observerOptions);

    // Observe feature cards for animation
    document.querySelectorAll('.feature-card').forEach(card => {
        observer.observe(card);
    });

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Navbar background change on scroll
    window.addEventListener('scroll', function() {
        const navbar = document.querySelector('.navbar-custom');
        if (window.scrollY > 100) {
            navbar.style.background = 'rgba(255, 253, 143, 0.95)';
            navbar.style.backdropFilter = 'blur(10px)';
        } else {
            navbar.style.background = 'linear-gradient(135deg, var(--primary), var(--secondary))';
            navbar.style.backdropFilter = 'none';
        }
    });

    // Add hover effects to buttons
    document.querySelectorAll('.btn').forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // Check if user is logged in and update navigation
    if (typeof auth !== 'undefined') {
        auth.onAuthStateChanged((user) => {
            const authLink = document.querySelector('.navbar-nav .nav-link[href="auth.html"]');
            if (authLink) {
                if (user) {
                    authLink.textContent = 'Dashboard';
                    authLink.href = 'dashboard.html';
                } else {
                    authLink.textContent = 'Login';
                    authLink.href = 'auth.html';
                }
            }
        });
    }
});

// PWA Utility Functions
function checkPWACompatibility() {
    const compatibility = {
        serviceWorker: 'serviceWorker' in navigator,
        pushManager: 'PushManager' in window,
        installPrompt: 'BeforeInstallPromptEvent' in window,
        storage: 'storage' in navigator && 'estimate' in navigator.storage
    };
    
    console.log('PWA Compatibility:', compatibility);
    return compatibility;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { checkPWACompatibility };
}
