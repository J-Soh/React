## Full-Stack Facility Booking System App


[![Facility-Booking-App](https://img.youtube.com/vi/Csw2wLrrJuA/maxresdefault.jpg)](https://youtu.be/Csw2wLrrJuA)

 **Web Preview:** [Full Preview of the App](https://saf-facility-booking.netlify.app/)


- Designed and developed a full-stack facility booking application using React.js, Supabase (PostgreSQL), and Netlify.

- Built end-to-end automation using Supabase's full-stack capabilities: PostgreSQL triggers for data validation, and RLS for security.

- Implemented a secure authentication system using JSON Web Tokens (JWT) with multi-role user management (clients/admins) and protected routing.

- Designed an optimized database schema with more than 3 tables, establish relationships and and implemented complex SQL queries.

- Built responsive UI with Tailwind CSS and deployed application using Netlify with environment configuration.
 

---

## How to use:

 _For Client Users:_
1. **Register/Login:** 
    - Create an account with your email and password.
    - login if you already have an account.
2. **Browse Facilities:** 
    - View all available facilities with their current capacity and booking status from the drop down menu. 
3. **Make a Booking:**
    - Select a facility from the dropdown menu.
    - Pick a date for your booking.
    - Specify your time slot (start time to end time).
    - Submit your booking request
    - This requested facility will then be sent to the admin for approval.
4. **Track Your Bookings:** 
    - View all your pending, approved, and rejected bookings in one place.

5. **Manage Bookings:** 
    - Cancel pending or approved bookings as needed.


 _For Admin Users:_

- **Manage Facilities**: Add, edit, or remove facilities with custom capacity limits

- **Review Approvals:** View all pending booking requests requiring approval

- **Approve/Reject:** Quickly approve or reject booking requests with one click

- **Monitor Usage:** See detailed booking history and facility utilization across all users

- **Full Control:** Delete bookings or facilities as needed with appropriate warnings

---

## App features:
**Core Functionality:**  
- **User Booking System:** Allows clients to book facilities for specific time periods.  
- **Capacity Management:** Enforces facility capacity limits to prevent overbooking.  
- **Time Slot Validation:** Prevents overlapping bookings with intelligent time conflict detection.  
- **Approval Workflow:** Implements a two-step process where all bookings require admin approval.  
- **Real-time Updates:** Shows live availability and booking status changes.  

**Admin Capabilities:**  
- **Facility Management:** Create and configure multiple facilities with custom capacities. 
- **Booking Oversight:** Monitor all booking activity across the entire platform.  
- **User Management:** View all registered users and their booking history  
- **System Control:** Maintain data integrity by managing facilities and bookings.  

**Technical Features:**  
- **Role-Based Access:** Separate interfaces for regular users and administrators.  
- **Responsive Design:** Works seamlessly on desktop, tablet, and mobile devices.
- **Secure Authentication:** JWT-based login system with password protection  
- **Real-time Validation:** Instant feedback on booking availability before submission.
- **Data Integrity:** Prevents double-booking and maintains accurate capacity tracking.

 ---

 ## How to run this build:

1. **Clone this repository** to your local machine:
   ```bash
   git clone https://github.com/J-Soh/React.git
   ```

2. **Install dependencies:**
- [nodejs](https://nodejs.org/en/download)
- react

3. **Navigate to root directionary:**

```
cd "facility-booking-app"
```

4. **Run this command with `Git-Bash`:**

```
npm install
npm start
```