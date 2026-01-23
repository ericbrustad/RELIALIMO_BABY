'use client';

export default function LandingPage() {
  const supabaseUrl = 'https://siumiadylwcrkaqsfwkj.supabase.co';
  const mainLogoUrl = `${supabaseUrl}/storage/v1/object/public/images/reliabull_Trans.png`;

  return (
    <div className="portal-page">
      {/* Hero Section */}
      <section className="portal-hero">
        <div className="portal-logo-container">
          <img 
            src={mainLogoUrl} 
            alt="RELIALIMO" 
            className="portal-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <h1 className="portal-title">RELIALIMO™</h1>
          <p className="portal-tagline">Professional Transportation Services</p>
        </div>
      </section>

      {/* Portal Navigation */}
      <section className="portal-nav">
        <h2 className="portal-nav-title">Select Your Portal</h2>
        
        <div className="portal-cards">
          {/* Customer/Accounts Portal */}
          <a href="https://account.relialimo.com" className="portal-card portal-card-accounts">
            <div className="portal-card-icon">👤</div>
            <h3 className="portal-card-title">Accounts</h3>
            <p className="portal-card-desc">
              Customer portal for booking rides, managing reservations, and viewing trip history.
            </p>
            <span className="portal-card-link">Sign In →</span>
          </a>

          {/* Drivers Portal */}
          <a href="https://driver.relialimo.com" className="portal-card portal-card-drivers">
            <div className="portal-card-icon">🚗</div>
            <h3 className="portal-card-title">Drivers</h3>
            <p className="portal-card-desc">
              Driver portal for viewing assignments, accepting trips, and managing your schedule.
            </p>
            <span className="portal-card-link">Sign In →</span>
          </a>

          {/* Admin Portal */}
          <a href="https://admin.relialimo.com" className="portal-card portal-card-admin">
            <div className="portal-card-icon">⚙️</div>
            <h3 className="portal-card-title">Admin</h3>
            <p className="portal-card-desc">
              Staff portal for reservations, dispatch, fleet management, and company operations.
            </p>
            <span className="portal-card-link">Sign In →</span>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="portal-footer">
        <p>© {new Date().getFullYear()} RELIALIMO™ - All Rights Reserved</p>
      </footer>

      <style jsx>{`
        .portal-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .portal-hero {
          padding: 60px 20px 40px;
          text-align: center;
        }

        .portal-logo-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .portal-logo {
          width: 120px;
          height: auto;
          filter: drop-shadow(0 0 30px rgba(201, 162, 39, 0.5));
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        .portal-title {
          font-size: 2.5rem;
          font-weight: 700;
          color: #c9a227;
          margin: 0;
          letter-spacing: 4px;
          text-shadow: 0 2px 20px rgba(201, 162, 39, 0.3);
        }

        .portal-tagline {
          font-size: 1.1rem;
          color: rgba(255, 255, 255, 0.7);
          margin: 8px 0 0;
          letter-spacing: 2px;
        }

        .portal-nav {
          padding: 20px;
          width: 100%;
          max-width: 1000px;
        }

        .portal-nav-title {
          text-align: center;
          color: #fff;
          font-size: 1.4rem;
          font-weight: 500;
          margin-bottom: 32px;
          opacity: 0.9;
        }

        .portal-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          padding: 0 20px;
        }

        .portal-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 32px 24px;
          text-decoration: none;
          color: #fff;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          backdrop-filter: blur(10px);
        }

        .portal-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          border-color: rgba(201, 162, 39, 0.4);
        }

        .portal-card-accounts:hover {
          background: rgba(76, 175, 80, 0.15);
          border-color: rgba(76, 175, 80, 0.5);
        }

        .portal-card-drivers:hover {
          background: rgba(33, 150, 243, 0.15);
          border-color: rgba(33, 150, 243, 0.5);
        }

        .portal-card-admin:hover {
          background: rgba(201, 162, 39, 0.15);
          border-color: rgba(201, 162, 39, 0.5);
        }

        .portal-card-icon {
          font-size: 3rem;
          margin-bottom: 16px;
        }

        .portal-card-title {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0 0 12px;
          color: #c9a227;
        }

        .portal-card-desc {
          font-size: 0.95rem;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.6;
          margin: 0 0 20px;
          flex-grow: 1;
        }

        .portal-card-link {
          font-size: 0.9rem;
          color: #c9a227;
          font-weight: 500;
          transition: color 0.2s;
        }

        .portal-card:hover .portal-card-link {
          color: #f4d03f;
        }

        .portal-footer {
          margin-top: auto;
          padding: 40px 20px;
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          font-size: 0.85rem;
        }

        @media (max-width: 600px) {
          .portal-title {
            font-size: 1.8rem;
            letter-spacing: 2px;
          }

          .portal-cards {
            grid-template-columns: 1fr;
            padding: 0 10px;
          }

          .portal-card {
            padding: 24px 20px;
          }
        }
      `}</style>
    </div>
  );
}
