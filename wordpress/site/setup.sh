#!/bin/sh
# Runs inside the wpcli container (see compose.yaml). Safe to re-run: it installs once,
# then creates or updates each page and the blog post from /site/content.
set -eu

if ! wp core is-installed 2>/dev/null; then
  wp core install --url="$WP_URL" --title="geoLARP" \
    --admin_user="$WP_ADMIN_USER" --admin_password="$WP_ADMIN_PASSWORD" \
    --admin_email="admin@geolarp.invalid" --skip-email
fi

wp option update blogdescription "A steampunk tabletop-style RPG played by walking"
wp option update blog_public 0   # staging: ask search engines to stay away
wp rewrite structure '/%postname%/' --hard
wp theme activate twentytwentyfive
wp post delete $(wp post list --post_type=page --name=sample-page --field=ID) --force 2>/dev/null || true
wp post delete $(wp post list --post_type=post --name=hello-world --field=ID) --force 2>/dev/null || true
wp plugin delete hello akismet 2>/dev/null || true

# upsert_page SLUG TITLE FILE
upsert_page() {
  id=$(wp post list --post_type=page --name="$1" --field=ID --post_status=any | head -n1)
  if [ -n "$id" ]; then
    wp post update "$id" "$3" --post_title="$2" --post_status=publish >/dev/null
  else
    id=$(wp post create "$3" --post_type=page --post_title="$2" --post_name="$1" --post_status=publish --porcelain)
  fi
  echo "$id"
}

home=$(upsert_page home "The street is the board. Your phone is the character sheet." /site/content/home.html)
upsert_page how-it-plays "How it plays" /site/content/how-it-plays.html >/dev/null
upsert_page business-model "What it costs" /site/content/business-model.html >/dev/null
blog=$(upsert_page blog "Blog" /site/content/blog-index.html)

wp option update show_on_front page
wp option update page_on_front "$home"
wp option update page_for_posts "$blog"

# The blog post: the corrected "The World Is the Board".
pid=$(wp post list --post_type=post --name=the-world-is-the-board --field=ID --post_status=any | head -n1)
title="The World Is the Board: What geoLARP Actually Is"
if [ -n "$pid" ]; then
  wp post update "$pid" /site/content/blog-the-world-is-the-board.html --post_title="$title" --post_status=publish >/dev/null
else
  wp post create /site/content/blog-the-world-is-the-board.html --post_title="$title" \
    --post_name=the-world-is-the-board --post_status=publish --post_date="2026-08-22 12:00:00" >/dev/null
fi

# Menu: rebuilt each run so the labels stay in step with this file.
wp menu delete geoLARP 2>/dev/null || true
wp menu create geoLARP >/dev/null
for entry in "home|Home" "how-it-plays|How it plays" "business-model|What it costs" "blog|Blog"; do
  slug=${entry%%|*}; label=${entry#*|}
  wp menu item add-post geoLARP "$(wp post list --post_type=page --name=$slug --field=ID)" --title="$label" >/dev/null
done
wp menu location assign geoLARP primary 2>/dev/null || true

echo "setup done: $WP_URL"
