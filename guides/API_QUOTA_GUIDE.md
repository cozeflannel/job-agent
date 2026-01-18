# API Quota Troubleshooting Guide

## Problem: "API Quota Exceeded" Error

You're seeing this error:
```
⚠️ API Quota Exceeded: You've hit the Gemini API free tier limit (20 requests/day)
```

## Why This Happens

The **Gemini API free tier** has strict limits:
- **20 requests per day** for `gemini-3-flash-preview`
- Resets every 24 hours
- Each form fill = 1 request
- Each resume upload with extraction = 2 requests (extraction + audit)
- Each chat message = 1 request

**Example:** If you uploaded a resume (2 requests) and filled 9 forms (9 requests), you've used 11/20 requests.

## Solutions

### Option 1: Wait for Reset (Free)
- Quota resets **24 hours** after your first request
- Check the error message for exact retry time
- No cost, but requires patience

### Option 2: Upgrade to Paid Tier (Recommended)
1. Go to: https://ai.google.dev/pricing
2. Enable billing on your Google Cloud account
3. Paid tier limits:
   - **1,500 requests per day** (75x more!)
   - **1 million requests per month**
   - Very affordable: ~$0.00025 per request

### Option 3: Use Multiple API Keys (Workaround)
1. Create additional Google accounts
2. Get API keys from each account
3. Rotate keys in Settings when one hits quota
4. **Not recommended** - violates terms of service

### Option 4: Reduce API Usage

#### Smart Strategies:
1. **Batch your applications**: Fill multiple forms in one session
2. **Pre-fill profile manually**: Enter common fields in Settings to reduce AI reliance
3. **Skip resume re-uploads**: Only upload once, reuse the stored data
4. **Use chat sparingly**: Chat uses 1 request per message

#### Disable AI Features Temporarily:
You can manually fill forms without AI by:
- Opening the extension side panel
- Copying values from Settings → Personal/Demographics
- Pasting directly into form fields

## How to Check Your Usage

Unfortunately, Google doesn't provide a real-time quota dashboard for the free tier. You can:
1. **Count your requests manually** (see "Why This Happens" above)
2. **Monitor error messages** - they include retry time
3. **Upgrade to paid tier** - get access to usage monitoring at https://ai.dev/rate-limit

## Current Quota Status

Based on your error message:
```
Please retry in 49.651935273s
```

This means:
- ✅ You can retry in **~50 seconds** (not 24 hours!)
- This is a **rate limit**, not a daily quota
- The free tier has **both**:
  - **Rate limit**: 20 requests per minute
  - **Daily quota**: 20 requests per day

## Recommended Action

**For serious job hunting**, upgrade to the paid tier:
- Cost: ~$0.50 per day for heavy usage (2000 requests)
- Benefit: No interruptions, faster applications
- ROI: One job offer pays for years of API usage

**For casual use**, wait for the quota reset and:
- Use the extension strategically
- Fill 1-2 applications per day
- Manually fill simple fields

## Technical Details

The extension now shows **clear error messages** when quota is exceeded:
- ⚠️ API Quota Exceeded (429 error)
- ⚠️ Invalid API Key (401 error)
- ⚠️ API Access Denied (403 error)

Check the extension logs (System Logs panel) for detailed error information.

## Need Help?

If you're still seeing errors after:
1. Waiting for quota reset
2. Verifying your API key
3. Checking your Google Cloud billing

Then the issue might be:
- API key permissions
- Google Cloud project configuration
- Network/firewall blocking API requests

---

**Pro Tip**: The paid tier is **extremely affordable** for the value it provides. For the cost of a coffee, you can fill hundreds of job applications with AI assistance. 🚀
