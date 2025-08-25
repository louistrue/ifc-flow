# Cloudflare Turnstile Setup Guide

This guide walks you through setting up Cloudflare Turnstile for your IFC Flow Map AI chatbot.

## Prerequisites

1. **Cloudflare Account**: You need a Cloudflare account (free tier works)
2. **Domain**: Your site should be accessible via a domain (localhost works for testing)

## Step 1: Create Turnstile Widget

1. **Login to Cloudflare Dashboard**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Navigate to **Turnstile** in the left sidebar

2. **Create New Widget**
   - Click **"Create widget"**
   - Fill in the details:
     - **Widget name**: `IFC Flow Map AI Chat`
     - **Domain**: Your production domain (e.g., `your-domain.com`)
     - **Mode**: Select **"Managed"** (recommended for best UX)
     - **Widget type**: **"Invisible"** or **"Visible"** (your choice)

3. **Get Your Keys**
   After creation, you'll receive:
   - **Sitekey** (public) - starts with `0x4A...`
   - **Secret key** (private) - keep this secure!

## Step 2: Configure Environment Variables

Add these to your `.env.local` file:

```env
# Cloudflare Turnstile Configuration (Production only)
NEXT_PUBLIC_TURNSTILE_SITEKEY=0x4AAAAAAAxxxxxxxxxxxxxxxx
TURNSTILE_SECRET_KEY=0x4AAAAAAAxxxxxxxxxxxxxxxx

# Note: Test keys are automatically used for localhost development
# No need to set test keys manually - they're built into the code
```

## Automatic Environment Detection

The system automatically detects your environment:

- **Development (localhost)**: Uses Cloudflare test keys automatically
  - Test Sitekey: `1x00000000000000000000AA` (always passes)
  - Test Secret: `1x0000000000000000000000000000000AA`
- **Production**: Uses your configured environment variables

## Step 3: Testing

### Testing Sitekeys (for development)

Cloudflare provides testing keys that always pass:

- **Test Sitekey**: `1x00000000000000000000AA`
- **Test Secret**: `1x0000000000000000000000000000000AA`

### Production Testing

1. **Deploy your changes** with the real sitekey
2. **Test rate limiting**:
   - Make 10+ requests quickly to trigger rate limiting
   - Verify Turnstile appears when required
   - Complete verification and confirm higher limits

3. **Monitor logs**:
   ```bash
   tail -f logs/security.log | grep -i turnstile
   ```

## Step 4: Security Best Practices

### 🔒 Protect Your Secret Key
- Never expose the secret key in client-side code
- Use environment variables only
- Rotate keys regularly (quarterly recommended)

### 🌐 Domain Restrictions
- Only add domains you control to the widget
- Use separate widgets for dev/staging/production
- Monitor usage in Cloudflare Analytics

### 📊 Monitor Usage
- Check Turnstile Analytics in Cloudflare Dashboard
- Set up alerts for unusual patterns
- Review logs regularly

## Step 5: Advanced Configuration

### Invisible Mode (Default)
The widget runs in invisible mode by default:
- **No user interaction required**: Verification happens automatically
- **Seamless experience**: Users don't see any CAPTCHA interface
- **Mandatory verification**: Chat is blocked until verification completes
- **Auto-retry**: Automatic retry on failure

### Theme Support
The widget automatically adapts to your site's theme:
- **Light mode**: Clean, minimal appearance
- **Dark mode**: Matches dark backgrounds
- **Auto**: Detects system preference

### Mobile Optimization
- Widget is responsive and mobile-friendly
- Works seamlessly on all device sizes
- Touch-friendly when interaction is needed

### Error Handling
The implementation includes comprehensive error handling:
- Network failures with user-friendly messages
- Token validation errors with retry options
- Expired tokens with automatic refresh
- Rate limiting integration with higher limits for verified users

## Troubleshooting

### Common Issues

1. **Widget not appearing**
   - Check sitekey is correct
   - Verify domain is added to widget settings
   - Check browser console for errors

2. **Error 110200 - Domain Configuration Issue** 🔥 **MOST COMMON**
   - **Problem**: Your production domain isn't configured in Cloudflare
   - **Solution**: 
     1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Turnstile**
     2. Click **"Edit"** on your widget
     3. Add your production domain (e.g., `your-app.vercel.app`) to **"Domains"**
     4. Save changes and wait 1-2 minutes for propagation
   - **Check**: Look for `🌐 Current domain:` in browser console to see exact domain
   - **Note**: Each domain/subdomain must be explicitly added

3. **Verification failing (other errors)**
   - Ensure secret key is correct
   - Check server-side validation
   - Verify network connectivity

4. **Rate limiting not working**
   - Check logs for Turnstile validation
   - Verify token is being sent to API
   - Test with and without verification

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
LOG_LEVEL=debug
```

### Testing Commands

```bash
# Test rate limiting
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'

# Test with Turnstile token (replace TOKEN)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}],"turnstileToken":"TOKEN"}'
```

## Benefits

### For Users
- ✅ **Seamless experience** - Only appears when needed
- ✅ **Privacy-friendly** - No tracking or data collection
- ✅ **Fast verification** - Usually completes in <1 second
- ✅ **Accessible** - Works with screen readers and assistive tech

### For Your Site
- 🛡️ **Bot protection** - Blocks automated abuse
- 📈 **Higher limits** - Verified users get 50% more requests
- 📊 **Analytics** - Detailed usage insights
- 🔒 **Security** - Complements existing rate limiting

## Migration from reCAPTCHA

If you're currently using reCAPTCHA, Turnstile is a drop-in replacement:

1. Replace reCAPTCHA script with Turnstile
2. Update sitekey and secret key
3. Minimal code changes required
4. Better user experience and performance

## Support

- [Cloudflare Turnstile Documentation](https://developers.cloudflare.com/turnstile/)
- [Turnstile Community Forum](https://community.cloudflare.com/c/security/turnstile/)
- [Status Page](https://www.cloudflarestatus.com/)

---

**Next Steps**: After setup, monitor your security logs and adjust rate limits based on usage patterns.
