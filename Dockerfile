# Host-agnostic container for the open-aeo hosted MCP server (open-aeo serve).
# Runs on any container host (Fly, Railway, Render, a VPS, ...).
#
#   docker build -t open-aeo .
#   docker run -p 3333:3333 \
#     -e PERPLEXITY_API_KEY=... \
#     -e OPENAI_API_KEY=... \
#     -e OPEN_AEO_HTTP_TOKEN=your-secret \
#     open-aeo
#
# Then point an MCP client at http://host:3333/mcp with
#   Authorization: Bearer your-secret

FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
ENV PORT=3333
EXPOSE 3333
CMD ["node", "dist/index.js", "serve"]
