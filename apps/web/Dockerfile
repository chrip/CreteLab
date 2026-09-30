# CreteLab web: the static Nuxt site behind nginx, which also proxies /api to the API service.
# Build context is the repository root (the web app depends on packages/engine).
FROM node:22-slim AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts
COPY packages/engine packages/engine
COPY apps/web apps/web
ARG NUXT_PUBLIC_SITE_URL=http://localhost:8080
# The public address, for canonical and hreflang links (compose passes SITE_URL).
ENV NUXT_PUBLIC_SITE_URL=$NUXT_PUBLIC_SITE_URL
# Legal notice, from .env (compose passes them); baked into the static pages.
ARG NUXT_PUBLIC_LEGAL_NAME="" NUXT_PUBLIC_LEGAL_STREET="" NUXT_PUBLIC_LEGAL_CITY="" NUXT_PUBLIC_LEGAL_COUNTRY="" \
    NUXT_PUBLIC_LEGAL_EMAIL="" NUXT_PUBLIC_LEGAL_HOSTING=""
ENV NUXT_PUBLIC_LEGAL_NAME=$NUXT_PUBLIC_LEGAL_NAME NUXT_PUBLIC_LEGAL_STREET=$NUXT_PUBLIC_LEGAL_STREET \
    NUXT_PUBLIC_LEGAL_CITY=$NUXT_PUBLIC_LEGAL_CITY NUXT_PUBLIC_LEGAL_COUNTRY=$NUXT_PUBLIC_LEGAL_COUNTRY \
    NUXT_PUBLIC_LEGAL_EMAIL=$NUXT_PUBLIC_LEGAL_EMAIL \
    NUXT_PUBLIC_LEGAL_HOSTING=$NUXT_PUBLIC_LEGAL_HOSTING
RUN npm run build -w apps/web

FROM nginx:1.29-alpine
COPY apps/web/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY apps/web/nginx/security.conf /etc/nginx/snippets/security.conf
COPY --from=build /repo/apps/web/.output/csp.conf /etc/nginx/snippets/csp.conf
COPY --from=build /repo/apps/web/.output/public /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/de >/dev/null || exit 1
