# GitHub Pages custom domain recovery / setup

Do **not** rename `CNAME.example` to `CNAME` until GitHub accepts the domain in **Settings → Pages**.

## 1. Verify ownership at the GitHub account level

GitHub profile picture → **Settings** → **Pages** → **Add a domain**.

Add the apex domain:

`avreyanderson.com`

GitHub will show a TXT record similar to:

`_github-pages-challenge-YOURUSERNAME.avreyanderson.com`

Create that exact TXT record at your DNS provider with the exact value GitHub supplies. Keep the TXT record after verification.

If the domain is merely attached to another Pages repository but not verified by another account, successful verification should release it from that other account/repository.

If GitHub says the domain is **already verified by another user or organization**, normal ownership verification cannot release it. Check old GitHub accounts and organizations you control and remove the verified domain there. If you cannot access the account that verified it, use GitHub Support and show that you control DNS.

## 2. DNS for `www.avreyanderson.com`

Apex (`@`) A records:

- `185.199.108.153`
- `185.199.109.153`
- `185.199.110.153`
- `185.199.111.153`

`www` CNAME:

`YOUR_GITHUB_USERNAME.github.io`

Do not set a CNAME at `@` if you are already using GitHub's A records there.

## 3. Attach it to the repository

Repository → **Settings** → **Pages** → **Custom domain**:

`www.avreyanderson.com`

Save it. GitHub may create/update the repository `CNAME` file automatically. If it does not, rename `CNAME.example` to `CNAME`; its only line should be:

`www.avreyanderson.com`

After DNS is healthy, enable **Enforce HTTPS** when GitHub makes the option available.

## 4. Why v0.3 works before the custom domain

All site asset/navigation URLs are repository-relative or dynamically derived from the loaded script URL. Therefore the site works at both:

`https://YOURUSERNAME.github.io/YOUR-REPOSITORY/`

and later:

`https://www.avreyanderson.com/`
