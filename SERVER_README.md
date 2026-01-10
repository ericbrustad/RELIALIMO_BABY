# ReliaLimo Local Server Setup

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure email provider:**
   ```bash
   copy env.example .env
   ```
   Edit `.env` with your email provider credentials.

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Access the app:**
   - Main app: http://localhost:3001
   - Email API: http://localhost:3001/api/email-send

## Email Provider Options

### Option 1: Resend (Recommended)
- Sign up at https://resend.com
- Get API key from dashboard
- Set `RESEND_API_KEY` in `.env`

### Option 2: SendGrid
- Sign up at https://sendgrid.com
- Create API key in settings
- Set `SENDGRID_API_KEY` in `.env`

### Option 3: Gmail SMTP
- Enable 2FA on Gmail
- Generate App Password
- Set SMTP credentials in `.env`

## Development Mode

```bash
npm run dev
```

This uses nodemon for auto-restart on file changes.

## Production Deployment

### Vercel
1. Push to GitHub
2. Connect to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically

### Netlify
1. Push to GitHub
2. Connect to Netlify
3. Configure build settings
4. Set environment variables

The server serves static files and provides the email API endpoint for testing email functionality.