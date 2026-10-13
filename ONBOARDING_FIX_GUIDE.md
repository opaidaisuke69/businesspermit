# Onboarding Bypass Bug - Fix Guide

## Problem Summary

Users are being directed to the dashboard immediately after email verification, skipping the onboarding flow (document upload, assistants, selfie).

## Root Cause

The backend has a helper function `_updateOnboardingStep()` in `bpa-backend/routes/verification.php` that automatically calculates and sets `onboarding_completed = 1` whenever:
- A document is uploaded/deleted
- An assistant is added/removed

This function checks if the user has:
1. Primary ID OR Secondary ID
2. Barangay Clearance
3. At least one Assistant
4. Selfie photo

If all conditions are met, it automatically sets `onboarding_completed = 1`, even if the user hasn't gone through the onboarding flow UI.

## Fixes Applied

### 1. Backend Type Conversion (CRITICAL)
**Files Modified:**
- `bpa-backend/routes/auth.php`

**Changes:**
- Added explicit integer conversion for `onboarding_completed` and `onboarding_step` in both login and `/auth/me` endpoints
- This ensures JavaScript receives `0` (number, falsy) instead of `"0"` (string, truthy)

```php
// Convert numeric fields to proper types for JavaScript
$user['onboarding_completed'] = (int)$user['onboarding_completed'];
$user['onboarding_step'] = (int)$user['onboarding_step'];
```

### 2. Mobile App Explicit Checks
**Files Modified:**
- `bpa-mobile/app/index.tsx`
- `bpa-mobile/app/(tabs)/_layout.tsx`

**Changes:**
- Made onboarding checks more explicit to handle both `0` and falsy values
- Added redundant check: `!user.onboarding_completed || user.onboarding_completed === 0`

## Debugging Tools Created

### 1. Complete Status Checker
**URL:** `https://lcc.bpa.tetsousangyo.com/bpa-backend/test-user-complete-status.php`

This tool shows:
- User's current `onboarding_completed` and `onboarding_step` values
- All uploaded documents by category
- All added assistants
- Analysis of whether the status is correct or inconsistent
- One-click fix buttons to correct the status

### 2. Onboarding Debug Tool
**URL:** `https://lcc.bpa.tetsousangyo.com/bpa-backend/test-onboarding-debug.php`

This tool shows:
- All users and their onboarding status
- Data types of the values
- JavaScript interpretation test

### 3. User Data Test
**URL:** `https://lcc.bpa.tetsousangyo.com/bpa-backend/test-user-data.php`

Shows raw user data and how it's interpreted by JavaScript.

## How to Test

### Step 1: Check Current Status
1. Visit: `https://lcc.bpa.tetsousangyo.com/bpa-backend/test-user-complete-status.php`
2. Review the user's current status
3. Check if there are any documents, assistants, or selfies already uploaded

### Step 2: Fix Inconsistent Data
If the tool shows "INCONSISTENT" status:
- Click the "Fix" button to reset `onboarding_completed = 0`
- This will force the user to go through onboarding

### Step 3: Test Fresh Registration
1. Register a new user with a fresh email
2. Verify email via the link
3. Log in to the mobile app
4. Confirm you're directed to the onboarding screen (not dashboard)
5. Complete all 3 phases:
   - Phase 1: Upload Primary ID + Barangay Clearance
   - Phase 2: Add at least one Assistant
   - Phase 3: Take Selfie photo
6. Submit for review
7. Confirm you're now directed to the dashboard

### Step 4: Test Existing User
1. Log out from the mobile app
2. Uninstall and reinstall the app (to clear cache)
3. Log in with the existing user
4. Confirm the correct behavior based on their onboarding status

## Expected Behavior

### New User (onboarding_completed = 0)
- After email verification → Directed to onboarding screen
- After completing all 3 phases → Directed to dashboard
- `onboarding_completed` automatically set to `1` after Phase 3

### Existing User (onboarding_completed = 1)
- After login → Directed to dashboard immediately
- Can access all tabs and features

## Common Issues

### Issue: User still directed to dashboard after fix
**Solution:**
1. Make sure you've uploaded the fixed backend files
2. Clear the mobile app data (uninstall/reinstall)
3. Check the database directly: `SELECT onboarding_completed FROM users WHERE email = 'user@example.com'`
4. If value is `1`, manually set to `0`: `UPDATE users SET onboarding_completed = 0 WHERE email = 'user@example.com'`

### Issue: User has old data from testing
**Solution:**
1. Delete all documents: `DELETE FROM user_documents WHERE user_id = X`
2. Delete all assistants: `DELETE FROM user_assistants WHERE user_id = X`
3. Reset onboarding: `UPDATE users SET onboarding_completed = 0, onboarding_step = 0 WHERE id = X`
4. Log out and log back in

### Issue: JavaScript still treats "0" as truthy
**Solution:**
- This means the backend type conversion isn't working
- Check that you've uploaded the updated `bpa-backend/routes/auth.php` file
- Test the API directly: `https://lcc.bpa.tetsousangyo.com/bpa-backend/api/auth/me` (with auth token)
- Verify the response shows `"onboarding_completed": 0` (number) not `"onboarding_completed": "0"` (string)

## Files Modified

1. `bpa-backend/routes/auth.php` - Added type conversion
2. `bpa-mobile/app/index.tsx` - Explicit onboarding check
3. `bpa-mobile/app/(tabs)/_layout.tsx` - Explicit onboarding check
4. `bpa-backend/test-user-complete-status.php` - NEW debugging tool
5. `bpa-backend/test-onboarding-debug.php` - NEW debugging tool
6. `bpa-backend/test-user-data.php` - NEW debugging tool
7. `bpa-backend/fix-onboarding.php` - NEW fix utility

## Next Steps

1. Upload all modified backend files to production
2. Rebuild the mobile app with the updated code
3. Test with a fresh user registration
4. Use the debugging tools to verify the fix
5. If issues persist, check the debugging tools for more details
