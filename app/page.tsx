'use client';

export default function LandingPage() {
  // Supabase storage URL for logos
  const supabaseUrl = 'https://siumiadylwcrkaqsfwkj.supabase.co';
  const mainLogoUrl = `${supabaseUrl}/storage/v1/object/public/images/relialimo-logo-main.png`;
  
  return (
    <>
      {/* Top Navigation */}
      <nav className="top-nav">
        <div className="nav-links">
          <a href="/driver-portal.html" className="nav-link">🚘 Driver</a>
          <a href="/index.html" className="nav-link">⚙️ Admin</a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="logo-container">
          <img 
            src={mainLogoUrl} 
            alt="RELIALIMO" 
            className="hero-logo"
            onError={(e) => {
              // Fallback to text if image fails to load
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'block';
            }}
          />
          <div className="logo-fallback" style={{ display: 'none' }}>
            <div className="logo-bull">🐂</div>
            <h1 className="hero-title">RELIALIMO</h1>
          </div>
        </div>
        
        <p className="hero-subtitle">Professional Transportation</p>
        <p className="hero-tagline">
          Experience luxury, reliability, and unparalleled service for all your 
          professional transportation needs.
        </p>
        
        <div className="cta-buttons">
          <a href="/book" className="btn btn-primary">
            Book a Ride
          </a>
          <a href="https://account.relialimo.com/auth" className="btn btn-secondary">
            Account Login
          </a>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <h2 className="section-title">Why Choose RELIALIMO</h2>
        <p className="section-subtitle">
          Trusted by businesses and individuals for premium transportation services
        </p>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🚗</div>
            <h3 className="feature-title">Luxury Fleet</h3>
            <p className="feature-desc">
              Premium vehicles meticulously maintained to ensure comfort and style 
              for every journey, from sedans to SUVs and limousines.
            </p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">⏰</div>
            <h3 className="feature-title">Always On Time</h3>
            <p className="feature-desc">
              Real-time flight tracking, GPS monitoring, and professional dispatching 
              ensure punctual arrivals every single time.
            </p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">👔</div>
            <h3 className="feature-title">Professional Chauffeurs</h3>
            <p className="feature-desc">
              Licensed, insured, and thoroughly vetted drivers committed to providing 
              exceptional service and safe transportation.
            </p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3 className="feature-title">Easy Booking</h3>
            <p className="feature-desc">
              Book instantly through our customer portal, receive real-time updates, 
              and manage all your reservations in one place.
            </p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3 className="feature-title">Secure & Reliable</h3>
            <p className="feature-desc">
              Bank-level security for payments, comprehensive insurance coverage, 
              and a track record of dependable service.
            </p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">💼</div>
            <h3 className="feature-title">Corporate Accounts</h3>
            <p className="feature-desc">
              Streamlined billing, detailed reporting, and dedicated account management 
              for businesses of all sizes.
            </p>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="services">
        <h2 className="section-title">Our Services</h2>
        <p className="section-subtitle">
          Comprehensive transportation solutions for every occasion
        </p>
        
        <div className="services-grid">
          <div className="service-card">
            <h3 className="service-title">Airport Transfers</h3>
            <p className="service-desc">
              Door-to-door service with flight monitoring, meet & greet options, 
              and assistance with luggage. Never miss a flight again.
            </p>
          </div>
          
          <div className="service-card">
            <h3 className="service-title">Corporate Travel</h3>
            <p className="service-desc">
              Executive transportation for meetings, conferences, and client entertainment. 
              Impress with professionalism and punctuality.
            </p>
          </div>
          
          <div className="service-card">
            <h3 className="service-title">Special Events</h3>
            <p className="service-desc">
              Weddings, proms, galas, and celebrations. Make your special day 
              memorable with elegant transportation.
            </p>
          </div>
          
          <div className="service-card">
            <h3 className="service-title">Hourly Charters</h3>
            <p className="service-desc">
              Flexible hourly service for shopping trips, city tours, wine tastings, 
              or any occasion requiring a personal chauffeur.
            </p>
          </div>
        </div>
      </section>

      {/* Portals Section */}
      <section className="portals">
        <h2 className="section-title">Access Your Portal</h2>
        <p className="section-subtitle">
          Dedicated portals for customers, drivers, and administrators
        </p>
        
        <div className="portals-grid">
          <div className="portal-card">
            <div className="portal-icon">👤</div>
            <h3 className="portal-title">Customer Portal</h3>
            <p className="portal-desc">
              Book rides, track your chauffeur in real-time, manage reservations, 
              and view your trip history.
            </p>
            <a href="https://account.relialimo.com" className="portal-link">
              Access Portal
            </a>
          </div>
          
          <div className="portal-card">
            <div className="portal-icon">🚘</div>
            <h3 className="portal-title">Driver Portal</h3>
            <p className="portal-desc">
              View assigned trips, update availability, manage your schedule, 
              and communicate with dispatch.
            </p>
            <a href="/driver-portal.html" className="portal-link">
              Driver Login
            </a>
          </div>
          
          <div className="portal-card">
            <div className="portal-icon">⚙️</div>
            <h3 className="portal-title">Admin Portal</h3>
            <p className="portal-desc">
              Manage reservations, dispatch drivers, configure settings, 
              and oversee all operations.
            </p>
            <a href="/index.html" className="portal-link">
              Admin Login
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p className="footer-text">
          © {new Date().getFullYear()} RELIALIMO. All rights reserved.
        </p>
      </footer>
    </>
  )
}
