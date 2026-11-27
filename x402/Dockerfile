# The x402 facilitator needs a long-lived process and outbound TCP on port 20000 to reach
# the Concordium node. A serverless platform cannot promise either, which is why this
# runs on Render as a plain container.
FROM node:22-alpine

WORKDIR /app

# Dependencies first, so a change to the source does not reinstall them.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src

# Render injects PORT; 8080 is the fallback for a local run.
ENV PORT=8080
EXPOSE 8080

# Unprivileged by default in the node image, kept explicit.
USER node

CMD ["node", "src/server.mjs"]
