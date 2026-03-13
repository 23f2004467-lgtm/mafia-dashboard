# MAFIA Recruitment Dashboard

**Streamlining large-scale club recruitments with real-time coordination and payment tracking**

---

## Overview

A web-based recruitment management platform I built to transform how my university's largest student-led club — the Music and Arts Association (MAFIA) — conducts annual recruitments.

As Vice President and acting President of the club, I built this system to solve a real operational problem: managing 500–600 interviews across 30+ concurrent interviewers over three days, while maintaining data integrity, real-time coordination, and payment transparency.

---

## The Problem

The club conducts recruitments for the incoming first-year batch across:
- Music (Vocal, Instrumental, Sound)
- Art (Digital, Traditional, Design)
- Dance (Classical, Western, Choreography)
- PR & HR (Management domains)

**The previous workflow:**

1. Application forms through Google Forms
2. Responses exported to Excel sheets
3. Manual interview scheduling
4. Interviewers record feedback in spreadsheets
5. Selected candidates pay membership fee

**Key issues:**

- **Data Management**: With 30+ interviewers and 500+ candidates, Excel sheets led to incomplete fields, overwritten rows, and lost information
- **No Real-time Coordination**: Interviewers working simultaneously had zero visibility into each other's actions
- **Payment Tracking**: Cash payments to individual interviewers with no centralized tracking
- **Monitoring Challenges**: Small board team (5–6 people) couldn't effectively track activity across 15+ interview rooms
- **Scalability**: Process became chaotic at scale, limiting how many candidates we could process

---

## The Solution

I built a full-stack web application that replaces spreadsheets with a structured, real-time system:

**Tech Stack:**
- **Frontend**: React
- **Authentication**: Google OAuth (college email restriction)
- **Database**: Firebase (real-time NoSQL)
- **Hosting**: Vercel
- **Deployment**: CI/CD pipeline

**Core Features:**
- Interviewer authentication via college email
- Admin portal for board oversight
- Real-time candidate activation and tracking
- Domain-specific interview questions
- QR-based payment generation with traceable identifiers
- Live monitoring of interviewer activity

---

## System Workflow

```
1. Candidate Application
   ↓
2. Board Approval (Admin Portal)
   → Mark candidate as present
   → Activate profile for interviewers
   ↓
3. Interview
   → Interviewer searches candidate
   → Views preferences and domain-specific questions
   → Records verdict (Selected/Not Selected)
   ↓
4. Payment (if Selected)
   → Generate payment QR code
   → QR redirects to club payment page
   → Transaction includes structured comment (Student ID | Interviewer Code | Timestamp)
   ↓
5. Verification
   → Cross-reference payment comments with system records
   → Board marks candidates as fully onboarded
```

---

## Impact

**Metrics:**

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Candidates processed | 300–400 | 500–600 | +50% capacity |
| Concurrent interviews | 10–15 | 30+ | 2x capacity |
| Data errors per day | 15–20 | 0 | Eliminated |
| Payment tracking | Manual | Traceable | 100% transparent |
| Board oversight | Impossible | Real-time | Full visibility |

**Key improvements:**
- Enabled 30+ simultaneous interviews without data loss
- Eliminated reliance on error-prone spreadsheets
- Created auditable, traceable payment records
- Real-time monitoring of all interviewer activity
- Increased total processing capacity by 50%

---

## Key Features

### Authentication & Access Control
- Google OAuth restricted to college email IDs
- Admin portal for interviewer approval and access management
- Session tracking and automatic timeout

### Candidate Management
- Real-time candidate activation at venue check-in
- Search by name or registration number
- View domain preferences and management interest
- Access board-reviewed interview questions

### Interview Coordination
- Real-time updates across all active interviewers
- Conflict prevention for concurrent interviews
- Activity logging and monitoring

### Payment & Verification
- QR code generation for selected candidates
- Structured payment comments for traceability
- Cross-verification system for board members
- Automated payment tracking

### Admin Oversight
- Live monitoring of interviewer activity
- Export candidate data to Excel
- Payment verification dashboard
- Bulk operations for data management

---

## Technical Implementation

### Real-time Synchronization
```javascript
// All interviewers see updates instantly
onSnapshot(collection(db, "candidates"), (snapshot) => {
  const candidates = snapshot.docs.map(doc => doc.data());
  setCandidates(candidates);
});
```

### Secure Payment Tracking
```javascript
// Generate traceable payment identifier
const paymentComment = `${studentId}|${interviewerCode}|${timestamp}`;
const qrUrl = `upi://pay?pa=upi@bank&pn=MAFIA&am=300&tr=${paymentComment}`;
```

### Performance Optimizations
- LRU cache to reduce database reads
- Debounced search to prevent excessive queries
- Connection pooling for Firebase
- Optimistic UI updates for instant feedback

### Security Measures
- Role-based access control (RBAC)
- Input validation and sanitization
- Rate limiting on API endpoints
- Audit logging for all sensitive operations
- Firestore security rules for server-side validation

---

## Motivation

The inspiration for this project came from personal experience:

- **Year 1**: As a first-year student, I participated in MAFIA recruitment and experienced the chaos firsthand — lost forms, confused interviewers, no coordination
- **Year 3**: As Vice President (and acting President), I had the opportunity and skills to fix these operational issues using my CS background

I built this system to solve a real problem I had lived through, with the goal of creating something that future recruitment teams could rely on.

---

## Future Improvements

While the current system significantly improved the workflow, there are several opportunities for future enhancement:

**WhatsApp Automation**
- Auto-add selected members to WhatsApp communities using WhatsApp Business API
- Automated interview reminders and notifications

**Payment Gateway Integration**
- Direct payment gateway integration for automatic verification
- Real-time payment confirmation without manual cross-checking

**Interview Scheduling**
- Automated interview slot allocation
- Calendar integration for interviewers and candidates
- Conflict detection and resolution

**Advanced Analytics**
- Year-over-year comparison of recruitment metrics
- Domain-wise acceptance trends
- Interviewer performance analytics

---

## Contact

**Built by Dheeraj**
- Vice President & Acting President, MAFIA (Music and Arts Association)
- Computer Science, [Your College Name]
- [dheera1312@gmail.com](mailto:dheera1312@gmail.com) | [9591185310](tel:9591185310)

---

*Built to solve a real problem, at scale, with real users.*
