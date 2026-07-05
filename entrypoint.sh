#!/bin/sh
# Runtime substitution of NEXT_PUBLIC_* build-time placeholders.
#
# `next build` inlines NEXT_PUBLIC_* values into the emitted bundles, which
# would tie a Docker image to one environment. To keep one image runnable in
# every environment ("One image, multiple environments" — CONCEPT.md in
# 21gifts/api), the image is built with literal placeholders of the form
# __NEXT_PUBLIC_FOO__ and this script replaces them with the runtime values
# of the corresponding environment variables at container start.
#
# Fail-loud contract: if the running environment does not provide a value for
# a placeholder present in the build output, the container refuses to start.
# An empty value counts as missing — a silently empty API URL would only
# surface as broken requests much later.
#
# Substitution happens in place, so it applies once per container lifetime;
# recreate the container (do not restart it with different env) to change
# configuration.

set -eu

SEARCH_PATHS='/app/.next /app/server.js'

for path in $SEARCH_PATHS; do
  if [ ! -e "$path" ]; then
    echo "entrypoint.sh: expected build output '$path' is missing" >&2
    exit 1
  fi
done

# shellcheck disable=SC2086 # SEARCH_PATHS is a deliberate word-split list
placeholders=$(grep -rhoE '__NEXT_PUBLIC_[A-Z0-9_]+__' $SEARCH_PATHS | sort -u) || placeholders=''

for placeholder in $placeholders; do
  var_name=${placeholder#__}
  var_name=${var_name%__}

  eval "value=\${${var_name}:-}"
  if [ -z "$value" ]; then
    echo "entrypoint.sh: ${var_name} is unset or empty, but the build output references ${placeholder}. Refusing to start." >&2
    exit 1
  fi

  case $value in
    *'|'* | *'&'* | *'\'*)
      echo "entrypoint.sh: ${var_name} contains '|', '&' or '\\', which the sed substitution cannot escape. Refusing to start." >&2
      exit 1
      ;;
  esac

  # shellcheck disable=SC2086 # SEARCH_PATHS is a deliberate word-split list
  grep -rlF "$placeholder" $SEARCH_PATHS | while IFS= read -r file; do
    sed -i "s|${placeholder}|${value}|g" "$file"
  done

  echo "entrypoint.sh: substituted ${placeholder} with the value of ${var_name}"
done

exec "$@"
