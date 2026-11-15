# GeoLARP WordPress test site

A local staging copy of the GeoLARP marketing site on the co-op WordPress base image.
It listens on 127.0.0.1 only. No public address, no DNS, no live data.

## Bring it up

From this folder:

    ./make-env.sh
    docker compose -p geolarp-wp up -d --build
    docker compose -p geolarp-wp --profile seed run --rm wpcli sh /site/setup.sh

Then open http://127.0.0.1:8095 (port set by `WP_PORT` in `.env`).

Screenshots of every page: `./screenshots.sh OUT_DIR`.

Remove everything, data included:

    docker compose -p geolarp-wp down -v

`make-env.sh` writes `.env` with throwaway passwords. It is gitignored. Do not paste it anywhere.

## What is in it

- `base/` the co-op WordPress base image: WordPress 7.1 on PHP 8.3 (Apache), WP-CLI 2.12, both parents pinned by digest.
- `compose.yaml` the site: base image, MariaDB 11.4 (pinned), a seed-only WP-CLI service.
- `site/setup.sh` installs WordPress and creates the pages and the blog post from `site/content/`.
- `site/mu-plugins/` the brass style, loaded as a must-use plugin.

Pages: Home, How it plays, What it costs, Blog, and the post "The World Is the Board".
Search engines are told to stay away (`blog_public=0`).

## Hardening in the base image

- Server and PHP versions hidden (ServerTokens Prod, expose_php off).
- Security headers on every response.
- `wp-config.php` returns 403.
- PHP errors never print on the page; upload limits sized for a small site.
- File editor in the dashboard disabled; environment type set to staging.
- Healthcheck on the web container.
- No secrets in the image: every credential arrives as an environment variable.

## Updating the pinned versions

Pull the new tag, copy its digest into `base/Dockerfile` (or the MariaDB line in `compose.yaml`),
rebuild with `up -d --build`, then re-run the seed and check each page returns 200.
