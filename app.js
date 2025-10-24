// Main app JavaScript for index.html

document.addEventListener('DOMContentLoaded', function() {
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
