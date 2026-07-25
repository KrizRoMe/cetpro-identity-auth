FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json ./
RUN pnpm install

COPY tsconfig.json nest-cli.json ./
COPY src ./src

RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "start"]
