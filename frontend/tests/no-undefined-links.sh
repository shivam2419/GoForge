#!/usr/bin/env bash
# Crawls every public page (incl. sitemap entries) and fails if any href/src/action renders undefined/null/empty.
B=${BASE:-http://localhost:4310}; fail=0
urls="/ /services /work /internship /about /contact /verify /verify?id=X /overview /privacy /terms /refund /admin/login $(curl -s $B/sitemap.xml | grep -o '<loc>[^<]*' | sed 's|<loc>https\?://[^/]*||')"
for u in $(echo $urls | tr ' ' '\n' | sort -u); do
  bad=$(curl -s "$B$u" | grep -oE '(href|src|action)="[^"]*"' | grep -E '="(undefined|null|)"|/undefined|/null"' | sort -u)
  if [ -n "$bad" ]; then echo "FAIL $u: $bad"; fail=1; fi
done
[ "$(curl -s -o /dev/null -w %{http_code} $B/undefined)" = 302 ] || { echo "FAIL /undefined not redirected"; fail=1; }
[ $fail = 0 ] && echo "PASS no undefined links"; exit $fail
