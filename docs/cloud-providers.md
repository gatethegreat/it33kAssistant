# Cloud Provider Guide

This app runs on any Ubuntu/Debian VM. Here's what to pick and what it costs.

## Recommended Specs

| Use Case | CPU | RAM | Disk | Notes |
|----------|-----|-----|------|-------|
| **Light** (1-2 users, few agents) | 1 vCPU | 2 GB | 25 GB | Minimum viable |
| **Standard** (daily use, scheduled runs) | 2 vCPU | 4 GB | 50 GB | Recommended |
| **Heavy** (multiple concurrent agents) | 4 vCPU | 8 GB | 80 GB | For power users |

The app itself is lightweight. Most cost comes from Anthropic API usage, not compute.

## Provider Comparison

### DigitalOcean (Recommended for simplicity)

| Droplet | Specs | Monthly Cost |
|---------|-------|-------------|
| Basic $6 | 1 vCPU / 1 GB / 25 GB | $6/mo |
| Basic $12 | 1 vCPU / 2 GB / 50 GB | $12/mo |
| **Basic $24** | **2 vCPU / 4 GB / 80 GB** | **$24/mo** |
| Basic $48 | 4 vCPU / 8 GB / 160 GB | $48/mo |

**Setup:** Droplets → Create Droplet → Ubuntu 24.04 → Choose size → Add SSH key → Create

**Why DO:** Simplest UI, flat pricing, good docs. The $12 droplet works fine for personal use. $24 is comfortable.

### Google Cloud (Compute Engine)

| Machine Type | Specs | Monthly Cost (est.) |
|-------------|-------|-------------------|
| e2-micro | 0.25 vCPU / 1 GB | ~$7/mo |
| e2-small | 0.5 vCPU / 2 GB | ~$14/mo |
| **e2-medium** | **1 vCPU / 4 GB** | **~$27/mo** |
| e2-standard-2 | 2 vCPU / 8 GB | ~$49/mo |

**Setup:** Compute Engine → Create Instance → Ubuntu 24.04 → Choose machine type → Allow HTTP/HTTPS → Create

**Why GCE:** Free tier includes 1 e2-micro instance. Good if you're already in the Google ecosystem. Pricing is more complex (per-second billing, sustained use discounts).

**Note:** Make sure to check "Allow HTTP traffic" and "Allow HTTPS traffic" in the firewall settings during creation, or the setup script's nginx won't be reachable.

### AWS (EC2)

| Instance Type | Specs | Monthly Cost (est.) |
|--------------|-------|-------------------|
| t3.micro | 2 vCPU / 1 GB | ~$8/mo |
| t3.small | 2 vCPU / 2 GB | ~$15/mo |
| **t3.medium** | **2 vCPU / 4 GB** | **~$30/mo** |
| t3.large | 2 vCPU / 8 GB | ~$60/mo |

**Setup:** EC2 → Launch Instance → Ubuntu 24.04 AMI → Choose instance type → Configure security group (allow 22, 80, 443) → Add SSH key → Launch

**Why AWS:** Free tier for 12 months (t3.micro). Best if you already have an AWS account. More complex setup than DO.

**Watch out for:** EBS storage costs extra (~$0.08/GB/mo). Security groups need manual port config. Elastic IP is free while attached, $3.65/mo if detached.

### Hetzner (Best value)

| Server | Specs | Monthly Cost |
|--------|-------|-------------|
| CX22 | 2 vCPU / 4 GB / 40 GB | €4.51/mo (~$5) |
| **CX32** | **4 vCPU / 8 GB / 80 GB** | **€7.69/mo (~$8)** |
| CX42 | 8 vCPU / 16 GB / 160 GB | €14.69/mo (~$16) |

**Setup:** Cloud Console → Add Server → Ubuntu 24.04 → Choose type → Add SSH key → Create

**Why Hetzner:** By far the cheapest. A CX32 at ~$8/mo gives you 4 vCPU / 8 GB — that's what you'd pay $48/mo for on DO. EU-based (Germany/Finland), so latency may be higher from US.

### Vultr

| Plan | Specs | Monthly Cost |
|------|-------|-------------|
| Cloud Compute | 1 vCPU / 2 GB / 50 GB | $12/mo |
| **Cloud Compute** | **2 vCPU / 4 GB / 100 GB** | **$24/mo** |
| Cloud Compute | 4 vCPU / 8 GB / 200 GB | $48/mo |

**Setup:** Products → Compute → Deploy Server → Ubuntu 24.04 → Choose plan → Add SSH key → Deploy

**Why Vultr:** Similar to DO in simplicity. More datacenter locations. Competitive pricing.

## DNS Setup (Cloudflare)

We recommend Cloudflare for DNS (free plan works). Here's the setup:

### Before running setup.sh

1. Add your domain to Cloudflare (or use it as DNS-only)
2. Create an **A record**:
   - **Name:** Your subdomain (e.g., `ai` for `ai.yourdomain.com`)
   - **Content:** Your server's IP address
   - **Proxy status:** **DNS only** (grey cloud) — this is critical for SSL setup
3. Wait 1-2 minutes for propagation

### After setup.sh completes

1. Go back to Cloudflare DNS settings
2. Click the grey cloud next to your A record to turn it **orange** (Proxied)
3. This enables Cloudflare's CDN, DDoS protection, and WAF

### Why grey cloud during setup?

Certbot (Let's Encrypt) needs to reach your server directly over port 80 to verify you own the domain. Cloudflare's proxy intercepts this and Certbot fails. Once the certificate is installed, Cloudflare's proxy works fine — it'll handle HTTPS termination and forward to your origin.

### If you skipped SSL during setup

```bash
# 1. Make sure Cloudflare proxy is OFF (grey cloud)
# 2. Run Certbot
sudo certbot --nginx -d yourdomain.com
# 3. Turn Cloudflare proxy back ON (orange cloud)
```

## Cost Summary

Your total monthly cost is **server + API usage**:

| Component | Cost |
|-----------|------|
| Server (DO $12 plan) | ~$12/mo |
| Supabase (free tier) | $0 |
| Cloudflare (free plan) | $0 |
| Anthropic API | Pay-per-use (varies) |
| **Total fixed cost** | **~$12/mo** |

Anthropic API costs depend on usage. A typical agent run costs $0.02–$0.50 depending on complexity. Budget $10–50/mo for moderate personal use.
