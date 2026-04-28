FROM node:20-alpine

WORKDIR /app

COPY package.json yarn.lock* package-lock.json* ./

RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; fi

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "if [ -f yarn.lock ]; then yarn dev -H 0.0.0.0 -p 3000; else npm run dev -- -H 0.0.0.0 -p 3000; fi"]
