# Co-op WordPress base image: pinned WordPress + PHP, WP-CLI, hardened defaults.
# No secrets baked in: every credential and URL arrives as an environment variable
# (WORDPRESS_DB_HOST, WORDPRESS_DB_USER, WORDPRESS_DB_PASSWORD, WORDPRESS_DB_NAME,
# WORDPRESS_CONFIG_EXTRA), and everything that changes lives in the /var/www/html volume.
#
#   docker build -t chattanooga-digital/wordpress-base:7.1-php8.3 wordpress/base
#
# Both parents are pinned by digest. To update, pull the new tag, copy its digest here,
# rebuild and re-run the site's proof.

FROM wordpress:cli-php8.3@sha256:a4fff017eb08c03187e90fe52d4bff8d3a4d4a5103de05829a6e747c4ca3056e AS wpcli

FROM wordpress:7.1-php8.3-apache@sha256:9001ea7dafd2bc3f05d068e6413b0edd2a116eeed4dfe9e08b6bd718dee4960a

LABEL org.opencontainers.image.title="wordpress-base" \
      org.opencontainers.image.description="Clean WordPress 7.1 on PHP 8.3 with WP-CLI and hardened defaults, for co-op sites" \
      org.opencontainers.image.source="https://github.com/TortoiseWolfe/geolarp/tree/main/wordpress/base"

# WP-CLI, copied from the official CLI image rather than downloaded.
COPY --from=wpcli /usr/local/bin/wp /usr/local/bin/wp

# Hardened defaults: hide versions, send the usual security headers, upload limits that fit
# a small site, and no PHP error text on the page.
COPY hardening.conf /etc/apache2/conf-available/zz-coop-hardening.conf
COPY hardening.ini /usr/local/etc/php/conf.d/zz-coop-hardening.ini
RUN a2enmod headers && a2enconf zz-coop-hardening

# The official entrypoint copies WordPress into the volume on first start; the site then
# runs as www-data (uid 33), the same user WP-CLI should use: docker run --user 33:33.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -fsS -o /dev/null http://127.0.0.1/wp-includes/images/blank.gif || exit 1
