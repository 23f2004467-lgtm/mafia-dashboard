# 🎭 MAFIA Recruitment Dashboard

Recruitment system for MAFIA's TalentComm and WorkComm. Built this to streamline the interview process and make it easier for interviewers to manage candidates.

## 🚀 Live Site

**URL**: [https://mafia-recruitments.web.app/](https://mafia-recruitments.web.app/)

## What it does

### Interviewer Portal
- Login with Google (anyone can access)
- Search and filter candidates
- Submit interview verdicts
- Verify payments (₹300 fixed)
- Real-time updates so everyone sees the latest data

### Admin Portal  
- Secure login for admins only
- View all candidates and payment stats
- Export data to Excel
- See who's currently logged in as interviewer
- Can reverse payment confirmations if needed

## Tech Stack

- React.js for frontend
- Firebase (Firestore + Auth + Hosting)
- Google OAuth for interviewers
- Firestore for database

## Quick Start

### For Interviewers
Just go to the site and login with Google. That's it.

### For Admins
Check the [Admin Setup Guide](ADMIN_SETUP_GUIDE.md) - need to set up Firebase Auth first.

## Development

Need Node.js and Firebase CLI installed.

```bash
npm install
npm start
```

To deploy:
```bash
npm run build
firebase deploy
```

## Notes

- Added rate limiting because we had some issues with too many requests
- Session tracking helps see who's active
- Payment verification is manual for now (might automate later)
- All the security stuff is in firestore.rules

## Contact

If something breaks: 9591185310

---

Built for MAFIA 2025-26 recruitments
